export function initLightbox() {
  const dialog = document.querySelector('[data-lightbox]');
  const items = [...document.querySelectorAll('[data-gallery-item]')];
  if (!dialog || !items.length) return;

  const img = dialog.querySelector('[data-lightbox-img]');
  const caption = dialog.querySelector('[data-lightbox-caption]');
  const btnClose = dialog.querySelector('[data-lightbox-close]');
  const btnPrev = dialog.querySelector('[data-lightbox-prev]');
  const btnNext = dialog.querySelector('[data-lightbox-next]');
  let index = 0;

  const show = (i) => {
    index = (i + items.length) % items.length;
    const item = items[index];
    const full = item.dataset.full;
    const alt = item.querySelector('img')?.alt || '';
    img.src = full;
    img.alt = alt;
    if (caption) caption.textContent = alt;
  };

  const open = (i) => {
    show(i);
    if (typeof dialog.showModal === 'function') dialog.showModal();
  };

  items.forEach((item, i) => item.addEventListener('click', () => open(i)));
  btnClose?.addEventListener('click', () => dialog.close());
  btnPrev?.addEventListener('click', () => show(index - 1));
  btnNext?.addEventListener('click', () => show(index + 1));
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}
