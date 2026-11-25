import { readCart, writeCart, type CartItem } from './cart-store';

type Money = { nio: number; usd: number };
type Catalog = Record<string, { name: string; image: string; url: string; prices: Record<string, Money> }>;
type Config = {
  lang: 'es' | 'en';
  whatsapp: string;
  email: string;
  sizes: Record<string, { label: string; imperial: string }>;
  strings: Record<string, string>;
};

const catalog: Catalog = JSON.parse(document.getElementById('cart-catalog')!.textContent || '{}');
const cfg: Config = JSON.parse(document.getElementById('cart-config')!.textContent || '{}');
const s = cfg.strings;

const emptyEl = document.querySelector<HTMLElement>('[data-cart-empty]')!;
const fullEl = document.querySelector<HTMLElement>('[data-cart-full]')!;
const list = document.querySelector<HTMLUListElement>('[data-cart-items]')!;
const subtotalEl = document.querySelector<HTMLElement>('[data-subtotal]')!;
const form = document.querySelector<HTMLFormElement>('[data-checkout]')!;
const errorEl = form.querySelector<HTMLElement>('[data-error]')!;

const fmt = (n: number) => n.toLocaleString('en-US');
const money = (m: Money) => `<span data-c="nio">C$ ${fmt(m.nio)}</span><span data-c="usd">US$ ${fmt(m.usd)}</span>`;
const esc = (str: string) => str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function valid(items: CartItem[]) {
  return items.filter((i) => catalog[i.slug]?.prices[i.size]);
}

function grindLabel(g: string) {
  return g === 'ground' ? s['product.grind.ground'] : s['product.grind.whole'];
}

function totals(items: CartItem[]): Money {
  return items.reduce(
    (acc, i) => {
      const p = catalog[i.slug].prices[i.size];
      return { nio: acc.nio + p.nio * i.qty, usd: acc.usd + p.usd * i.qty };
    },
    { nio: 0, usd: 0 },
  );
}

function render() {
  const items = valid(readCart());
  emptyEl.hidden = items.length > 0;
  fullEl.hidden = items.length === 0;
  list.innerHTML = items
    .map((i, idx) => {
      const p = catalog[i.slug];
      const price = p.prices[i.size];
      return `<li>
        <img src="${p.image}" alt="" width="84" height="84" />
        <div>
          <a class="name" href="${p.url}">${esc(p.name)}</a>
          <p class="opts">${cfg.sizes[i.size]?.label ?? i.size} · ${grindLabel(i.grind)}</p>
          <div class="ctrl">
            <button type="button" data-dec="${idx}" aria-label="−1">−</button>
            <span aria-live="polite">${i.qty}</span>
            <button type="button" data-inc="${idx}" aria-label="+1">+</button>
            <button type="button" class="rm" data-rm="${idx}">${s['cart.remove']}</button>
          </div>
        </div>
        <span class="line-total">${money({ nio: price.nio * i.qty, usd: price.usd * i.qty })}</span>
      </li>`;
    })
    .join('');
  subtotalEl.innerHTML = money(totals(items));
}

list.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  const items = valid(readCart());
  const idx = Number(b.dataset.inc ?? b.dataset.dec ?? b.dataset.rm);
  if (!items[idx]) return;
  if (b.dataset.inc) items[idx].qty = Math.min(99, items[idx].qty + 1);
  else if (b.dataset.dec) items[idx].qty -= 1;
  else items[idx].qty = 0;
  writeCart(items.filter((i) => i.qty > 0));
});

document.addEventListener('cart:change', render);
window.addEventListener('storage', render);
render();

function orderText(data: FormData) {
  const items = valid(readCart());
  const cur = document.documentElement.dataset.cur === 'usd' ? 'usd' : 'nio';
  const sym = cur === 'usd' ? 'US$' : 'C$';
  const zone = form.querySelector<HTMLSelectElement>('[name=zone]')!;
  const pay = form.querySelector<HTMLSelectElement>('[name=payment]')!;
  const lines = items.map((i) => {
    const p = catalog[i.slug];
    return `• ${i.qty} × ${p.name} · ${cfg.sizes[i.size]?.label ?? i.size} · ${grindLabel(i.grind)} = ${sym} ${fmt(p.prices[i.size][cur] * i.qty)}`;
  });
  const total = totals(items)[cur];
  const out = [
    s['order.greeting'],
    '',
    ...lines,
    '',
    `${s['cart.subtotal']}: ${sym} ${fmt(total)}`,
    `${s['cart.shipping']}: ${s['cart.shippingNote']}`,
    '',
    `${s['checkout.name']}: ${data.get('name')}`,
    `${s['checkout.phone']}: ${data.get('phone')}`,
  ];
  if (data.get('email')) out.push(`${s['checkout.email']}: ${data.get('email')}`);
  out.push(`${s['checkout.zone']}: ${zone.selectedOptions[0]?.text ?? ''}`);
  out.push(`${s['checkout.address']}: ${data.get('address')}`);
  out.push(`${s['checkout.payment']}: ${pay.selectedOptions[0]?.text ?? ''}`);
  if (data.get('notes')) out.push(`${s['checkout.notes'].replace(/ \(.*\)/, '')}: ${data.get('notes')}`);
  return out.join('\n');
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
  if (!form.checkValidity()) {
    errorEl.hidden = false;
    form.querySelector<HTMLElement>(':invalid')?.focus();
    return;
  }
  errorEl.hidden = true;
  const text = orderText(new FormData(form));
  if (submitter?.dataset.via === 'email') {
    const subject = cfg.lang === 'es' ? 'Pedido tienda RAJUANSE' : 'RAJUANSE shop order';
    location.href = `mailto:${cfg.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  } else {
    window.open(`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }
});
