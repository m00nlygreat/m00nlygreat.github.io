import { commandAvailability } from '../domain/commands.js';

function createLayerRow({ item, parentId, child, documentModel, assets, selectedId, layerFocusId, expandedGroups, aligning }) {
  const row = document.createElement('div');
  row.className = `layer-row${child ? ' child-row' : ''}${layerFocusId === item.id || (!child && selectedId === item.id) ? ' selected' : ''}${item.needsAlignment ? ' needs-alignment' : ''}`;
  row.dataset.id = item.id;
  if (parentId) row.dataset.parent = parentId;
  row.setAttribute('role', 'treeitem');
  row.setAttribute('aria-selected', String(layerFocusId === item.id || (!child && selectedId === item.id)));

  if (item.type === 'group' && !child) {
    const expand = document.createElement('button');
    expand.type = 'button'; expand.className = 'expand-button';
    expand.setAttribute('aria-label', `${expandedGroups.has(item.id) ? '접기' : '펼치기'} ${item.name}`);
    expand.setAttribute('aria-expanded', String(expandedGroups.has(item.id)));
    expand.dataset.action = 'expand'; expand.textContent = expandedGroups.has(item.id) ? '⌄' : '›';
    row.append(expand);
  } else {
    const spacer = document.createElement('span'); spacer.className = 'expand-spacer'; row.append(spacer);
  }

  const select = document.createElement('button');
  select.type = 'button'; select.className = 'layer-select-row'; select.dataset.action = 'select';
  select.setAttribute('aria-label', `${item.name || '이미지'} 선택`);
  const thumb = document.createElement('span'); thumb.className = `layer-thumb ${item.type === 'group' ? 'group-thumb' : ''}`;
  const assetId = item.type === 'group' ? item.children[0]?.assetId : item.assetId;
  const asset = assets.get(assetId);
  if (asset?.previewUrl) thumb.style.backgroundImage = `url("${asset.previewUrl}")`;
  const text = document.createElement('span'); text.className = 'layer-label';
  const title = document.createElement('strong'); title.textContent = item.name || '이미지';
  const detail = document.createElement('span');
  detail.textContent = item.type === 'group' ? `${item.children.length}개 원본` : `${documentModel.assets[item.assetId]?.width || '?'} × ${documentModel.assets[item.assetId]?.height || '?'}px`;
  text.append(title, detail); select.append(thumb, text); row.append(select);

  if (item.needsAlignment) {
    const flag = document.createElement('span'); flag.className = 'alignment-tag'; flag.textContent = '정렬 필요'; row.append(flag);
  }
  const availability = commandAvailability(documentModel, {
    selectedId: parentId || item.id,
    layerFocusId: item.id,
    layerFocusParent: parentId
  }, { aligning });
  const order = document.createElement('span'); order.className = 'row-order-actions';
  const front = document.createElement('button'); front.type = 'button'; front.dataset.action = 'front'; front.textContent = '↑'; front.title = '앞으로'; front.setAttribute('aria-label', `${item.name} 앞으로`); front.disabled = !availability.canMoveForward;
  const back = document.createElement('button'); back.type = 'button'; back.dataset.action = 'back'; back.textContent = '↓'; back.title = '뒤로'; back.setAttribute('aria-label', `${item.name} 뒤로`); back.disabled = !availability.canMoveBackward;
  order.append(front, back); row.append(order);
  row.draggable = true;
  return row;
}

export function renderLayerList({ documentModel, assets, selectedId, layerFocusId, expandedGroups, layerList, aligning = false }) {
  const active = document.activeElement;
  const focusedRow = active instanceof HTMLElement ? active.closest('.layer-row') : null;
  const focusTarget = focusedRow && layerList.contains(focusedRow) && active.dataset.action
    ? { id: focusedRow.dataset.id, parentId: focusedRow.dataset.parent || null, action: active.dataset.action }
    : null;
  layerList.replaceChildren();
  for (const item of [...documentModel.items].reverse()) {
    const entry = document.createElement('div');
    entry.className = 'layer-entry';
    entry.append(createLayerRow({ item, child: false, documentModel, assets, selectedId, layerFocusId, expandedGroups, aligning }));
    if (item.type === 'group' && expandedGroups.has(item.id)) {
      const children = document.createElement('div'); children.className = 'layer-children'; children.setAttribute('role', 'group');
      for (const child of [...item.children].reverse()) {
        children.append(createLayerRow({ item: child, parentId: item.id, child: true, documentModel, assets, selectedId, layerFocusId, expandedGroups, aligning }));
      }
      entry.append(children);
    }
    layerList.append(entry);
  }
  document.getElementById('empty-layers').classList.toggle('hidden', documentModel.items.length > 0);
  document.getElementById('layer-count').textContent = String(documentModel.items.length);
  if (focusTarget) {
    const row = [...layerList.querySelectorAll('.layer-row')].find((candidate) => candidate.dataset.id === focusTarget.id && (candidate.dataset.parent || null) === focusTarget.parentId);
    const target = row?.querySelector(`[data-action="${focusTarget.action}"]`) || row?.querySelector('[data-action="select"]');
    target?.focus({ preventScroll: true });
  }
}
