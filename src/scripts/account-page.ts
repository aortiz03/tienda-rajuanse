import { authEnabled } from './auth';
import { loadProfile, fetchMyOrders, type SheetOrder } from './profile';

type Config = { lang: 'es' | 'en'; orderEndpoint: string; strings: Record<string, string>; shopUrl: string };
const cfg: Config = JSON.parse(document.getElementById('account-config')!.textContent || '{}');
const s = cfg.strings;
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const esc = (str: string) =>
  String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function show(state: 'loading' | 'unavailable' | 'signedout' | 'signedin') {
  document.querySelectorAll<HTMLElement>('[data-state]').forEach((el) => (el.hidden = el.dataset.state !== state));
}

const msgEl = $('[data-msg]');
const errEl = $('[data-err]');
function say(text = '', err = false) {
  msgEl.hidden = err || !text;
  errEl.hidden = !err || !text;
  (err ? errEl : msgEl).textContent = text;
}

if (!authEnabled) {
  show('unavailable');
} else {
  init();
}

async function init() {
  const auth = await import('./auth');

  // Pestañas correo / teléfono
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((tab) =>
    tab.addEventListener('click', () => {
      document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      document.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== tab.dataset.tab));
      say();
    }),
  );

  // Correo: enviar enlace, o terminar de entrar si se abrió el enlace
  const emailForm = $<HTMLFormElement>('[data-email-form]');
  const emailInput = emailForm.querySelector<HTMLInputElement>('input')!;
  const finishing = auth.isEmailLink();
  if (finishing) {
    const remembered = auth.rememberedEmail();
    if (remembered) {
      try {
        await auth.finishEmailLink(remembered);
      } catch (e) {
        say(s[auth.errorKey(e)], true);
      }
    } else {
      $('[data-email-label]').textContent = s['acc.email.confirm'];
      $('[data-email-btn]').textContent = s['acc.email.confirmBtn'];
    }
  }
  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const btn = emailForm.querySelector<HTMLButtonElement>('button')!;
    btn.disabled = true;
    try {
      if (auth.isEmailLink()) {
        await auth.finishEmailLink(email);
      } else {
        await auth.sendEmailLink(email, location.origin + location.pathname);
        say(s['acc.email.sent'].replace('{email}', email));
      }
    } catch (err) {
      say(s[auth.errorKey(err)], true);
    } finally {
      btn.disabled = false;
    }
  });

  // Teléfono: enviar código y verificar
  const phoneForm = $<HTMLFormElement>('[data-phone-form]');
  const codeForm = $<HTMLFormElement>('[data-code-form]');
  let confirmation: import('./auth').ConfirmationResult | null = null;
  phoneForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = auth.normalizePhone(phoneForm.querySelector<HTMLInputElement>('input')!.value);
    const btn = phoneForm.querySelector<HTMLButtonElement>('button')!;
    btn.disabled = true;
    say();
    try {
      confirmation = await auth.sendPhoneCode(phone, 'phone-send-btn');
      codeForm.hidden = false;
      $('[data-code-sent]').textContent = s['acc.code.sent'].replace('{phone}', phone);
      codeForm.querySelector<HTMLInputElement>('input')!.focus();
    } catch (err) {
      say(s[auth.errorKey(err)], true);
    } finally {
      btn.disabled = false;
    }
  });
  codeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!confirmation) return;
    try {
      await confirmation.confirm(codeForm.querySelector<HTMLInputElement>('input')!.value.trim());
    } catch (err) {
      say(s[auth.errorKey(err)], true);
    }
  });

  $('[data-signout]').addEventListener('click', () => auth.signOut());

  let lastUid = '';
  auth.watchUser((user, token) => {
    if (!user) {
      lastUid = '';
      show('signedout');
      return;
    }
    show('signedin');
    $('[data-who]').textContent = user.email || user.phoneNumber || '';
    if (user.uid !== lastUid) {
      lastUid = user.uid;
      renderDetails(user.uid, { email: user.email || '', phone: user.phoneNumber || '' });
      loadOrders(user.uid, token, { email: user.email || '', phone: user.phoneNumber || '' });
    }
  });
}

function renderDetails(uid: string, base: { email: string; phone: string }, sheet?: Record<string, string | undefined>) {
  const p = loadProfile(uid);
  const rows: [string, string][] = [
    [s['checkout.name'], p.name || sheet?.full_name || ''],
    [s['checkout.phone'], p.phone || sheet?.whatsapp_phone || base.phone],
    [s['checkout.email'], p.email || sheet?.email || base.email],
    [s['checkout.address'], p.address || sheet?.address || ''],
  ];
  $('[data-details]').innerHTML = rows
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v ? esc(v) : '—'}</dd></div>`)
    .join('');
}

function money(cur: string, n: number) {
  return `${cur === 'USD' ? 'US$' : 'C$'} ${Number(n || 0).toLocaleString('en-US')}`;
}

function dateOf(v: string) {
  const d = new Date(v);
  return isNaN(d.getTime()) ? esc(v) : d.toLocaleDateString(cfg.lang === 'es' ? 'es-NI' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderOrder(o: SheetOrder) {
  const status = s[`status.${o.status}`] || o.status;
  const items = (o.items || [])
    .map((i) => `<li>${i.quantity} × ${esc(i.product)}${i.description ? ` · ${esc(i.description)}` : ''} — ${money(o.currency, i.line_total)}</li>`)
    .join('');
  return `<article>
    <div class="head"><span class="num">${esc(s['acc.order'])} ${esc(o.order_number)}</span><span class="status ${esc(o.status)}">${esc(status)}</span></div>
    <p class="hint">${dateOf(o.created_at)}${o.web_ref ? ` · ${esc(o.web_ref)}` : ''}</p>
    <ul>${items}</ul>
    <p class="total">${esc(s['acc.total'])}: ${money(o.currency, o.total)}</p>
  </article>`;
}

async function loadOrders(uid: string, token: string, base: { email: string; phone: string }) {
  const box = $('[data-orders]');
  if (!cfg.orderEndpoint) {
    box.innerHTML = `<p>${esc(s['acc.orders.none'])}</p>`;
    return;
  }
  box.innerHTML = `<p>${esc(s['acc.orders.loading'])}</p>`;
  try {
    const data = await fetchMyOrders(cfg.orderEndpoint, token);
    if (!data.ok) throw new Error(data.error || 'error');
    if (data.customer) renderDetails(uid, base, data.customer as Record<string, string>);
    const orders = data.orders || [];
    box.innerHTML = orders.length ? orders.map(renderOrder).join('') : `<p>${esc(s['acc.orders.none'])}</p>`;
  } catch {
    box.innerHTML = `<p class="err">${esc(s['acc.orders.error'])}</p>`;
  }
}
