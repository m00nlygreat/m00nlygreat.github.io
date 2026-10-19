import {
  findContainingGroup,
  findRoot,
  groupItems,
  groupFromStitch,
  addPastedImageToTarget,
  makeImage,
  mergeImageIntoTarget,
  moveRoot,
  referencedAssetIds,
  removeItem,
  reorderItem,
  setRootTransform,
  ungroup
} from './model.js';

export function normalizeSelection(document, selection = {}) {
  const selectedId = selection.selectedId && findRoot(document, selection.selectedId)
    ? selection.selectedId
    : null;
  const selected = selectedId ? findRoot(document, selectedId) : null;
  const focusedChild = selected?.type === 'group' && selection.layerFocusParent === selectedId
    ? selected.children.find((child) => child.id === selection.layerFocusId)
    : null;
  return {
    selectedId,
    layerFocusId: focusedChild?.id || selectedId,
    layerFocusParent: focusedChild ? selectedId : null
  };
}

export function commandAvailability(document, selection = {}, transient = {}) {
  const normalized = normalizeSelection(document, selection);
  const selected = normalized.selectedId ? findRoot(document, normalized.selectedId) : null;
  const siblings = normalized.layerFocusParent
    ? findRoot(document, normalized.layerFocusParent)?.children
    : document.items;
  const index = siblings?.findIndex((item) => item.id === normalized.layerFocusId) ?? -1;
  const available = !transient.processing && !transient.aligning;
  return {
    canMove: available && Boolean(selected),
    canTransform: available && Boolean(selected),
    canResetTransform: available && Boolean(selected && ((selected.scale || 1) !== 1 || (selected.rotation || 0) !== 0)),
    canAlign: available && selected?.type === 'image' && Boolean(selected.needsAlignment),
    canUngroup: available && selected?.type === 'group',
    canDelete: available && Boolean(normalized.layerFocusId),
    canMoveForward: available && index >= 0 && index < siblings.length - 1,
    canMoveBackward: available && index > 0
  };
}

function normalizedComponents(records, components, engineError) {
  if (!Array.isArray(records) || records.length === 0) throw new Error('가져올 이미지가 없습니다.');
  const recordById = new Map();
  for (const record of records) {
    if (!record?.id || recordById.has(record.id) || !Number.isFinite(record.width) || !Number.isFinite(record.height) || record.width <= 0 || record.height <= 0) {
      throw new Error('가져오기 이미지 정보가 올바르지 않습니다.');
    }
    recordById.set(record.id, record);
  }
  if (engineError || !Array.isArray(components) || components.length === 0) {
    return records.map((record) => [{
      assetId: record.id,
      x: 0,
      y: 0,
      matched: false,
      needsAlignment: records.length > 1 && !engineError,
      failureReasons: []
    }]);
  }

  const seen = new Set();
  for (const component of components) {
    if (!Array.isArray(component) || component.length === 0) throw new Error('스티칭 집합이 비어 있습니다.');
    for (const entry of component) {
      if (!recordById.has(entry?.assetId) || seen.has(entry.assetId) || !Number.isFinite(entry.x) || !Number.isFinite(entry.y)) {
        throw new Error('스티칭 결과의 원본 ID 또는 좌표가 올바르지 않습니다.');
      }
      seen.add(entry.assetId);
    }
  }
  if (seen.size !== recordById.size) throw new Error('스티칭 결과에서 일부 원본을 찾을 수 없습니다.');
  return components;
}

export function applyImportResults(document, { records, components, engineError = null, origin = { x: 0, y: 0 } }) {
  const normalized = normalizedComponents(records, components, engineError);
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y)) throw new Error('가져오기 배치 기준이 올바르지 않습니다.');
  for (const record of records) {
    if (document.assets[record.id]) throw new Error('이미 사용 중인 이미지 ID입니다.');
  }

  const recordsById = new Map(records.map((record) => [record.id, record]));
  const sizes = normalized.map((component) => {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const entry of component) {
      const record = recordsById.get(entry.assetId);
      left = Math.min(left, entry.x); top = Math.min(top, entry.y);
      right = Math.max(right, entry.x + record.width); bottom = Math.max(bottom, entry.y + record.height);
    }
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  });

  const spacing = 48;
  const totalWidth = sizes.reduce((sum, box) => sum + box.width, 0) + Math.max(0, sizes.length - 1) * spacing;
  let cursor = origin.x - totalWidth / 2;
  const items = [...document.items];
  const metadata = { ...document.assets };
  let nextGroupNumber = document.nextGroupNumber;
  for (const record of records) {
    metadata[record.id] = { id: record.id, name: record.name, mime: record.mime, width: record.width, height: record.height };
  }

  const rootIds = [];
  for (let index = 0; index < normalized.length; index++) {
    const component = normalized[index];
    const bounds = sizes[index];
    const x = cursor;
    const y = origin.y - bounds.height / 2;
    if (component.length > 1 && !engineError) {
      const members = component.map((entry) => {
        const record = recordsById.get(entry.assetId);
        return { assetId: record.id, name: record.name, x: entry.x - bounds.left, y: entry.y - bounds.top, originX: x, originY: y };
      });
      const group = groupFromStitch({ ...document, nextGroupNumber }, members);
      nextGroupNumber++;
      items.push(group);
      rootIds.push(group.id);
    } else {
      const entry = component[0];
      const record = recordsById.get(entry.assetId);
      const image = makeImage({
        assetId: record.id,
        name: record.name,
        x: x + entry.x - bounds.left,
        y: y + entry.y - bounds.top,
        needsAlignment: entry.needsAlignment ?? (records.length > 1 && !engineError)
      });
      items.push(image);
      rootIds.push(image.id);
    }
    cursor += bounds.width + spacing;
  }

  document.items = items;
  document.assets = metadata;
  document.nextGroupNumber = nextGroupNumber;
  return {
    rootIds,
    assetIds: records.map((record) => record.id),
    selection: { selectedId: rootIds[0] || null, layerFocusId: rootIds[0] || null, layerFocusParent: null }
  };
}

export function groupLayersCommand(document, ids) {
  if (!Array.isArray(ids) || ids.length < 2 || new Set(ids).size !== ids.length || ids.some((id) => !findRoot(document, id))) {
    return { changed: false, reason: 'invalid-selection', selection: normalizeSelection(document) };
  }
  const group = groupItems(document, ids);
  if (!group) return { changed: false, reason: 'invalid-selection', selection: normalizeSelection(document) };
  return {
    changed: true,
    groupId: group.id,
    selection: normalizeSelection(document, { selectedId: group.id })
  };
}

export function addPastedImageToTargetCommand(document, record, targetId, transform) {
  const target = findRoot(document, targetId);
  if (!record?.id || !record?.name || !record?.mime || !Number.isFinite(record.width) || !Number.isFinite(record.height)
    || record.width <= 0 || record.height <= 0 || document.assets[record.id] || !target) {
    return { changed: false, reason: 'invalid-image-or-target', selection: normalizeSelection(document) };
  }
  if (![transform?.x, transform?.y, transform?.scale, transform?.rotation].every(Number.isFinite) || transform.scale <= 0) {
    return { changed: false, reason: 'invalid-transform', selection: normalizeSelection(document) };
  }
  const groupId = addPastedImageToTarget(document, record, targetId, transform);
  if (!groupId) return { changed: false, reason: 'merge-failed', selection: normalizeSelection(document) };
  return { changed: true, groupId, selection: normalizeSelection(document, { selectedId: groupId }) };
}

export function moveItemCommand(document, id, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { changed: false, reason: 'invalid-position' };
  return { changed: moveRoot(document, id, x, y), reason: findRoot(document, id) ? null : 'missing-item' };
}

export function transformItemCommand(document, id, transform) {
  if (![transform?.x, transform?.y, transform?.scale, transform?.rotation].every(Number.isFinite) || transform.scale <= 0) {
    return { changed: false, reason: 'invalid-transform' };
  }
  return { changed: setRootTransform(document, id, transform), reason: findRoot(document, id) ? null : 'missing-item' };
}

export function reorderLayerCommand(document, id, direction, parentId = null) {
  if (![-1, 1].includes(direction)) return { changed: false, reason: 'invalid-direction' };
  if (parentId && findRoot(document, parentId)?.type !== 'group') return { changed: false, reason: 'missing-parent' };
  if (parentId && !findContainingGroup(document, id)) return { changed: false, reason: 'missing-child' };
  return { changed: reorderItem(document, id, direction, parentId), reason: null };
}

export function reorderLayerToTargetCommand(document, id, targetId, parentId = null) {
  const siblings = parentId ? findRoot(document, parentId)?.children : document.items;
  if (!siblings) return { changed: false, reason: 'missing-parent' };
  const from = siblings.findIndex((item) => item.id === id);
  const to = siblings.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0) return { changed: false, reason: 'missing-item' };
  if (from === to) return { changed: false, reason: null };
  const [item] = siblings.splice(from, 1);
  siblings.splice(to, 0, item);
  return { changed: true, reason: null };
}

export function pruneUnreferencedAssetMetadata(document) {
  const referenced = referencedAssetIds(document);
  const removedIds = Object.keys(document.assets).filter((id) => !referenced.has(id));
  if (!removedIds.length) return removedIds;
  const assets = { ...document.assets };
  for (const id of removedIds) delete assets[id];
  document.assets = assets;
  return removedIds;
}

export function mergeAlignmentCommand(document, sourceId, targetId, transform) {
  const source = findRoot(document, sourceId);
  const target = findRoot(document, targetId);
  if (!source || source.type !== 'image' || !source.needsAlignment) return { changed: false, reason: 'invalid-source' };
  if (!target || target.id === source.id) return { changed: false, reason: 'invalid-target' };
  if (![transform?.x, transform?.y, transform?.scale, transform?.rotation].every(Number.isFinite) || transform.scale <= 0) {
    return { changed: false, reason: 'invalid-transform' };
  }
  Object.assign(source, transform);
  const groupId = mergeImageIntoTarget(document, sourceId, targetId);
  if (!groupId) return { changed: false, reason: 'merge-failed' };
  return { changed: true, selection: { selectedId: groupId, layerFocusId: groupId, layerFocusParent: null } };
}

export function keepAlignmentCommand(document, sourceId, transform) {
  const source = findRoot(document, sourceId);
  if (!source || source.type !== 'image' || !source.needsAlignment) return { changed: false, reason: 'invalid-source' };
  if (![transform?.x, transform?.y, transform?.scale, transform?.rotation].every(Number.isFinite) || transform.scale <= 0) {
    return { changed: false, reason: 'invalid-transform' };
  }
  Object.assign(source, transform, { needsAlignment: false });
  return { changed: true, selection: { selectedId: source.id, layerFocusId: source.id, layerFocusParent: null } };
}

export function deleteLayerCommand(document, selection = {}) {
  const normalized = normalizeSelection(document, selection);
  const id = normalized.layerFocusParent ? normalized.layerFocusId : normalized.selectedId;
  if (!id) return { changed: false, reason: 'missing-selection', selection: normalized };
  const result = removeItem(document, id);
  return {
    changed: result.removed,
    reason: result.removed ? null : 'missing-item',
    selection: normalizeSelection(document, { selectedId: result.selection })
  };
}

export function deleteLayersCommand(document, ids) {
  if (!Array.isArray(ids) || ids.length === 0 || new Set(ids).size !== ids.length || ids.some((id) => !findRoot(document, id))) {
    return { changed: false, reason: 'invalid-selection', selection: normalizeSelection(document) };
  }
  const selectedIds = new Set(ids);
  document.items = document.items.filter((item) => !selectedIds.has(item.id));
  return { changed: true, removedIds: [...selectedIds], selection: normalizeSelection(document) };
}

export function ungroupCommand(document, id) {
  const group = findRoot(document, id);
  if (group?.type !== 'group') return { changed: false, reason: 'not-a-group', selection: normalizeSelection(document) };
  const ids = ungroup(document, id);
  return { changed: ids.length > 0, reason: null, itemIds: ids, selection: normalizeSelection(document, { selectedId: ids[0] || null }) };
}
