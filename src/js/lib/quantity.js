/** Shared by the build (static render) and the browser (servings scaler). */
const FRACTIONS = [
  [0, ''],
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
  [1, ''],
];

export function formatQty(q) {
  if (q === null || q === undefined || Number.isNaN(q)) return '';
  let whole = Math.floor(q + 1e-9);
  const rest = q - whole;
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) if (Math.abs(f[0] - rest) < Math.abs(best[0] - rest)) best = f;
  if (best[0] === 1) {
    whole += 1;
    best = FRACTIONS[0];
  }
  if (Math.abs(best[0] - rest) > 0.07 && q < 10) return String(Math.round(q * 10) / 10);
  if (!whole && !best[1]) return String(Math.round(q * 100) / 100);
  return `${whole || ''}${best[1]}`;
}

export function formatUnit(u, q) {
  if (!u) return '';
  const many = q > 1.0001;
  const swaps = [
    ['cups', 'cup'],
    ['pints', 'pint'],
    ['cloves', 'clove'],
    ['slices', 'slice'],
    ['sprigs', 'sprig'],
  ];
  for (const [plural, single] of swaps) {
    if (u === plural || u === single) return many ? plural : single;
  }
  if (/^cans? /.test(u)) return (many ? 'cans ' : 'can ') + u.replace(/^cans? /, '');
  return u;
}

/** Scaled-down volumes read better in smaller units (0.06 cup → 1 tbsp). */
export function normalize(q, u) {
  if (q === null || q === undefined) return { q, u };
  if ((u === 'cup' || u === 'cups') && q < 0.25) return normalize(q * 16, 'tbsp');
  if (u === 'tbsp' && q < 0.5) return { q: q * 3, u: 'tsp' };
  return { q, u };
}
