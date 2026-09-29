const supportedTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
const DEFAULT_MAX_WIDTH_OR_HEIGHT = 1600;
const DEFAULT_TARGET_MIN_MB = 0.3;
const DEFAULT_TARGET_MAX_MB = 0.7;
const DEFAULT_TARGET_QUALITY = 0.84;
export const MAX_IMAGE_SOURCE_MB = 20;

export function isSupportedImageFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  if (supportedTypes.has(type)) return true;
  if (type && type !== 'application/octet-stream') return false;
  const name = String(file.name || '').toLowerCase();
  return supportedExtensions.some((extension) => name.endsWith(extension));
}

export async function compressImageFile(file, options = {}) {
  if (!isSupportedImageFile(file)) {
    throw new Error('Only JPG, JPEG, PNG, and WEBP images are allowed.');
  }

  const originalSize = Number(file.size || 0);
  if (!originalSize || originalSize > MAX_IMAGE_SOURCE_MB * 1024 * 1024) {
    throw new Error(`Choose a non-empty photo up to ${MAX_IMAGE_SOURCE_MB}MB before compression.`);
  }
  const targetMaxMb = Math.min(DEFAULT_TARGET_MAX_MB, Number(options.targetMaxSizeMb || DEFAULT_TARGET_MAX_MB));
  const targetMinMb = Math.min(targetMaxMb, Number(options.targetMinSizeMb || DEFAULT_TARGET_MIN_MB));
  const targetMaxSizeMb = pickTargetSizeMb(file, targetMinMb, targetMaxMb);
  const maxWidthOrHeight = Number(options.maxWidthOrHeight || DEFAULT_MAX_WIDTH_OR_HEIGHT);

  // The old 2MB source threshold incorrectly allowed large WebP originals to
  // bypass compression. Only an already-small WebP can skip another encode.
  if (file.size <= targetMaxMb * 1024 * 1024 && isPreferredUploadType(file)) {
    return attachCompressionMeta(file, {
      originalSize,
      compressedSize: originalSize,
      skipped: true,
      convertedToWebp: file.type === 'image/webp',
      maxWidthOrHeight,
      targetMaxSizeMb,
    });
  }

  try {
    // Validation and already-small WebP uploads do not need the compressor.
    const { default: imageCompression } = await import('browser-image-compression');
    const extension = String(file.name || '').split('.').pop().toLowerCase();
    const source = supportedTypes.has(file.type) && file.type !== 'image/jpg' ? file : new File([file], file.name, { type: extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg', lastModified: file.lastModified });
    const compressed = await imageCompression(source, {
      maxSizeMB: targetMaxSizeMb,
      maxWidthOrHeight,
      alwaysKeepResolution: false,
      useWebWorker: true,
      initialQuality: Number(options.initialQuality || DEFAULT_TARGET_QUALITY),
      preserveExif: false,
      fileType: 'image/webp',
      onProgress: typeof options.onProgress === 'function' ? options.onProgress : undefined,
    });

    if (!compressed.size || compressed.size > targetMaxSizeMb * 1024 * 1024 || compressed.type !== 'image/webp') {
      throw new Error('This photo could not be optimized within the upload limit. Try exporting it as JPG or WEBP. The original was not uploaded.');
    }

    const outputName = `${String(file.name || 'image').replace(/\.[^.]+$/, '')}.webp`;
    const compressedFile = new File([compressed], outputName, {
      type: 'image/webp',
      lastModified: file.lastModified || Date.now(),
    });
    return attachCompressionMeta(compressedFile, {
      originalSize,
      compressedSize: Number(compressedFile.size || 0),
      skipped: false,
      convertedToWebp: true,
      maxWidthOrHeight,
      targetMaxSizeMb,
    });
  } catch (error) {
    throw new Error(error.message || 'Image compression failed. Please try again.');
  }
}

// One entry point for ordinary uploads, bulk drafts and mixed evidence uploads.
// Videos are left alone; images are never skipped because their field is "files".
export async function prepareImageUploads(files, fieldName = 'images') {
  const prepared = [];
  for (const file of Array.from(files || [])) {
    if (!file) continue;
    if (fieldName === 'images' || fieldName === 'image' || isSupportedImageFile(file) || String(file.type || '').startsWith('image/')) prepared.push(await compressImageFile(file));
    else prepared.push(file);
  }
  return prepared;
}

function isPreferredUploadType(file) {
  return String(file?.type || '').toLowerCase() === 'image/webp';
}

function pickTargetSizeMb(file, minMb, maxMb) {
  const bytes = Number(file?.size || 0);
  if (bytes >= 12 * 1024 * 1024) return maxMb;
  if (bytes >= 6 * 1024 * 1024) return Math.min(maxMb, 0.6);
  if (bytes >= 3 * 1024 * 1024) return Math.min(maxMb, 0.5);
  return minMb;
}

function attachCompressionMeta(file, meta) {
  try {
    Object.defineProperty(file, '__compressionMeta', {
      value: {
        originalSize: meta.originalSize,
        compressedSize: meta.compressedSize,
        skipped: Boolean(meta.skipped),
        convertedToWebp: Boolean(meta.convertedToWebp),
        maxWidthOrHeight: meta.maxWidthOrHeight,
        targetMaxSizeMb: meta.targetMaxSizeMb,
      },
      configurable: true,
      enumerable: false,
      writable: true,
    });
  } catch {
    file.__compressionMeta = meta;
  }
  return file;
}
