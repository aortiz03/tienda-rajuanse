/**
 * RAJUANSE · Script de la hoja de pedidos (Google Apps Script)
 * ------------------------------------------------------------
 * Pegar este archivo en la hoja: Extensiones → Apps Script.
 * Instrucciones completas: sheets/README.md
 *
 * Hace estas cosas:
 *  1. GET  ?action=variants  → la web lee precios y disponibilidad
 *     de la pestaña product_variants cuando se publica.
 *  2. POST {type:"order"}    → cada pedido hecho en la web se añade
 *     solo a customers, orders y order_items.
 *  3. Menú "Tienda" → "Publicar cambios en la web": vuelve a publicar
 *     la web con los precios actuales de la hoja.
 *  4. Clientes con cuenta (Firebase, por correo o teléfono):
 *     GET ?action=my_orders&id_token=… devuelve sólo los pedidos de
 *     ese cliente; los pedidos con id_token se ligan a su cuenta.
 *  5. Panel de administración (Admin.gs + Admin.html): abrir la URL
 *     del script con la cuenta de Google autorizada.
 */

const REPO = 'aortiz03/tienda-rajuanse';
const TZ = 'America/Managua';
const MAX_ORDERS_PER_10_MIN = 30; // freno contra envíos masivos

// ---------- Web: lectura de precios ----------------------------------

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'variants') return json_({ variants: readVariants_() });
  if (action === 'my_orders') return json_(myOrders_(e.parameter.id_token));
  // Panel de administración (Admin.gs): sólo para los correos de ADMIN_EMAILS.
  if (!action && isAdmin_()) return adminPage_();
  return json_({ ok: true, info: 'RAJUANSE sheet API' });
}

function readVariants_() {
  const rows = readTable_('product_variants');
  return rows
    .filter((r) => String(r.sku || '').trim())
    .map((r) => ({
      sku: String(r.sku).trim(),
      price_nio: toNumberOrNull_(r.price_nio),
      price_usd: toNumberOrNull_(r.price_usd),
      active: String(r.active || 'yes').trim().toLowerCase() === 'no' ? 'no' : 'yes',
    }));
}

// ---------- Web: pedidos ---------------------------------------------

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.type !== 'order') return json_({ ok: false, error: 'unknown type' });
    if (body.website) return json_({ ok: true }); // campo trampa para bots
    if (!underRateLimit_()) return json_({ ok: false, error: 'rate limited' });

    const order = validateOrder_(body);
    const existing = findOrderByWebRef_(order.web_ref);
    if (existing) return json_({ ok: true, order_number: existing, duplicate: true });

    const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
    let customerId = null;
    if (body.id_token) {
      // Si el token no vale (p. ej. caducado), el pedido se guarda igual, como invitado.
      const user = lookupUser_(body.id_token);
      if (user) customerId = findAuthCustomer_(user) || createCustomer_(order.customer, now, user);
    }
    if (!customerId) customerId = findOrCreateCustomer_(order.customer, now);
    const orderNumber = nextOrderNumber_();

    writeRow_('orders', {
      order_number: orderNumber,
      customer_id: customerId,
      channel: 'web',
      status: 'nuevo',
      currency: order.currency,
      shipping: 0,
      discount: 0,
      payment_method: order.payment_method,
      payment_reference: order.payment_reference,
      ship_to: order.customer.address,
      customer_note: order.customer_note,
      internal_note:
        `web_ref: ${order.web_ref} · zona: ${order.customer.zone} · enviado por: ${order.send_via} · subtotal web: ${order.subtotal}` +
        (order.customer.id_number ? ` · cédula/pasaporte: ${order.customer.id_number}` : ''),
      created_at: now,
    });
    order.items.forEach((it) =>
      writeRow_('order_items', {
        order_number: orderNumber,
        sku: it.sku,
        quantity: it.quantity,
        unit_price: it.unit_price,
      }),
    );
    return json_({ ok: true, order_number: orderNumber });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function validateOrder_(b) {
  const c = b.customer || {};
  const webRef = clean_(b.web_ref, 40);
  if (!/^WEB-\d{8}-[A-Z0-9]{4,8}$/.test(webRef)) throw new Error('bad web_ref');
  const currency = b.currency === 'USD' ? 'USD' : 'NIO';
  const pay = ['tarjeta', 'efectivo', 'transferencia', 'compra_click', 'paypal'].indexOf(b.payment_method) >= 0 ? b.payment_method : 'otro';
  const known = {};
  readVariants_().forEach((v) => (known[v.sku] = v));
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 30).map((it) => {
    const sku = clean_(it.sku, 40);
    const qty = Math.floor(Number(it.quantity));
    const price = Number(it.unit_price);
    if (!known[sku]) throw new Error('unknown sku ' + sku);
    if (!(qty >= 1 && qty <= 99)) throw new Error('bad quantity');
    if (!(price >= 0 && price < 100000)) throw new Error('bad price');
    return { sku: sku, quantity: qty, unit_price: price };
  });
  if (!items.length) throw new Error('no items');
  const name = clean_(c.full_name, 120);
  const phone = clean_(c.whatsapp_phone, 40);
  if (!name || !phone) throw new Error('name and phone required');
  return {
    web_ref: webRef,
    send_via: ['email', 'web'].indexOf(b.send_via) >= 0 ? b.send_via : 'whatsapp',
    payment_reference: clean_(b.payment_reference, 80),
    currency: currency,
    payment_method: pay,
    subtotal: Number(b.subtotal) || 0,
    customer_note: clean_(b.customer_note, 500),
    items: items,
    customer: {
      full_name: name,
      whatsapp_phone: phone,
      email: clean_(c.email, 120),
      preferred_language: c.preferred_language === 'en' ? 'en' : 'es',
      country: clean_(c.country, 2).toUpperCase(),
      address: clean_(c.address, 400),
      id_number: clean_(c.id_number, 30),
      zone: ['managua', 'nicaragua', 'intl'].indexOf(c.zone) >= 0 ? c.zone : '',
    },
  };
}

function digits_(s) {
  return String(s || '').replace(/\D/g, '');
}

function findOrCreateCustomer_(c, now) {
  const phone = digits_(c.whatsapp_phone);
  const match = readTable_('customers').find((r) => phone.length >= 7 && digits_(r.whatsapp_phone) === phone);
  if (match) return String(match.customer_id);
  return createCustomer_(c, now, null);
}

function createCustomer_(c, now, user, notes) {
  const rows = readTable_('customers');
  let max = 0;
  rows.forEach((r) => {
    const m = /^C-(\d+)$/.exec(String(r.customer_id || ''));
    if (m) max = Math.max(max, Number(m[1]));
  });
  const id = 'C-' + String(max + 1).padStart(4, '0');
  writeRow_('customers', {
    customer_id: id,
    type: 'retail',
    full_name: c.full_name,
    whatsapp_phone: c.whatsapp_phone,
    email: c.email,
    preferred_language: c.preferred_language,
    country: c.country,
    marketing_opt_in: 'no',
    address: c.address,
    notes: notes || 'Creado desde la web',
    created_at: now,
    auth_uid: user ? user.uid : '',
    auth_provider: user ? user.provider : '',
  });
  return id;
}

// ---------- Cuentas de clientes (Firebase) ----------------------------

/**
 * Comprueba el id_token con Firebase. Devuelve {uid, provider, email, phone}
 * con sólo el correo o teléfono VERIFICADOS, o null si el token no vale.
 */
function lookupUser_(idToken) {
  const key = PropertiesService.getScriptProperties().getProperty('FIREBASE_API_KEY');
  if (!key || !idToken || String(idToken).length > 4096) return null;
  const res = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(key), {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ idToken: String(idToken) }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) return null;
  const u = (JSON.parse(res.getContentText()).users || [])[0];
  if (!u || !u.localId || u.disabled) return null;
  return {
    uid: u.localId,
    provider: u.phoneNumber ? 'phone' : 'email',
    phone: u.phoneNumber || '',
    email: u.email && u.emailVerified ? String(u.email).toLowerCase() : '',
  };
}

/**
 * Cliente de una cuenta: primero por auth_uid; si no, por el teléfono o
 * correo verificados de la cuenta (nunca por lo escrito en el formulario),
 * y en ese caso liga la fila a la cuenta. Devuelve el id o null.
 */
function findAuthCustomer_(user) {
  ensureColumns_('customers', ['auth_uid', 'auth_provider']);
  const rows = readTable_('customers');
  const byUid = rows.find((r) => String(r.auth_uid || '') === user.uid);
  if (byUid) return String(byUid.customer_id);
  const phone = digits_(user.phone);
  const match = rows.find(
    (r) =>
      !String(r.auth_uid || '') &&
      ((phone.length >= 7 && digits_(r.whatsapp_phone) === phone) ||
        (user.email && String(r.email || '').trim().toLowerCase() === user.email)),
  );
  if (!match) return null;
  updateRow_('customers', 'customer_id', match.customer_id, { auth_uid: user.uid, auth_provider: user.provider });
  return String(match.customer_id);
}

function myOrders_(idToken) {
  const user = lookupUser_(idToken);
  if (!user) return { ok: false, error: 'auth' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let customerId;
  try {
    customerId = findAuthCustomer_(user);
  } finally {
    lock.releaseLock();
  }
  if (!customerId) return { ok: true, customer: null, orders: [] };

  const c = readTable_('customers').find((r) => String(r.customer_id) === customerId) || {};
  const items = readTable_('order_items');
  const orders = readTable_('orders')
    .filter((o) => String(o.customer_id) === customerId)
    .map((o) => ({
      order_number: String(o.order_number),
      web_ref: (/web_ref: (WEB-[A-Z0-9-]+)/.exec(String(o.internal_note || '')) || [])[1] || '',
      created_at: dateText_(o.created_at),
      status: String(o.status || ''),
      currency: String(o.currency || ''),
      subtotal: num_(o.subtotal),
      shipping: num_(o.shipping),
      discount: num_(o.discount),
      total: num_(o.total),
      items: items
        .filter((i) => String(i.order_number) === String(o.order_number))
        .map((i) => ({
          sku: String(i.sku || ''),
          product: String(i['product (auto)'] || ''),
          description: String(i['size and grind (auto)'] || ''),
          quantity: num_(i.quantity),
          unit_price: num_(i.unit_price),
          line_total: num_(i.line_total),
        })),
    }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  return {
    ok: true,
    customer: {
      full_name: plain_(c.full_name),
      whatsapp_phone: plain_(c.whatsapp_phone),
      email: plain_(c.email),
      address: plain_(c.address),
    },
    orders: orders,
  };
}

function findOrderByWebRef_(ref) {
  const hit = readTable_('orders').find((r) => String(r.internal_note || '').indexOf('web_ref: ' + ref) >= 0);
  return hit ? String(hit.order_number) : null;
}

function nextOrderNumber_() {
  const year = Utilities.formatDate(new Date(), TZ, 'yyyy');
  let max = 0;
  readTable_('orders').forEach((r) => {
    const m = new RegExp('^RJ-' + year + '-(\\d+)$').exec(String(r.order_number || ''));
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `RJ-${year}-${String(max + 1).padStart(4, '0')}`;
}

function underRateLimit_() {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('orders10m') || 0);
  if (n >= MAX_ORDERS_PER_10_MIN) return false;
  cache.put('orders10m', String(n + 1), 600);
  return true;
}

// ---------- Menú: publicar la web ------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tienda')
    .addItem('Publicar cambios en la web', 'publishSite')
    .addToUi();
}

function publishSite() {
  const ui = SpreadsheetApp.getUi();
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    ui.alert('Falta el GITHUB_TOKEN en Configuración del proyecto → Propiedades del script. Ver sheets/README.md.');
    return;
  }
  const res = UrlFetchApp.fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
    payload: JSON.stringify({ event_type: 'sheet-updated' }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() === 204) {
    ui.alert('Listo. La web se actualiza en 2 a 3 minutos.');
  } else {
    ui.alert('GitHub respondió ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  }
}

// ---------- Utilidades -----------------------------------------------

/** Filas de una pestaña como objetos {encabezado: valor}, sin filas vacías. */
function readTable_(name) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();
  const head = values.shift().map((h) => String(h).trim());
  return values
    .filter((row) => String(row[0]).trim() !== '')
    .map((row) => {
      const o = {};
      head.forEach((h, i) => (o[h] = row[i]));
      return o;
    });
}

/**
 * Escribe en la primera fila con la columna A vacía, sólo en las columnas
 * indicadas, para no pisar las fórmulas que ya hay en la plantilla.
 */
function writeRow_(name, data) {
  const sh = sheet_(name);
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map((h) => String(h).trim());
  const colA = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues();
  let row = colA.findIndex((r, i) => i > 0 && String(r[0]).trim() === '') + 1;
  if (row <= 0) row = colA.length + 1;
  Object.keys(data).forEach((key) => {
    const col = head.indexOf(key) + 1;
    if (col > 0 && data[key] !== undefined && data[key] !== '') {
      sh.getRange(row, col).setValue(safe_(data[key]));
    }
  });
  return row;
}

/** Cambia celdas de la fila cuya columna keyCol vale keyVal. */
function updateRow_(name, keyCol, keyVal, data) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();
  const head = values[0].map((h) => String(h).trim());
  const k = head.indexOf(keyCol);
  const idx = values.findIndex((r, i) => i > 0 && String(r[k]) === String(keyVal));
  if (idx < 1) return;
  Object.keys(data).forEach((key) => {
    const col = head.indexOf(key) + 1;
    if (col > 0) sh.getRange(idx + 1, col).setValue(safe_(data[key]));
  });
}

/** Añade al final los encabezados que falten (hojas creadas antes). */
function ensureColumns_(name, cols) {
  const sh = sheet_(name);
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map((h) => String(h).trim());
  let next = head.length;
  cols.forEach((c) => {
    if (head.indexOf(c) < 0) sh.getRange(1, ++next, 1, 1).setValue(c);
  });
}

function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Falta la pestaña ' + name);
  return sh;
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max);
}

/** Evita que un texto enviado desde la web se interprete como fórmula. */
function safe_(v) {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}

function toNumberOrNull_(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function num_(v) {
  const n = Number(v);
  return v === '' || v == null || !isFinite(n) ? 0 : n;
}

/** Quita el apóstrofo que safe_ pone delante de textos como "+505…". */
function plain_(v) {
  return String(v == null ? '' : v).replace(/^'/, '');
}

function dateText_(v) {
  return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm') : String(v || '');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
