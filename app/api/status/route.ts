import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';

interface JobState {
  status: 'processing' | 'complete' | 'error';
  durationMs: number;
  error?: string;
  createdAt: string;
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId || !/^[\w-]+$/.test(jobId)) {
    return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
  }

  const jobDir = join('/tmp', 'jobs', jobId);
  const jobFile = join(jobDir, 'job.json');

  let job: JobState;
  try {
    job = JSON.parse(await readFile(jobFile, 'utf-8'));
  } catch {
    return NextResponse.json({ status: 'error', error: 'Job not found', progress: 0 }, { status: 404 });
  }

  if (job.status === 'complete') {
    return NextResponse.json({ status: 'complete', progress: 100 });
  }
  if (job.status === 'error') {
    return NextResponse.json({ status: 'error', error: job.error || 'Compression failed', progress: 0 });
  }

  // If the server restarted while FFmpeg was running, the job will be stuck in 'processing'
  const age = Date.now() - new Date(job.createdAt).getTime();
  if (age > 25 * 60 * 1000) {
    await writeFile(jobFile, JSON.stringify({ ...job, status: 'error', error: 'Job timed out' })).catch(() => {});
    return NextResponse.json({ status: 'error', error: 'Job timed out', progress: 0 });
  }

  // Parse FFmpeg's progress file for real percentage
  let progress = 5;
  try {
    const progressText = await readFile(join(jobDir, 'progress'), 'utf-8');
    const matches = [...progressText.matchAll(/out_time_ms=(\d+)/g)];
    if (matches.length > 0 && job.durationMs > 0) {
      const latestMs = parseInt(matches[matches.length - 1][1]);
      progress = Math.min(99, Math.max(5, Math.round((latestMs / job.durationMs) * 100)));
    }
  } catch {}

  return NextResponse.json({ status: 'processing', progress });
}
