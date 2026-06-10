import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const { uploadId, filename, totalChunks } = await request.json();

  const uploadDir = join('/tmp', 'uploads', uploadId);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, 'metadata.json'), JSON.stringify({ filename, totalChunks }));

  return NextResponse.json({ success: true, uploadId });
}
