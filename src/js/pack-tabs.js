export function initPackTabs({ gsap, Flip, reduceMotion }) {
  const root = document.querySelector('[data-pack-tabs]');
  if (!root) return;

  const tabs = [...root.querySelectorAll('[data-pack-tab]')];
  const panels = [...root.querySelectorAll('[data-pack-panel]')];

  const activate = (id, { focus = false } = {}) => {
    const nextTab = tabs.find((t) => t.dataset.packTab === id);
    const nextPanel = panels.find((p) => p.dataset.packPanel === id);
    if (!nextTab || !nextPanel) return;

    const currentPanel = panels.find((p) => !p.hidden);
    const state = !reduceMotion && currentPanel ? Flip.getState(currentPanel.querySelectorAll('[data-pack-card]')) : null;

    tabs.forEach((t) => {
      const on = t === nextTab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p) => {
      p.hidden = p !== nextPanel;
    });
    if (focus) nextTab.focus();

    const cards = nextPanel.querySelectorAll('[data-pack-card]');
    if (reduceMotion) return;

    if (state) {
      Flip.from(state, {
        targets: cards,
        duration: 0.55,
        ease: 'power2.inOut',
        absolute: true,
        fade: true,
        scale: true,
      });
    }

    gsap.fromTo(
      cards,
      { autoAlpha: 0, y: 18, rotate: -4 },
      {
        autoAlpha: 1,
        y: 0,
        rotate: 0,
        duration: 0.55,
        stagger: 0.06,
        ease: 'back.out(1.6)',
        overwrite: true,
      }
    );
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activate(tab.dataset.packTab));
    tab.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(tab);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const next = tabs[(i + dir + tabs.length) % tabs.length];
        activate(next.dataset.packTab, { focus: true });
      }
      if (e.key === 'Home') {
        e.preventDefault();
        activate(tabs[0].dataset.packTab, { focus: true });
      }
      if (e.key === 'End') {
        e.preventDefault();
        activate(tabs[tabs.length - 1].dataset.packTab, { focus: true });
      }
    });
  });

  /* Tin tilt on fine pointers */
  if (!reduceMotion && matchMedia('(pointer: fine)').matches) {
    root.querySelectorAll('[data-pack-card]').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(card, { rotateY: x * 10, rotateX: -y * 8, duration: 0.35, transformPerspective: 600 });
      });
      card.addEventListener('pointerleave', () => {
        gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.45, ease: 'power2.out' });
      });
    });
  }
}
