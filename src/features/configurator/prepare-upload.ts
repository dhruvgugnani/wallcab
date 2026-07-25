const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 2_868;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function canvasBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("The browser could not prepare this image.")),
      "image/webp",
      quality,
    );
  });
}

export async function prepareImageUpload(file: File): Promise<File> {
  if (!allowedTypes.has(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }

  if (!("createImageBitmap" in window)) {
    if (file.size <= MAX_UPLOAD_BYTES) return file;
    throw new Error("Choose an image smaller than 4 MB in this browser.");
  }

  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("The browser could not prepare this image.");
    }
    context.drawImage(bitmap, 0, 0, width, height);

    let blob = await canvasBlob(canvas, 0.84);
    if (blob.size > MAX_UPLOAD_BYTES) {
      blob = await canvasBlob(canvas, 0.7);
    }
    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new Error("The prepared image is still larger than 4 MB.");
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "wallcab-background";
    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}
