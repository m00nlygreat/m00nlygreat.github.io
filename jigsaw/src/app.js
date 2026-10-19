import { CanvasRenderer } from './canvas/renderer.js';
import { createImportLayoutTransitions, interpolateCamera, interpolateTransform, prefersReducedMotion } from './canvas/transition.js';
import { composeTransform, decomposeTransform, localBounds, multiply, rootVisualCenter, transformAroundCenter, transformPoint, worldBounds } from './domain/geometry.js';
import { createDocument, findRoot, newId, referencedAssetIds } from './domain/model.js';
import {
  applyImportResults,
  addPastedImageToTargetCommand,
  deleteLayerCommand,
  deleteLayersCommand,
  groupLayersCommand,
  keepAlignmentCommand,
  mergeAlignmentCommand,
  moveItemCommand,
  normalizeSelection,
  pruneUnreferencedAssetMetadata,
  reorderLayerCommand,
  reorderLayerToTargetCommand,
  transformItemCommand,
  ungroupCommand
} from './domain/commands.js';
import { renderLayerList } from './ui/layers.js';
import { renderSelectionDock } from './ui/selection.js';
import { renderAlignmentHint } from './ui/alignment.js';
import { appendToast, renderProcessingCard, renderSaveIndicator, renderStatus } from './ui/status.js';
import { decodeImageFile, releaseDecodedImage } from './imaging/decode.js';
import { createThumbnailUrl } from './imaging/thumbnail.js';
import { renderExport, deliverBlob } from './export/exporter.js';
import { LocalStore } from './persistence/store.js';
import { createPersistenceSnapshot } from './persistence/snapshot.js';
import { captureViewState, restoreViewState } from './persistence/view-state.js';
import { applyWaitingUpdate } from './pwa/update.js';
import { createStitchingService } from './stitching/service.js';
import { isInteractiveTarget, isTextEditingTarget, shouldIgnoreKeyboardShortcuts } from './input/keyboard.js';

const byId = (id) => document.getElementById(id);
const canvas = byId('canvas');
const sidebar = byId('sidebar');
const layerList = byId('layer-list');
const fileInput = byId('file-input');
const processingCard = byId('processing-card');
const alignHint = byId('align-hint');
const store = new LocalStore();
const stitching = createStitchingService();

let documentModel = createDocument();
let assets = new Map();
let camera = { x: 0, y: 0, zoom: 1 };
let selectedId = null;
let selectedIds = new Set();
let layerFocusId = null;
let layerFocusParent = null;
let layerRangeAnchor = null;
let expandedGroups = new Set();
let panelOpen = true;
let activeTool = 'select';
let spaceDown = false;
let pendingImages = [];
let alignDraft = null;
let transformDraft = null;
let multiTransformDraft = new Map();
let selectionRect = null;
let layoutTransition = null;
let snapGuides = null;
let gesture = null;
let pointerMap = new Map();
let stateRevision = 0;
let savedRevision = -1;
let saveTimer = null;
let saveQueue = Promise.resolve();
let persistenceBlocked = false;
let persistenceError = null;
let restoreFailed = false;
let processingHidden = false;
let importQueue = Promise.resolve();
let importsPending = 0;
let installPrompt = null;
let serviceWorkerRegistration = null;
let updateReloadRequested = false;
let exportBusy = false;

const renderer = new CanvasRenderer(canvas, (assetId) => assets.get(assetId)?.bitmap);

function refresh() {
  renderer.draw({ document: documentModel, metadata: documentModel.assets, camera, selectedId, selectedIds, pending: pendingImages, alignDraft, transformDraft, multiTransformDraft, selectionRect, layoutTransition, snapGuides });
  renderLayers();
  renderSelection();
  updateZoomLabels();
  updateAlignmentUI();
  updateEmptyState();
}

function updateEmptyState() {
  byId('empty-state').classList.toggle('hidden', documentModel.items.length > 0 || pendingImages.length > 0 || importsPending > 0);
}

function markChanged(documentChanged = false) {
  stateRevision++;
  if (documentChanged) documentModel.revision++;
  refresh();
  scheduleSave();
}

function setStatus(message, tone = 'normal') {
  renderStatus(byId('status-banner'), byId('status-text'), message, tone);
  byId('status-banner').classList.toggle('hidden', !message);
}

function showToast(message, tone = 'normal', duration = 5200) {
  appendToast(byId('toast-region'), message, tone, duration);
}

function saveIndicator(label, tone = 'normal') {
  const button = byId('save-status');
  byId('save-status-wrap').classList.toggle('hidden', tone !== 'error');
  renderSaveIndicator(button, label, tone);
  button.setAttribute('aria-label', restoreFailed ? '저장된 작업 복원 다시 시도'
    : '작업 저장 다시 시도');
}

function viewSnapshot() {
  return captureViewState(documentModel, { camera, selectedId, selectedIds, layerFocusId, layerFocusParent, expandedGroups, panelOpen });
}

function persistenceSnapshot() {
  return createPersistenceSnapshot(documentModel, assets, viewSnapshot(), stateRevision);
}

function scheduleSave(immediate = false) {
  if (persistenceBlocked) {
    saveIndicator(persistenceError ? '복원 확인 필요' : '저장소 사용 불가', 'error');
    return;
  }
  if (!globalThis.indexedDB) {
    persistenceError = new Error('이 브라우저는 IndexedDB를 지원하지 않습니다.');
    saveIndicator('저장 실패', 'error');
    setStatus('로컬 저장소를 사용할 수 없습니다', 'error');
    return;
  }
  clearTimeout(saveTimer);
  saveIndicator('저장 전', 'dirty');
  if (immediate) void persistNow();
  else saveTimer = setTimeout(() => void persistNow(), 450);
}

async function persistNow() {
  if (persistenceBlocked) return;
  const snapshot = persistenceSnapshot();
  const targetRevision = snapshot.stateRevision;
  saveIndicator('저장 중', 'saving');
  saveQueue = saveQueue.catch(() => {}).then(() => store.save(snapshot));
  try {
    await saveQueue;
    if (targetRevision === stateRevision) {
      savedRevision = targetRevision;
      const clearedSaveError = Boolean(persistenceError);
      persistenceError = null;
      saveIndicator('', 'saved');
      if (clearedSaveError) setStatus('', 'normal');
    } else {
      saveIndicator('저장 전', 'dirty');
      scheduleSave(true);
    }
  } catch (error) {
    persistenceError = error;
    saveIndicator('저장 실패', 'error');
    setStatus(`저장 실패: ${error.message || '다시 시도해 주세요'}`, 'error');
  }
}

function pruneAssets() {
  const removedIds = new Set(pruneUnreferencedAssetMetadata(documentModel));
  for (const [id, asset] of assets) {
    if (!removedIds.has(id)) continue;
    asset.bitmap?.close?.();
    if (asset.previewUrl) URL.revokeObjectURL(asset.previewUrl);
    assets.delete(id);
  }
}

function assetNameFor(id) { return documentModel.assets[id]?.name || '이미지'; }

function setSelection(id, focusId = id, parentId = null, save = true) {
  finishLayoutTransition();
  const normalized = normalizeSelection(documentModel, { selectedId: id, layerFocusId: focusId, layerFocusParent: parentId });
  const nextIds = new Set(normalized.selectedId ? [normalized.selectedId] : []);
  const changed = selectedId !== normalized.selectedId || layerFocusId !== normalized.layerFocusId || layerFocusParent !== normalized.layerFocusParent
    || !sameIdSet(selectedIds, nextIds);
  selectedId = normalized.selectedId;
  selectedIds = nextIds;
  layerFocusId = normalized.layerFocusId;
  layerFocusParent = normalized.layerFocusParent;
  refresh();
  if (changed && save) markChanged(false);
}

function sameIdSet(left, right) {
  return left.size === right.size && [...left].every((id) => right.has(id));
}

function setMultipleSelection(ids, primaryId = null, save = true) {
  finishLayoutTransition();
  const validIds = [...new Set(ids)].filter((id) => Boolean(findRoot(documentModel, id)));
  const nextIds = new Set(validIds);
  const selected = validIds.includes(primaryId) ? primaryId : validIds.at(-1) || null;
  const normalized = normalizeSelection(documentModel, { selectedId: selected });
  const changed = selectedId !== normalized.selectedId || layerFocusId !== normalized.layerFocusId || layerFocusParent !== null
    || !sameIdSet(selectedIds, nextIds);
  selectedId = normalized.selectedId;
  selectedIds = nextIds;
  layerFocusId = normalized.layerFocusId;
  layerFocusParent = null;
  refresh();
  if (changed && save) markChanged(false);
}

function adoptSelection(selection = {}) {
  ({ selectedId, layerFocusId, layerFocusParent } = selection);
  selectedIds = new Set(selectedId ? [selectedId] : []);
}

function updateZoomLabels() {
  const label = `${Math.round(camera.zoom * 100)}%`;
  byId('zoom-label').textContent = label;
  byId('zoom-label').setAttribute('aria-label', `현재 확대율 ${label}. 클릭하여 100%로 초기화`);
  byId('canvas-zoom').textContent = label;
}

function renderSelection() {
  const selectedRoot = selectedId && findRoot(documentModel, selectedId);
  const transition = selectedRoot && layoutTransition?.items.get(selectedRoot.id);
  const layoutTransform = transition ? interpolateTransform(transition.from, transition.to, layoutTransition.progress) : null;
  renderSelectionDock({
    documentModel, selectedId, selectedIds, layerFocusId, layerFocusParent, alignDraft, transformDraft, layoutTransform,
    elements: {
      dock: byId('selection-dock'), name: byId('selection-name'), meta: byId('selection-meta'),
      x: byId('value-x'), y: byId('value-y'), scale: byId('value-scale'), rotation: byId('value-rotation'),
      groupButton: byId('selection-group'), alignButton: byId('align-button'), resetButton: byId('reset-transform')
    }
  });
  const toolbarSelection = selectedId ? findRoot(documentModel, selectedId) : null;
  byId('toolbar-group').disabled = selectedIds.size < 2 || Boolean(alignDraft);
  byId('toolbar-ungroup').disabled = selectedIds.size !== 1 || !toolbarSelection || toolbarSelection.type !== 'group' || Boolean(alignDraft);
  byId('toolbar-delete').disabled = selectedIds.size === 0 || Boolean(alignDraft);
}

function renderLayers() {
  renderLayerList({ documentModel, assets, selectedId, selectedIds, layerFocusId, expandedGroups, layerList, aligning: Boolean(alignDraft) });
}

function updateAlignmentUI() {
  const source = findRoot(documentModel, alignDraft?.id);
  const target = findRoot(documentModel, alignDraft?.targetId);
  renderAlignmentHint({
    container: alignHint,
    alignDraft,
    sourceName: source ? assetNameFor(source.assetId) : null,
    targetName: target?.name,
    onMerge: finishAlignmentMerge,
    onKeep: keepAlignmentSeparate,
    onCancel: cancelAlignment
  });
}

function togglePanel(open = !panelOpen) {
  finishLayoutTransition();
  const returnFocus = !open && sidebar.contains(document.activeElement);
  panelOpen = Boolean(open);
  sidebar.classList.toggle('closed', !panelOpen);
  byId('layers-toggle').classList.toggle('active', panelOpen);
  byId('layers-toggle').setAttribute('aria-pressed', String(panelOpen));
  markChanged(false);
  if (returnFocus) byId('layers-toggle').focus({ preventScroll: true });
}

function setTool(tool) {
  activeTool = tool;
  byId('select-tool').classList.toggle('active', tool === 'select');
  byId('select-tool').setAttribute('aria-pressed', String(tool === 'select'));
  byId('pan-tool').classList.toggle('active', tool === 'pan');
  byId('pan-tool').setAttribute('aria-pressed', String(tool === 'pan'));
  canvas.classList.toggle('pan-cursor', tool === 'pan' || spaceDown);
}

function zoomAt(nextZoom, sx = renderer.width / 2, sy = renderer.height / 2) {
  finishLayoutTransition();
  const world = renderer.toWorld(sx, sy, camera);
  camera.zoom = Math.max(0.04, Math.min(4, nextZoom));
  camera.x = world.x - (sx - renderer.width / 2) / camera.zoom;
  camera.y = world.y - (sy - renderer.height / 2) / camera.zoom;
  markChanged(false);
}

function fitViewport() {
  const frame = canvas.getBoundingClientRect();
  const region = { left: 12, top: 12, right: renderer.width - 12, bottom: renderer.height - 12 };
  const isVisible = (element) => element && !element.classList.contains('hidden') && getComputedStyle(element).display !== 'none';
  const overlaps = (rect) => rect.right > frame.left + region.left && rect.left < frame.left + region.right
    && rect.bottom > frame.top && rect.top < frame.bottom;

  for (const element of [processingCard, alignHint]) {
    if (!isVisible(element)) continue;
    const rect = element.getBoundingClientRect();
    if (overlaps(rect) && rect.top <= frame.top + renderer.height / 2) {
      region.top = Math.max(region.top, rect.bottom - frame.top + 12);
    }
  }
  for (const element of [byId('selection-dock'), document.querySelector('.toolbar')]) {
    if (!isVisible(element)) continue;
    const rect = element.getBoundingClientRect();
    if (overlaps(rect) && rect.bottom >= frame.top + renderer.height / 2) {
      region.bottom = Math.min(region.bottom, rect.top - frame.top - 12);
    }
  }
  if (panelOpen && isVisible(sidebar)) {
    const rect = sidebar.getBoundingClientRect();
    if (overlaps(rect)) {
      if (matchMedia('(max-width: 700px)').matches && rect.top > frame.top + 24) {
        region.bottom = Math.min(region.bottom, rect.top - frame.top - 12);
      } else {
        region.right = Math.min(region.right, rect.left - frame.left - 12);
      }
    }
  }
  if (region.right <= region.left || region.bottom <= region.top) {
    return { left: 0, top: 0, right: renderer.width, bottom: renderer.height };
  }
  return region;
}

function fitDocument() {
  renderer.fit(documentModel.items, documentModel.assets, camera, 24, fitViewport());
}

function finishLayoutTransition() {
  if (!layoutTransition) return false;
  camera = { ...layoutTransition.toCamera };
  layoutTransition = null;
  refresh();
  markChanged(false);
  return true;
}

function animateImportLayout(records, components, rootIds, fromCamera) {
  const targetCamera = { ...camera };
  renderer.fit(documentModel.items, documentModel.assets, targetCamera, 24, fitViewport());
  const transitions = createImportLayoutTransitions(
    records, components, rootIds, documentModel.items, fromCamera, renderer.width, renderer.height
  );

  const motionEnabled = !prefersReducedMotion() && typeof requestAnimationFrame === 'function' && transitions.size > 0;
  if (!motionEnabled) {
    camera = targetCamera;
    layoutTransition = null;
    refresh();
    return;
  }

  const transition = {
    fromCamera: { ...fromCamera },
    toCamera: targetCamera,
    items: transitions,
    startedAt: performance.now(),
    duration: 360,
    progress: 0
  };
  layoutTransition = transition;
  const animate = (now) => {
    if (layoutTransition !== transition) return;
    const progress = Math.max(0, Math.min(1, (now - transition.startedAt) / transition.duration));
    transition.progress = progress;
    camera = interpolateCamera(transition.fromCamera, transition.toCamera, progress);
    refresh();
    if (progress < 1) {
      requestAnimationFrame(animate);
      return;
    }
    camera = { ...transition.toCamera };
    layoutTransition = null;
    markChanged(false);
  };
  refresh();
  requestAnimationFrame(animate);
}

function fitAll() {
  finishLayoutTransition();
  fitDocument();
  markChanged(false);
}

function focusLayer(itemId, parentId = null) {
  const rootId = parentId || itemId;
  if (!findRoot(documentModel, rootId)) return;
  layerRangeAnchor = rootId;
  setSelection(rootId, itemId, parentId, true);
}

function moveFocusedLayer(direction) {
  if (!layerFocusId) return;
  const result = reorderLayerCommand(documentModel, layerFocusId, direction, layerFocusParent);
  if (result.changed) markChanged(true);
}

function reorderByDrop(sourceId, sourceParent, targetId, targetParent) {
  if (!sourceId || !targetId || sourceId === targetId || sourceParent !== targetParent) return;
  const list = sourceParent ? findRoot(documentModel, sourceParent)?.children : documentModel.items;
  if (!list) return;
  const uiOrder = [...list].reverse();
  const from = uiOrder.findIndex((item) => item.id === sourceId);
  const to = uiOrder.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0) return;
  const underlyingTarget = uiOrder[to].id;
  const result = reorderLayerToTargetCommand(documentModel, sourceId, underlyingTarget, sourceParent);
  if (result.changed) markChanged(true);
}

function onLayerClick(event) {
  finishLayoutTransition();
  const button = event.target.closest('button[data-action]');
  const row = event.target.closest('.layer-row');
  if (!row) return;
  const id = row.dataset.id;
  const parentId = row.dataset.parent || null;
  if (button?.dataset.action === 'expand') {
    if (expandedGroups.has(id)) expandedGroups.delete(id); else expandedGroups.add(id);
    markChanged(false);
    return;
  }
  if (button?.dataset.action === 'front' || button?.dataset.action === 'back') {
    focusLayer(id, parentId);
    moveFocusedLayer(button.dataset.action === 'front' ? 1 : -1);
    return;
  }
  const rootId = parentId || id;
  if (event.shiftKey || event.ctrlKey || event.metaKey) {
    const order = [...documentModel.items].reverse().map((item) => item.id);
    if (event.shiftKey) {
      const anchorId = layerRangeAnchor && order.includes(layerRangeAnchor) ? layerRangeAnchor : selectedId || rootId;
      const targetIndex = order.indexOf(rootId);
      const foundAnchor = order.indexOf(anchorId);
      const anchorIndex = foundAnchor >= 0 ? foundAnchor : targetIndex;
      const range = order.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1);
      setMultipleSelection([...selectedIds, ...range], rootId, true);
    } else {
      const next = new Set(selectedIds);
      if (next.has(rootId)) next.delete(rootId); else next.add(rootId);
      setMultipleSelection([...next], rootId, true);
    }
    return;
  }
  focusLayer(id, parentId);
}

function getCanvasPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function currentRootTransform(item) { return { x: item.x, y: item.y, scale: item.scale || 1, rotation: item.rotation || 0 }; }

function closestSnap(sourceBounds, targetBounds, axis, tolerance) {
  const sourceFeatures = axis === 'x'
    ? [sourceBounds.left, (sourceBounds.left + sourceBounds.right) / 2, sourceBounds.right]
    : [sourceBounds.top, (sourceBounds.top + sourceBounds.bottom) / 2, sourceBounds.bottom];
  let closest = null;
  for (const bounds of targetBounds) {
    const targetFeatures = axis === 'x'
      ? [bounds.left, (bounds.left + bounds.right) / 2, bounds.right]
      : [bounds.top, (bounds.top + bounds.bottom) / 2, bounds.bottom];
    for (const source of sourceFeatures) {
      for (const target of targetFeatures) {
        const delta = target - source;
        const distance = Math.abs(delta);
        if (distance <= tolerance && (!closest || distance < closest.distance)) closest = { delta, coordinate: target, distance };
      }
    }
  }
  return closest;
}

function snapTransformToImages(item, transform, ignoredIds = new Set([item.id])) {
  const sourceBounds = worldBounds({ ...item, ...transform }, documentModel.assets);
  if (!sourceBounds) return { transform, guides: null };
  const targets = documentModel.items
    .filter((target) => !ignoredIds.has(target.id))
    .map((target) => worldBounds(target, documentModel.assets))
    .filter(Boolean);
  if (!targets.length) return { transform, guides: null };

  const tolerance = 8 / camera.zoom;
  const horizontal = closestSnap(sourceBounds, targets, 'x', tolerance);
  const vertical = closestSnap(sourceBounds, targets, 'y', tolerance);
  return {
    transform: {
      ...transform,
      x: transform.x + (horizontal?.delta || 0),
      y: transform.y + (vertical?.delta || 0)
    },
    guides: horizontal || vertical ? { x: horizontal?.coordinate ?? null, y: vertical?.coordinate ?? null } : null
  };
}

function canvasHandle(item, screen) {
  const bounds = worldBounds(item, documentModel.assets);
  if (!bounds) return null;
  const left = renderer.toScreen(bounds.left, bounds.top, camera);
  const right = renderer.toScreen(bounds.right, bounds.bottom, camera);
  const corners = [[left.x, left.y], [right.x, left.y], [right.x, right.y], [left.x, right.y]];
  const touchTarget = matchMedia('(pointer: coarse)').matches ? 24 : 10;
  if (corners.some(([x, y]) => Math.hypot(screen.x - x, screen.y - y) <= touchTarget)) return 'resize';
  const rotateHandle = { x: (left.x + right.x) / 2, y: left.y - 23 };
  if (Math.hypot(screen.x - rotateHandle.x, screen.y - rotateHandle.y) <= Math.max(11, touchTarget)) return 'rotate';
  return null;
}

function screenBoundsForItem(item) {
  const bounds = worldBounds(item, documentModel.assets);
  if (!bounds) return null;
  const first = renderer.toScreen(bounds.left, bounds.top, camera);
  const second = renderer.toScreen(bounds.right, bounds.bottom, camera);
  return {
    left: Math.min(first.x, second.x),
    top: Math.min(first.y, second.y),
    right: Math.max(first.x, second.x),
    bottom: Math.max(first.y, second.y)
  };
}

function rectFromPoints(first, second) {
  return {
    left: Math.min(first.x, second.x),
    top: Math.min(first.y, second.y),
    right: Math.max(first.x, second.x),
    bottom: Math.max(first.y, second.y)
  };
}

function idsInSelectionRect(rect) {
  return documentModel.items.filter((item) => {
    const bounds = screenBoundsForItem(item);
    return bounds && bounds.left <= rect.right && bounds.right >= rect.left
      && bounds.top <= rect.bottom && bounds.bottom >= rect.top;
  }).map((item) => item.id);
}

function commitMarqueeSelection(finished) {
  if (!finished.moved || !selectionRect) {
    if (finished.mode === 'replace') setSelection(null, null, null, true);
    return;
  }
  const hits = idsInSelectionRect(selectionRect);
  const next = new Set(finished.baseIds);
  if (finished.mode === 'replace') {
    setMultipleSelection(hits, hits.at(-1) || null, true);
  } else if (finished.mode === 'add') {
    for (const id of hits) next.add(id);
    setMultipleSelection([...next], hits.at(-1) || finished.primaryId, true);
  } else {
    for (const id of hits) {
      if (next.has(id)) next.delete(id); else next.add(id);
    }
    setMultipleSelection([...next], hits.at(-1) || finished.primaryId, true);
  }
}

function transformAtPointer(item, kind, start, screen) {
  const world = renderer.toWorld(screen.x, screen.y, camera);
  const original = start.transform;
  const center = start.center;
  const pointerAngle = Math.atan2(world.y - center.y, world.x - center.x);
  let scale = original.scale;
  let rotation = original.rotation;
  if (kind === 'resize') {
    const distance = Math.hypot(world.x - center.x, world.y - center.y);
    scale = Math.max(0.05, Math.min(16, original.scale * distance / Math.max(1, start.distance)));
  } else {
    let delta = (pointerAngle - start.angle) * 180 / Math.PI;
    rotation = original.rotation + delta;
    if (start.shift) rotation = Math.round(rotation / 15) * 15;
  }
  return transformAroundCenter(item, documentModel.assets, scale, rotation);
}

function onPointerDown(event) {
  finishLayoutTransition();
  if (event.button !== 0 && event.button !== 1) return;
  const screen = getCanvasPosition(event);
  pointerMap.set(event.pointerId, screen);
  try { canvas.setPointerCapture(event.pointerId); } catch { /* input may lose capture on window changes */ }
  if (pointerMap.size >= 2) {
    if (gesture?.type === 'move' || gesture?.type === 'multi-move' || gesture?.type === 'resize' || gesture?.type === 'rotate') {
      transformDraft = null;
      multiTransformDraft.clear();
    }
    if (gesture?.type === 'marquee') {
      selectionRect = null;
      canvas.classList.remove('selecting');
    }
    if (gesture?.type === 'align-move' && alignDraft) alignDraft.transform = { ...alignDraft.initialTransform };
    snapGuides = null;
    canvas.classList.remove('dragging');
    const entries = [...pointerMap.values()];
    const midpoint = { x: (entries[0].x + entries[1].x) / 2, y: (entries[0].y + entries[1].y) / 2 };
    const world = renderer.toWorld(midpoint.x, midpoint.y, camera);
    gesture = { type: 'pinch', initialDistance: Math.hypot(entries[1].x - entries[0].x, entries[1].y - entries[0].y), initialZoom: camera.zoom, anchor: world, camera: { ...camera }, moved: true };
    refresh();
    event.preventDefault();
    return;
  }

  const hit = renderer.hitTest(documentModel.items, documentModel.assets, camera, screen.x, screen.y);
  if (alignDraft) {
    if (hit?.rootId === alignDraft.id) {
      const current = { ...alignDraft.transform };
      gesture = { type: 'align-move', id: alignDraft.id, start: screen, transform: current, moved: false };
    } else if (hit && hit.rootId !== alignDraft.id) {
      alignDraft.targetId = hit.rootId;
      refresh();
    }
    event.preventDefault();
    return;
  }

  const pan = event.button === 1 || spaceDown || activeTool === 'pan';
  if (pan) {
    gesture = { type: 'pan', start: screen, camera: { ...camera }, last: screen, moved: false };
    canvas.classList.add('dragging');
    event.preventDefault();
    return;
  }

  const selected = selectedId ? findRoot(documentModel, selectedId) : null;
  const modifiedSelection = event.shiftKey || event.ctrlKey || event.metaKey;
  const handle = !modifiedSelection && selectedIds.size === 1 && selected && selectedId === selected.id ? canvasHandle(selected, screen) : null;
  if (handle) {
    const world = renderer.toWorld(screen.x, screen.y, camera);
    const center = rootVisualCenter(selected, documentModel.assets);
    gesture = { type: handle, id: selected.id, start: screen, transform: currentRootTransform(selected), center,
      distance: Math.hypot(world.x - center.x, world.y - center.y), angle: Math.atan2(world.y - center.y, world.x - center.x), shift: event.shiftKey, moved: false };
    return;
  }

  if (hit) {
    if (modifiedSelection) {
      const next = new Set(selectedIds);
      if (event.ctrlKey || event.metaKey) {
        if (next.has(hit.rootId)) next.delete(hit.rootId); else next.add(hit.rootId);
      } else next.add(hit.rootId);
      setMultipleSelection([...next], hit.rootId, true);
      gesture = { type: 'select-click', start: screen, moved: false };
      event.preventDefault();
      return;
    }
    layerRangeAnchor = hit.rootId;
    if (selectedIds.size > 1 && selectedIds.has(hit.rootId)) setMultipleSelection([...selectedIds], hit.rootId, true);
    else setSelection(hit.rootId, hit.childId, hit.childId === hit.rootId ? null : hit.rootId, true);
    const item = findRoot(documentModel, hit.rootId);
    if (item && selectedIds.size > 1) {
      gesture = {
        type: 'multi-move', ids: [...selectedIds], primaryId: item.id, start: screen,
        transforms: new Map([...selectedIds].map((id) => [id, currentRootTransform(findRoot(documentModel, id))])), moved: false
      };
    } else if (item) gesture = { type: 'move', id: item.id, start: screen, transform: currentRootTransform(item), moved: false };
  } else {
    selectionRect = null;
    canvas.classList.add('selecting');
    gesture = {
      type: 'marquee', start: screen,
      mode: event.ctrlKey || event.metaKey ? 'toggle' : event.shiftKey ? 'add' : 'replace',
      baseIds: [...selectedIds], primaryId: selectedId, moved: false
    };
  }
}

function onPointerMove(event) {
  const screen = getCanvasPosition(event);
  if (pointerMap.has(event.pointerId)) pointerMap.set(event.pointerId, screen);
  if (!gesture) return;
  if (gesture.type === 'pinch' && pointerMap.size >= 2) {
    const entries = [...pointerMap.values()];
    const midpoint = { x: (entries[0].x + entries[1].x) / 2, y: (entries[0].y + entries[1].y) / 2 };
    const distance = Math.max(1, Math.hypot(entries[1].x - entries[0].x, entries[1].y - entries[0].y));
    camera.zoom = Math.max(0.04, Math.min(4, gesture.initialZoom * distance / Math.max(1, gesture.initialDistance)));
    camera.x = gesture.anchor.x - (midpoint.x - renderer.width / 2) / camera.zoom;
    camera.y = gesture.anchor.y - (midpoint.y - renderer.height / 2) / camera.zoom;
    gesture.moved = true;
    snapGuides = null;
    refresh();
    event.preventDefault();
    return;
  }
  const dx = screen.x - gesture.start.x, dy = screen.y - gesture.start.y;
  if (Math.hypot(dx, dy) > 2) gesture.moved = true;
  snapGuides = null;
  if (gesture.type === 'marquee') {
    selectionRect = rectFromPoints(gesture.start, screen);
  } else if (gesture.type === 'pan') {
    camera.x = gesture.camera.x - dx / camera.zoom;
    camera.y = gesture.camera.y - dy / camera.zoom;
  } else if (gesture.type === 'move') {
    const item = findRoot(documentModel, gesture.id);
    if (item) {
      const moved = { x: gesture.transform.x + dx / camera.zoom, y: gesture.transform.y + dy / camera.zoom, scale: gesture.transform.scale, rotation: gesture.transform.rotation };
      const snapped = snapTransformToImages(item, moved);
      transformDraft = { id: gesture.id, transform: snapped.transform };
      snapGuides = snapped.guides;
    }
  } else if (gesture.type === 'multi-move') {
    const primary = findRoot(documentModel, gesture.primaryId);
    const base = gesture.transforms.get(gesture.primaryId);
    if (primary && base) {
      const moved = { ...base, x: base.x + dx / camera.zoom, y: base.y + dy / camera.zoom };
      const snapped = snapTransformToImages(primary, moved, new Set(gesture.ids));
      const deltaX = snapped.transform.x - base.x;
      const deltaY = snapped.transform.y - base.y;
      multiTransformDraft = new Map(gesture.ids.map((id) => {
        const transform = gesture.transforms.get(id);
        return [id, { ...transform, x: transform.x + deltaX, y: transform.y + deltaY }];
      }));
      snapGuides = snapped.guides;
    }
  } else if (gesture.type === 'align-move') {
    const item = findRoot(documentModel, gesture.id);
    if (item) {
      const moved = { x: gesture.transform.x + dx / camera.zoom, y: gesture.transform.y + dy / camera.zoom, scale: gesture.transform.scale, rotation: gesture.transform.rotation };
      const snapped = snapTransformToImages(item, moved);
      alignDraft.transform = snapped.transform;
      snapGuides = snapped.guides;
    }
  } else if (gesture.type === 'resize' || gesture.type === 'rotate') {
    const item = findRoot(documentModel, gesture.id);
    if (item) transformDraft = { id: item.id, transform: transformAtPointer(item, gesture.type, { ...gesture, shift: event.shiftKey }, screen) };
  }
  refresh();
  event.preventDefault();
}

function finishPointer(cancel = false) {
  const finished = gesture;
  snapGuides = null;
  if (!finished) { pointerMap.clear(); refresh(); return; }
  gesture = null;
  pointerMap.clear();
  canvas.classList.remove('dragging');
  canvas.classList.remove('selecting');
  if (finished.type === 'move' || finished.type === 'resize' || finished.type === 'rotate') {
    if (!cancel && finished.moved && transformDraft?.id === finished.id) {
      transformItemCommand(documentModel, finished.id, transformDraft.transform);
      transformDraft = null;
      markChanged(true);
    } else { transformDraft = null; refresh(); }
  } else if (finished.type === 'multi-move') {
    if (!cancel && finished.moved && multiTransformDraft.size) {
      for (const [id, transform] of multiTransformDraft) transformItemCommand(documentModel, id, transform);
      multiTransformDraft.clear();
      markChanged(true);
    } else {
      multiTransformDraft.clear();
      refresh();
    }
  } else if (finished.type === 'marquee') {
    if (!cancel) commitMarqueeSelection(finished);
    selectionRect = null;
    refresh();
  } else if (finished.type === 'align-move') {
    if (cancel) alignDraft.transform = { ...alignDraft.initialTransform };
    refresh();
  } else if (finished.type === 'pan' || finished.type === 'pinch') {
    if (cancel) { camera = { ...finished.camera }; refresh(); }
    else if (finished.moved) markChanged(false);
    else refresh();
  }
}

function onPointerUp(event) {
  pointerMap.delete(event.pointerId);
  if (gesture?.type === 'pinch' && pointerMap.size === 1) {
    const start = pointerMap.values().next().value;
    gesture = { type: 'pan', start: { ...start }, camera: { ...camera }, last: { ...start }, moved: true };
    canvas.classList.add('dragging');
    return;
  }
  finishPointer(false);
}

function onPointerCancel(event) {
  pointerMap.delete(event.pointerId);
  finishPointer(true);
}

function startAlignment() {
  finishLayoutTransition();
  const item = selectedId && findRoot(documentModel, selectedId);
  if (!item || item.type !== 'image' || !item.needsAlignment) return;
  alignDraft = { id: item.id, transform: currentRootTransform(item), initialTransform: currentRootTransform(item), targetId: null };
  refresh();
}

function closeAlignment() {
  alignDraft = null;
  transformDraft = null;
  refresh();
}

function cancelAlignment() {
  closeAlignment();
  setStatus('수동 정렬을 취소했습니다. 위치와 정렬 필요 상태를 유지했습니다', 'normal');
}

function finishAlignmentMerge() {
  if (!alignDraft?.targetId) return;
  const { id, targetId, transform } = alignDraft;
  const result = mergeAlignmentCommand(documentModel, id, targetId, transform);
  if (!result.changed) {
    closeAlignment();
    setStatus('정렬할 이미지 또는 대상이 더 이상 유효하지 않습니다', 'warning');
    return;
  }
  alignDraft = null;
  adoptSelection(result.selection);
  pruneAssets();
  markChanged(true);
  setStatus('수동 정렬한 이미지를 그룹에 병합했습니다', 'normal');
}

function keepAlignmentSeparate() {
  if (!alignDraft) return;
  const result = keepAlignmentCommand(documentModel, alignDraft.id, alignDraft.transform);
  if (!result.changed) return closeAlignment();
  alignDraft = null;
  adoptSelection(result.selection);
  markChanged(true);
  setStatus('이미지를 개별 항목으로 유지했습니다', 'normal');
}

function deleteSelection() {
  finishLayoutTransition();
  if (!selectedIds.size || alignDraft) return;
  if (selectedIds.size > 1) {
    const result = deleteLayersCommand(documentModel, [...selectedIds]);
    if (!result.changed) return;
    adoptSelection(result.selection);
    expandedGroups = new Set([...expandedGroups].filter((id) => Boolean(findRoot(documentModel, id))));
    pruneAssets();
    markChanged(true);
    return;
  }
  const result = deleteLayerCommand(documentModel, { selectedId, layerFocusId, layerFocusParent });
  if (!result.changed) return;
  adoptSelection(result.selection);
  expandedGroups = new Set([...expandedGroups].filter((id) => Boolean(findRoot(documentModel, id))));
  pruneAssets();
  markChanged(true);
}

function groupSelection() {
  finishLayoutTransition();
  if (selectedIds.size < 2 || alignDraft) return;
  const count = selectedIds.size;
  const result = groupLayersCommand(documentModel, [...selectedIds]);
  if (!result.changed) return;
  adoptSelection(result.selection);
  expandedGroups.add(result.groupId);
  markChanged(true);
  setStatus(`${count}개 레이어를 그룹화했습니다`, 'normal');
}

function resetTransform() {
  finishLayoutTransition();
  if (selectedIds.size !== 1) return;
  const item = selectedId && findRoot(documentModel, selectedId);
  if (!item || alignDraft) return;
  const result = transformItemCommand(documentModel, item.id, { x: item.x, y: item.y, scale: 1, rotation: 0 });
  if (result.changed) markChanged(true);
}

function adjustSelectionTransform(scaleFactor = 1, rotationDelta = 0) {
  finishLayoutTransition();
  if (selectedIds.size !== 1) return false;
  const item = selectedId && findRoot(documentModel, selectedId);
  if (!item || alignDraft) return false;
  const scale = Math.max(0.05, Math.min(16, (item.scale || 1) * scaleFactor));
  const rotation = (item.rotation || 0) + rotationDelta;
  if (scale === (item.scale || 1) && rotation === (item.rotation || 0)) return false;
  const result = transformItemCommand(documentModel, item.id, transformAroundCenter(item, documentModel.assets, scale, rotation));
  if (!result.changed) return false;
  markChanged(true);
  return true;
}

function ungroupSelection() {
  finishLayoutTransition();
  const item = selectedId && findRoot(documentModel, selectedId);
  if (!item || item.type !== 'group') return;
  const result = ungroupCommand(documentModel, item.id);
  if (!result.changed) return;
  adoptSelection(result.selection);
  expandedGroups.delete(item.id);
  markChanged(true);
}

function nudgeSelection(dx, dy) {
  finishLayoutTransition();
  if (alignDraft) {
    alignDraft.transform.x += dx; alignDraft.transform.y += dy; refresh(); return;
  }
  if (selectedIds.size > 1) {
    let changed = false;
    for (const id of selectedIds) {
      const item = findRoot(documentModel, id);
      if (item && moveItemCommand(documentModel, item.id, item.x + dx, item.y + dy).changed) changed = true;
    }
    if (changed) markChanged(true);
    return;
  }
  const item = selectedId && findRoot(documentModel, selectedId);
  if (!item) return;
  const result = moveItemCommand(documentModel, item.id, item.x + dx, item.y + dy);
  if (result.changed) markChanged(true);
}

function openFilePicker() { fileInput.click(); }

function pastedImageFile(file, index, timestamp) {
  if (!file) return null;
  if (file.name) return file;
  const extension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' })[file.type.toLowerCase()] || 'img';
  return new File([file], `pasted-image-${timestamp}-${index + 1}.${extension}`, {
    type: file.type,
    lastModified: file.lastModified || timestamp
  });
}

function onPaste(event) {
  if (event.defaultPrevented || byId('help-dialog').open) return;
  if (event.target !== fileInput && isTextEditingTarget(event.target)) return;
  const clipboard = event.clipboardData;
  const items = [...(clipboard?.items || [])];
  const images = items.filter((item) => item.kind === 'file' && item.type.toLowerCase().startsWith('image/'));
  const timestamp = Date.now();
  let candidates = images.map((item) => item.getAsFile()).filter(Boolean);
  if (!candidates.length) candidates = [...(clipboard?.files || [])].filter((file) => file.type.toLowerCase().startsWith('image/'));
  if (!candidates.length) return;
  const files = candidates.map((file, index) => pastedImageFile(file, index, timestamp)).filter(Boolean);
  if (!files.length) return;
  event.preventDefault();
  enqueueFiles(files, false, true);
}

function setExportMenu(open) {
  byId('export-menu').classList.toggle('hidden', !open);
  byId('export-toggle').setAttribute('aria-expanded', String(open));
}

function isFileDrag(event) {
  return [...(event.dataTransfer?.types || [])].includes('Files');
}

function describeDecodeErrors(errors) {
  const counts = errors.reduce((result, item) => { result[item.reason] = (result[item.reason] || 0) + 1; return result; }, {});
  const messages = [];
  if (counts['not-image']) messages.push(`이미지가 아닌 파일 ${counts['not-image']}개`);
  if (counts.unsupported) messages.push(`지원하지 않는 형식 ${counts.unsupported}개`);
  if (counts.corrupt) messages.push(`읽을 수 없는 이미지 ${counts.corrupt}개`);
  if (counts.browser) messages.push(`브라우저에서 읽을 수 없는 파일 ${counts.browser}개`);
  return messages.join(' · ');
}

function setProcessing(title, detail) {
  renderProcessingCard({
    card: processingCard,
    heading: byId('processing-title'),
    description: byId('processing-detail'),
    title,
    detail,
    visible: !processingHidden
  });
  setStatus(title, 'busy');
  updateEmptyState();
}

function enqueueFiles(files, sample = false, compareExisting = false) {
  if (!files.length) return;
  const captured = [...files];
  importsPending++;
  importQueue = importQueue.then(() => processFiles(captured, sample, compareExisting)).catch((error) => {
    pendingImages = [];
    processingCard.classList.add('hidden');
    refresh();
    setStatus('이미지 처리를 마치지 못했습니다', 'error');
    showToast(error.message || '이미지 처리에 실패했습니다.', 'error', 0);
  }).finally(() => { importsPending--; updateEmptyState(); });
}

function decodedSample(file, bitmap, blob) {
  return { ok: true, blob, bitmap, width: bitmap.width, height: bitmap.height, mime: 'image/png', name: file };
}

async function loadSampleBitmap(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`샘플 이미지를 읽지 못했습니다: ${path}`);
  const source = await response.blob();
  const sourceUrl = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();
    const raster = document.createElement('canvas');
    raster.width = image.naturalWidth; raster.height = image.naturalHeight;
    const context = raster.getContext('2d');
    if (!context) throw new Error('샘플 이미지를 준비할 수 없습니다.');
    context.drawImage(image, 0, 0);
    const blob = await new Promise((resolve, reject) => raster.toBlob((value) => value ? resolve(value) : reject(new Error('샘플 이미지를 준비할 수 없습니다.')), 'image/png'));
    const bitmap = await createImageBitmap(blob);
    raster.width = 0; raster.height = 0;
    return decodedSample(path.split('/').pop(), bitmap, blob);
  } finally { URL.revokeObjectURL(sourceUrl); }
}

function existingStitchSources() {
  const sources = [];
  for (const root of documentModel.items) {
    const images = root.type === 'group' ? root.children : [root];
    for (const image of images) {
      const metadata = documentModel.assets[image.assetId];
      const asset = assets.get(image.assetId);
      if (!metadata || !asset?.blob) continue;
      const matrix = root.type === 'group'
        ? multiply(composeTransform(root), composeTransform(image))
        : composeTransform(image);
      sources.push({
        assetId: image.assetId,
        blob: asset.blob,
        width: metadata.width,
        height: metadata.height,
        rootId: root.id,
        imageId: image.id,
        matrix
      });
    }
  }
  return sources;
}

function pastedImageMatch(result, sources, record) {
  const edge = result?.matchedEdges?.filter((entry) => entry.assetIdA === record.id || entry.assetIdB === record.id)
    .sort((left, right) => right.confidence - left.confidence)[0];
  let source;
  let dx;
  let dy;
  if (edge) {
    const anchorId = edge.assetIdA === record.id ? edge.assetIdB : edge.assetIdA;
    source = sources.find((entry) => entry.assetId === anchorId);
    const direction = edge.assetIdB === record.id ? 1 : -1;
    dx = edge.dx * direction;
    dy = edge.dy * direction;
  } else {
    const component = result?.components?.find((entries) => entries.some((entry) => entry.assetId === record.id));
    const pasted = component?.find((entry) => entry.assetId === record.id);
    const anchor = component?.find((entry) => entry.assetId !== record.id);
    source = sources.find((entry) => entry.assetId === anchor?.assetId);
    if (!pasted || !anchor) return null;
    dx = pasted.x - anchor.x;
    dy = pasted.y - anchor.y;
  }
  if (!source) return null;
  const matrix = source.matrix;
  return {
    targetId: source.rootId,
    transform: decomposeTransform([
      matrix[0], matrix[1], matrix[2], matrix[3],
      matrix[4] + matrix[0] * dx + matrix[2] * dy,
      matrix[5] + matrix[1] * dx + matrix[3] * dy
    ])
  };
}

async function addPastedImageToExisting(record, match) {
  let previewUrl;
  try { previewUrl = await createThumbnailUrl(record.bitmap) || URL.createObjectURL(record.blob); }
  catch { previewUrl = URL.createObjectURL(record.blob); }
  const applied = addPastedImageToTargetCommand(documentModel, record, match.targetId, match.transform);
  if (!applied.changed) {
    URL.revokeObjectURL(previewUrl);
    throw new Error('기존 레이어에 이미지를 스티칭하지 못했습니다.');
  }
  assets.set(record.id, { blob: record.blob, bitmap: record.bitmap, previewUrl });
  adoptSelection(applied.selection);
  return applied;
}

async function processFiles(files, isSample = false, compareExisting = false) {
  finishLayoutTransition();
  processingHidden = false;
  pendingImages = [];
  setProcessing('이미지를 읽는 중', `${files.length}개 파일 확인`);
  const results = [];
  let retained = false;
  try {
    if (isSample) {
      for (let index = 0; index < files.length; index++) {
        results.push(await loadSampleBitmap(files[index]));
        setProcessing('이미지 읽는 중', `${index + 1} / ${files.length}개`);
      }
    } else {
      const decoded = [];
      for (let index = 0; index < files.length; index++) {
        const result = await decodeImageFile(files[index]);
        decoded.push(result);
        if (result.ok) results.push(result);
        setProcessing('이미지 읽는 중', `${index + 1} / ${files.length}개`);
      }
      const errors = decoded.filter((result) => !result.ok);
      if (errors.length) showToast(describeDecodeErrors(errors), 'warning', 8000);
    }
    if (!results.length) {
      pendingImages = [];
      processingCard.classList.add('hidden');
      setStatus('가져올 수 있는 이미지가 없습니다', 'error');
      return;
    }

    const records = results.map((image) => ({ id: newId(), ...image }));
    pendingImages = records;
    refresh();
    const existingSources = compareExisting && records.length === 1 ? existingStitchSources() : [];
    const externalPairs = existingSources.map((_, index) => [index, existingSources.length]);
    const pairCount = externalPairs.length || records.length * (records.length - 1) / 2;
    setProcessing(existingSources.length ? '기존 레이어와 겹침 탐색 중' : '이미지 겹침 탐색 중', pairCount
      ? `${pairCount.toLocaleString()}개 이미지 쌍을 실제 픽셀로 비교합니다`
      : '비교할 이미지 쌍이 없어 개별 이미지로 추가합니다');
    let engineResult = null;
    let engineError = null;
    if (existingSources.length || records.length > 1) {
      try {
        const incomingImages = records.map(({ id, blob, width, height }) => ({ assetId: id, blob, width, height }));
        const stitchImages = existingSources.length
          ? [...existingSources.map(({ assetId, blob, width, height }) => ({ assetId, blob, width, height })), ...incomingImages]
          : incomingImages;
        engineResult = await stitching.run(stitchImages, (progress) => {
          if (progress.phase === 'read') setProcessing('이미지 읽는 중', `${progress.completed} / ${progress.total}개`);
          if (progress.phase === 'match') setProcessing('겹침 탐색 중', `${progress.completed.toLocaleString()} / ${progress.total.toLocaleString()}개 이미지 쌍 · 연결 ${progress.matchedPairs}개`);
          if (progress.phase === 'layout') setProcessing('경계 정렬 중', '연결된 이미지의 상대 위치를 계산하고 있습니다');
        }, existingSources.length ? { candidatePairs: externalPairs, allowDifferentDimensions: true } : undefined);
      } catch (error) { engineError = error; }
    }
    setProcessing('스티칭 결과 반영 중', '원본 파일과 작업 상태를 준비하고 있습니다');
    const cameraBeforeLayout = { ...camera };
    const pasteMatch = existingSources.length && records.length === 1 && !engineError
      ? pastedImageMatch(engineResult, existingSources, records[0])
      : null;
    const applied = pasteMatch
      ? await addPastedImageToExisting(records[0], pasteMatch)
      : await addDecodedImages(records, existingSources.length ? null : engineResult, engineError);
    retained = true;
    pendingImages = [];
    processingCard.classList.add('hidden');
    processingHidden = false;
    refresh();
    if (!pasteMatch) animateImportLayout(records, existingSources.length ? null : engineResult?.components, applied.rootIds, cameraBeforeLayout);
    markChanged(true);
    const groups = records.length > 1 && engineResult ? engineResult.components.filter((component) => component.length > 1).length : 0;
    const matchedCount = engineResult?.components.filter((component) => component.length > 1).reduce((count, component) => count + component.length, 0) || 0;
    const unmatched = records.length > 1 && engineResult ? records.length - matchedCount : 0;
    const summary = pasteMatch
      ? '붙여넣은 이미지를 기존 레이어에 스티칭했습니다'
      : `${records.length}개 이미지를 추가했습니다 · 스티칭 그룹 ${groups}개${unmatched ? ` · 정렬 필요 ${unmatched}개` : ''}`;
    setStatus(summary, engineError ? 'warning' : 'normal');
    showToast(engineError ? `${summary}. 자동 스티칭은 실패했지만 읽은 원본은 개별 이미지로 보관했습니다.` : summary, engineError || unmatched ? 'warning' : 'normal', 7600);
    if (engineError) showToast(`스티칭 엔진 오류: ${engineError.message}`, 'error', 0);
  } finally {
    if (!retained) for (const image of results) releaseDecodedImage(image);
  }
}

async function addDecodedImages(records, result, engineError) {
  const previewUrls = await Promise.all(records.map(async (image) => {
    try { return await createThumbnailUrl(image.bitmap) || URL.createObjectURL(image.blob); }
    catch { return URL.createObjectURL(image.blob); }
  }));
  let applied;
  try {
    applied = applyImportResults(documentModel, {
      records,
      components: result?.components,
      engineError,
      origin: { x: camera.x, y: camera.y }
    });
  } catch (error) {
    for (const previewUrl of previewUrls) URL.revokeObjectURL(previewUrl);
    throw error;
  }
  for (const [index, image] of records.entries()) {
    assets.set(image.id, { blob: image.blob, bitmap: image.bitmap, previewUrl: previewUrls[index] });
  }
  adoptSelection(applied.selection);
  return applied;
}

async function loadSampleSet() {
  enqueueFiles(['./samples/panorama-left.svg', './samples/panorama-right.svg', './samples/standalone.svg'], true);
}

async function exportImage(format) {
  if (exportBusy) return;
  exportBusy = true;
  byId('export-png').disabled = true; byId('export-jpg').disabled = true;
  setStatus(`${format === 'image/png' ? 'PNG' : 'JPG'} 내보내는 중`, 'busy');
  try {
    const snapshot = structuredClone(documentModel);
    const output = await renderExport(snapshot, snapshot.assets, (id) => assets.get(id)?.bitmap, format);
    const extension = format === 'image/png' ? 'png' : 'jpg';
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    deliverBlob(output.blob, `jigsaw-${timestamp}.${extension}`);
    const summary = `${extension.toUpperCase()} 내보내기 완료 · ${output.width.toLocaleString()} × ${output.height.toLocaleString()}px`;
    setStatus(summary, 'normal'); showToast(summary, 'normal', 7000);
  } catch (error) {
    setStatus(`내보내기 실패: ${error.message}`, 'error'); showToast(error.message || '이미지를 내보내지 못했습니다.', 'error', 0);
  } finally {
    exportBusy = false; byId('export-png').disabled = false; byId('export-jpg').disabled = false;
  }
}

async function retryRestore() {
  if (!restoreFailed) return;
  restoreFailed = false;
  persistenceBlocked = false;
  persistenceError = null;
  saveIndicator('복원 중', 'saving');
  setStatus('저장된 작업을 다시 확인하고 있습니다', 'busy');
  await restore();
  refresh();
  updateEmptyState();
}

function closeHelp() { byId('help-dialog').close?.(); }

function onKeyDown(event) {
  const target = event.target;
  const ignored = shouldIgnoreKeyboardShortcuts(event, byId('help-dialog').open);
  if (ignored) return;
  finishLayoutTransition();
  if (event.code === 'Space' && !ignored && !isInteractiveTarget(target)) { spaceDown = true; canvas.classList.add('pan-cursor'); event.preventDefault(); return; }
  const key = event.key.toLowerCase();
  if (key === 'escape' && !byId('export-menu').classList.contains('hidden')) { setExportMenu(false); byId('export-toggle').focus(); event.preventDefault(); return; }
  if (!byId('export-menu').classList.contains('hidden') && key === 'arrowdown') { byId('export-png').focus(); event.preventDefault(); return; }
  if (!byId('export-menu').classList.contains('hidden') && key === 'arrowup') { byId('export-jpg').focus(); event.preventDefault(); return; }
  if (key === 'escape' && alignDraft) { cancelAlignment(); event.preventDefault(); return; }
  if ((event.ctrlKey || event.metaKey) && (key === '+' || key === '=')) { zoomAt(camera.zoom * 1.15); event.preventDefault(); return; }
  if ((event.ctrlKey || event.metaKey) && key === '-') { zoomAt(camera.zoom / 1.15); event.preventDefault(); return; }
  if (key === '+' || key === '=') { if (adjustSelectionTransform(1.05)) event.preventDefault(); return; }
  if (key === '-' || key === '_') { if (adjustSelectionTransform(0.95)) event.preventDefault(); return; }
  if (key === 'q' || key === 'e') {
    if (adjustSelectionTransform(1, (key === 'q' ? -1 : 1) * (event.shiftKey ? 15 : 1))) event.preventDefault();
    return;
  }
  if (key === 'v') { setTool('select'); return; }
  if (key === 'h') { setTool('pan'); return; }
  if (key === 'l') { togglePanel(); event.preventDefault(); return; }
  if (key === 'f') { fitAll(); event.preventDefault(); return; }
  if (key === '[') { moveFocusedLayer(-1); event.preventDefault(); return; }
  if (key === ']') { moveFocusedLayer(1); event.preventDefault(); return; }
  if ((key === 'delete' || key === 'backspace') && selectedIds.size) { deleteSelection(); event.preventDefault(); return; }
  if (key.startsWith('arrow')) {
    const amount = event.shiftKey ? 10 : 1;
    const map = { arrowup: [0, -amount], arrowdown: [0, amount], arrowleft: [-amount, 0], arrowright: [amount, 0] };
    if (map[key]) { nudgeSelection(...map[key]); event.preventDefault(); }
  }
}

function registerEvents() {
  byId('empty-import').addEventListener('click', openFilePicker);
  byId('import-button').addEventListener('click', openFilePicker);
  byId('sample-button').addEventListener('click', loadSampleSet);
  byId('select-tool').addEventListener('click', () => setTool('select'));
  byId('pan-tool').addEventListener('click', () => setTool('pan'));
  byId('zoom-in').addEventListener('click', () => zoomAt(camera.zoom * 1.15));
  byId('zoom-out').addEventListener('click', () => zoomAt(camera.zoom / 1.15));
  byId('zoom-label').addEventListener('click', () => { camera.zoom = 1; markChanged(false); });
  byId('fit-all').addEventListener('click', fitAll);
  byId('toolbar-ungroup').addEventListener('click', ungroupSelection);
  byId('toolbar-group').addEventListener('click', groupSelection);
  byId('selection-group').addEventListener('click', groupSelection);
  byId('toolbar-delete').addEventListener('click', deleteSelection);
  byId('layers-toggle').addEventListener('click', () => togglePanel());
  byId('align-button').addEventListener('click', startAlignment);
  byId('reset-transform').addEventListener('click', resetTransform);
  byId('export-toggle').addEventListener('click', () => setExportMenu(byId('export-menu').classList.contains('hidden')));
  byId('save-status').addEventListener('click', () => {
    if (restoreFailed) void retryRestore();
    else if (persistenceError) scheduleSave(true);
  });
  byId('export-png').addEventListener('click', () => { setExportMenu(false); exportImage('image/png'); });
  byId('export-jpg').addEventListener('click', () => { setExportMenu(false); exportImage('image/jpeg'); });
  document.addEventListener('pointerdown', (event) => {
    if (!byId('export-menu').contains(event.target) && !byId('export-toggle').contains(event.target)) setExportMenu(false);
  });
  byId('help-button').addEventListener('click', () => byId('help-dialog').showModal());
  byId('update-button').addEventListener('click', applyAppUpdate);
  byId('install-button').addEventListener('click', async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    installPrompt = null;
    byId('install-button').classList.add('hidden');
  });
  byId('dismiss-processing').addEventListener('click', () => { processingHidden = true; processingCard.classList.add('hidden'); });
  fileInput.addEventListener('change', () => { const files = [...(fileInput.files || [])]; fileInput.value = ''; enqueueFiles(files); });
  window.addEventListener('paste', onPaste);
  layerList.addEventListener('click', onLayerClick);
  layerList.addEventListener('dragstart', (event) => {
    const row = event.target.closest('.layer-row'); if (!row) return;
    event.dataTransfer.setData('text/plain', JSON.stringify({ id: row.dataset.id, parentId: row.dataset.parent || null }));
    event.dataTransfer.effectAllowed = 'move';
  });
  layerList.addEventListener('dragover', (event) => { if (event.target.closest('.layer-row')) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } });
  layerList.addEventListener('drop', (event) => {
    const row = event.target.closest('.layer-row'); if (!row) return;
    event.preventDefault();
    try { const source = JSON.parse(event.dataTransfer.getData('text/plain')); reorderByDrop(source.id, source.parentId || null, row.dataset.id, row.dataset.parent || null); } catch { /* ignore non-layer drops */ }
  });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('lostpointercapture', (event) => { if (gesture && pointerMap.has(event.pointerId)) finishPointer(true); });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    finishLayoutTransition();
    const screen = getCanvasPosition(event);
    if (event.ctrlKey || event.metaKey) zoomAt(camera.zoom * Math.exp(-event.deltaY * 0.002), screen.x, screen.y);
    else { camera.x += event.deltaX / camera.zoom; camera.y += event.deltaY / camera.zoom; markChanged(false); }
  }, { passive: false });
  const frame = byId('canvas-frame');
  window.addEventListener('dragover', (event) => { if (isFileDrag(event)) event.preventDefault(); });
  window.addEventListener('drop', (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    if (!frame.contains(event.target)) showToast('이미지는 캔버스에 놓아 가져옵니다.', 'warning', 5200);
  });
  frame.addEventListener('dragenter', (event) => { if (isFileDrag(event)) { event.preventDefault(); byId('drop-overlay').classList.add('visible'); } });
  frame.addEventListener('dragover', (event) => { if (isFileDrag(event)) { event.preventDefault(); byId('drop-overlay').classList.add('visible'); } });
  frame.addEventListener('dragleave', (event) => { if (!frame.contains(event.relatedTarget)) byId('drop-overlay').classList.remove('visible'); });
  frame.addEventListener('drop', (event) => { event.preventDefault(); byId('drop-overlay').classList.remove('visible'); enqueueFiles(event.dataTransfer?.files || []); });
  byId('help-dialog').addEventListener('click', (event) => { if (event.target === byId('help-dialog')) closeHelp(); });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', (event) => { if (event.code === 'Space') { spaceDown = false; canvas.classList.toggle('pan-cursor', activeTool === 'pan'); } });
  window.addEventListener('blur', () => { spaceDown = false; if (gesture) finishPointer(true); canvas.classList.toggle('pan-cursor', activeTool === 'pan'); });
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event; byId('install-button').classList.remove('hidden'); });
  window.addEventListener('appinstalled', () => { installPrompt = null; byId('install-button').classList.add('hidden'); showToast('Jigsaw를 설치했습니다.'); });
  new ResizeObserver(() => { finishLayoutTransition(); renderer.resize(); refresh(); }).observe(byId('canvas-frame'));
}

async function restore() {
  const restored = new Map();
  let committed = false;
  try {
    const record = await store.load();
    if (!record) { saveIndicator('', 'dirty'); scheduleSave(); return; }
    for (const item of record.assets) {
      const bitmap = await createImageBitmap(item.blob, { imageOrientation: 'from-image' });
      const asset = { blob: item.blob, bitmap, previewUrl: null };
      restored.set(item.id, asset);
      let previewUrl = null;
      try { previewUrl = await createThumbnailUrl(bitmap); } catch { /* use the original as a preview fallback */ }
      asset.previewUrl = previewUrl || URL.createObjectURL(item.blob);
    }
    const required = referencedAssetIds(record.document);
    if ([...required].some((id) => !restored.has(id) || !record.document.assets[id])) throw new Error('작업이 참조하는 이미지가 저장소에 없습니다. 기존 저장본을 그대로 보존했습니다.');
    const restoredView = restoreViewState(record.document, record.view);
    documentModel = record.document;
    assets = restored;
    committed = true;
    restoreFailed = false;
    persistenceBlocked = false;
    persistenceError = null;
    camera = restoredView.camera;
    panelOpen = restoredView.panelOpen;
    expandedGroups = new Set(restoredView.expandedGroups);
    selectedId = restoredView.selectedId;
    selectedIds = new Set(restoredView.selectedIds);
    layerRangeAnchor = selectedId;
    layerFocusId = restoredView.layerFocusId;
    layerFocusParent = restoredView.layerFocusParent;
    stateRevision = Number.isSafeInteger(record.stateRevision) ? record.stateRevision : documentModel.revision;
    savedRevision = stateRevision;
    sidebar.classList.toggle('closed', !panelOpen);
    saveIndicator('', 'saved');
    setStatus('', 'normal');
  } catch (error) {
    if (!committed) {
      for (const asset of restored.values()) {
        asset.bitmap?.close?.();
        if (asset.previewUrl) URL.revokeObjectURL(asset.previewUrl);
      }
    }
    restoreFailed = true;
    persistenceBlocked = true;
    persistenceError = error;
    saveIndicator('복원 확인 필요', 'error');
    setStatus('저장된 작업을 복원하지 못했습니다. 기존 저장본은 보존했습니다', 'error');
    showToast(error.message || '저장된 작업을 읽지 못했습니다.', 'error', 0);
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    serviceWorkerRegistration = await navigator.serviceWorker.register(new URL('../service-worker.js', import.meta.url), { scope: new URL('../', import.meta.url).pathname });
    const offerUpdate = () => {
      if (!serviceWorkerRegistration.waiting || !navigator.serviceWorker.controller) return;
      byId('update-button').classList.remove('hidden');
      setStatus('앱 업데이트가 준비되었습니다.', 'normal');
    };
    serviceWorkerRegistration.addEventListener('updatefound', () => {
      const installing = serviceWorkerRegistration.installing;
      installing?.addEventListener('statechange', () => { if (installing.state === 'installed') offerUpdate(); });
    });
    offerUpdate();
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updateReloadRequested) window.location.reload();
    });
  }
  catch { showToast('오프라인 앱 자원을 준비하지 못했습니다. 인터넷 연결 후 다시 열어 주세요.', 'warning', 8000); }
}

async function applyAppUpdate() {
  const button = byId('update-button');
  button.disabled = true;
  updateReloadRequested = true;
  try {
    const applied = await applyWaitingUpdate({
      worker: serviceWorkerRegistration?.waiting,
      persist: () => persistNow(),
      isSafeToReload: () => !persistenceBlocked && !persistenceError && savedRevision === stateRevision
        && importsPending === 0 && pendingImages.length === 0 && !alignDraft && !transformDraft && !layoutTransition && !gesture && !exportBusy
    });
    if (!applied) {
      updateReloadRequested = false;
      button.disabled = false;
      if (persistenceBlocked) {
        const message = '저장된 작업 확인이 끝난 뒤 업데이트할 수 있습니다. 기존 저장본은 보존했습니다.';
        setStatus(message, 'error'); showToast(message, 'error', 0);
      } else if (persistenceError) {
        const message = '저장에 실패해 업데이트를 미뤘습니다. 저장 오류 버튼을 눌러 다시 시도해 주세요.';
        setStatus(message, 'error'); showToast(message, 'error', 0);
      } else {
        const message = '진행 중인 작업을 마친 뒤 업데이트할 수 있습니다.';
        setStatus(message, 'warning'); showToast('진행 중인 작업이 끝나면 다시 업데이트를 적용해 주세요.', 'warning', 8000);
      }
      return;
    }
    setStatus('앱을 업데이트합니다.', 'busy');
  } catch (error) {
    updateReloadRequested = false;
    button.disabled = false;
    setStatus(`업데이트를 미뤘습니다: ${error.message || '작업을 저장하지 못했습니다'}`, 'error');
    showToast('저장 오류를 해결한 뒤 다시 업데이트를 적용해 주세요.', 'error', 0);
  }
}

async function start() {
  registerEvents();
  renderer.resize();
  refresh();
  await restore();
  refresh();
  void registerServiceWorker();
}

start();
