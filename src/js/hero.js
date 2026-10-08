export function initHero({ gsap, ScrollTrigger, reduceMotion }) {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;

  const titleLines = hero.querySelectorAll('[data-hero-title] .line span');
  const bg = hero.querySelector('[data-hero-bg] img');
  const canvas = hero.querySelector('[data-particles]');

  if (!reduceMotion && titleLines.length) {
    gsap.from(titleLines, {
      yPercent: 110,
      duration: 1.05,
      stagger: 0.12,
      ease: 'power4.out',
      delay: 0.15,
    });
  }

  if (!reduceMotion && bg) {
    gsap.to(bg, {
      scale: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });
  }

  if (!canvas || reduceMotion) return;

  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  const particles = Array.from({ length: 28 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 1 + Math.random() * 2.4,
    vx: (Math.random() - 0.5) * 0.00035,
    vy: 0.00015 + Math.random() * 0.00045,
    a: 0.25 + Math.random() * 0.45,
  }));

  const resize = () => {
    w = canvas.width = hero.clientWidth;
    h = canvas.height = hero.clientHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  const colors = ['#da522a', '#ffda88', '#f8e7c2', '#d86869'];
  gsap.ticker.add(() => {
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y > 1.05) p.y = -0.05;
      if (p.x < -0.05) p.x = 1.05;
      if (p.x > 1.05) p.x = -0.05;
      ctx.beginPath();
      ctx.fillStyle = colors[Math.floor(p.r * 2) % colors.length];
      ctx.globalAlpha = p.a;
      ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}
