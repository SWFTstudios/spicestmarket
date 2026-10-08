export function initSpiceScene({ gsap, ScrollTrigger, reduceMotion }) {
  const scene = document.querySelector('[data-spice-scene]');
  const tins = gsap.utils.toArray('[data-spice-tin]');
  if (!scene || !tins.length) return;

  if (reduceMotion) {
    tins.forEach((tin, i) => {
      const angle = (i / (tins.length - 1) - 0.5) * 50;
      gsap.set(tin, { xPercent: -50 + angle * 1.6, yPercent: -50, rotate: angle * 0.3 });
      tin.querySelector('.spice-tin__label')?.style && (tin.querySelector('.spice-tin__label').style.opacity = 1);
    });
    return;
  }

  gsap.set(tins, { xPercent: -50, yPercent: -50, rotate: 0, scale: 0.85 });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: scene,
      start: 'top top',
      end: '+=160%',
      pin: true,
      scrub: 0.65,
      anticipatePin: 1,
    },
  });

  tins.forEach((tin, i) => {
    const mid = (tins.length - 1) / 2;
    const offset = i - mid;
    const label = tin.querySelector('.spice-tin__label');
    tl.to(
      tin,
      {
        xPercent: -50 + offset * 22,
        yPercent: -50 + Math.abs(offset) * 4,
        rotate: offset * 8,
        scale: 1,
        ease: 'none',
      },
      0
    );
    if (label) {
      tl.to(label, { autoAlpha: 1, y: 0, ease: 'none' }, 0.35);
    }
  });
}
