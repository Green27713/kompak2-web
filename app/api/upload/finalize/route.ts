import { NextRequest, NextResponse } from 'next/server';
import { readFile, unlink, open } from 'fs/promises';
import { join } from 'path';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';

export async function POST(request: NextRequest) {
  const { uploadId } = await request.json();

  const uploadDir = join('/tmp', 'uploads', uploadId);
  const metadata = JSON.parse(await readFile(join(uploadDir, 'metadata.json'), 'utf-8'));
  const combinedPath = join(uploadDir, 'combined');

  // Stream-concatenate chunks to avoid loading entire file into RAM
  const outStream = createWriteStream(combinedPath);
  for (let i = 0; i < metadata.totalChunks; i++) {
    const chunkPath = join(uploadDir, `chunk-${i}`);
    await pipeline(createReadStream(chunkPath), outStream, { end: false });
    await unlink(chunkPath).catch(() => {});
  }
  outStream.end();
  await new Promise<void>((resolve, reject) => {
    outStream.on('finish', () => resolve());
    outStream.on('error', reject);
  });

  return NextResponse.json({ success: true, uploadId });
}
