/**
 * Accessible spice-pack tabs + GSAP Flip / shake on change.
 */
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(Flip);

export function initPackTabs({ reduceMotion = false } = {}) {
  const root = document.querySelector('[data-pack-tabs]');
  if (!root) return;

  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = [...root.querySelectorAll('[role="tabpanel"]')];
  if (!tabs.length || !panels.length) return;

  const activate = (next, { focus = false } = {}) => {
    const id = next.getAttribute('aria-controls');
    const panel = panels.find((p) => p.id === id);
    if (!panel) return;

    const state = reduceMotion ? null : Flip.getState(panel.querySelectorAll('.spice-card'));

    tabs.forEach((t) => {
      const selected = t === next;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
    });

    panels.forEach((p) => {
      const on = p === panel;
      p.hidden = !on;
      p.classList.toggle('is-active', on);
    });

    if (focus) next.focus();

    if (!reduceMotion) {
      const cards = panel.querySelectorAll('.spice-card');
      gsap.fromTo(
        cards,
        { y: 24, opacity: 0, rotate: -4 },
        {
          y: 0,
          opacity: 1,
          rotate: 0,
          duration: 0.55,
          stagger: 0.06,
          ease: 'back.out(1.6)',
          clearProps: 'transform',
        }
      );
      if (state) {
        Flip.from(state, { duration: 0.45, ease: 'power2.out', absolute: false });
      }
      // Shake the selected tab pill
      gsap.fromTo(next, { x: -3 }, { x: 3, duration: 0.06, yoyo: true, repeat: 5, clearProps: 'x' });
    }
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', (e) => {
      let idx = i;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') idx = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') idx = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') idx = 0;
      else if (e.key === 'End') idx = tabs.length - 1;
      else return;
      e.preventDefault();
      activate(tabs[idx], { focus: true });
    });
  });

  // Tin tilt on hover (fine pointer)
  if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    root.querySelectorAll('.spice-card').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(card, { rotateY: x * 10, rotateX: -y * 8, duration: 0.3, ease: 'power2.out' });
      });
      card.addEventListener('pointerleave', () => {
        gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.45, ease: 'power3.out' });
      });
    });
  }
}
