import { findRoot } from '../domain/model.js';
import { commandAvailability } from '../domain/commands.js';

export function renderSelectionDock({ documentModel, selectedId, selectedIds, layerFocusId, layerFocusParent, alignDraft, transformDraft, layoutTransform, elements }) {
  const item = selectedId ? findRoot(documentModel, selectedId) : null;
  const selectionCount = selectedIds?.size || (item ? 1 : 0);
  elements.dock.classList.toggle('hidden', !item && !selectionCount);
  elements.dock.classList.toggle('multi-selection', selectionCount > 1);
  elements.groupButton?.classList.toggle('hidden', selectionCount < 2);
  if (elements.groupButton) elements.groupButton.disabled = Boolean(alignDraft);
  if (!item) {
    elements.groupButton?.classList.add('hidden');
    elements.alignButton.classList.add('hidden');
    elements.resetButton.classList.add('hidden');
    return;
  }
  if (selectionCount > 1) {
    elements.name.textContent = `${selectionCount}개 레이어 선택`;
    elements.meta.textContent = '그룹화하거나 삭제할 수 있습니다';
    elements.x.textContent = '—';
    elements.y.textContent = '—';
    elements.scale.textContent = '—';
    elements.rotation.textContent = '—';
    elements.alignButton.classList.add('hidden');
    elements.resetButton.classList.add('hidden');
    return;
  }

  let name = item.name;
  let meta = item.type === 'group' ? `${item.children.length}개 원본` : `${documentModel.assets[item.assetId]?.width || 0} × ${documentModel.assets[item.assetId]?.height || 0}px`;
  if (item.type === 'group' && layerFocusId && layerFocusId !== item.id) {
    const child = item.children.find((entry) => entry.id === layerFocusId);
    if (child) { name = child.name; meta = `원본 이미지 · ${item.name}`; }
  }
  elements.name.textContent = name || '이미지';
  elements.meta.textContent = meta;
  const displayTransform = transformDraft?.id === item.id ? transformDraft.transform
    : alignDraft?.id === item.id ? alignDraft.transform
      : layoutTransform || item;
  elements.x.textContent = Math.round(displayTransform.x || 0).toLocaleString();
  elements.y.textContent = Math.round(displayTransform.y || 0).toLocaleString();
  elements.scale.textContent = `${Math.round((displayTransform.scale || 1) * 100)}%`;
  elements.rotation.textContent = `${Math.round(displayTransform.rotation || 0)}°`;

  const availability = commandAvailability(documentModel, { selectedId, layerFocusId, layerFocusParent }, { aligning: Boolean(alignDraft) });
  elements.alignButton.classList.toggle('hidden', !availability.canAlign);
  elements.resetButton.classList.toggle('hidden', Boolean(alignDraft));
  elements.resetButton.disabled = !availability.canResetTransform;
}
