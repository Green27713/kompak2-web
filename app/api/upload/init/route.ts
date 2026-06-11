import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { getTier } from '@/lib/rateLimit';
import { VIDEO_SIZE_LIMITS } from '@/lib/requirePro';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const { uploadId, filename, totalChunks, fileSize } = await request.json();

  if (typeof fileSize === 'number') {
    const tier = getTier(request);
    const limit = VIDEO_SIZE_LIMITS[tier];
    if (fileSize > limit) {
      const mb = limit / 1024 / 1024;
      const label = mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
      return NextResponse.json(
        { error: `Your ${tier} plan supports files up to ${label}. Please upgrade to upload larger files.` },
        { status: 403 },
      );
    }
  }

  const uploadDir = join('/tmp', 'uploads', uploadId);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, 'metadata.json'), JSON.stringify({ filename, totalChunks }));

  return NextResponse.json({ success: true, uploadId });
}
