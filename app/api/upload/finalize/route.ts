import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  const { uploadId } = await request.json();

  const uploadDir = join('/tmp', 'uploads', uploadId);
  const metadata = JSON.parse(await readFile(join(uploadDir, 'metadata.json'), 'utf-8'));

  const chunks: Buffer[] = [];
  for (let i = 0; i < metadata.totalChunks; i++) {
    chunks.push(await readFile(join(uploadDir, `chunk-${i}`)));
  }

  await writeFile(join(uploadDir, 'combined'), Buffer.concat(chunks));

  await Promise.all(
    Array.from({ length: metadata.totalChunks }, (_, i) =>
      unlink(join(uploadDir, `chunk-${i}`)).catch(() => {})
    )
  );

  return NextResponse.json({ success: true, uploadId });
}
