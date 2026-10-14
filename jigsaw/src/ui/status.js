export function renderStatus(banner, text, message, tone = 'normal') {
  text.textContent = message;
  banner.dataset.tone = tone;
}

export function appendToast(region, message, tone = 'normal', duration = 5200) {
  const toast = document.createElement('div');
  toast.className = `toast ${tone}`;
  toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  const text = document.createElement('span');
  text.textContent = message;
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'toast-close'; close.setAttribute('aria-label', '알림 닫기'); close.textContent = '×';
  close.addEventListener('click', () => toast.remove());
  toast.append(text, close);
  region.append(toast);
  if (duration > 0) setTimeout(() => toast.remove(), duration);
}

export function renderSaveIndicator(button, label, tone = 'normal') {
  button.textContent = label;
  button.dataset.tone = tone;
  button.disabled = label === '저장 중';
}

export function renderProcessingCard({ card, title, detail, heading, description, visible }) {
  card.classList.toggle('hidden', !visible);
  heading.textContent = title;
  description.textContent = detail;
}
