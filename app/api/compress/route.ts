import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { writeFile, unlink } from 'fs/promises';
import { promisify } from 'util';
import { exec } from 'child_process';
import { createHash } from 'crypto';
import { checkRateLimit } from '@/lib/redis';

const execAsync = promisify(exec);

export const runtime = 'nodejs';
export const maxDuration = 600;

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;  // 10MB
const VIDEO_MAX_BYTES = 500 * 1024 * 1024; // 500MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const qualityRaw = formData.get('quality') as string | null;
    const outputFormat = (formData.get('outputFormat') as string | null) || 'mp4';

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

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // ── IMAGE: Sharp server-side compression ────────────────────────────────
    if (isImage) {
      if (file.size > IMAGE_MAX_BYTES) {
        return NextResponse.json({ error: 'Image too large. Max 10MB.' }, { status: 413 });
      }

      const quality = Math.min(100, Math.max(1, parseInt(qualityRaw || '80', 10)));
      const buffer = Buffer.from(await file.arrayBuffer());

      let compressed: Buffer;
      let outputMime: string;

      if (file.type === 'image/png') {
        compressed = await sharp(buffer).webp({ quality }).toBuffer();
        outputMime = 'image/webp';
      } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        compressed = await sharp(buffer).jpeg({ quality, mozjpeg: true }).toBuffer();
        outputMime = 'image/jpeg';
      } else {
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

    const fileId = `${Date.now()}-${createHash('sha256').update(file.name).digest('hex').slice(0, 8)}`;
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempPath = `/tmp/${fileId}-${safeFileName}`;
    const useWebM = outputFormat === 'webm';
    const outputExt = useWebM ? 'webm' : 'mp4';
    const outputPath = `/tmp/${fileId}-compressed.${outputExt}`;

    try {
      await writeFile(tempPath, Buffer.from(await file.arrayBuffer()));

      const ffmpegCmd = useWebM
        ? `ffmpeg -i "${tempPath}" -c:v libvpx-vp9 -crf ${crf} -b:v 0 -c:a libopus -b:a 128k "${outputPath}"`
        : `ffmpeg -i "${tempPath}" -c:v libx264 -crf ${crf} -preset ${ffmpegPreset} -c:a aac -b:a 128k -movflags +faststart "${outputPath}"`;

      await execAsync(ffmpegCmd);

      const { readFile } = await import('fs/promises');
      const compressedBuffer = await readFile(outputPath);
      const originalSize = file.size;
      const compressedSize = compressedBuffer.length;
      const savings = Math.round((1 - compressedSize / originalSize) * 100);
      const outputMime = useWebM ? 'video/webm' : 'video/mp4';
      const outName = file.name.replace(/\.[^.]+$/, '') + `-compressed.${outputExt}`;

      return new NextResponse(compressedBuffer, {
        headers: {
          'Content-Type': outputMime,
          'Content-Disposition': `attachment; filename="${outName}"`,
          'X-Original-Size': String(originalSize),
          'X-Compressed-Size': String(compressedSize),
          'X-Savings': String(savings),
          'Cache-Control': 'no-store',
        },
      });
    } finally {
      try { await unlink(tempPath); } catch {}
      try { await unlink(outputPath); } catch {}
    }

  } catch (err) {
    console.error('Compression error:', err);
    return NextResponse.json({ error: 'Compression failed' }, { status: 500 });
  }
}
