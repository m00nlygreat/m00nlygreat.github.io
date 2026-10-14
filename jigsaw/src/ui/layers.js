import { commandAvailability } from '../domain/commands.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const LAYER_ICONS = {
  expand: ['M9 6l6 6-6 6', 12, 2.4],
  forward: ['M12 19V5M6 11l6-6 6 6', 13, 2.2],
  backward: ['M12 5v14M6 13l6 6 6-6', 13, 2.2]
};

function createLayerIcon(name) {
  const [pathData, size, strokeWidth] = LAYER_ICONS[name];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(strokeWidth));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', pathData);
  svg.append(path);
  return svg;
}

function createLayerRow({ item, parentId, child, documentModel, assets, selectedId, layerFocusId, expandedGroups, aligning }) {
  const row = document.createElement('div');
  row.className = `layer-row${child ? ' child-row' : ''}${layerFocusId === item.id || (!child && selectedId === item.id) ? ' selected' : ''}${item.needsAlignment ? ' needs-alignment' : ''}`;
  row.dataset.id = item.id;
  if (parentId) row.dataset.parent = parentId;
  row.setAttribute('role', 'treeitem');
  row.setAttribute('aria-selected', String(layerFocusId === item.id || (!child && selectedId === item.id)));

  if (child) {
    const guide = document.createElement('span');
    guide.className = 'layer-guide';
    row.append(guide);
  } else if (item.type === 'group') {
    const expand = document.createElement('button');
    expand.type = 'button'; expand.className = 'expand-button';
    expand.setAttribute('aria-label', `${expandedGroups.has(item.id) ? '접기' : '펼치기'} ${item.name}`);
    expand.setAttribute('aria-expanded', String(expandedGroups.has(item.id)));
    expand.dataset.action = 'expand';
    if (expandedGroups.has(item.id)) expand.classList.add('expanded');
    expand.append(createLayerIcon('expand'));
    row.append(expand);
  } else {
    const spacer = document.createElement('span'); spacer.className = 'expand-spacer'; spacer.setAttribute('aria-hidden', 'true'); row.append(spacer);
  }

  const select = document.createElement('button');
  select.type = 'button'; select.className = 'layer-select-row'; select.dataset.action = 'select';
  select.setAttribute('aria-label', `${item.name || '이미지'} 선택`);
  const thumb = document.createElement('span'); thumb.className = 'layer-thumb';
  const assetId = item.type === 'group' ? item.children[0]?.assetId : item.assetId;
  const asset = assets.get(assetId);
  if (asset?.previewUrl) {
    const image = document.createElement('img');
    image.src = asset.previewUrl;
    image.alt = '';
    image.draggable = false;
    thumb.append(image);
  }
  const text = document.createElement('span'); text.className = 'layer-label';
  const title = document.createElement('strong'); title.textContent = item.name || '이미지';
  const detail = document.createElement('span');
  detail.textContent = item.needsAlignment
    ? '정렬 필요 · 수동 정렬'
    : item.type === 'group'
      ? `${item.children.length}개 원본`
      : `${documentModel.assets[item.assetId]?.width || '?'} × ${documentModel.assets[item.assetId]?.height || '?'}px`;
  if (item.needsAlignment) detail.className = 'needs-alignment';
  text.append(title, detail); select.append(thumb, text); row.append(select);

  const availability = commandAvailability(documentModel, {
    selectedId: parentId || item.id,
    layerFocusId: item.id,
    layerFocusParent: parentId
  }, { aligning });
  const order = document.createElement('span'); order.className = 'row-order-actions';
  const front = document.createElement('button'); front.type = 'button'; front.dataset.action = 'front'; front.append(createLayerIcon('forward')); front.title = '앞으로'; front.setAttribute('aria-label', `${item.name} 앞으로`); front.disabled = !availability.canMoveForward;
  const back = document.createElement('button'); back.type = 'button'; back.dataset.action = 'back'; back.append(createLayerIcon('backward')); back.title = '뒤로'; back.setAttribute('aria-label', `${item.name} 뒤로`); back.disabled = !availability.canMoveBackward;
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

