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
const doneEl = document.querySelector<HTMLElement>('[data-done]')!;
let finished = false; // true al confirmar el pago: el carrito queda vacío pero se muestra la confirmación

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
  emptyEl.hidden = finished || items.length > 0;
  fullEl.hidden = finished || items.length === 0;
  doneEl.hidden = !finished;
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
  document.dispatchEvent(new CustomEvent('cart:rendered'));
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


// =====================================================================
// Pago en 3 pasos: 1) cuenta, 2) datos y envío, 3) pago → confirmación.
// =====================================================================
type Step = 'account' | 'details' | 'payment';
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const fill = (key: string, vars: Record<string, string> = {}) =>
  (s[key] || key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

const authOn = Boolean(import.meta.env.PUBLIC_FIREBASE_API_KEY && import.meta.env.PUBLIC_FIREBASE_PROJECT_ID);
type AuthMod = typeof import('./auth');
let auth: AuthMod | null = null;
let idToken = '';
let uid = '';
let accountEmail = '';
let step: Step = 'account';

const steps = {
  account: $('[data-step="account"]'),
  details: $<HTMLFormElement>('[data-step="details"]'),
  payment: $<HTMLFormElement>('[data-step="payment"]'),
};

function go(next: Step) {
  if (next !== 'account' && authOn && !uid) next = 'account'; // sin cuenta no se pasa del paso 1
  step = next;
  (Object.keys(steps) as Step[]).forEach((k) => (steps[k].hidden = k !== next));
  const order: Step[] = ['account', 'details', 'payment'];
  document.querySelectorAll<HTMLElement>('[data-dot]').forEach((d) => {
    const i = order.indexOf(d.dataset.dot as Step);
    d.classList.toggle('on', i === order.indexOf(next));
    d.classList.toggle('past', i < order.indexOf(next));
  });
  if (next === 'payment') preparePayment();
  if (window.matchMedia('(max-width: 860px)').matches) $('[data-checkout]').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
document.querySelectorAll<HTMLButtonElement>('[data-back]').forEach((b) => b.addEventListener('click', () => go(b.dataset.back as Step)));

// ---------- 1. Cuenta ----------
const emailForm = $<HTMLFormElement>('[data-email-form]');
const emailInput = $<HTMLInputElement>('#a-email');
const emailBtn = $<HTMLButtonElement>('[data-email-btn]');
const pwPanel = $('[data-pw-panel]');
const pwForm = $<HTMLFormElement>('[data-pw-form]');
const pwInput = $<HTMLInputElement>('#a-pw');
const pwBtn = $<HTMLButtonElement>('[data-pw-btn]');
const signedEl = $('[data-signed]');
const accMsg = $('[data-acc-msg]');
const accErr = $('[data-acc-err]');
let pwMode: 'signin' | 'create' = 'signin';
let finishingLink = false;

function say(text = '', err = false) {
  accMsg.hidden = err || !text;
  accErr.hidden = !err || !text;
  (err ? accErr : accMsg).textContent = text;
}
function fail(e: unknown) {
  say(s[auth ? auth.errorKey(e) : 'acc.error'] || s['acc.error'], true);
}
function busy(btn: HTMLButtonElement, on: boolean, label?: string) {
  btn.disabled = on;
  if (label !== undefined) btn.textContent = label;
}

function showPassword(mode: 'signin' | 'create' | 'link', email: string) {
  pwMode = mode === 'create' ? 'create' : 'signin';
  emailForm.hidden = true;
  pwPanel.hidden = false;
  const noPw = mode === 'link';
  $('[data-pw-msg]').textContent = fill(mode === 'create' ? 'co.new' : noPw ? 'co.existing.link' : 'co.existing', { email });
  pwForm.hidden = noPw;
  $('.or', pwPanel).hidden = noPw;
  $('[data-forgot]').hidden = mode !== 'signin';
  $('[data-pw-label]').textContent = s[mode === 'create' ? 'co.password.new' : 'co.password'];
  pwInput.autocomplete = mode === 'create' ? 'new-password' : 'current-password';
  pwBtn.textContent = s[mode === 'create' ? 'co.create' : 'co.signin'];
  pwInput.value = '';
  if (!noPw) pwInput.focus();
}
function resetAccount() {
  emailForm.hidden = false;
  pwPanel.hidden = true;
  say();
  emailInput.focus();
}
$('[data-change-email]').addEventListener('click', resetAccount);

emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  if (!emailInput.checkValidity() || !email) return say(s['co.err.email'], true);
  if (!auth) return;
  say();
  if (finishingLink) {
    try {
      await auth.finishEmailLink(email);
      finishingLink = false;
    } catch (err) {
      fail(err);
    }
    return;
  }
  busy(emailBtn, true, s['co.checking']);
  try {
    const status = await auth.emailStatus(email);
    showPassword(status === 'none' ? 'create' : status === 'password' ? 'signin' : 'link', email);
  } catch (err) {
    fail(err);
  } finally {
    busy(emailBtn, false, s['co.continue']);
  }
});

pwForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!auth) return;
  const email = emailInput.value.trim().toLowerCase();
  const pw = pwInput.value;
  if (pw.length < 6) return say(s['co.err.weak'], true);
  say();
  busy(pwBtn, true);
  try {
    if (pwMode === 'create') await auth.createAccount(email, pw);
    else await auth.signInPassword(email, pw);
    // watchUser se encarga de pasar al paso 2
  } catch (err) {
    const code = (err as { code?: string })?.code || '';
    if (pwMode === 'create' && code.includes('email-already-in-use')) {
      showPassword('signin', email);
      say(s['co.err.inUse'], true);
    } else fail(err);
  } finally {
    busy(pwBtn, false);
  }
});

$('[data-send-link]').addEventListener('click', async (e) => {
  if (!auth) return;
  const btn = e.currentTarget as HTMLButtonElement;
  const email = emailInput.value.trim().toLowerCase();
  busy(btn, true);
  try {
    await auth.sendEmailLink(email, location.origin + location.pathname);
    say(fill('co.linkSent', { email }));
  } catch (err) {
    fail(err);
  } finally {
    busy(btn, false);
  }
});

$('[data-forgot]').addEventListener('click', async () => {
  if (!auth) return;
  const email = emailInput.value.trim().toLowerCase();
  try {
    await auth.sendReset(email);
    say(fill('co.resetSent', { email }));
  } catch (err) {
    fail(err);
  }
});

$('[data-signed-go]').addEventListener('click', () => go('details'));
$('[data-signout]').addEventListener('click', async () => {
  if (auth) await auth.signOut();
});

const details = steps.details;
const field = (name: string) => details.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name=${name}]`)!;
function fillIfEmpty(name: string, value?: string) {
  const el = field(name);
  if (el && value && !el.value) el.value = value;
}

async function prefill(user: import('./auth').User, token: string) {
  const { loadProfile, fetchMyOrders } = await import('./profile');
  const p = loadProfile(user.uid);
  let saved = Boolean(p.name && p.address);
  fillIfEmpty('name', p.name);
  fillIfEmpty('phone', p.phone || user.phoneNumber || '');
  fillIfEmpty('email', p.email || user.email || '');
  fillIfEmpty('idnumber', p.idNumber);
  fillIfEmpty('address', p.address);
  if (p.zone) field('zone').value = p.zone;
  if (cfg.orderEndpoint && !saved) {
    try {
      const data = await fetchMyOrders(cfg.orderEndpoint, token);
      const c = data.ok ? data.customer : null;
      if (c) {
        fillIfEmpty('name', c.full_name);
        fillIfEmpty('phone', c.whatsapp_phone);
        fillIfEmpty('email', c.email);
        fillIfEmpty('address', c.address);
        saved = Boolean(c.full_name && c.address);
      }
    } catch {}
  }
  $('[data-saved-note]').hidden = !saved;
}

async function initAuth() {
  if (!authOn) {
    // Sin Firebase configurado la tienda no puede exigir cuenta: se avisa y se sigue.
    $('[data-noauth]').hidden = false;
    $('[data-acc-lead]').hidden = true;
    emailForm.hidden = true;
    signedEl.hidden = false;
    $('[data-signed-who]').parentElement!.hidden = true;
    $('[data-signout]').hidden = true;
    return;
  }
  auth = await import('./auth');
  let justLinked = false; // volvió desde el enlace del correo → directo al paso 2
  if (auth.isEmailLink()) {
    const remembered = auth.rememberedEmail();
    if (remembered) {
      try {
        await auth.finishEmailLink(remembered);
        justLinked = true;
      } catch (err) {
        fail(err);
      }
    } else {
      finishingLink = true;
      $('[data-email-label]').textContent = s['co.confirmEmail'];
      emailBtn.textContent = s['co.signin'];
    }
  }
  let first = true;
  auth.watchUser((user, token) => {
    idToken = token;
    const wasIn = Boolean(uid);
    uid = user?.uid || '';
    accountEmail = user?.email || '';
    signedEl.hidden = !user;
    emailForm.hidden = Boolean(user);
    pwPanel.hidden = true;
    if (!user) {
      say();
      if (step !== 'account') go('account');
      first = false;
      return;
    }
    say();
    $('[data-signed-who]').textContent = fill('co.signedAs', { who: user.email || user.phoneNumber || '' });
    if (!wasIn) {
      prefill(user, token);
      // Recién entró (no es una visita con la sesión ya abierta) → directo al paso 2
      if (!first || justLinked) go('details');
    }
    first = false;
  });
}

// ---------- 2. Datos y envío ----------
details.addEventListener('submit', (e) => {
  e.preventDefault();
  const err = $('[data-error]', details);
  if (!details.checkValidity()) {
    err.hidden = false;
    details.querySelector<HTMLElement>(':invalid')?.focus();
    return;
  }
  err.hidden = true;
  go('payment');
});

// ---------- 3. Pago ----------
const payForm = steps.payment;
const payBtn = $<HTMLButtonElement>('[data-pay-btn]');
const payErr = $('[data-pay-error]');
const cardBox = $('[data-card]');
const cashOpt = $('[data-cash-opt]');
const cashRadio = $<HTMLInputElement>('input[value="efectivo"]', payForm);
const cardRadio = $<HTMLInputElement>('input[value="tarjeta"]', payForm);
const cc = {
  name: $<HTMLInputElement>('#k-name'),
  num: $<HTMLInputElement>('#k-num'),
  exp: $<HTMLInputElement>('#k-exp'),
  cvv: $<HTMLInputElement>('#k-cvv'),
};

function payMethod(): 'tarjeta' | 'efectivo' {
  return cashRadio.checked ? 'efectivo' : 'tarjeta';
}
function amountText() {
  const cur = currentCurrency();
  return `${cur === 'usd' ? 'US$' : 'C$'} ${fmt(totals(valid(readCart()))[cur])}`;
}
function updatePayUi() {
  const card = payMethod() === 'tarjeta';
  cardBox.hidden = !card;
  cardBox.querySelectorAll<HTMLInputElement>('[data-cc]').forEach((i) => (i.required = card));
  payBtn.textContent = card ? fill('co.pay', { amount: amountText() }) : s['co.place'];
  const items = valid(readCart());
  $('[data-pay-subtotal]', payForm).innerHTML = money(totals(items));
  $('[data-pay-total]', payForm).innerHTML = money(totals(items));
}
function preparePayment() {
  const zone = field('zone').value;
  const cashOk = zone === 'managua';
  cashRadio.disabled = !cashOk;
  cashOpt.classList.toggle('off', !cashOk);
  $('[data-cash-note]').textContent = s[cashOk ? 'co.pay.cashNote' : 'co.pay.cashOff'];
  if (!cashOk) cardRadio.checked = true;
  const zoneText = (field('zone') as HTMLSelectElement).selectedOptions[0]?.text.replace(/ \(.*\)/, '') ?? '';
  $('[data-shipto]').textContent = `${field('name').value} · ${field('phone').value} · ${field('address').value} (${zoneText})`;
  payErr.hidden = true;
  updatePayUi();
}
payForm.addEventListener('change', updatePayUi);
document.addEventListener('cart:rendered', () => step === 'payment' && updatePayUi());
new MutationObserver(() => step === 'payment' && updatePayUi()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-cur'] });

// Formato mientras se escribe
cc.num.addEventListener('input', () => {
  const d = cc.num.value.replace(/\D/g, '').slice(0, 19);
  cc.num.value = d.replace(/(.{4})/g, '$1 ').trim();
});
cc.exp.addEventListener('input', () => {
  const d = cc.exp.value.replace(/\D/g, '').slice(0, 4);
  cc.exp.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
});
cc.cvv.addEventListener('input', () => (cc.cvv.value = cc.cvv.value.replace(/\D/g, '').slice(0, 4)));

function luhn(num: string) {
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let n = Number(num[num.length - 1 - i]);
    if (i % 2) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}
function brand(num: string) {
  if (/^4/.test(num)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(num)) return 'Mastercard';
  if (/^3[47]/.test(num)) return 'Amex';
  return 'Tarjeta';
}
/** Valida la tarjeta (sólo formato: todavía no hay banco conectado). Nunca se envía el número. */
function checkCard(): { brand: string; last4: string } | null {
  const num = cc.num.value.replace(/\D/g, '');
  const [mm, yy] = cc.exp.value.split('/').map(Number);
  const now = new Date();
  const expOk = mm >= 1 && mm <= 12 && yy >= 0 && new Date(2000 + yy, mm, 1) > now;
  const ok = cc.name.value.trim().length > 1 && num.length >= 13 && num.length <= 19 && luhn(num) && expOk && /^\d{3,4}$/.test(cc.cvv.value);
  return ok ? { brand: brand(num), last4: num.slice(-4) } : null;
}

// Envía el pedido a la hoja de pedidos (Google Sheets).
function postToSheet(ref: string, payment: { method: string; reference: string }) {
  if (!cfg.orderEndpoint) return;
  const items = valid(readCart());
  const cur = currentCurrency();
  const zone = field('zone').value;
  const payload = {
    type: 'order',
    version: 2,
    web_ref: ref,
    created_at: new Date().toISOString(),
    send_via: 'web',
    lang: cfg.lang,
    currency: cur === 'usd' ? 'USD' : 'NIO',
    customer: {
      full_name: field('name').value.trim(),
      whatsapp_phone: field('phone').value.trim(),
      email: field('email').value.trim() || accountEmail,
      id_number: field('idnumber').value.trim(),
      preferred_language: cfg.lang,
      country: zone === 'intl' ? '' : 'NI',
      address: field('address').value.trim(),
      zone,
    },
    items: items.map((i) => {
      const v = variantOf(i)!;
      return { sku: v.sku, quantity: i.qty, unit_price: v[cur] };
    }),
    subtotal: totals(items)[cur],
    payment_method: payment.method,
    payment_reference: payment.reference,
    customer_note: field('notes').value.trim(),
    website: (payForm.querySelector<HTMLInputElement>('[name=website]')!).value,
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

function orderText(ref: string, paymentLine: string) {
  const items = valid(readCart());
  const cur = currentCurrency();
  const sym = cur === 'usd' ? 'US$' : 'C$';
  const zone = field('zone') as HTMLSelectElement;
  const out = [
    s['order.greeting'],
    `${s['order.ref']}: ${ref}`,
    '',
    ...items.map((i) => {
      const v = variantOf(i)!;
      return `• ${i.qty} × ${catalog[i.slug].name} · ${cfg.sizes[i.size]?.label ?? i.size} · ${grindLabel(i.grind)} = ${sym} ${fmt(v[cur] * i.qty)}`;
    }),
    '',
    `${s['cart.subtotal']}: ${sym} ${fmt(totals(items)[cur])}`,
    `${s['cart.shipping']}: ${s['cart.shippingNote']}`,
    `${s['checkout.payment'].replace(/ preferida| method/, '')}: ${paymentLine}`,
    '',
    `${s['checkout.name']}: ${field('name').value}`,
    `${s['checkout.phone']}: ${field('phone').value}`,
  ];
  const email = field('email').value || accountEmail;
  if (email) out.push(`${s['checkout.email']}: ${email}`);
  out.push(`${s['checkout.zone']}: ${zone.selectedOptions[0]?.text ?? ''}`);
  out.push(`${s['checkout.address']}: ${field('address').value}`);
  if (field('notes').value) out.push(`${s['checkout.notes'].replace(/ \(.*\)/, '')}: ${field('notes').value}`);
  return out.join('\n');
}

payForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  payErr.hidden = true;
  const method = payMethod();
  let card: { brand: string; last4: string } | null = null;
  if (method === 'tarjeta') {
    card = checkCard();
    if (!card) {
      payErr.textContent = s['co.card.invalid'];
      payErr.hidden = false;
      return;
    }
  }
  if (!payForm.checkValidity()) {
    payErr.textContent = s['checkout.required'];
    payErr.hidden = false;
    payForm.querySelector<HTMLElement>(':invalid')?.focus();
    return;
  }
  busy(payBtn, true, s['co.processing']);
  idToken = auth ? await auth.freshToken() : '';
  // Marcador de posición del cobro: aquí irá el banco (p. ej. BAC). Por ahora se simula.
  await new Promise((r) => setTimeout(r, 900));

  const ref = refFor(JSON.stringify(readCart()));
  const amount = amountText();
  const reference = card ? `PRUEBA sin cobro · ${card.brand} ···· ${card.last4}` : '';
  const paymentLine = card ? `${s['co.paidCard']} · ${card.brand} ···· ${card.last4}` : s['co.pay.cash'];
  postToSheet(ref, { method, reference });
  const text = orderText(ref, paymentLine);

  if (details.querySelector<HTMLInputElement>('[name=save]')!.checked && uid) {
    const { saveProfile } = await import('./profile');
    saveProfile(uid, {
      name: field('name').value,
      phone: field('phone').value,
      email: field('email').value,
      idNumber: field('idnumber').value,
      address: field('address').value,
      zone: field('zone').value,
    });
  }

  // Confirmación
  const items = valid(readCart());
  const cur = currentCurrency();
  $('[data-done-title]').textContent = s[card ? 'co.done.paid' : 'co.done.cash'];
  $('[data-done-note]').textContent = card ? fill('co.done.paidNote', { amount, last4: card.last4 }) : fill('co.done.cashNote', { amount });
  $('[data-done-ref]').textContent = ref;
  $('[data-done-items]').innerHTML = items
    .map((i) => {
      const v = variantOf(i)!;
      return `<li><span>${i.qty} × ${esc(catalog[i.slug].name)} · ${cfg.sizes[i.size]?.label ?? i.size} · ${grindLabel(i.grind)}</span><span class="line-total">${cur === 'usd' ? 'US$' : 'C$'} ${fmt(v[cur] * i.qty)}</span></li>`;
    })
    .join('');
  $('[data-done-wa]').onclick = () => window.open(`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');

  Object.values(cc).forEach((i) => (i.value = ''));
  busy(payBtn, false);
  finished = true;
  orderKey = '';
  writeCart([]); // vacía el carrito; render() muestra la confirmación
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

go('account');
initAuth();
