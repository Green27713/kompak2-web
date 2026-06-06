import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { writeFile, unlink, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { createHash } from 'crypto';
import { checkRateLimit } from '@/lib/redis';

const execAsync = promisify(exec);

export const runtime = 'nodejs';
export const maxDuration = 600;

const IMAGE_MAX_BYTES = 50 * 1024 * 1024;  // 50MB
const VIDEO_MAX_BYTES = 500 * 1024 * 1024; // 500MB

export async function POST(req: NextRequest) {
  let uploadId: string | null = null;

  try {
    const contentType = req.headers.get('content-type') || '';
    let file: File | null = null;
    let qualityRaw: string | null = null;
    let outputFormat = 'mp4';
    let outputImageFormat = 'auto';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      uploadId = body.uploadId;
      qualityRaw = String(body.quality ?? 80);
      outputFormat = body.outputFormat || 'mp4';

      if (!uploadId) return NextResponse.json({ error: 'Missing uploadId' }, { status: 400 });

      const uploadDir = join('/tmp', 'uploads', uploadId);
      const metadata = JSON.parse(await readFile(join(uploadDir, 'metadata.json'), 'utf-8'));
      const fileBuffer = await readFile(join(uploadDir, 'combined'));
      file = new File([fileBuffer], metadata.filename || 'video.mp4', { type: 'video/mp4' });
    } else {
      const formData = await req.formData();
      file = formData.get('file') as File | null;
      qualityRaw = formData.get('quality') as string | null;
      outputFormat = (formData.get('outputFormat') as string | null) || 'mp4';
      outputImageFormat = (formData.get('outputImageFormat') as string | null) || 'auto';
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Rate limiting — Redis down means we allow the request
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
               req.headers.get('x-real-ip') || 'anonymous';
    let rateLimit = { allowed: true, remaining: 99, resetIn: 60000 };
    try {
      rateLimit = await checkRateLimit(`compress:${ip}`, 100, 60 * 1000);
    } catch {
      // Redis unavailable — allow request without rate limiting
    }
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // HEIC/HEIF must be converted to JPEG client-side — Sharp won't have the codec
    if (file.type === 'image/heic' || file.type === 'image/heif' ||
        file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
      return NextResponse.json({ error: 'HEIC files are converted in your browser automatically. Please refresh the page and try again.' }, { status: 415 });
    }

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // ── IMAGE: Sharp server-side compression ────────────────────────────────
    if (isImage) {
      if (file.size > IMAGE_MAX_BYTES) {
        return NextResponse.json({ error: 'Image too large. Max 50MB.' }, { status: 413 });
      }

      const quality = Math.min(100, Math.max(1, parseInt(qualityRaw || '80', 10)));
      const lossless = quality === 100;
      const buffer = Buffer.from(await file.arrayBuffer());

      let compressed: Buffer;
      let outputMime: string;

      // Explicit format requested (convert mode) — honour it
      if (outputImageFormat === 'jpg') {
        compressed = await sharp(buffer).jpeg({ quality, mozjpeg: !lossless }).toBuffer();
        outputMime = 'image/jpeg';
      } else if (outputImageFormat === 'png') {
        compressed = await sharp(buffer).png({ compressionLevel: lossless ? 0 : 6 }).toBuffer();
        outputMime = 'image/png';
      } else if (outputImageFormat === 'webp') {
        compressed = lossless
          ? await sharp(buffer).webp({ lossless: true }).toBuffer()
          : await sharp(buffer).webp({ quality }).toBuffer();
        outputMime = 'image/webp';
      } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        // Auto: JPEG → JPEG (compress mode default)
        compressed = await sharp(buffer).jpeg({ quality, mozjpeg: true }).toBuffer();
        outputMime = 'image/jpeg';
      } else {
        // Auto: everything else → WebP (best compression)
        compressed = await sharp(buffer).webp({ quality }).toBuffer();
        outputMime = 'image/webp';
      }

      // Never return a file larger than the original
      if (compressed.length >= buffer.length) {
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            'Content-Type': file.type,
            'X-Original-Size': String(buffer.length),
            'X-Compressed-Size': String(buffer.length),
            'X-Already-Optimized': 'true',
          },
        });
      }

      return new NextResponse(new Uint8Array(compressed), {
        headers: {
          'Content-Type': outputMime,
          'X-Original-Size': String(buffer.length),
          'X-Compressed-Size': String(compressed.length),
          'X-Already-Optimized': 'false',
        },
      });
    }

    // ── VIDEO: FFmpeg server-side compression ────────────────────────────────
    if (file.size > VIDEO_MAX_BYTES) {
      return NextResponse.json({ error: 'Video too large. Max 500MB.' }, { status: 413 });
    }

    // Map quality (1-100) or preset string to CRF + FFmpeg preset
    let crf: number;
    let ffmpegPreset: string;
    if (qualityRaw === 'high')        { crf = 18; ffmpegPreset = 'slow'; }
    else if (qualityRaw === 'medium') { crf = 23; ffmpegPreset = 'medium'; }
    else if (qualityRaw === 'low')    { crf = 28; ffmpegPreset = 'fast'; }
    else {
      const q = Math.min(100, Math.max(1, parseInt(qualityRaw || '80', 10)));
      crf = Math.round(18 + (1 - q / 100) * 10); // quality 100 → CRF 18, quality 1 → CRF 28
      ffmpegPreset = q >= 80 ? 'slow' : q >= 50 ? 'medium' : 'fast';
    }

    // Cap preset for large files — slow/medium presets use too much RAM on 1GB droplets
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 100 && ffmpegPreset === 'slow')   ffmpegPreset = 'veryfast';
    if (sizeMB > 200 && ffmpegPreset === 'medium') ffmpegPreset = 'veryfast';

    const fileId = `${Date.now()}-${createHash('sha256').update(file.name).digest('hex').slice(0, 8)}`;
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempPath = `/tmp/${fileId}-${safeFileName}`;
    const useWebM = outputFormat === 'webm';
    const outputExt = useWebM ? 'webm' : 'mp4';
    const outputPath = `/tmp/${fileId}-compressed.${outputExt}`;

    let inputDeleted = false;
    let outputStreaming = false;

    try {
      await writeFile(tempPath, Buffer.from(await file.arrayBuffer()));

      // -loglevel error: suppress frame-by-frame progress output — default 1MB maxBuffer
      // overflows on long encodes (267MB video generates megabytes of stderr progress lines)
      const ffmpegCmd = useWebM
        ? `ffmpeg -loglevel error -i "${tempPath}" -c:v libvpx-vp9 -crf ${crf} -b:v 0 -c:a libopus -b:a 128k "${outputPath}"`
        : `ffmpeg -loglevel error -i "${tempPath}" -c:v libx264 -crf ${crf} -preset ${ffmpegPreset} -c:a aac -b:a 128k -movflags +faststart "${outputPath}"`;

      await execAsync(ffmpegCmd, { maxBuffer: 10 * 1024 * 1024 });

      // Input no longer needed — free disk space before streaming response
      try { await unlink(tempPath); inputDeleted = true; } catch {}

      const { stat } = await import('fs/promises');
      const { createReadStream } = await import('fs');
      const { Readable } = await import('stream');

      const fileStat = await stat(outputPath);
      const outputSize = fileStat.size;
      const originalSize = file.size;
      const savings = Math.max(0, Math.round((1 - outputSize / originalSize) * 100));
      const outputMime = useWebM ? 'video/webm' : 'video/mp4';
      const outName = file.name.replace(/\.[^.]+$/, '') + `-compressed.${outputExt}`;

      // Stream directly from disk — avoids loading the whole file into RAM
      const nodeStream = createReadStream(outputPath);
      nodeStream.on('close', async () => { try { await unlink(outputPath); } catch {} });

      outputStreaming = true;
      return new NextResponse(Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>, {
        headers: {
          'Content-Type': outputMime,
          'Content-Disposition': `attachment; filename="${outName}"`,
          'Content-Length': String(outputSize),
          'X-Original-Size': String(originalSize),
          'X-Compressed-Size': String(outputSize),
          'X-Savings': String(savings),
          'Cache-Control': 'no-store',
        },
      });
    } finally {
      if (!inputDeleted)    { try { await unlink(tempPath); }  catch {} }
      if (!outputStreaming) { try { await unlink(outputPath); } catch {} }
      if (uploadId) { try { await rm(join('/tmp', 'uploads', uploadId), { recursive: true, force: true }); } catch {} }
    }

  } catch (err) {
    console.error('Compression error:', err);
    return NextResponse.json({ error: 'Compression failed' }, { status: 500 });
  }
}
