/** Recipe page tools: servings scaler, saved checklists, step timers, cook mode. */
import { formatQty, formatUnit, normalize } from '../lib/quantity.js';

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode — fine, state just won't persist */
    }
  },
};

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function ding() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'triangle';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.2);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + t);
      o.stop(ac.currentTime + t + 0.22);
    });
    setTimeout(() => ac.close(), 1000);
  } catch {
    /* no audio, no problem */
  }
  navigator.vibrate?.([200, 100, 200]);
}

export function initRecipe({ reduceMotion, lenis, sneeze }) {
  const root = document.querySelector('[data-recipe]');
  if (!root) return;
  const slug = root.dataset.recipe;
  const key = (k) => `ssm:${slug}:${k}`;

  /* ---- Servings ---- */
  const base = Number(root.dataset.servings) || 1;
  const out = root.querySelector('[data-serves-out]');
  const label = root.querySelector('[data-servings-label]');
  const qtys = [...root.querySelectorAll('.ssm-ing__qty')];
  let servings = store.get(key('serves'), base);

  const renderServings = () => {
    const factor = servings / base;
    out.textContent = String(servings);
    if (label) label.textContent = String(servings);
    qtys.forEach((el) => {
      const n = normalize(Number(el.dataset.q) * factor, el.dataset.u);
      const unit = formatUnit(n.u, n.q);
      el.textContent = `${formatQty(n.q)}${unit ? ` ${unit}` : ''}`;
    });
    root.classList.toggle('is-scaled', servings !== base);
  };
  root.querySelectorAll('[data-serves]').forEach((btn) =>
    btn.addEventListener('click', () => {
      servings = Math.min(24, Math.max(1, servings + Number(btn.dataset.serves)));
      store.set(key('serves'), servings);
      renderServings();
      if (!reduceMotion) {
        qtys.forEach((el) => {
          el.classList.remove('is-bump');
          void el.offsetWidth;
          el.classList.add('is-bump');
        });
      }
    })
  );
  renderServings();

  /* ---- Ingredient + step checklists ---- */
  const boxes = [...root.querySelectorAll('[data-ing]')];
  const steps = [...root.querySelectorAll('[data-step]')];
  const savedIng = new Set(store.get(key('ing'), []));
  const savedSteps = new Set(store.get(key('steps'), []));

  boxes.forEach((box, i) => {
    box.checked = savedIng.has(i);
    box.addEventListener('change', () => {
      box.checked ? savedIng.add(i) : savedIng.delete(i);
      store.set(key('ing'), [...savedIng]);
    });
  });

  const setStepDone = (i, done) => {
    const step = steps[i];
    step.classList.toggle('is-done', done);
    step.querySelector('[data-step-toggle]').setAttribute('aria-pressed', String(done));
    done ? savedSteps.add(i) : savedSteps.delete(i);
    store.set(key('steps'), [...savedSteps]);
  };
  steps.forEach((step, i) => {
    if (savedSteps.has(i)) setStepDone(i, true);
    step.querySelector('[data-step-toggle]').addEventListener('click', () => setStepDone(i, !step.classList.contains('is-done')));
  });

  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    boxes.forEach((b) => (b.checked = false));
    savedIng.clear();
    store.set(key('ing'), []);
    steps.forEach((_, i) => setStepDone(i, false));
  });

  /* ---- Timers (a timer keeps running if you jump into cook mode) ---- */
  const timers = new Map(); // minutes-button → { end, id }
  const dock = document.createElement('div');
  dock.className = 'ssm-dock';
  dock.setAttribute('aria-live', 'polite');
  document.body.appendChild(dock);

  const renderDock = () => {
    dock.innerHTML = '';
    timers.forEach((t, btn) => {
      const left = Math.max(0, Math.round((t.end - Date.now()) / 1000));
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'ssm-dock__pill' + (left === 0 ? ' is-done' : '');
      pill.textContent = left === 0 ? `Step ${t.step}: done!` : `Step ${t.step} · ${mmss(left)}`;
      pill.addEventListener('click', () => btn.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' }));
      dock.appendChild(pill);
    });
    dock.classList.toggle('is-on', timers.size > 0);
  };

  const timerButtons = [...root.querySelectorAll('.ssm-steps [data-timer]')];

  const startTimer = (btn) => {
    const stepIndex = steps.indexOf(btn.closest('[data-step]'));
    const lbl = btn.querySelector('[data-timer-label]');
    if (timers.has(btn)) {
      clearInterval(timers.get(btn).id);
      timers.delete(btn);
      btn.classList.remove('is-running', 'is-done');
      lbl.textContent = `${btn.dataset.timer} min`;
      renderDock();
      return;
    }
    const end = Date.now() + Number(btn.dataset.timer) * 60000;
    const t = { end, step: stepIndex + 1, id: 0 };
    btn.classList.add('is-running');
    btn.classList.remove('is-done');
    const update = () => {
      const left = Math.max(0, Math.round((t.end - Date.now()) / 1000));
      lbl.textContent = left ? mmss(left) : 'Done!';
      if (!left) {
        clearInterval(t.id);
        btn.classList.remove('is-running');
        btn.classList.add('is-done');
        ding();
        const r = btn.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) sneeze?.emit(r.left + r.width / 2, r.top, { count: 40 });
        setTimeout(() => {
          timers.delete(btn);
          renderDock();
        }, 8000);
      }
      renderDock();
      cook.refreshTimer();
    };
    t.id = setInterval(update, 1000);
    timers.set(btn, t);
    update();
  };
  timerButtons.forEach((btn) => btn.addEventListener('click', () => startTimer(btn)));

  /* ---- Cook mode ---- */
  const cook = (() => {
    const el = root.querySelector('[data-cook]');
    // Webflow wrappers can create a containing block for position:fixed; portal to <body>
    el.style.setProperty('--blend', getComputedStyle(root).getPropertyValue('--blend'));
    document.body.appendChild(el);
    const text = el.querySelector('[data-cook-text]');
    const count = el.querySelector('[data-cook-count]');
    const timerSlot = el.querySelector('[data-cook-timer]');
    const prev = el.querySelector('[data-cook-prev]');
    const next = el.querySelector('[data-cook-next]');
    const note = el.querySelector('[data-wake-note]');
    let i = 0;
    let lock = null;
    let opener = null;

    const requestLock = async () => {
      try {
        lock = await navigator.wakeLock?.request('screen');
        note.textContent = lock ? 'Screen stays awake while you cook.' : '';
      } catch {
        note.textContent = '';
      }
    };

    const refreshTimer = () => {
      if (el.hidden) return;
      const btn = steps[i].querySelector('[data-timer]');
      timerSlot.innerHTML = '';
      if (!btn) return;
      const twin = document.createElement('button');
      twin.type = 'button';
      twin.className = 'ssm-timer ssm-timer--big' + (btn.classList.contains('is-running') ? ' is-running' : '') + (btn.classList.contains('is-done') ? ' is-done' : '');
      twin.innerHTML = btn.innerHTML;
      twin.addEventListener('click', () => {
        startTimer(btn);
        refreshTimer();
      });
      timerSlot.appendChild(twin);
    };

    const show = (n) => {
      i = Math.max(0, Math.min(steps.length - 1, n));
      text.textContent = steps[i].querySelector('.ssm-step__body p').textContent;
      count.textContent = `Step ${i + 1} of ${steps.length}`;
      prev.disabled = i === 0;
      next.textContent = i === steps.length - 1 ? 'Done, dig in!' : 'Next step';
      refreshTimer();
      if (!reduceMotion) {
        text.classList.remove('is-in');
        void text.offsetWidth;
        text.classList.add('is-in');
      }
    };

    const open = () => {
      opener = document.activeElement;
      el.hidden = false;
      document.documentElement.classList.add('ssm-cooking');
      lenis?.stop();
      const firstOpen = steps.findIndex((s) => !s.classList.contains('is-done'));
      show(firstOpen === -1 ? 0 : firstOpen);
      requestLock();
      next.focus();
    };
    const close = () => {
      el.hidden = true;
      document.documentElement.classList.remove('ssm-cooking');
      lenis?.start();
      lock?.release?.();
      lock = null;
      opener?.focus?.();
    };

    prev.addEventListener('click', () => show(i - 1));
    next.addEventListener('click', () => {
      setStepDone(i, true);
      if (i === steps.length - 1) {
        close();
        const r = root.querySelector('.ssm-hero__media').getBoundingClientRect();
        sneeze?.emit(innerWidth / 2, Math.max(80, r.top + 40), { count: 140 });
        return;
      }
      show(i + 1);
    });
    el.querySelector('[data-cook-close]').addEventListener('click', close);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next.click();
      if (e.key === 'ArrowLeft') show(i - 1);
      if (e.key === 'Tab') {
        // keep focus inside the dialog
        const f = [...el.querySelectorAll('button:not([disabled])')];
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Swipe between steps with greasy fingers
    let x0 = null;
    el.addEventListener('pointerdown', (e) => (x0 = e.clientX));
    el.addEventListener('pointerup', (e) => {
      if (x0 === null || e.target.closest('button')) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 60) dx < 0 ? next.click() : show(i - 1);
    });

    document.addEventListener('visibilitychange', () => {
      if (!el.hidden && document.visibilityState === 'visible') requestLock();
    });

    root.querySelector('[data-cook-mode]')?.addEventListener('click', open);
    return { refreshTimer };
  })();

  /* ---- Reading progress ---- */
  const bar = root.querySelector('[data-progress]');
  if (bar) {
    const track = bar.parentElement;
    track.style.setProperty('--blend', getComputedStyle(root).getPropertyValue('--blend'));
    document.body.appendChild(track);
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = root.getBoundingClientRect();
      const total = r.height - innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      bar.style.transform = `scaleX(${p})`;
    };
    addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();
  }
}
