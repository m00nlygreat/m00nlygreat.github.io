export function renderAlignmentHint({ container, alignDraft, sourceName, targetName, onMerge, onKeep, onCancel }) {
  container.classList.toggle('hidden', !alignDraft);
  if (!alignDraft) { container.replaceChildren(); return; }
  container.replaceChildren();
  const copy = document.createElement('div'); copy.className = 'align-copy';
  const title = document.createElement('strong'); title.textContent = `수동 정렬 · ${sourceName || '이미지'}`;
  const detail = document.createElement('span');
  detail.textContent = alignDraft.targetId ? `대상: ${targetName || '레이어'}` : '이미지를 드래그해 위치를 맞춘 뒤 캔버스에서 대상을 선택하세요.';
  copy.append(title, detail);
  const actions = document.createElement('div'); actions.className = 'align-actions';
  const merge = document.createElement('button'); merge.type = 'button'; merge.className = 'primary-button compact'; merge.textContent = '그룹에 병합'; merge.disabled = !alignDraft.targetId;
  merge.addEventListener('click', onMerge);
  const keep = document.createElement('button'); keep.type = 'button'; keep.className = 'secondary-button compact'; keep.textContent = '개별 유지'; keep.addEventListener('click', onKeep);
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'quiet-button compact'; cancel.textContent = '취소'; cancel.addEventListener('click', onCancel);
  actions.append(merge, keep, cancel); container.append(copy, actions);
}
