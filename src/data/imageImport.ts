const HEIC_RE = /\.(heic|heif)$/i;

/** Formats the browser can't decode, which we transcode to JPEG on upload. */
export function isConvertibleFormat(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  return type === 'image/heic' || type === 'image/heif' || HEIC_RE.test(file.name.toLowerCase());
}

/**
 * Transcode unsupported formats (HEIC/HEIF) to JPEG so they render everywhere.
 * The decoder is loaded lazily, so it costs nothing unless a HEIC is uploaded.
 */
export async function prepareImageFile(file: File): Promise<File> {
  if (!isConvertibleFormat(file)) return file;
  const { default: heic2any } = await import('heic2any');
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  const blob = Array.isArray(result) ? result[0] : result;
  const name = file.name.replace(/\.(heic|heif)$/i, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}
