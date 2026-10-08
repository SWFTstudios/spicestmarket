/**
 * Spice St Market — GSAP + Lenis motion, tabs, lightbox, nav
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
import Lenis from 'lenis';
import { initHero } from './hero.js';
import { initSpiceScene } from './spice-scene.js';
import { initPackTabs } from './pack-tabs.js';
import { initMarquee } from './marquee.js';
import { initMicro } from './micro.js';
import { initLightbox } from './lightbox.js';
import { initTransitions } from './transitions.js';

gsap.registerPlugin(ScrollTrigger, Flip);

(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  initTransitions();

  /* Nav */
  const nav = document.querySelector('[data-nav]');
  const toggle = document.querySelector('[data-nav-toggle]');
  const menu = document.querySelector('[data-nav-menu]');
  if (toggle && menu && nav) {
    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('nav-open', open);
    };
    toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });
  }

  /* Lenis + ScrollTrigger */
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

  /* Solid header after hero */
  const hero = document.querySelector('[data-hero]');
  if (hero && nav) {
    ScrollTrigger.create({
      trigger: hero,
      start: 'bottom top+=64',
      onEnter: () => nav.classList.add('is-solid'),
      onLeaveBack: () => nav.classList.remove('is-solid'),
    });
  } else if (nav) {
    nav.classList.add('is-solid');
  }

  /* Reveals */
  if (!reduceMotion) {
    gsap.utils.toArray('[data-reveal]').forEach((el) => {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 28 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%' },
        }
      );
    });
  } else {
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
  }

  initHero({ gsap, ScrollTrigger, reduceMotion });
  initSpiceScene({ gsap, ScrollTrigger, reduceMotion });
  initPackTabs({ gsap, Flip, reduceMotion });
  initMarquee({ gsap, ScrollTrigger, lenis, reduceMotion });
  initMicro({ gsap, reduceMotion });
  initLightbox();

  /* Forms placeholder */
  document.querySelectorAll('[data-newsletter], [data-contact]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const status = form.querySelector('[data-form-status]');
      if (status) {
        status.hidden = false;
        status.textContent = 'Thanks — newsletter wiring comes next.';
      } else {
        alert('Thanks — we will connect this form soon.');
      }
    });
  });
})();
