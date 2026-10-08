export function initMicro({ gsap, reduceMotion }) {
  if (reduceMotion) return;

  /* Magnetic CTAs */
  if (matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('[data-magnetic]').forEach((btn) => {
      const strength = 18;
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        gsap.to(btn, { x: x / strength, y: y / strength, duration: 0.35, ease: 'power2.out' });
      });
      btn.addEventListener('pointerleave', () => {
        gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'power3.out' });
      });
    });

    const dot = document.querySelector('[data-cursor]');
    if (dot) {
      dot.hidden = false;
      dot.classList.add('is-on');
      const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      window.addEventListener('pointermove', (e) => {
        pos.x = e.clientX;
        pos.y = e.clientY;
        gsap.to(dot, { x: pos.x, y: pos.y, duration: 0.25, ease: 'power2.out' });
      });
      document.querySelectorAll('a, button, [data-magnetic], [data-gallery-item]').forEach((el) => {
        el.addEventListener('pointerenter', () => dot.classList.add('is-hot'));
        el.addEventListener('pointerleave', () => dot.classList.remove('is-hot'));
      });
    }
  }
}
