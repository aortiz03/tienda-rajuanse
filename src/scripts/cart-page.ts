import { readCart, writeCart, type CartItem } from './cart-store';

type Variant = { sku: string; nio: number; usd: number };
type Catalog = Record<string, { name: string; image: string; url: string; variants: Record<string, Variant> }>;
type Config = {
  lang: 'es' | 'en';
  orderEndpoint: string;
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
const sentEl = form.querySelector<HTMLElement>('[data-sent]')!;

// ---------- Cuenta del cliente (opcional) ----------
const authOn = Boolean(import.meta.env.PUBLIC_FIREBASE_API_KEY && import.meta.env.PUBLIC_FIREBASE_PROJECT_ID);
let idToken = '';
let uid = '';
const field = (name: string) => form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name=${name}]`)!;
function fillIfEmpty(name: string, value?: string) {
  const el = field(name);
  if (el && value && !el.value) el.value = value;
}
if (authOn) {
  import('./auth').then((auth) =>
    auth.watchUser(async (user, token) => {
      idToken = token;
      uid = user?.uid || '';
      form.querySelector<HTMLElement>('[data-acct-out]')!.hidden = Boolean(user);
      form.querySelector<HTMLElement>('[data-acct-in]')!.hidden = !user;
      if (!user) return;
      form.querySelector('[data-acct-who]')!.textContent = user.email || user.phoneNumber || '';
      const { loadProfile, fetchMyOrders } = await import('./profile');
      const p = loadProfile(user.uid);
      fillIfEmpty('name', p.name);
      fillIfEmpty('phone', p.phone || user.phoneNumber || '');
      fillIfEmpty('email', p.email || user.email || '');
      fillIfEmpty('address', p.address);
      if (p.zone) field('zone').value = p.zone;
      if (cfg.orderEndpoint && (!p.name || !p.address)) {
        try {
          const data = await fetchMyOrders(cfg.orderEndpoint, token);
          const c = data.ok ? data.customer : null;
          if (c) {
            fillIfEmpty('name', c.full_name);
            fillIfEmpty('phone', c.whatsapp_phone);
            fillIfEmpty('email', c.email);
            fillIfEmpty('address', c.address);
          }
        } catch {}
      }
    }),
  );
}

const fmt = (n: number) => n.toLocaleString('en-US');
const money = (m: { nio: number; usd: number }) =>
  `<span data-c="nio">C$ ${fmt(m.nio)}</span><span data-c="usd">US$ ${fmt(m.usd)}</span>`;
const esc = (str: string) =>
  str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const variantOf = (i: CartItem): Variant | undefined => catalog[i.slug]?.variants[`${i.size}|${i.grind}`];

// Sólo artículos que siguen disponibles
function valid(items: CartItem[]) {
  return items.filter((i) => variantOf(i));
}

function grindLabel(g: string) {
  return g === 'ground' ? s['product.grind.ground'] : s['product.grind.whole'];
}

function totals(items: CartItem[]) {
  return items.reduce(
    (acc, i) => {
      const v = variantOf(i)!;
      return { nio: acc.nio + v.nio * i.qty, usd: acc.usd + v.usd * i.qty };
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
      const v = variantOf(i)!;
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
        <span class="line-total">${money({ nio: v.nio * i.qty, usd: v.usd * i.qty })}</span>
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

// Una referencia por pedido: si el cliente pulsa WhatsApp y luego correo,
// la hoja recibe el mismo pedido dos veces con la misma referencia y lo cuenta una sola vez.
let orderRef = '';
let orderKey = '';
function refFor(key: string) {
  if (key !== orderKey || !orderRef) {
    const d = new Date();
    const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32])
      .join('');
    orderRef = `WEB-${date}-${rand}`;
    orderKey = key;
  }
  return orderRef;
}

document.addEventListener('cart:change', () => {
  orderRef = '';
  render();
});
window.addEventListener('storage', render);
render();

function currentCurrency(): 'nio' | 'usd' {
  return document.documentElement.dataset.cur === 'usd' ? 'usd' : 'nio';
}

function orderText(data: FormData, ref: string) {
  const items = valid(readCart());
  const cur = currentCurrency();
  const sym = cur === 'usd' ? 'US$' : 'C$';
  const zone = form.querySelector<HTMLSelectElement>('[name=zone]')!;
  const pay = form.querySelector<HTMLSelectElement>('[name=payment]')!;
  const lines = items.map((i) => {
    const p = catalog[i.slug];
    const v = variantOf(i)!;
    return `• ${i.qty} × ${p.name} · ${cfg.sizes[i.size]?.label ?? i.size} · ${grindLabel(i.grind)} = ${sym} ${fmt(v[cur] * i.qty)}`;
  });
  const out = [
    s['order.greeting'],
    `${s['order.ref']}: ${ref}`,
    '',
    ...lines,
    '',
    `${s['cart.subtotal']}: ${sym} ${fmt(totals(items)[cur])}`,
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

// Envía una copia del pedido a la hoja de pedidos (Google Sheets).
// Se envía "sin esperar respuesta" para que WhatsApp se abra al instante.
function postToSheet(data: FormData, ref: string, via: 'whatsapp' | 'email') {
  if (!cfg.orderEndpoint) return;
  const items = valid(readCart());
  const cur = currentCurrency();
  const zone = String(data.get('zone') || '');
  const payload = {
    type: 'order',
    version: 1,
    web_ref: ref,
    created_at: new Date().toISOString(),
    send_via: via,
    lang: cfg.lang,
    currency: cur === 'usd' ? 'USD' : 'NIO',
    customer: {
      full_name: String(data.get('name') || '').trim(),
      whatsapp_phone: String(data.get('phone') || '').trim(),
      email: String(data.get('email') || '').trim(),
      preferred_language: cfg.lang,
      country: zone === 'intl' ? '' : 'NI',
      address: String(data.get('address') || '').trim(),
      zone,
    },
    items: items.map((i) => {
      const v = variantOf(i)!;
      return { sku: v.sku, quantity: i.qty, unit_price: v[cur] };
    }),
    subtotal: totals(items)[cur],
    payment_method: String(data.get('payment') || ''),
    customer_note: String(data.get('notes') || '').trim(),
    ...(idToken ? { id_token: idToken } : {}),
  };
  try {
    fetch(cfg.orderEndpoint, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {}
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
  const data = new FormData(form);
  const ref = refFor(JSON.stringify(readCart()));
  const via = submitter?.dataset.via === 'email' ? 'email' : 'whatsapp';
  const text = orderText(data, ref);
  postToSheet(data, ref, via);
  if (uid) {
    import('./profile').then(({ saveProfile }) =>
      saveProfile(uid, {
        name: String(data.get('name') || ''),
        phone: String(data.get('phone') || ''),
        email: String(data.get('email') || ''),
        address: String(data.get('address') || ''),
        zone: String(data.get('zone') || ''),
      }),
    );
  }
  sentEl.querySelector('[data-ref]')!.textContent = ref;
  sentEl.hidden = false;
  if (via === 'email') {
    const subject = `${cfg.lang === 'es' ? 'Pedido tienda RAJUANSE' : 'RAJUANSE shop order'} ${ref}`;
    location.href = `mailto:${cfg.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  } else {
    window.open(`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }
});
