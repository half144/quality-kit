/**
 * Marks the defect (or the fix) on the live page before the screenshot: a red
 * outline on the element and a caption box with what is there and what was
 * expected. A reload removes it; nothing reaches the app.
 */

const CAPTION = {
  en: { actual: 'Actual', expected: 'Expected' },
  'pt-BR': { actual: 'Atual', expected: 'Esperado' },
};

export function captionText(language, { actual, expected }) {
  const words = CAPTION[language] ?? CAPTION.en;
  return [actual && `${words.actual}: ${actual}`, expected && `${words.expected}: ${expected}`].filter(Boolean).join(' · ');
}

/**
 * Runs in the page (`page.evaluate`), so it cannot close over anything. The
 * caption sits above the element, below when there is no room, in page
 * coordinates so it stays attached if the page scrolls.
 */
export function markElement({ selector, caption, color = '#ff2d55' }) {
  const element = document.querySelector(selector);
  if (!element) return `no element matches ${selector}`;
  element.scrollIntoView({ block: 'center', inline: 'nearest' });
  element.style.outline = `3px solid ${color}`;
  element.style.outlineOffset = '2px';
  if (!caption) return null;
  const box = element.getBoundingClientRect();
  const note = document.createElement('div');
  note.textContent = caption;
  Object.assign(note.style, {
    position: 'absolute',
    zIndex: '2147483647',
    maxWidth: 'min(420px, calc(100vw - 8px))',
    background: color,
    color: '#fff',
    font: '600 13px/1.35 system-ui, sans-serif',
    padding: '4px 8px',
    borderRadius: '4px',
    boxShadow: '0 2px 6px rgba(0,0,0,.35)',
    pointerEvents: 'none',
  });
  document.body.appendChild(note);
  const gap = 8;
  const above = box.top - note.offsetHeight - gap;
  const top = above < 4 ? box.bottom + gap : above;
  const left = Math.max(4, Math.min(box.left, window.innerWidth - note.offsetWidth - 4));
  note.style.top = `${top + window.scrollY}px`;
  note.style.left = `${left + window.scrollX}px`;
  return null;
}
