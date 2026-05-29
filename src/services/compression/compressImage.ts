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

export function compressImage(
  file: File,
  options: ImageCompressionOptions
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("Could not get canvas context")); return; }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const mimeType = "image/webp";
      let lo = 0.05, hi = 0.90;
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

      resolve({ dataUrl: bestDataUrl, sizeBytes: bestSize, width: img.naturalWidth, height: img.naturalHeight, format: mimeType, alreadyOptimized: false });
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}
