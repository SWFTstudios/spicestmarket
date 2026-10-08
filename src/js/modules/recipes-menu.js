/** Recipes mega menu: hover/focus on desktop, accordion inside the Webflow mobile menu. */
export function initRecipesMenu() {
  const root = document.querySelector('[data-recipes-menu]');
  if (!root) return;
  const toggle = root.querySelector('.ssm-nav-recipes__toggle');
  const panel = root.querySelector('[data-recipes-panel]');
  const desktop = window.matchMedia('(min-width: 992px) and (hover: hover)');
  let closeTimer = 0;

  root.querySelectorAll('.ssm-mega__link').forEach((a, i) => a.style.setProperty('--i', String(i % 6)));

  const setOpen = (open) => {
    clearTimeout(closeTimer);
    root.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  const isOpen = () => root.classList.contains('is-open');

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!isOpen());
  });

  root.addEventListener('pointerenter', (e) => {
    if (desktop.matches && e.pointerType === 'mouse') setOpen(true);
  });
  root.addEventListener('pointerleave', (e) => {
    if (desktop.matches && e.pointerType === 'mouse') closeTimer = setTimeout(() => setOpen(false), 180);
  });

  root.addEventListener('focusout', (e) => {
    if (desktop.matches && !root.contains(e.relatedTarget)) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (isOpen() && !root.contains(e.target)) setOpen(false);
  });

  // Arrow keys move between blend links while the panel is open
  panel.addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const links = [...panel.querySelectorAll('a')];
    const i = links.indexOf(document.activeElement);
    if (i === -1) return;
    e.preventDefault();
    links[(i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length].focus();
  });
}
