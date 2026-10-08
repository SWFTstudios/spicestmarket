export function initMarquee({ gsap, ScrollTrigger, lenis, reduceMotion }) {
  const track = document.querySelector('[data-marquee-track]');
  if (!track) return;

  if (reduceMotion) {
    gsap.set(track, { x: 0 });
    return;
  }

  const loop = gsap.to(track, {
    xPercent: -50,
    duration: 22,
    ease: 'none',
    repeat: -1,
  });

  let last = 0;
  const bump = (vel) => {
    const speed = gsap.utils.clamp(0.35, 2.8, 1 + Math.abs(vel) * 0.0025);
    loop.timeScale(vel < 0 ? -speed : speed);
  };

  if (lenis) {
    lenis.on('scroll', ({ velocity }) => bump(velocity));
  } else {
    ScrollTrigger.create({
      onUpdate: (self) => {
        const v = self.getVelocity();
        if (v !== last) {
          bump(v);
          last = v;
        }
      },
    });
  }
}
