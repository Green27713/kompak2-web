export interface CompressedImageResult {
  dataUrl: string;
  sizeBytes: number;
  width: number;
  height: number;
  format: string;
  alreadyOptimized?: boolean;
}

export interface ImageCompressionOptions {
  quality: number;
}

const API_SIZE_LIMIT = 4 * 1024 * 1024; // 4MB

async function compressViaAPI(
  file: File,
  quality: number
): Promise<CompressedImageResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("quality", String(quality));

  const res = await fetch("/api/compress", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("API compression failed");

  const blob = await res.blob();
  const alreadyOptimized = res.headers.get("X-Already-Optimized") === "true";
  const compressedSize = parseInt(res.headers.get("X-Compressed-Size") || "0", 10);

  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(blob);
  });

  return {
    dataUrl,
    sizeBytes: compressedSize || blob.size,
    width: 0,
    height: 0,
    format: blob.type,
    alreadyOptimized,
  };
}

async function compressViaBrowser(
  file: File,
  quality: number
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("Canvas failed")); return; }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const mimeType = "image/webp";
      let lo = 0.05, hi = 0.85;
      let bestDataUrl = "";
      let bestSize = file.size;
      let found = false;

      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        const attempt = canvas.toDataURL(mimeType, mid);
        const attemptSize = Math.round((attempt.split(",")[1].length * 3) / 4);
        if (attemptSize < file.size) {
          bestDataUrl = attempt; bestSize = attemptSize; found = true; lo = mid;
        } else { hi = mid; }
      }

      if (!found) {
        const reader = new FileReader();
        reader.onload = (e) => resolve({
          dataUrl: e.target?.result as string,
          sizeBytes: file.size,
          width: img.naturalWidth,
          height: img.naturalHeight,
          format: file.type,
          alreadyOptimized: true,
        });
        reader.readAsDataURL(file);
        return;
      }

      resolve({
        dataUrl: bestDataUrl,
        sizeBytes: bestSize,
        width: img.naturalWidth,
        height: img.naturalHeight,
        format: mimeType,
        alreadyOptimized: false,
      });
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

export async function compressImage(
  file: File,
  options: ImageCompressionOptions
): Promise<CompressedImageResult> {
  // Use server-side Sharp for files under 4MB — far better compression
  if (file.size <= API_SIZE_LIMIT) {
    try {
      return await compressViaAPI(file, options.quality);
    } catch {
      // Fall back to browser if API fails
      console.warn("API compression failed, falling back to browser");
    }
  }
  // Browser fallback for large files
  return await compressViaBrowser(file, options.quality);
}
