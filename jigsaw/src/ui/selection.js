import { findRoot } from '../domain/model.js';
import { commandAvailability } from '../domain/commands.js';

export function renderSelectionDock({ documentModel, selectedId, layerFocusId, layerFocusParent, alignDraft, transformDraft, layoutTransform, elements }) {
  const item = selectedId ? findRoot(documentModel, selectedId) : null;
  elements.dock.classList.toggle('hidden', !item);
  if (!item) {
    elements.alignButton.classList.add('hidden');
    elements.ungroupButton.classList.add('hidden');
    elements.resetButton.classList.add('hidden');
    elements.deleteButton.classList.add('hidden');
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
  elements.ungroupButton.classList.toggle('hidden', !availability.canUngroup);
  elements.resetButton.classList.toggle('hidden', Boolean(alignDraft));
  elements.deleteButton.classList.toggle('hidden', Boolean(alignDraft));
  elements.resetButton.disabled = !availability.canResetTransform;
  elements.ungroupButton.disabled = !availability.canUngroup;
  elements.deleteButton.disabled = !availability.canDelete;
}
