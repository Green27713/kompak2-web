import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // 4MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const quality = parseInt(formData.get("quality") as string || "80", 10);

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large for server compression. Max 4MB." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type;

    let compressed: Buffer;
    let outputMime: string;

    if (mimeType === "image/png") {
      // PNG → WebP
      compressed = await sharp(buffer)
        .webp({ quality })
        .toBuffer();
      outputMime = "image/webp";
    } else if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
      // JPEG → mozjpeg via Sharp
      compressed = await sharp(buffer)
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      outputMime = "image/jpeg";
    } else if (mimeType === "image/webp") {
      // WebP → re-compress
      compressed = await sharp(buffer)
        .webp({ quality })
        .toBuffer();
      outputMime = "image/webp";
    } else {
      // Fallback — try WebP
      compressed = await sharp(buffer)
        .webp({ quality })
        .toBuffer();
      outputMime = "image/webp";
    }

    // Never return a file larger than the original
    if (compressed.length >= buffer.length) {
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": mimeType,
          "X-Original-Size": String(buffer.length),
          "X-Compressed-Size": String(buffer.length),
          "X-Already-Optimized": "true",
        },
      });
    }

    return new NextResponse(new Uint8Array(compressed), {
      headers: {
        "Content-Type": outputMime,
        "X-Original-Size": String(buffer.length),
        "X-Compressed-Size": String(compressed.length),
        "X-Already-Optimized": "false",
      },
    });
  } catch (err) {
    console.error("Compression error:", err);
    return NextResponse.json({ error: "Compression failed" }, { status: 500 });
  }
}
