function clampProgress(progress) {
  return Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
}

export function interpolateTransform(from, to, progress) {
  const amount = clampProgress(progress);
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
    scale: from.scale + (to.scale - from.scale) * amount,
    rotation: from.rotation + (to.rotation - from.rotation) * amount
  };
}

export function interpolateCamera(from, to, progress) {
  const amount = clampProgress(progress);
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
    zoom: from.zoom + (to.zoom - from.zoom) * amount
  };
}

export function createImportLayoutTransitions(records, components, rootIds, documentItems, camera, width, height) {
  const stageByAssetId = new Map(records.map((record, index) => [record.id, {
    x: camera.x - width / (2 * camera.zoom) + 32 + index * 26,
    y: camera.y - height / (2 * camera.zoom) + 46
  }]));
  const groups = Array.isArray(components) && components.length
    ? components
    : records.map((record) => [{ assetId: record.id }]);
  const rootById = new Map(documentItems.map((item) => [item.id, item]));
  const transitions = new Map();

  groups.forEach((component, index) => {
    const root = rootById.get(rootIds[index]);
    if (!root) return;
    const to = { x: root.x, y: root.y, scale: root.scale || 1, rotation: root.rotation || 0 };
    if (root.type === 'group') {
      const children = new Map();
      for (const child of root.children) {
        const stage = stageByAssetId.get(child.assetId);
        if (!stage) continue;
        children.set(child.id, {
          from: { x: stage.x - root.x, y: stage.y - root.y, scale: 1, rotation: 0 },
          to: { x: child.x, y: child.y, scale: child.scale || 1, rotation: child.rotation || 0 }
        });
      }
      transitions.set(root.id, { from: to, to, children });
      return;
    }
    const stage = stageByAssetId.get(root.assetId);
    if (!stage) return;
    transitions.set(root.id, {
      from: { x: stage.x, y: stage.y, scale: 1, rotation: 0 },
      to
    });
  });
  return transitions;
}

export function prefersReducedMotion(mediaQuery = globalThis.matchMedia) {
  try { return Boolean(mediaQuery?.('(prefers-reduced-motion: reduce)')?.matches); }
  catch { return false; }
}
