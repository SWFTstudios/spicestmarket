/**
 * "If you ain't sneezin, you ain't seasonin."
 * A pooled canvas of spice flecks (paprika, turmeric, herbs, pepper) that bursts
 * from Amazon CTAs and sprinkles out of the recipe-page tin when you shake it.
 */
const SPICE = ['#b84141', '#eb8351', '#edc16e', '#e9bf83', '#4d9a3f', '#3c0d0d', '#1f1f1f', '#902b1d'];
const MAX = 220;

export function initSneeze({ reduceMotion }) {
  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let running = false;
  const flecks = [];

  const ensureCanvas = () => {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'ssm-sneeze';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
    };
    resize();
    addEventListener('resize', resize, { passive: true });
  };

  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = flecks.length - 1; i >= 0; i--) {
      const f = flecks[i];
      f.life -= 1;
      f.vx *= 0.985;
      f.vy = f.vy * 0.985 + f.g;
      f.x += f.vx;
      f.y += f.vy;
      f.rot += f.spin;
      if (f.life <= 0 || f.y > innerHeight + 20) {
        flecks.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life / 30);
      ctx.translate(f.x * dpr, f.y * dpr);
      ctx.rotate(f.rot);
      ctx.fillStyle = f.color;
      const s = f.size * dpr;
      if (f.shape === 0) {
        ctx.beginPath();
        ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.shape === 1) {
        ctx.fillRect(-s / 2, -s / 4, s, s / 2); // herb flake
      } else {
        ctx.beginPath(); // crushed pepper shard
        ctx.moveTo(0, -s / 2);
        ctx.lineTo(s / 2, s / 3);
        ctx.lineTo(-s / 2, s / 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    if (flecks.length) requestAnimationFrame(tick);
    else {
      running = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  /** mode: 'burst' (radial pop) or 'sprinkle' (falls from a point) */
  function emit(x, y, { count = 60, mode = 'burst', colors = SPICE } = {}) {
    if (reduceMotion) return;
    ensureCanvas();
    for (let i = 0; i < count && flecks.length < MAX; i++) {
      const angle = mode === 'burst' ? Math.random() * Math.PI * 2 : Math.PI / 2 + (Math.random() - 0.5) * 0.9;
      const speed = mode === 'burst' ? 2 + Math.random() * 6 : 0.6 + Math.random() * 2.2;
      flecks.push({
        x: x + (Math.random() - 0.5) * (mode === 'burst' ? 6 : 26),
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (mode === 'burst' ? 2.5 : 0),
        g: mode === 'burst' ? 0.16 : 0.12,
        size: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
        life: 60 + Math.random() * 40,
        shape: Math.floor(Math.random() * 3),
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    if (!running) {
      running = true;
      requestAnimationFrame(tick);
    }
  }

  const blendColors = (el) => {
    const blend = getComputedStyle(el).getPropertyValue('--blend').trim();
    return blend ? [blend, blend, ...SPICE] : SPICE;
  };

  // Every Amazon CTA on the site gets a little spice pop
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('[data-sneeze], a[href*="amazon.com"], a[href^="https://a.co/"]');
    if (!a) return;
    const r = a.getBoundingClientRect();
    const x = e.clientX || r.left + r.width / 2;
    const y = e.clientY || r.top + r.height / 2;
    emit(x, y, { count: 70, colors: blendColors(a) });
  });

  // Shake-the-tin easter egg on recipe pages
  document.querySelectorAll('[data-shaker]').forEach((btn) => {
    let shakes = 0;
    let resetTimer = 0;
    btn.addEventListener('click', () => {
      shakes++;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => (shakes = 0), 2500);
      btn.classList.remove('is-shaking');
      void btn.offsetWidth;
      btn.classList.add('is-shaking');
      const r = btn.getBoundingClientRect();
      const colors = blendColors(btn);
      [0, 120, 240].forEach((t) =>
        setTimeout(() => emit(r.left + r.width / 2, r.top + r.height * 0.15, { count: 22, mode: 'sprinkle', colors }), t)
      );
      if (shakes === 3) {
        shakes = 0;
        const bubble = document.createElement('span');
        bubble.className = 'ssm-achoo';
        bubble.textContent = 'Achoo!';
        bubble.setAttribute('role', 'status');
        btn.appendChild(bubble);
        emit(r.left + r.width / 2, r.top + r.height * 0.3, { count: 90, colors });
        setTimeout(() => bubble.remove(), 1600);
      }
    });
  });

  return { emit };
}
