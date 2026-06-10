import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const uploadId = request.headers.get('X-Upload-ID');
  const chunkIndex = request.headers.get('X-Chunk-Index');

  if (!uploadId || chunkIndex === null) {
    return NextResponse.json({ error: 'Missing headers' }, { status: 400 });
  }

  const data = await request.arrayBuffer();
  await writeFile(join('/tmp', 'uploads', uploadId, `chunk-${chunkIndex}`), Buffer.from(data));

  return NextResponse.json({ success: true, chunkIndex: Number(chunkIndex) });
}
