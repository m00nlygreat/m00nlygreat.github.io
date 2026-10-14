const TEXT_ENTRY_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function isTextEditingTarget(target) {
  if (!target) return false;
  return Boolean(target.isContentEditable || TEXT_ENTRY_TAGS.has(String(target.tagName || '').toUpperCase()));
}

export function shouldIgnoreKeyboardShortcuts(event, dialogOpen = false) {
  return Boolean(dialogOpen || event?.altKey || event?.isComposing || event?.keyCode === 229 || isTextEditingTarget(event?.target));
}

export function isInteractiveTarget(target) {
  return Boolean(target?.closest?.('button, a, input, textarea, select, [role="button"]'));
}
