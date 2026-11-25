import { addToCart, cartCount } from './cart-store';

const root = document.documentElement;

// Moneda
document.querySelectorAll<HTMLButtonElement>('[data-setcur]').forEach((btn) => {
  btn.setAttribute('aria-pressed', String(root.dataset.cur === btn.dataset.setcur));
  btn.addEventListener('click', () => {
    const cur = btn.dataset.setcur!;
    root.dataset.cur = cur;
    try {
      localStorage.setItem('rj-cur', cur);
    } catch {}
    document.querySelectorAll<HTMLButtonElement>('[data-setcur]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.setcur === cur)),
    );
    document.dispatchEvent(new CustomEvent('currency:change'));
  });
});

// Idioma: recordar la elección para no redirigir otra vez
document.querySelectorAll<HTMLAnchorElement>('[data-setlang]').forEach((a) => {
  a.addEventListener('click', () => {
    try {
      localStorage.setItem('rj-lang', a.dataset.setlang!);
    } catch {}
  });
});

// Contador del carrito
function updateCount() {
  const n = cartCount();
  document.querySelectorAll<HTMLElement>('[data-cart-count]').forEach((el) => {
    el.textContent = String(n);
    el.hidden = n === 0;
  });
}
updateCount();
document.addEventListener('cart:change', updateCount);
window.addEventListener('storage', updateCount);

// Formularios "Agregar al carrito"
document.querySelectorAll<HTMLFormElement>('form[data-add-to-cart]').forEach((form) => {
  const priceEls = form.querySelectorAll<HTMLElement>('[data-size-price]');
  // Combinaciones tamaño|molienda disponibles (según la hoja de pedidos)
  const combos: string[] = JSON.parse(form.dataset.combos || '[]');
  const grindInputs = form.querySelectorAll<HTMLInputElement>('input[name=grind]');
  const sync = () => {
    const size = (new FormData(form).get('size') as string) || '';
    grindInputs.forEach((g) => (g.disabled = !combos.includes(`${size}|${g.value}`)));
    const checked = form.querySelector<HTMLInputElement>('input[name=grind]:checked');
    if (!checked || checked.disabled) {
      const firstOk = Array.from(grindInputs).find((g) => !g.disabled);
      if (firstOk) firstOk.checked = true;
    }
    const grind = (new FormData(form).get('grind') as string) || '';
    priceEls.forEach((el) => (el.hidden = el.dataset.sizePrice !== `${size}|${grind}`));
  };
  form.addEventListener('change', sync);
  sync();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    addToCart({
      slug: form.dataset.addToCart!,
      size: String(data.get('size')),
      grind: data.get('grind') === 'ground' ? 'ground' : 'whole',
      qty: Math.max(1, Math.min(99, Number(data.get('qty')) || 1)),
    });
    const status = form.querySelector<HTMLElement>('[data-added]');
    if (status) {
      status.hidden = false;
      clearTimeout((status as any)._t);
      (status as any)._t = setTimeout(() => (status.hidden = true), 4000);
    }
  });
});
