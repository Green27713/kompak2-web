import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (!loadPromise) {
    loadPromise = (async () => {
      const ff = new FFmpeg();
      await ff.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      ffmpegInstance = ff;
      return ff;
    })();
  }
  return loadPromise;
}

export type OutputFormat = "mp4" | "webm";
export type Resolution = "original" | "1920x1080" | "1280x720" | "854x480";

export interface VideoCompressionOptions {
  crf: number;        // 0-51, lower = better quality
  resolution: Resolution;
  outputFormat: OutputFormat;
  onProgress?: (progress: number) => void;
}

export interface CompressedVideoResult {
  url: string;
  sizeBytes: number;
  mimeType: string;
}

export async function compressVideo(
  file: File,
  options: VideoCompressionOptions
): Promise<CompressedVideoResult> {
  const { crf, resolution, outputFormat, onProgress } = options;
  const ff = await getFFmpeg();

  const progressHandler = onProgress
    ? ({ progress }: { progress: number }) =>
        onProgress(Math.min(Math.max(progress, 0), 1))
    : null;

  if (progressHandler) ff.on("progress", progressHandler);

  const inputExt = getExt(file.name) || ".mp4";
  const inputName = `input${inputExt}`;
  const outputExt = outputFormat === "webm" ? "webm" : "mp4";
  const outputName = `output.${outputExt}`;

  try {
    await ff.writeFile(inputName, await fetchFile(file));

    const scaleFilter: string[] =
      resolution === "original"
        ? []
        : ["-vf", `scale=${resolution}:force_original_aspect_ratio=decrease:flags=lanczos`];

    let codecArgs: string[];
    if (outputFormat === "webm") {
      codecArgs = [
        "-c:v", "libvpx-vp9",
        "-crf", String(crf),
        "-b:v", "0",
        "-c:a", "libopus",
        "-b:a", "128k",
      ];
    } else {
      codecArgs = [
        "-c:v", "libx264",
        "-crf", String(crf),
        "-preset", "fast",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
      ];
    }

    await ff.exec(["-i", inputName, ...scaleFilter, ...codecArgs, "-y", outputName]);

    const data = await ff.readFile(outputName);
    const mimeType = outputFormat === "webm" ? "video/webm" : "video/mp4";
    const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data as unknown as ArrayBuffer);
    const blob = new Blob([new Uint8Array(uint8.buffer as ArrayBuffer)], { type: mimeType });

    return {
      url: URL.createObjectURL(blob),
      sizeBytes: blob.size,
      mimeType,
    };
  } finally {
    if (progressHandler) ff.off("progress", progressHandler);
    try { await ff.deleteFile(inputName); } catch (_) {}
    try { await ff.deleteFile(outputName); } catch (_) {}
  }
}

function getExt(filename: string): string | null {
  const m = filename?.match(/\.[^.]+$/);
  return m ? m[0].toLowerCase() : null;
}