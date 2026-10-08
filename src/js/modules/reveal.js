/** Scroll reveals for the new recipe UI only (Webflow IX2 owns the rest). */
export function initReveal({ reduceMotion }) {
  if (reduceMotion || !('IntersectionObserver' in window)) return;
  const targets = document.querySelectorAll('.ssm-card, .ssm-step, .ssm-tip, .ssm-blend, .ssm-next li, .ssm-card-ing');
  if (!targets.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px' }
  );
  let row = 0;
  let lastTop = null;
  targets.forEach((el) => {
    const top = el.getBoundingClientRect().top;
    row = top === lastTop ? row + 1 : 0;
    lastTop = top;
    el.style.setProperty('--reveal-delay', `${Math.min(row, 4) * 70}ms`);
    if (top < innerHeight) return; // already on screen: no flash
    el.classList.add('ssm-reveal');
    io.observe(el);
  });
}
