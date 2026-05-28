// ── Shared types ──────────────────────────────────────────────────────────────

export type FileCategory = "image" | "video";

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  savings: number; // percentage 0-100
  filename: string;
  format: string;
}

// ── Shared utilities ──────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function calculateSavings(originalSize: number, compressedSize: number): number {
  return Math.max(0, Math.round((1 - compressedSize / originalSize) * 100));
}

export function getFileCategory(file: File): FileCategory | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export function getOutputFilename(originalName: string, format: string): string {
  const base = originalName.replace(/\.[^.]+$/, "");
  const ext = format.includes("png") ? "png"
    : format.includes("webm") ? "webm"
    : format.includes("mp4") ? "mp4"
    : "jpg";
  return `${base}-compressed.${ext}`;
}

// ── Feature flag for Phase 2 ──────────────────────────────────────────────────

export const config = {
  engine: process.env.NEXT_PUBLIC_COMPRESSION_ENGINE || "wasm",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "",
  apiKey: process.env.NEXT_PUBLIC_API_KEY || "",
} as const;