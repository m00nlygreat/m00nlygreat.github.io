export const identity = () => [1, 0, 0, 1, 0, 0];
export const multiply = (left, right) => [
  left[0] * right[0] + left[2] * right[1],
  left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3],
  left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4],
  left[1] * right[4] + left[3] * right[5] + left[5]
];

export function composeTransform(item = {}) {
  const angle = (item.rotation || 0) * Math.PI / 180;
  const scale = item.scale || 1;
  const cos = Math.cos(angle) * scale;
  const sin = Math.sin(angle) * scale;
  return [cos, sin, -sin, cos, item.x || 0, item.y || 0];
}

export function invert(matrix) {
  const [a, b, c, d, e, f] = matrix;
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-12) throw new Error('변형 행렬을 되돌릴 수 없습니다.');
  return [d / determinant, -b / determinant, -c / determinant, a / determinant,
    (c * f - d * e) / determinant, (b * e - a * f) / determinant];
}

export function transformPoint(matrix, point) {
  return { x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] };
}

export function decomposeTransform(matrix) {
  const scale = Math.hypot(matrix[0], matrix[1]);
  return { x: matrix[4], y: matrix[5], scale, rotation: Math.atan2(matrix[1], matrix[0]) * 180 / Math.PI };
}

export function rectangleForMatrix(matrix, width, height) {
  const corners = [
    transformPoint(matrix, { x: 0, y: 0 }), transformPoint(matrix, { x: width, y: 0 }),
    transformPoint(matrix, { x: width, y: height }), transformPoint(matrix, { x: 0, y: height })
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  return { x: left, y: top, left, right, top, bottom, width: right - left, height: bottom - top };
}

export function imageMatrix(item) {
  return composeTransform(item);
}

function childBounds(child, metadata) {
  const asset = metadata[child.assetId];
  if (!asset) return null;
  return rectangleForMatrix(composeTransform(child), asset.width, asset.height);
}

export function localBounds(item, metadata) {
  if (item.type !== 'group') {
    const asset = metadata[item.assetId];
    if (!asset) return null;
    return { x: 0, y: 0, left: 0, top: 0, right: asset.width, bottom: asset.height, width: asset.width, height: asset.height };
  }
  const boxes = item.children.map((child) => childBounds(child, metadata)).filter(Boolean);
  if (!boxes.length) return { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.right));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  return { x: left, y: top, left, top, right, bottom, width: right - left, height: bottom - top };
}

export function worldBounds(item, metadata) {
  if (item.type !== 'group') {
    const asset = metadata[item.assetId];
    return asset ? rectangleForMatrix(composeTransform(item), asset.width, asset.height) : null;
  }
  const groupMatrix = composeTransform(item);
  const boxes = item.children.map((child) => {
    const asset = metadata[child.assetId];
    return asset ? rectangleForMatrix(multiply(groupMatrix, composeTransform(child)), asset.width, asset.height) : null;
  }).filter(Boolean);
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.right));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  return { x: left, y: top, left, top, right, bottom, width: right - left, height: bottom - top };
}

export function allBounds(items, metadata) {
  const boxes = items.map((item) => worldBounds(item, metadata)).filter(Boolean);
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.right));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  return { x: left, y: top, left, top, right, bottom, width: right - left, height: bottom - top };
}

export function hitTest(items, metadata, point) {
  for (let index = items.length - 1; index >= 0; index--) {
    const root = items[index];
    if (root.type === 'group') {
      const rootMatrix = composeTransform(root);
      for (let childIndex = root.children.length - 1; childIndex >= 0; childIndex--) {
        const child = root.children[childIndex];
        const asset = metadata[child.assetId];
        if (!asset) continue;
        const local = transformPoint(invert(multiply(rootMatrix, composeTransform(child))), point);
        if (local.x >= 0 && local.y >= 0 && local.x <= asset.width && local.y <= asset.height) return { rootId: root.id, childId: child.id, assetId: child.assetId };
      }
    } else {
      const asset = metadata[root.assetId];
      if (!asset) continue;
      const local = transformPoint(invert(composeTransform(root)), point);
      if (local.x >= 0 && local.y >= 0 && local.x <= asset.width && local.y <= asset.height) return { rootId: root.id, childId: root.id, assetId: root.assetId };
    }
  }
  return null;
}

export function rootVisualCenter(item, metadata) {
  const bounds = localBounds(item, metadata);
  if (!bounds) return { x: item.x, y: item.y };
  return transformPoint(composeTransform(item), { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 });
}

export function transformAroundCenter(item, metadata, scale = item.scale || 1, rotation = item.rotation || 0) {
  const bounds = localBounds(item, metadata);
  if (!bounds) return { x: item.x, y: item.y, scale, rotation };
  const center = rootVisualCenter(item, metadata);
  const localX = (bounds.left + bounds.right) / 2;
  const localY = (bounds.top + bounds.bottom) / 2;
  const radians = rotation * Math.PI / 180;
  const cos = Math.cos(radians) * scale;
  const sin = Math.sin(radians) * scale;
  return {
    x: center.x - cos * localX + sin * localY,
    y: center.y - sin * localX - cos * localY,
    scale,
    rotation
  };
}
