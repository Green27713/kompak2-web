import { NextRequest, NextResponse } from 'next/server';
import { readFile, appendFile, unlink } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const { uploadId } = await request.json();

  const uploadDir = join('/tmp', 'uploads', uploadId);
  const metadata = JSON.parse(await readFile(join(uploadDir, 'metadata.json'), 'utf-8'));
  const combinedPath = join(uploadDir, 'combined');

  // Append one 5 MB chunk at a time — never more than one chunk in RAM
  for (let i = 0; i < metadata.totalChunks; i++) {
    const chunkPath = join(uploadDir, `chunk-${i}`);
    const data = await readFile(chunkPath);
    await appendFile(combinedPath, data);
    await unlink(chunkPath).catch(() => {});
  }

  return NextResponse.json({ success: true, uploadId });
}
