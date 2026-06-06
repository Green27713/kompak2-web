import { useState, useCallback } from "react";
import { compressImage } from "../services/compression/compressImage";
import { compressVideo } from "../services/compression/compressVideo";
import {
  formatBytes,
  calculateSavings,
  getFileCategory,
  getOutputFilename,
} from "../services/compression/index";

export type CompressionStatus = "idle" | "compressing" | "done" | "error";

export interface CompressionState {
  status: CompressionStatus;
  progress: number;
  originalSize: number;
  compressedSize: number;
  savings: number;
  outputUrl: string | null;
  outputFilename: string;
  errorMsg: string;
  originalSizeFormatted: string;
  compressedSizeFormatted: string;
}

const initialState: CompressionState = {
  status: "idle",
  progress: 0,
  originalSize: 0,
  compressedSize: 0,
  savings: 0,
  outputUrl: null,
  outputFilename: "",
  errorMsg: "",
  originalSizeFormatted: "",
  compressedSizeFormatted: "",
};

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
const CHUNKED_THRESHOLD = 50 * 1024 * 1024; // files > 50 MB use chunked upload

async function compressVideoViaServer(
  file: File,
  quality: number,
  onProgress: (p: number) => void
): Promise<{ url: string; sizeBytes: number; mimeType: string }> {
  if (file.size > CHUNKED_THRESHOLD) {
    return compressVideoChunked(file, quality, onProgress);
  }

  onProgress(5);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("quality", String(quality));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000); // 5 min

  try {
    const res = await fetch("/api/compress", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    onProgress(90);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Server error ${res.status}${body ? `: ${body}` : ""}`);
    }

    const blob = await res.blob();
    onProgress(100);

    return { url: URL.createObjectURL(blob), sizeBytes: blob.size, mimeType: "video/mp4" };
  } finally {
    clearTimeout(timeout);
  }
}

async function compressVideoChunked(
  file: File,
  quality: number,
  onProgress: (p: number) => void
): Promise<{ url: string; sizeBytes: number; mimeType: string }> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = crypto.randomUUID();

  // Init
  const initRes = await fetch("/api/upload/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId, filename: file.name, totalChunks }),
  });
  if (!initRes.ok) throw new Error("Failed to initialize upload");

  // Upload chunks (0–50% progress)
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const chunk = file.slice(start, start + CHUNK_SIZE);

    const chunkRes = await fetch("/api/upload/chunk", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Upload-ID": uploadId,
        "X-Chunk-Index": String(i),
      },
      body: chunk,
    });
    if (!chunkRes.ok) throw new Error(`Chunk ${i} upload failed`);

    onProgress(Math.round(((i + 1) / totalChunks) * 50));
  }

  // Finalize
  const finalRes = await fetch("/api/upload/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId }),
  });
  if (!finalRes.ok) throw new Error("Failed to finalize upload");

  onProgress(55);

  // Compress (55–100% progress)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 600_000); // 10 min

  try {
    const res = await fetch("/api/compress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId, quality }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Server error ${res.status}${body ? `: ${body}` : ""}`);
    }

    onProgress(90);
    const blob = await res.blob();
    onProgress(100);

    return { url: URL.createObjectURL(blob), sizeBytes: blob.size, mimeType: "video/mp4" };
  } finally {
    clearTimeout(timeout);
  }
}

export function useCompression() {
  const [state, setState] = useState<CompressionState>(initialState);

  const compress = useCallback(async (file: File, quality: number) => {
    const category = getFileCategory(file);
    if (!category) {
      setState((s) => ({ ...s, status: "error", errorMsg: "Unsupported file type." }));
      return;
    }

    setState({
      ...initialState,
      status: "compressing",
      originalSize: file.size,
      originalSizeFormatted: formatBytes(file.size),
    });

    try {
      let outputUrl: string;
      let sizeBytes: number;
      let format: string;

      if (category === "image") {
        const result = await compressImage(file, { quality });
        const res = await fetch(result.dataUrl);
        const blob = await res.blob();
        outputUrl = URL.createObjectURL(blob);
        sizeBytes = result.sizeBytes;
        format = result.format;
      } else {
        // Try server-side FFmpeg first (faster), fall back to browser WASM
        try {
          const result = await compressVideoViaServer(
            file,
            quality,
            (p) => setState((s) => ({ ...s, progress: p }))
          );
          outputUrl = result.url;
          sizeBytes = result.sizeBytes;
          format = result.mimeType;
        } catch (serverErr) {
          console.warn("Server video compression failed, falling back to browser WASM:", serverErr);
          setState((s) => ({ ...s, progress: 0 }));
          const crf = Math.round(51 - (quality / 100) * 51);
          const result = await compressVideo(file, {
            crf,
            resolution: "original",
            outputFormat: "mp4",
            onProgress: (p) => setState((s) => ({ ...s, progress: Math.round(p * 100) })),
          });
          outputUrl = result.url;
          sizeBytes = result.sizeBytes;
          format = result.mimeType;
        }
      }

      const savings = calculateSavings(file.size, sizeBytes);
      const outputFilename = getOutputFilename(file.name, format);

      setState({
        status: "done",
        progress: 100,
        originalSize: file.size,
        compressedSize: sizeBytes,
        savings,
        outputUrl,
        outputFilename,
        errorMsg: "",
        originalSizeFormatted: formatBytes(file.size),
        compressedSizeFormatted: formatBytes(sizeBytes),
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "error",
        errorMsg: err instanceof Error ? err.message : "Compression failed.",
      }));
    }
  }, []);

  const reset = useCallback(() => setState(initialState), []);

  return { state, compress, reset };
}
