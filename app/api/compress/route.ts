import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { writeFile, unlink, readFile, rm, stat, mkdir, rename } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { applyRateLimit } from '@/lib/rateLimit';
import { requireVideoSizeAllowed, VIDEO_SIZE_LIMITS } from '@/lib/requirePro';
import { getTier } from '@/lib/rateLimit';
import { smartCompress } from '@/lib/smartCompress';

const execAsync = promisify(exec);

export const runtime = 'nodejs';
export const maxDuration = 60; // video path returns 202 immediately; image path is fast

const IMAGE_MAX_BYTES = 50 * 1024 * 1024; // 50 MB — same across all tiers

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let file: File | null = null;
    let qualityRaw: string | null = null;
    let outputFormat = 'mp4';
    let outputImageFormat = 'auto';

    let chunkedFilePath: string | null = null;
    let chunkedFileSize = 0;
    let chunkedFileName = 'video.mp4';
    let uploadId: string | null = null;

    if (contentType.includes('application/json')) {
      const body = await req.json();
      uploadId = body.uploadId;
      qualityRaw = String(body.quality ?? 80);
      outputFormat = body.outputFormat || 'mp4';

      if (!uploadId) return NextResponse.json({ error: 'Missing uploadId' }, { status: 400 });

      const uploadDir = join('/tmp', 'uploads', uploadId);
      const metadata = JSON.parse(await readFile(join(uploadDir, 'metadata.json'), 'utf-8'));
      chunkedFilePath = join(uploadDir, 'combined');
      chunkedFileSize = (await stat(chunkedFilePath)).size;
      chunkedFileName = metadata.filename || 'video.mp4';
    } else {
      const formData = await req.formData();
      file = formData.get('file') as File | null;
      qualityRaw = formData.get('quality') as string | null;
      outputFormat = (formData.get('outputFormat') as string | null) || 'mp4';
      outputImageFormat = (formData.get('outputImageFormat') as string | null) || 'auto';
    }

    if (!file && !chunkedFilePath) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Tier-aware rate limiting (limits come from TIER_LIMITS in lib/session.ts).
    // X-User-Tier is injected by proxy.ts from the session cookie.
    const limited = await applyRateLimit(req);
    if (limited) return limited;

    if (!chunkedFilePath) {
      if (file!.type === 'image/heic' || file!.type === 'image/heif' ||
          file!.name.toLowerCase().endsWith('.heic') || file!.name.toLowerCase().endsWith('.heif')) {
        return NextResponse.json({ error: 'HEIC files are converted in your browser automatically. Please refresh the page and try again.' }, { status: 415 });
      }
      if (!file!.type.startsWith('image/') && !file!.type.startsWith('video/')) {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
      }
    }

    const isImage = !chunkedFilePath && file!.type.startsWith('image/');

    // ── IMAGE: Sharp (synchronous — fast enough for direct response) ────────
    if (isImage && file) {
      if (file.size > IMAGE_MAX_BYTES) {
        return NextResponse.json({ error: 'Image too large. Max 50MB.' }, { status: 413 });
      }

      const quality = Math.min(100, Math.max(1, parseInt(qualityRaw || '80', 10)));
      const lossless = quality === 100;
      const buffer = Buffer.from(await file.arrayBuffer());

      let compressed: Buffer;
      let outputMime: string;
      let smartContentType: string | undefined;
      let smartChroma: string | undefined;
      let smartQuality: number | undefined;
      let smartSharpened: boolean | undefined;

      // Smart pipeline: analyse image content, pick per-image settings.
      // Only activates for JPEG output (where the per-content settings apply)
      // and when the user hasn't requested lossless (quality=100).
      const wantJpeg =
        outputImageFormat === 'jpg' ||
        (outputImageFormat === 'auto' &&
          (file.type === 'image/jpeg' || file.type === 'image/jpg'));

      if (process.env.SMART_COMPRESS === 'true' && wantJpeg && !lossless) {
        try {
          const result = await smartCompress(buffer, file.type);
          compressed = result.outputBuffer;
          outputMime = 'image/jpeg';
          smartContentType = result.contentType;
          smartChroma = result.settings.chromaSubsampling;
          smartQuality = result.settings.jpegQuality;
          smartSharpened = result.settings.sharpenBeforeCompress;
          console.log(
            `[smart] ${result.contentType} ` +
            `q=${result.settings.jpegQuality} ` +
            `chroma=${result.settings.chromaSubsampling} ` +
            `saved=${result.savingsPercent.toFixed(1)}%`,
          );
        } catch (smartErr) {
          // Degrade gracefully — fall through to the standard JPEG path
          console.warn('[smart] analysis failed, using standard pipeline:', smartErr);
          compressed = await sharp(buffer).jpeg({ quality, mozjpeg: true }).toBuffer();
          outputMime = 'image/jpeg';
        }
      } else if (outputImageFormat === 'jpg') {
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
        compressed = await sharp(buffer).jpeg({ quality, mozjpeg: true }).toBuffer();
        outputMime = 'image/jpeg';
      } else {
        compressed = await sharp(buffer).webp({ quality }).toBuffer();
        outputMime = 'image/webp';
      }

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

      const responseHeaders: Record<string, string> = {
        'Content-Type': outputMime,
        'X-Original-Size': String(buffer.length),
        'X-Compressed-Size': String(compressed.length),
        'X-Already-Optimized': 'false',
      };
      if (smartContentType) {
        responseHeaders['X-Smart-Content-Type'] = smartContentType;
        responseHeaders['X-Smart-Chroma'] = smartChroma!;
        responseHeaders['X-Smart-Quality'] = String(smartQuality!);
        responseHeaders['X-Smart-Sharpened'] = String(smartSharpened!);
      }
      return new NextResponse(new Uint8Array(compressed), { headers: responseHeaders });
    }

    // ── VIDEO: async FFmpeg job — returns 202 immediately ──────────────────
    const videoSize = chunkedFilePath ? chunkedFileSize : file!.size;

    // Enforce per-tier video size limit (free=600MB, pro=2GB, enterprise=5GB).
    const sizeDenied = requireVideoSizeAllowed(req, videoSize);
    if (sizeDenied) return sizeDenied;

    // Hard ceiling — no single plan supports beyond 5 GB.
    const absoluteMax = VIDEO_SIZE_LIMITS[getTier(req)];
    if (videoSize > absoluteMax) {
      return NextResponse.json({ error: 'Video exceeds the maximum allowed size for your plan.' }, { status: 413 });
    }

    const videoName = chunkedFilePath ? chunkedFileName : file!.name;
    const safeVideoName = videoName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const useWebM = outputFormat === 'webm';
    const outputExt = useWebM ? 'webm' : 'mp4';
    const outputMime = useWebM ? 'video/webm' : 'video/mp4';

    // Original file mime — needed for smart skip (serving original instead of larger output)
    const origExt = videoName.split('.').pop()?.toLowerCase() || 'mp4';
    const origMimeMap: Record<string, string> = {
      mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
      avi: 'video/x-msvideo', mkv: 'video/x-matroska', m4v: 'video/mp4',
    };
    const originalMime = origMimeMap[origExt] || 'video/mp4';

    const jobId = randomUUID();
    const jobDir = join('/tmp', 'jobs', jobId);
    const outputPath = join(jobDir, `output.${outputExt}`);
    const progressPath = join(jobDir, 'progress');
    const outputFilename = videoName.replace(/\.[^.]+$/, '') + `-compressed.${outputExt}`;

    const tempPath = chunkedFilePath ?? join('/tmp', `${jobId}-${safeVideoName}`);

    try {
      if (!chunkedFilePath) {
        await writeFile(tempPath, Buffer.from(await file!.arrayBuffer()));
      }

      // Get duration for progress tracking (best-effort)
      let durationMs = 0;
      try {
        const { stdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempPath}"`,
          { timeout: 10_000 }
        );
        durationMs = Math.round(parseFloat(stdout.trim()) * 1000);
      } catch {}

      await mkdir(jobDir, { recursive: true });
      await writeFile(join(jobDir, 'job.json'), JSON.stringify({
        status: 'processing',
        inputPath: tempPath,
        outputPath,
        outputFilename,
        outputMime,
        originalFilename: videoName,
        originalMime,
        originalSize: videoSize,
        durationMs,
        uploadId,
        isChunked: !!chunkedFilePath,
        createdAt: new Date().toISOString(),
      }));

      // CRF 32 at default quality (80). Range 24–40: higher quality → lower CRF → bigger file.
      const q = Math.min(100, Math.max(1, parseInt(qualityRaw || '80', 10)));
      const crf = Math.max(24, Math.min(40, Math.round(32 + (80 - q) / 10)));

      const ffmpegArgs = [
        '-loglevel', 'error',
        '-progress', progressPath,
        '-nostats',
        '-i', tempPath,
        ...(useWebM
          ? ['-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0', '-c:a', 'libopus', '-b:a', '64k']
          : [
              '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', String(crf),
              '-vf', 'scale=-2:-2',       // ensure even dimensions (required by H.264)
              '-c:a', 'aac', '-b:a', '64k',
              '-maxrate', '1M', '-bufsize', '2M',
              '-movflags', '+faststart',
            ]
        ),
        outputPath,
      ];

      console.log(`[job:${jobId}] start – ${(videoSize / 1024 / 1024).toFixed(0)} MB crf=${crf}`);

      // Capture stderr so we can include FFmpeg error messages in job state
      const stderrChunks: Buffer[] = [];
      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      ffmpegProcess.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      ffmpegProcess.on('close', async (code) => {
        const jobFile = join(jobDir, 'job.json');
        const stderrText = Buffer.concat(stderrChunks).toString('utf-8').trim();
        if (stderrText) console.error(`[job:${jobId}] FFmpeg stderr:`, stderrText);

        try {
          const job = JSON.parse(await readFile(jobFile, 'utf-8'));

          let failReason: string | null = null;
          let outSize = 0;

          if (code !== 0) {
            failReason = stderrText || `FFmpeg exited with code ${code}`;
          } else {
            // Verify output file exists and has a reasonable size
            try { outSize = (await stat(outputPath)).size; } catch { failReason = 'Output file missing after encode'; }
            if (!failReason && outSize < 1024) {
              failReason = `Output file too small (${outSize} bytes) — FFmpeg may have failed silently`;
            }

            // Validate the output is a playable video via ffprobe
            if (!failReason) {
              try {
                await execAsync(
                  `ffprobe -v error -select_streams v:0 -show_entries stream=codec_type -of csv=p=0 "${outputPath}"`,
                  { timeout: 15_000 }
                );
              } catch {
                failReason = 'Output file is not a valid video (ffprobe validation failed)';
              }
            }
          }

          if (failReason) {
            console.error(`[job:${jobId}] failed: ${failReason}`);
            try { await unlink(outputPath); } catch {}
            await writeFile(jobFile, JSON.stringify({ ...job, status: 'error', error: failReason }));
            // Clean up input on failure
            if (uploadId && chunkedFilePath) {
              try { await rm(join('/tmp', 'uploads', uploadId), { recursive: true, force: true }); } catch {}
            } else {
              try { await unlink(tempPath); } catch {}
            }
          } else if (outSize >= videoSize) {
            // Smart skip: output is larger than input — serve original instead
            console.log(`[job:${jobId}] output (${outSize}) >= input (${videoSize}), serving original`);
            try { await unlink(outputPath); } catch {} // discard the bloated output
            // Move the original input into the job directory (instant rename on same fs)
            const origOutputPath = join(jobDir, `original.${origExt}`);
            await rename(tempPath, origOutputPath);
            await writeFile(jobFile, JSON.stringify({
              ...job,
              status: 'complete',
              outputPath: origOutputPath,
              outputFilename: videoName,
              outputMime: originalMime,
              alreadyOptimized: true,
            }));
            // Clean up upload dir shell (combined file was just moved out)
            if (uploadId && chunkedFilePath) {
              try { await rm(join('/tmp', 'uploads', uploadId), { recursive: true, force: true }); } catch {}
            }
          } else {
            console.log(`[job:${jobId}] complete — saved ${Math.round((1 - outSize / videoSize) * 100)}%`);
            await writeFile(jobFile, JSON.stringify({ ...job, status: 'complete' }));
            // Clean up input
            if (uploadId && chunkedFilePath) {
              try { await rm(join('/tmp', 'uploads', uploadId), { recursive: true, force: true }); } catch {}
            } else {
              try { await unlink(tempPath); } catch {}
            }
          }
        } catch (e) {
          console.error(`[job:${jobId}] job update error:`, e);
        }
      });

      return NextResponse.json({ jobId, status: 'processing' }, { status: 202 });

    } catch (err) {
      // Setup failed before spawn — clean up input
      if (uploadId && chunkedFilePath) {
        try { await rm(join('/tmp', 'uploads', uploadId), { recursive: true, force: true }); } catch {}
      } else {
        try { await unlink(tempPath); } catch {}
      }
      throw err;
    }

  } catch (err) {
    console.error('Compress error:', err);
    return NextResponse.json({ error: 'Compression failed' }, { status: 500 });
  }
}
