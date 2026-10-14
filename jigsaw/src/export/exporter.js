import { allBounds, composeTransform, multiply } from '../domain/geometry.js';

const MAX_EXPORT_PIXELS = 64 * 1024 * 1024;
const MAX_EXPORT_SIDE = 16384;

export async function renderExport(model, metadata, getBitmap, format) {
  const bounds = allBounds(model.items, metadata);
  if (!bounds) throw new Error('내보낼 이미지가 없습니다.');
  const left = Math.floor(bounds.left), top = Math.floor(bounds.top);
  const width = Math.ceil(bounds.right) - left, height = Math.ceil(bounds.bottom) - top;
  if (!width || !height) throw new Error('출력 영역의 크기가 올바르지 않습니다.');
  if (width > MAX_EXPORT_SIDE || height > MAX_EXPORT_SIDE || width * height > MAX_EXPORT_PIXELS) {
    throw new Error(`출력 크기 ${width.toLocaleString()} × ${height.toLocaleString()}px는 브라우저 안전 범위를 넘습니다. 자동 축소하지 않았습니다. 캔버스의 이미지 크기를 줄여 다시 시도해 주세요.`);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('출력 캔버스를 만들 수 없습니다.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    if (format === 'image/jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); }
    context.translate(-left, -top);
    for (const item of model.items) {
      if (item.type === 'group') {
        const parent = composeTransform(item);
        for (const child of item.children) draw(context, child, metadata, getBitmap, multiply(parent, composeTransform(child)));
      } else draw(context, item, metadata, getBitmap, composeTransform(item));
    }
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('이미지 파일을 만들지 못했습니다.')), format, format === 'image/jpeg' ? 0.92 : undefined);
    });
    return { blob, width, height };
  } finally {
    canvas.width = 0; canvas.height = 0;
  }
}

function draw(context, item, metadata, getBitmap, matrix) {
  const asset = metadata[item.assetId];
  const bitmap = getBitmap(item.assetId);
  if (!asset || !bitmap) throw new Error(`${item.name || '이미지'}를 불러오지 못했습니다.`);
  context.save();
  context.transform(...matrix);
  context.drawImage(bitmap, 0, 0, asset.width, asset.height);
  context.restore();
}

export function deliverBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.rel = 'noopener';
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
