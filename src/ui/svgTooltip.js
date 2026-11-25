// Shared lightweight floating tooltip for interactive SVG charts

let tipEl = null;

function ensureTip() {
  if (typeof document === 'undefined') return null;
  if (tipEl && document.body.contains(tipEl)) return tipEl;
  tipEl = document.createElement('div');
  tipEl.id = 'ss-svg-tooltip';
  tipEl.className = 'ss-svg-tooltip hidden no-print';
  document.body.appendChild(tipEl);
  return tipEl;
}

export function showSvgTooltip(clientX, clientY, htmlContent) {
  const el = ensureTip();
  if (!el) return;
  el.innerHTML = htmlContent;
  el.classList.remove('hidden');
  const pad = 14;
  const rect = el.getBoundingClientRect();
  let left = clientX + pad;
  let top = clientY - rect.height - 10;
  if (left + rect.width > window.innerWidth - 10) {
    left = clientX - rect.width - pad;
  }
  if (top < 10) {
    top = clientY + pad;
  }
  el.style.left = `${Math.max(8, left)}px`;
  el.style.top = `${Math.max(8, top)}px`;
}

export function hideSvgTooltip() {
  if (tipEl) tipEl.classList.add('hidden');
}

export function bindSvgHoverTargets(svg, selector, formatFn) {
  if (!svg) return;
  svg.addEventListener('mouseleave', hideSvgTooltip);
  svg.querySelectorAll(selector).forEach((el) => {
    el.addEventListener('mouseenter', (e) => {
      const html = formatFn(el);
      if (html) showSvgTooltip(e.clientX, e.clientY, html);
    });
    el.addEventListener('mousemove', (e) => {
      const html = formatFn(el);
      if (html) showSvgTooltip(e.clientX, e.clientY, html);
    });
    el.addEventListener('click', hideSvgTooltip);
    el.addEventListener('mouseleave', hideSvgTooltip);
  });
}
