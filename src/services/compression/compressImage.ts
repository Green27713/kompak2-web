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

      // Map user quality 1-100 to WebP quality 0.1-0.85
      // Cap at 0.85 — above this WebP bloats vs original
      const mappedQ = 0.1 + (options.quality / 100) * 0.75;
      const mimeType = "image/webp";

      const dataUrl = canvas.toDataURL(mimeType, mappedQ);
      const base64 = dataUrl.split(",")[1];
      const sizeBytes = Math.round((base64.length * 3) / 4);

      // If still larger than original, force quality down until smaller
      if (sizeBytes >= file.size) {
        let q = 0.4;
        let result = canvas.toDataURL(mimeType, q);
        let resultBase64 = result.split(",")[1];
        let resultSize = Math.round((resultBase64.length * 3) / 4);

        while (resultSize >= file.size && q > 0.1) {
          q -= 0.05;
          result = canvas.toDataURL(mimeType, q);
          resultBase64 = result.split(",")[1];
          resultSize = Math.round((resultBase64.length * 3) / 4);
        }

        resolve({
          dataUrl: result,
          sizeBytes: resultSize,
          width: img.naturalWidth,
          height: img.naturalHeight,
          format: mimeType,
        });
        return;
      }

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
