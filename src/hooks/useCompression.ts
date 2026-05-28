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
        const crf = Math.round(51 - (quality / 100) * 51);
        const result = await compressVideo(file, {
          crf,
          resolution: "original",
          outputFormat: "mp4",
          onProgress: (p) =>
            setState((s) => ({ ...s, progress: Math.round(p * 100) })),
        });
        outputUrl = result.url;
        sizeBytes = result.sizeBytes;
        format = result.mimeType;
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
