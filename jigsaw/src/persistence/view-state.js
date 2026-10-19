import { findRoot } from '../domain/model.js';

export function captureViewState(document, state) {
  const selectedIds = [...new Set(state.selectedIds || (state.selectedId ? [state.selectedId] : []))]
    .filter((id) => Boolean(findRoot(document, id)));
  const selectedId = selectedIds.includes(state.selectedId) ? state.selectedId : selectedIds[0] || null;
  const selected = selectedId ? findRoot(document, selectedId) : null;
  let layerFocusId = selectedId;
  let layerFocusParent = null;
  if (selectedIds.length === 1 && selected?.type === 'group' && state.layerFocusParent === selectedId && selected.children.some((child) => child.id === state.layerFocusId)) {
    layerFocusId = state.layerFocusId;
    layerFocusParent = selectedId;
  }
  return {
    camera: { ...state.camera },
    selectedId,
    selectedIds,
    layerFocusId,
    layerFocusParent,
    expandedGroups: [...state.expandedGroups].filter((id) => findRoot(document, id)?.type === 'group'),
    panelOpen: Boolean(state.panelOpen)
  };
}

export function restoreViewState(document, view) {
  const camera = view?.camera;
  const restoredCamera = camera && Number.isFinite(camera.x) && Number.isFinite(camera.y) && Number.isFinite(camera.zoom)
    ? { x: camera.x, y: camera.y, zoom: Math.max(0.04, Math.min(4, camera.zoom)) }
    : { x: 0, y: 0, zoom: 1 };
  const selectedIds = [...new Set(Array.isArray(view?.selectedIds)
    ? view.selectedIds.filter((id) => Boolean(findRoot(document, id)))
    : (view?.selectedId && findRoot(document, view.selectedId) ? [view.selectedId] : []))];
  const selectedId = selectedIds.includes(view?.selectedId) ? view.selectedId : selectedIds[0] || null;
  const selected = selectedId ? findRoot(document, selectedId) : null;
  const focusedChild = selectedIds.length === 1 && selected?.type === 'group' && view?.layerFocusParent === selectedId
    ? selected.children.find((child) => child.id === view.layerFocusId)
    : null;
  const layerFocusId = focusedChild?.id || selectedId;
  const layerFocusParent = focusedChild ? selectedId : null;
  const expandedGroups = Array.isArray(view?.expandedGroups)
    ? view.expandedGroups.filter((id) => findRoot(document, id)?.type === 'group')
    : [];
  return {
    camera: restoredCamera,
    selectedId,
    selectedIds,
    layerFocusId,
    layerFocusParent,
    expandedGroups,
    panelOpen: view?.panelOpen !== false
  };
}
