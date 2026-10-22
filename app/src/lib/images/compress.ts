export type ImageOutputType = "image/webp" | "image/jpeg";

export interface CompressionOptions {
  maxWidth: number;
  maxHeight: number;
  targetBytes: number;
  quality?: number;
  minQuality?: number;
  minDimension?: number;
  square?: boolean;
  skipBelowBytes?: number;
  preferredType?: ImageOutputType;
  maxPixels?: number;
}

export interface CompressionResult {
  file: File;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  compressed: boolean;
  mimeType: string;
  extension: string;
}

interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

const AVATAR_OPTIONS: CompressionOptions = {
  maxWidth: 512,
  maxHeight: 512,
  targetBytes: 120 * 1024,
  quality: 0.82,
  minQuality: 0.48,
  minDimension: 192,
  square: true,
  preferredType: "image/webp",
  maxPixels: 24_000_000,
};

const STUDY_IMAGE_OPTIONS: CompressionOptions = {
  maxWidth: 2560,
  maxHeight: 2560,
  targetBytes: 1024 * 1024,
  quality: 0.85,
  minQuality: 0.5,
  minDimension: 960,
  skipBelowBytes: 150 * 1024,
  preferredType: "image/webp",
  maxPixels: 40_000_000,
};

const QUALITY_STEPS = [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52];
const SCALE_STEPS = [1, 0.94, 0.86, 0.78, 0.7, 0.62];

function extensionForMime(type: string): string {
  return type === "image/jpeg" ? "jpg" : "webp";
}

function replaceExtension(name: string, extension: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "image";
  return `${base}.${extension}`;
}

function isGif(file: File): boolean {
  return file.type === "image/gif" || /\.gif$/i.test(file.name);
}

function isSupportedImage(file: File): boolean {
  return (
    file.type.startsWith("image/") &&
    !isGif(file) &&
    file.type !== "image/svg+xml"
  );
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Fall through to the HTMLImageElement path.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  try {
    if (typeof image.decode === "function") {
      await image.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("image decode failed"));
      });
    }
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  type: ImageOutputType,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function encodeBestEffort(
  canvas: HTMLCanvasElement,
  preferredType: ImageOutputType,
  quality: number,
): Promise<Blob | null> {
  const preferred = await encodeCanvas(canvas, preferredType, quality);
  if (preferred && preferred.type === preferredType) return preferred;

  const fallbackType: ImageOutputType =
    preferredType === "image/webp" ? "image/jpeg" : "image/webp";
  const fallback = await encodeCanvas(canvas, fallbackType, quality);
  if (fallback && fallback.type === fallbackType) return fallback;

  return preferred && preferred.type ? preferred : fallback;
}

function drawToCanvas(
  image: LoadedImage,
  width: number,
  height: number,
  square: boolean,
  forceOpaque: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  if (forceOpaque) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }

  if (square) {
    const cropSize = Math.min(image.width, image.height);
    const sourceX = (image.width - cropSize) / 2;
    const sourceY = (image.height - cropSize) / 2;
    context.drawImage(
      image.source,
      sourceX,
      sourceY,
      cropSize,
      cropSize,
      0,
      0,
      width,
      height,
    );
  } else {
    context.drawImage(image.source, 0, 0, image.width, image.height, 0, 0, width, height);
  }

  return canvas;
}

function initialDimensions(
  image: LoadedImage,
  options: CompressionOptions,
): { width: number; height: number } {
  const maxPixels = options.maxPixels ?? 40_000_000;
  const pixelScale =
    image.width * image.height > maxPixels
      ? Math.sqrt(maxPixels / (image.width * image.height))
      : 1;
  const effectiveWidth = image.width * pixelScale;
  const effectiveHeight = image.height * pixelScale;

  if (options.square) {
    const size = Math.min(
      options.maxWidth,
      options.maxHeight,
      Math.min(effectiveWidth, effectiveHeight),
    );
    return {
      width: Math.max(1, Math.round(size)),
      height: Math.max(1, Math.round(size)),
    };
  }

  const scale = Math.min(
    1,
    options.maxWidth / effectiveWidth,
    options.maxHeight / effectiveHeight,
  );
  return {
    width: Math.max(1, Math.round(effectiveWidth * scale)),
    height: Math.max(1, Math.round(effectiveHeight * scale)),
  };
}

export async function compressImage(
  file: File,
  options: CompressionOptions,
): Promise<CompressionResult> {
  const original: CompressionResult = {
    file,
    width: 0,
    height: 0,
    originalSize: file.size,
    compressedSize: file.size,
    compressed: false,
    mimeType: file.type || "application/octet-stream",
    extension: file.name.split(".").pop()?.toLowerCase() || "bin",
  };

  if (!isSupportedImage(file)) return original;

  let image: LoadedImage;
  try {
    image = await loadImage(file);
  } catch {
    return original;
  }

  const { width: startWidth, height: startHeight } = initialDimensions(image, options);
  const isResizeNeeded =
    startWidth < image.width || startHeight < image.height || Boolean(options.square);
  if (
    options.skipBelowBytes &&
    file.size <= options.skipBelowBytes &&
    !isResizeNeeded
  ) {
    original.width = image.width;
    original.height = image.height;
    image.close();
    return original;
  }

  const preferredType = options.preferredType ?? "image/webp";
  const initialQuality = options.quality ?? 0.85;
  const minQuality = options.minQuality ?? 0.5;
  const minDimension = options.minDimension ?? 640;
  const qualities = [
    initialQuality,
    ...QUALITY_STEPS.filter((value) => value < initialQuality && value >= minQuality),
    minQuality,
  ].filter((value, index, list) => list.indexOf(value) === index);

  let bestTarget: { blob: Blob; width: number; height: number } | null = null;
  let bestEffort: { blob: Blob; width: number; height: number } | null = null;

  try {
    for (const scale of SCALE_STEPS) {
      const width = Math.max(1, Math.round(startWidth * scale));
      const height = Math.max(1, Math.round(startHeight * scale));
      if (Math.min(width, height) < minDimension && bestEffort) break;

      const probe = drawToCanvas(image, width, height, Boolean(options.square), false);
      let smallestForScale: Blob | null = null;

      for (const quality of qualities) {
        const blob = await encodeBestEffort(probe, preferredType, quality);
        if (!blob) continue;
        if (!smallestForScale || blob.size < smallestForScale.size) {
          smallestForScale = blob;
        }
        if (blob.size <= options.targetBytes) {
          bestTarget = { blob, width, height };
          break;
        }
      }

      if (!bestTarget && smallestForScale) {
        if (!bestEffort || smallestForScale.size < bestEffort.blob.size) {
          bestEffort = { blob: smallestForScale, width, height };
        }
      }
      if (bestTarget) break;
    }

    const best = bestTarget ?? bestEffort;
    if (!best) return original;

    if (!isResizeNeeded && best.blob.size >= file.size) {
      original.width = image.width;
      original.height = image.height;
      return original;
    }

    const forceOpaque = best.blob.type === "image/jpeg";
    let outputBlob = best.blob;
    if (forceOpaque) {
      const opaqueCanvas = drawToCanvas(
        image,
        best.width,
        best.height,
        Boolean(options.square),
        true,
      );
      const opaque = await encodeCanvas(opaqueCanvas, "image/jpeg", initialQuality);
      if (opaque && opaque.size <= outputBlob.size * 1.08) {
        outputBlob = opaque;
      }
    }

    const extension = extensionForMime(outputBlob.type || preferredType);
    return {
      file: new File([outputBlob], replaceExtension(file.name, extension), {
        type: outputBlob.type || preferredType,
        lastModified: file.lastModified,
      }),
      width: best.width,
      height: best.height,
      originalSize: file.size,
      compressedSize: outputBlob.size,
      compressed: outputBlob.size < file.size,
      mimeType: outputBlob.type || preferredType,
      extension,
    };
  } finally {
    image.close();
  }
}

export function compressAvatar(file: File): Promise<CompressionResult> {
  return compressImage(file, AVATAR_OPTIONS);
}

export function compressStudyImage(file: File): Promise<CompressionResult> {
  return compressImage(file, STUDY_IMAGE_OPTIONS);
}
