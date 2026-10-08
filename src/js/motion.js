/**
 * Lenis smooth scroll + GSAP ScrollTrigger scenes (hero, spice stage, marquee, reveals).
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export function initMotion({ reduceMotion = false } = {}) {
  let lenis = null;

  if (!reduceMotion) {
    lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      touchMultiplier: 1.4,
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  initNavSolid();
  initHero(reduceMotion);
  initParticles(reduceMotion);
  initMarquee(reduceMotion, lenis);
  initSpiceScene(reduceMotion);
  initReveals(reduceMotion);
  initMagnetic(reduceMotion);

  return { lenis };
}

function initNavSolid() {
  const nav = document.querySelector('[data-nav]');
  const hero = document.querySelector('[data-hero]') || document.querySelector('[data-page-hero]');
  if (!nav) return;
  if (!hero) {
    nav.classList.add('is-solid');
    return;
  }
  new IntersectionObserver(([entry]) => {
    nav.classList.toggle('is-solid', !entry.isIntersecting);
  }, { threshold: 0.05 }).observe(hero);
}

function initHero(reduceMotion) {
  const title = document.querySelector('[data-hero-title]');
  const media = document.querySelector('[data-hero-media] img');
  if (!title) return;

  const lines = [...title.querySelectorAll('.line span')];
  if (reduceMotion) {
    gsap.set(lines, { clearProps: 'all' });
    return;
  }

  gsap.from(lines, {
    yPercent: 110,
    rotate: 4,
    duration: 1,
    stagger: 0.12,
    ease: 'power4.out',
    delay: 0.15,
  });

  if (media) {
    gsap.fromTo(
      media,
      { scale: 1.12 },
      {
        scale: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '[data-hero]',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      }
    );
  }
}

function initParticles(reduceMotion) {
  const canvas = document.querySelector('[data-particles]');
  if (!canvas || reduceMotion) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let w = 0;
  let h = 0;
  const dots = Array.from({ length: 28 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 1 + Math.random() * 2.5,
    vx: (Math.random() - 0.5) * 0.00035,
    vy: 0.00015 + Math.random() * 0.00045,
    a: 0.25 + Math.random() * 0.5,
  }));

  const resize = () => {
    w = canvas.width = canvas.clientWidth * devicePixelRatio;
    h = canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const colors = ['#ffda88', '#da522a', '#f8e7c2', '#85eba8'];
  gsap.ticker.add(() => {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    for (const d of dots) {
      d.x += d.vx;
      d.y += d.vy;
      if (d.y > 1.05) d.y = -0.05;
      if (d.x < -0.05) d.x = 1.05;
      if (d.x > 1.05) d.x = -0.05;
      ctx.beginPath();
      ctx.fillStyle = colors[Math.floor(d.a * colors.length) % colors.length];
      ctx.globalAlpha = d.a;
      ctx.arc(d.x * canvas.clientWidth, d.y * canvas.clientHeight, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

function initMarquee(reduceMotion, lenis) {
  const tracks = document.querySelectorAll('[data-marquee-track]');
  if (!tracks.length) return;

  tracks.forEach((track) => {
    // Duplicate content for seamless loop
    track.innerHTML = track.innerHTML + track.innerHTML;
    let x = 0;
    let speed = 0.45;
    let dir = -1;

    if (reduceMotion) {
      track.style.transform = 'translateX(0)';
      return;
    }

    gsap.ticker.add(() => {
      const v = lenis ? lenis.velocity : 0;
      speed = gsap.utils.clamp(0.25, 2.2, 0.45 + Math.abs(v) * 0.04);
      dir = v > 0.2 ? 1 : v < -0.2 ? -1 : dir;
      x += speed * dir;
      const half = track.scrollWidth / 2;
      if (x <= -half) x += half;
      if (x >= 0) x -= half;
      track.style.transform = `translate3d(${x}px,0,0)`;
    });
  });
}

function initSpiceScene(reduceMotion) {
  const scene = document.querySelector('[data-spice-scene]');
  if (!scene) return;
  const tins = [...scene.querySelectorAll('[data-spice-tin]')];
  if (!tins.length) return;

  // Fan layout defaults
  tins.forEach((tin, i) => {
    const n = tins.length;
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    gsap.set(tin, {
      xPercent: -50,
      yPercent: -50,
      left: '50%',
      top: '50%',
      x: t * 220,
      y: Math.abs(t) * 40,
      rotate: t * 18,
      scale: 0.86,
      zIndex: 10 - Math.abs(Math.round(t * 10)),
    });
  });

  if (reduceMotion) return;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: scene,
      start: 'top top',
      end: '+=180%',
      pin: true,
      scrub: 0.65,
      anticipatePin: 1,
    },
  });

  tins.forEach((tin, i) => {
    const n = tins.length;
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    tl.to(
      tin,
      {
        x: t * 340,
        y: Math.sin(t * Math.PI) * -30,
        rotate: t * 28,
        scale: 1,
        ease: 'none',
      },
      0
    );
    const cap = tin.querySelector('figcaption');
    if (cap) {
      tl.fromTo(cap, { opacity: 0, y: 12 }, { opacity: 1, y: 0, ease: 'none' }, 0.15 + i * 0.05);
    }
  });
}

function initReveals(reduceMotion) {
  const els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;
  if (reduceMotion) {
    els.forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return;
  }
  els.forEach((el) => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.85,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
      },
    });
  });
}

function initMagnetic(reduceMotion) {
  if (reduceMotion || !window.matchMedia('(pointer: fine)').matches) return;
  document.querySelectorAll('[data-magnetic]').forEach((btn) => {
    const strength = 28;
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      gsap.to(btn, { x: x / strength, y: y / strength, duration: 0.35, ease: 'power2.out' });
    });
    btn.addEventListener('pointerleave', () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    });
  });
}
