export interface CompressedImageResult {
  dataUrl: string;
  sizeBytes: number;
  width: number;
  height: number;
  format: string;
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
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      // PNG → WebP for real compression gains
      // JPEG stays as JPEG
      const isPng = file.type === "image/png";
      const mimeType = isPng ? "image/webp" : "image/jpeg";
      const q = options.quality / 100;
      const dataUrl = canvas.toDataURL(mimeType, q);
      const base64 = dataUrl.split(",")[1];
      const sizeBytes = Math.round((base64.length * 3) / 4);

      resolve({
        dataUrl,
        sizeBytes,
        width: img.naturalWidth,
        height: img.naturalHeight,
        format: mimeType,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
