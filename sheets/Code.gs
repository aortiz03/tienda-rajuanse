/**
 * RAJUANSE · Script de la hoja de pedidos (Google Apps Script)
 * ------------------------------------------------------------
 * Pegar este archivo en la hoja: Extensiones → Apps Script.
 * Instrucciones completas: sheets/README.md
 *
 * Hace tres cosas:
 *  1. GET  ?action=variants  → la web lee precios y disponibilidad
 *     de la pestaña product_variants cuando se publica.
 *  2. POST {type:"order"}    → cada pedido hecho en la web se añade
 *     solo a customers, orders y order_items.
 *  3. Menú "Tienda" → "Publicar cambios en la web": vuelve a publicar
 *     la web con los precios actuales de la hoja.
 */

const REPO = 'aortiz03/tienda-rajuanse';
const TZ = 'America/Managua';
const MAX_ORDERS_PER_10_MIN = 30; // freno contra envíos masivos

// ---------- Web: lectura de precios ----------------------------------

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'variants') return json_({ variants: readVariants_() });
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
    const customerId = findOrCreateCustomer_(order.customer, now);
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
      ship_to: order.customer.address,
      customer_note: order.customer_note,
      internal_note: `web_ref: ${order.web_ref} · zona: ${order.customer.zone} · enviado por: ${order.send_via} · subtotal web: ${order.subtotal}`,
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
  const pay = ['transferencia', 'efectivo', 'paypal'].indexOf(b.payment_method) >= 0 ? b.payment_method : 'otro';
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
    send_via: b.send_via === 'email' ? 'email' : 'whatsapp',
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
      zone: ['managua', 'nicaragua', 'intl'].indexOf(c.zone) >= 0 ? c.zone : '',
    },
  };
}

function findOrCreateCustomer_(c, now) {
  const digits = (s) => String(s || '').replace(/\D/g, '');
  const phone = digits(c.whatsapp_phone);
  const rows = readTable_('customers');
  const match = rows.find((r) => phone.length >= 7 && digits(r.whatsapp_phone) === phone);
  if (match) return String(match.customer_id);
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
    notes: 'Creado desde la web',
    created_at: now,
  });
  return id;
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

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
