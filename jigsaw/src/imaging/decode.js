const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function decodeImageFile(file) {
  const reportedType = (file.type || '').toLowerCase();
  const suffix = file.name?.toLowerCase().split('.').at(-1);
  const inferredType = ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' })[suffix];
  const type = ACCEPTED_TYPES.has(reportedType) ? reportedType : (!reportedType || reportedType === 'application/octet-stream' ? inferredType || reportedType : reportedType);
  if (!ACCEPTED_TYPES.has(type)) {
    return { ok: false, reason: type.startsWith('image/') ? 'unsupported' : 'not-image', name: file.name };
  }
  if (typeof createImageBitmap !== 'function') return { ok: false, reason: 'browser', name: file.name };
  try {
    let bitmap;
    try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { bitmap = await createImageBitmap(file); }
    if (!bitmap.width || !bitmap.height) {
      bitmap.close();
      return { ok: false, reason: 'corrupt', name: file.name };
    }
    return { ok: true, blob: file, bitmap, width: bitmap.width, height: bitmap.height,
      mime: type, name: file.name, animated: type === 'image/gif' };
  } catch {
    return { ok: false, reason: 'corrupt', name: file.name };
  }
}

export function releaseDecodedImage(image) {
  image?.bitmap?.close?.();
}
