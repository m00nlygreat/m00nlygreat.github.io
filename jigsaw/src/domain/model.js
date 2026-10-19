import { composeTransform, decomposeTransform, invert, multiply } from './geometry.js';

export const SCHEMA_VERSION = 1;
export const newId = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function createDocument() {
  return { schemaVersion: SCHEMA_VERSION, revision: 0, nextGroupNumber: 1, items: [], assets: {} };
}

export function makeImage({ id = newId(), assetId, name, x = 0, y = 0, needsAlignment = false }) {
  return { type: 'image', id, assetId, name, x, y, scale: 1, rotation: 0, needsAlignment };
}

export function findRoot(doc, id) {
  return doc.items.find((item) => item.id === id) || null;
}

export function findContainingGroup(doc, childId) {
  return doc.items.find((item) => item.type === 'group' && item.children.some((child) => child.id === childId)) || null;
}

export function moveRoot(doc, id, x, y) {
  const item = findRoot(doc, id);
  if (!item) return false;
  item.x = x;
  item.y = y;
  return true;
}

export function setRootTransform(doc, id, transform) {
  const item = findRoot(doc, id);
  if (!item) return false;
  item.x = transform.x;
  item.y = transform.y;
  item.scale = transform.scale;
  item.rotation = transform.rotation;
  return true;
}

export function reorderItem(doc, id, direction, parentId = null) {
  const list = parentId ? findRoot(doc, parentId)?.children : doc.items;
  if (!list) return false;
  const index = list.findIndex((item) => item.id === id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= list.length) return false;
  [list[index], list[next]] = [list[next], list[index]];
  return true;
}

export function groupFromStitch(doc, members, name = null) {
  if (members.length < 2) throw new Error('그룹에는 이미지가 두 장 이상 필요합니다.');
  const id = newId();
  const number = doc.nextGroupNumber++;
  const children = members.map((member) => ({
    id: newId(), assetId: member.assetId, name: member.name, x: member.x, y: member.y,
    scale: 1, rotation: 0, needsAlignment: false
  }));
  return { type: 'group', id, name: name || `스티칭 그룹 ${number}`, x: members[0].originX || 0,
    y: members[0].originY || 0, scale: 1, rotation: 0, children };
}

export function groupItems(doc, ids) {
  const selectedIds = new Set(ids);
  if (selectedIds.size < 2 || [...selectedIds].some((id) => !findRoot(doc, id))) return null;
  const selected = doc.items.filter((item) => selectedIds.has(item.id));
  if (selected.length !== selectedIds.size) return null;

  const children = [];
  for (const item of selected) {
    if (item.type === 'group') {
      const parentMatrix = composeTransform(item);
      for (const child of item.children) {
        children.push({
          ...child,
          ...decomposeTransform(multiply(parentMatrix, composeTransform(child)))
        });
      }
    } else {
      children.push({ ...item, ...decomposeTransform(composeTransform(item)) });
    }
  }

  const firstIndex = doc.items.findIndex((item) => selectedIds.has(item.id));
  const number = doc.nextGroupNumber++;
  const group = {
    type: 'group', id: newId(), name: `그룹 ${number}`,
    x: 0, y: 0, scale: 1, rotation: 0, children
  };
  doc.items = doc.items.filter((item) => !selectedIds.has(item.id));
  doc.items.splice(firstIndex, 0, group);
  return group;
}

export function mergeImageIntoTarget(doc, sourceId, targetId) {
  const sourceIndex = doc.items.findIndex((item) => item.id === sourceId && item.type === 'image');
  const targetIndex = doc.items.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceId === targetId) return null;
  const source = doc.items[sourceIndex];
  const target = doc.items[targetIndex];
  if (target.type === 'group') {
    const relative = decomposeTransform(multiply(invert(composeTransform(target)), composeTransform(source)));
    target.children.push({ ...source, ...relative, needsAlignment: false });
    doc.items.splice(sourceIndex, 1);
    return target.id;
  }
  const groupId = newId();
  const groupMatrix = [1, 0, 0, 1, target.x, target.y];
  const targetChild = { ...target, ...decomposeTransform(multiply(invert(groupMatrix), composeTransform(target))) };
  const sourceChild = { ...source, ...decomposeTransform(multiply(invert(groupMatrix), composeTransform(source))), needsAlignment: false };
  const group = { type: 'group', id: groupId, name: `스티칭 그룹 ${doc.nextGroupNumber++}`,
    x: target.x, y: target.y, scale: 1, rotation: 0, children: [targetChild, sourceChild] };
  const insertion = Math.min(sourceIndex, targetIndex);
  doc.items = doc.items.filter((item) => item.id !== sourceId && item.id !== targetId);
  doc.items.splice(insertion, 0, group);
  return group.id;
}

export function addPastedImageToTarget(doc, record, targetId, transform) {
  const target = findRoot(doc, targetId);
  if (!target || doc.assets[record.id]) return null;
  const source = makeImage({
    assetId: record.id,
    name: record.name,
    x: transform.x,
    y: transform.y
  });
  source.scale = transform.scale;
  source.rotation = transform.rotation;
  doc.assets = {
    ...doc.assets,
    [record.id]: { id: record.id, name: record.name, mime: record.mime, width: record.width, height: record.height }
  };
  doc.items.push(source);
  return mergeImageIntoTarget(doc, source.id, target.id);
}

export function ungroup(doc, groupId) {
  const index = doc.items.findIndex((item) => item.id === groupId && item.type === 'group');
  if (index < 0) return [];
  const group = doc.items[index];
  const matrix = composeTransform(group);
  const images = group.children.map((child) => ({
    type: 'image', ...child, ...decomposeTransform(multiply(matrix, composeTransform(child)))
  }));
  doc.items.splice(index, 1, ...images);
  return images.map((image) => image.id);
}

export function removeItem(doc, id) {
  const rootIndex = doc.items.findIndex((item) => item.id === id);
  if (rootIndex >= 0) {
    doc.items.splice(rootIndex, 1);
    return { removed: true, selection: null };
  }
  const parent = findContainingGroup(doc, id);
  if (!parent) return { removed: false, selection: null };
  parent.children = parent.children.filter((child) => child.id !== id);
  if (parent.children.length === 1) {
    const child = parent.children[0];
    const image = { type: 'image', ...child, ...decomposeTransform(multiply(composeTransform(parent), composeTransform(child))) };
    const index = doc.items.findIndex((item) => item.id === parent.id);
    doc.items.splice(index, 1, image);
    return { removed: true, selection: image.id };
  }
  if (parent.children.length === 0) doc.items = doc.items.filter((item) => item.id !== parent.id);
  return { removed: true, selection: parent.children.length ? parent.id : null };
}

export function referencedAssetIds(doc) {
  const ids = new Set();
  for (const item of doc.items) {
    if (item.type === 'group') for (const child of item.children) ids.add(child.assetId);
    else ids.add(item.assetId);
  }
  return ids;
}
