import { NextRequest, NextResponse } from 'next/server';
import { readFile, rm, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { join } from 'path';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface JobState {
  status: string;
  outputPath: string;
  outputFilename: string;
  outputMime: string;
  originalSize: number;
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId || !/^[\w-]+$/.test(jobId)) {
    return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
  }

  const jobDir = join('/tmp', 'jobs', jobId);

  let job: JobState;
  try {
    job = JSON.parse(await readFile(join(jobDir, 'job.json'), 'utf-8'));
  } catch {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (job.status !== 'complete') {
    return NextResponse.json({ error: 'Job not ready' }, { status: 400 });
  }

  let outputStat: Awaited<ReturnType<typeof stat>>;
  try {
    outputStat = await stat(job.outputPath);
  } catch {
    return NextResponse.json({ error: 'Output file missing' }, { status: 404 });
  }

  const nodeStream = createReadStream(job.outputPath);
  // Delete job directory after stream closes
  nodeStream.on('close', async () => {
    try { await rm(jobDir, { recursive: true, force: true }); } catch {}
  });

  const savings = Math.max(0, Math.round((1 - outputStat.size / job.originalSize) * 100));

  return new NextResponse(Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>, {
    headers: {
      'Content-Type': job.outputMime,
      'Content-Disposition': `attachment; filename="${job.outputFilename}"`,
      'Content-Length': String(outputStat.size),
      'X-Original-Size': String(job.originalSize),
      'X-Compressed-Size': String(outputStat.size),
      'X-Savings': String(savings),
      'Cache-Control': 'no-store',
    },
  });
}
