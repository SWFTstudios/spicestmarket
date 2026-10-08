/** Recipe index: pack chips + live search, animated with a same-document View Transition. */
export function initRecipeIndex({ reduceMotion }) {
  const root = document.querySelector('[data-recipe-index]');
  if (!root) return;
  const chips = [...root.querySelectorAll('[data-filter]')];
  const cards = [...root.querySelectorAll('.ssm-card')];
  const search = root.querySelector('[data-recipe-search]');
  const empty = root.querySelector('[data-recipe-empty]');
  let pack = 'all';

  const apply = () => {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    cards.forEach((card) => {
      const ok = (pack === 'all' || card.dataset.pack.split(' ').includes(pack)) && (!q || card.dataset.search.includes(q));
      card.hidden = !ok;
      if (ok) shown++;
    });
    empty.hidden = shown > 0;
  };

  const run = (fn) => {
    if (!reduceMotion && document.startViewTransition) document.startViewTransition(fn);
    else fn();
  };

  const select = (id, { push = true } = {}) => {
    if (!chips.some((c) => c.dataset.filter === id)) id = 'all';
    pack = id;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === id)));
    run(apply);
    if (push) history.replaceState(null, '', id === 'all' ? location.pathname : `#${id}`);
  };

  chips.forEach((c) => c.addEventListener('click', () => select(c.dataset.filter)));
  let t = 0;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => run(apply), 120);
  });

  const fromHash = () => select(decodeURIComponent(location.hash.slice(1)) || 'all', { push: false });
  addEventListener('hashchange', fromHash);
  if (location.hash) {
    pack = decodeURIComponent(location.hash.slice(1));
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === pack)));
    apply();
  }
}
