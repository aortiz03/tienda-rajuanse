/**
 * RAJUANSE · Panel de administración (Google Apps Script)
 * --------------------------------------------------------
 * Va en el MISMO proyecto de Apps Script que Code.gs, como un archivo
 * más (Admin.gs), junto con la página Admin.html.
 * Instrucciones: sheets/README.md → "Panel de administración".
 *
 * Seguridad: todas las funciones admin* revisan primero que quien las
 * llama haya iniciado sesión en Google con un correo de ADMIN_EMAILS
 * (propiedad del script). Sin esa propiedad, sólo entra la dueña del
 * script. Un visitante anónimo nunca tiene correo, así que nunca entra.
 *
 * Para pasar a una base de datos más adelante: la página sólo habla con
 * estas funciones (adminLoad, adminUpdateOrder, ...). Basta con escribir
 * las mismas funciones contra la base de datos y cambiar `api()` en
 * Admin.html por un fetch().
 */

const ORDER_STATUSES = ['nuevo', 'confirmado', 'pagado', 'tostado / empacado', 'enviado', 'entregado', 'cancelado'];
const PACKED_STATUSES = ['tostado / empacado', 'enviado', 'entregado'];
const CHANNELS = ['web', 'whatsapp', 'email', 'in_person'];
const PAYMENT_METHODS = ['transferencia', 'efectivo', 'compra_click', 'paypal', 'otro'];

const INVENTORY_COLS = ['inventory_id', 'product', 'roast', 'stock_kg', 'low_stock_kg', 'updated_at', 'notes'];
const MOVES_COLS = ['created_at', 'inventory_id', 'change_kg', 'stock_after_kg', 'reason', 'order_number', 'by'];

// ---------- Acceso ----------------------------------------------------

function adminEmails_() {
  const prop = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS') || '';
  const list = prop
    .split(/[,\s;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length) return list;
  const owner = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  return owner ? [owner] : [];
}

function currentEmail_() {
  return String(Session.getActiveUser().getEmail() || '').toLowerCase();
}

function isAdmin_() {
  const email = currentEmail_();
  return !!email && adminEmails_().indexOf(email) >= 0;
}

function requireAdmin_() {
  if (!isAdmin_()) throw new Error('Sin acceso. Entra con la cuenta de Google autorizada.');
  return currentEmail_();
}

/** Página del panel (la sirve doGet en Code.gs sólo a quien es admin). */
function adminPage_() {
  return HtmlService.createHtmlOutputFromFile('Admin')
    .setTitle('RAJUANSE · Panel')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Ejecuta fn con el candado del script (el mismo que usan los pedidos web). */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const out = fn();
    SpreadsheetApp.flush();
    return out;
  } finally {
    lock.releaseLock();
  }
}

// ---------- Lectura: todo lo que muestra el panel ----------------------

function adminLoad() {
  const email = requireAdmin_();
  withLock_(() => ensureAdminTabs_());
  const variants = readTable_('product_variants')
    .filter((r) => String(r.sku || '').trim())
    .map((r) => ({
      sku: String(r.sku).trim(),
      product: plain_(r.product),
      line: plain_(r.line),
      roast: plain_(r.roast),
      weight_g: num_(r.weight_g),
      grind: plain_(r.grind),
      price_nio: toNumberOrNull_(r.price_nio),
      price_usd: toNumberOrNull_(r.price_usd),
      active: String(r.active || 'yes').trim().toLowerCase() === 'no' ? 'no' : 'yes',
      inventory_id: inventoryIdForSku_(r.sku),
    }));

  const customers = readTable_('customers').map((c) => ({
    customer_id: String(c.customer_id),
    type: plain_(c.type),
    full_name: plain_(c.full_name),
    company_name: plain_(c.company_name),
    whatsapp_phone: plain_(c.whatsapp_phone),
    email: plain_(c.email),
    preferred_language: plain_(c.preferred_language),
    country: plain_(c.country),
    address: plain_(c.address),
    delivery_reference: plain_(c.delivery_reference),
    notes: plain_(c.notes),
    has_account: !!String(c.auth_uid || '').trim(),
  }));

  const itemsByOrder = {};
  readTable_('order_items').forEach((i) => {
    const key = String(i.order_number);
    const qty = num_(i.quantity);
    const price = num_(i.unit_price);
    (itemsByOrder[key] = itemsByOrder[key] || []).push({
      sku: plain_(i.sku),
      product: plain_(i['product (auto)']),
      description: plain_(i['size and grind (auto)']),
      quantity: qty,
      unit_price: price,
      line_total: qty * price,
    });
  });

  const orders = readTable_('orders')
    .map((o) => {
      const items = itemsByOrder[String(o.order_number)] || [];
      const subtotal = items.reduce((s, i) => s + i.line_total, 0);
      const shipping = num_(o.shipping);
      const discount = num_(o.discount);
      return {
        order_number: String(o.order_number),
        customer_id: plain_(o.customer_id),
        channel: plain_(o.channel),
        status: plain_(o.status) || 'nuevo',
        currency: plain_(o.currency) || 'NIO',
        subtotal: subtotal,
        shipping: shipping,
        discount: discount,
        total: subtotal + shipping - discount,
        payment_method: plain_(o.payment_method),
        payment_reference: plain_(o.payment_reference),
        paid_on: dateText_(o.paid_on).slice(0, 10),
        ship_to: plain_(o.ship_to),
        shipped_on: dateText_(o.shipped_on).slice(0, 10),
        customer_note: plain_(o.customer_note),
        internal_note: plain_(o.internal_note),
        created_at: dateText_(o.created_at),
        stock_deducted: String(o.stock_deducted || '') === 'yes',
        items: items,
      };
    })
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));

  return {
    user: email,
    statuses: ORDER_STATUSES,
    packed_statuses: PACKED_STATUSES,
    channels: CHANNELS,
    payment_methods: PAYMENT_METHODS,
    can_publish: !!PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN'),
    variants: variants,
    customers: customers,
    orders: orders,
    inventory: readInventory_(),
    moves: readTable_('inventory_moves')
      .slice(-100)
      .reverse()
      .map((m) => ({
        created_at: dateText_(m.created_at),
        inventory_id: plain_(m.inventory_id),
        change_kg: num_(m.change_kg),
        stock_after_kg: num_(m.stock_after_kg),
        reason: plain_(m.reason),
        order_number: plain_(m.order_number),
        by: plain_(m.by),
      })),
  };
}

// ---------- Pedidos ---------------------------------------------------

/**
 * Cambia un pedido. `changes` puede traer: status, payment_method,
 * payment_reference, paid_on, shipped_on, shipping, discount,
 * internal_note, ship_to. Al pasar a "tostado / empacado" (o después)
 * descuenta el café del inventario; al volver atrás lo devuelve.
 */
function adminUpdateOrder(orderNumber, changes) {
  const email = requireAdmin_();
  return withLock_(() => {
    ensureAdminTabs_();
    const order = readTable_('orders').find((o) => String(o.order_number) === String(orderNumber));
    if (!order) throw new Error('No encontré el pedido ' + orderNumber);
    const c = changes || {};
    const data = {};
    const prev = String(order.status || 'nuevo');
    const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');

    if (c.status !== undefined) {
      if (ORDER_STATUSES.indexOf(c.status) < 0) throw new Error('Estado no válido: ' + c.status);
      data.status = c.status;
      if (c.status === 'pagado' && !order.paid_on && !c.paid_on) data.paid_on = today;
      if (c.status === 'enviado' && !order.shipped_on && !c.shipped_on) data.shipped_on = today;
    }
    if (c.payment_method !== undefined) {
      if (c.payment_method && PAYMENT_METHODS.indexOf(c.payment_method) < 0) throw new Error('Forma de pago no válida');
      data.payment_method = c.payment_method;
    }
    ['payment_reference', 'internal_note', 'ship_to'].forEach((k) => {
      if (c[k] !== undefined) data[k] = clean_(c[k], 1000);
    });
    ['paid_on', 'shipped_on'].forEach((k) => {
      if (c[k] !== undefined) data[k] = dateOrBlank_(c[k]);
    });
    ['shipping', 'discount'].forEach((k) => {
      if (c[k] !== undefined) data[k] = money_(c[k]);
    });

    if (data.status !== undefined && data.status !== prev) {
      const deducted = String(order.stock_deducted || '') === 'yes';
      const goesPacked = PACKED_STATUSES.indexOf(data.status) >= 0;
      const goesBack = ['nuevo', 'confirmado', 'pagado'].indexOf(data.status) >= 0;
      const cancelUnshipped = data.status === 'cancelado' && prev === 'tostado / empacado';
      if (goesPacked && !deducted) {
        deductOrderStock_(String(orderNumber), email);
        data.stock_deducted = 'yes';
      } else if (deducted && (goesBack || cancelUnshipped)) {
        restoreOrderStock_(String(orderNumber), email);
        data.stock_deducted = '';
      }
    }
    updateRow_('orders', 'order_number', orderNumber, data);
    return { ok: true, order_number: String(orderNumber) };
  });
}

/**
 * Pedido hecho a mano (WhatsApp, correo, en persona).
 * p = { customer_id?, customer:{full_name, whatsapp_phone, email, address, preferred_language, country},
 *       channel, currency, status, payment_method, payment_reference, shipping, discount,
 *       ship_to, customer_note, internal_note, items:[{sku, quantity, unit_price}] }
 */
function adminCreateOrder(p) {
  const email = requireAdmin_();
  return withLock_(() => {
    ensureAdminTabs_();
    p = p || {};
    const channel = CHANNELS.indexOf(p.channel) >= 0 ? p.channel : 'whatsapp';
    const status = ORDER_STATUSES.indexOf(p.status) >= 0 ? p.status : 'nuevo';
    const currency = p.currency === 'USD' ? 'USD' : 'NIO';
    const pay = PAYMENT_METHODS.indexOf(p.payment_method) >= 0 ? p.payment_method : '';

    const known = {};
    readVariants_().forEach((v) => (known[v.sku] = v));
    const items = (Array.isArray(p.items) ? p.items : []).slice(0, 50).map((it) => {
      const sku = clean_(it.sku, 40);
      const qty = Math.floor(Number(it.quantity));
      const price = Number(it.unit_price);
      if (!known[sku]) throw new Error('Código no existe: ' + sku);
      if (!(qty >= 1 && qty <= 999)) throw new Error('Cantidad no válida en ' + sku);
      if (!(price >= 0 && price < 1000000) || String(it.unit_price) === '') throw new Error('Falta el precio de ' + sku);
      return { sku: sku, quantity: qty, unit_price: price };
    });
    if (!items.length) throw new Error('Agrega al menos un café.');

    const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
    let customerId = clean_(p.customer_id, 20);
    let customer = null;
    if (customerId) {
      customer = readTable_('customers').find((r) => String(r.customer_id) === customerId);
      if (!customer) throw new Error('No encontré el cliente ' + customerId);
    } else {
      const c = p.customer || {};
      const nc = {
        full_name: clean_(c.full_name, 120),
        whatsapp_phone: clean_(c.whatsapp_phone, 40),
        email: clean_(c.email, 120),
        preferred_language: c.preferred_language === 'en' ? 'en' : 'es',
        country: clean_(c.country || 'NI', 2).toUpperCase(),
        address: clean_(c.address, 400),
      };
      if (!nc.full_name) throw new Error('Falta el nombre del cliente.');
      const match = readTable_('customers').find((r) => samePhone_(r.whatsapp_phone, nc.whatsapp_phone));
      if (match) {
        customerId = String(match.customer_id);
        customer = match;
      } else {
        customerId = createCustomer_(nc, now, null, 'Creado desde el panel');
        customer = { address: nc.address };
      }
    }

    const today = now.slice(0, 10);
    const orderNumber = nextOrderNumber_();
    writeRow_('orders', {
      order_number: orderNumber,
      customer_id: customerId,
      channel: channel,
      status: status,
      currency: currency,
      shipping: money_(p.shipping),
      discount: money_(p.discount),
      payment_method: pay,
      payment_reference: clean_(p.payment_reference, 200),
      paid_on: ['pagado'].concat(PACKED_STATUSES).indexOf(status) >= 0 && pay ? today : '',
      ship_to: clean_(p.ship_to, 400) || plain_(customer && customer.address),
      shipped_on: ['enviado', 'entregado'].indexOf(status) >= 0 ? today : '',
      customer_note: clean_(p.customer_note, 500),
      internal_note: [clean_(p.internal_note, 500), 'creado en el panel por ' + email].filter(Boolean).join(' · '),
      created_at: now,
    });
    items.forEach((it) =>
      writeRow_('order_items', {
        order_number: orderNumber,
        sku: it.sku,
        quantity: it.quantity,
        unit_price: it.unit_price,
      }),
    );
    if (PACKED_STATUSES.indexOf(status) >= 0) {
      deductOrderStock_(orderNumber, email, items);
      updateRow_('orders', 'order_number', orderNumber, { stock_deducted: 'yes' });
    }
    return { ok: true, order_number: orderNumber, customer_id: customerId };
  });
}

/** Cambia los datos de contacto de un cliente. */
function adminUpdateCustomer(customerId, changes) {
  requireAdmin_();
  return withLock_(() => {
    const row = readTable_('customers').find((r) => String(r.customer_id) === String(customerId));
    if (!row) throw new Error('No encontré el cliente ' + customerId);
    const c = changes || {};
    const data = {};
    const limits = { full_name: 120, company_name: 120, whatsapp_phone: 40, email: 120, address: 400, delivery_reference: 300, notes: 500 };
    Object.keys(limits).forEach((k) => {
      if (c[k] !== undefined) data[k] = clean_(c[k], limits[k]);
    });
    if (data.full_name === '') throw new Error('El nombre no puede quedar vacío.');
    updateRow_('customers', 'customer_id', customerId, data);
    return { ok: true };
  });
}

// ---------- Productos y precios ----------------------------------------

/** rows = [{sku, price_nio, price_usd, active}] — sólo las filas que cambiaron. */
function adminSaveVariants(rows) {
  requireAdmin_();
  return withLock_(() => {
    const known = {};
    readVariants_().forEach((v) => (known[v.sku] = true));
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      const sku = clean_(r.sku, 40);
      if (!known[sku]) throw new Error('Código no existe: ' + sku);
      const data = {};
      if (r.price_nio !== undefined) data.price_nio = priceOrBlank_(r.price_nio);
      if (r.price_usd !== undefined) data.price_usd = priceOrBlank_(r.price_usd);
      if (r.active !== undefined) data.active = r.active === 'no' ? 'no' : 'yes';
      updateRow_('product_variants', 'sku', sku, data);
    });
    return { ok: true };
  });
}

/** Igual que el menú Tienda → Publicar cambios en la web. */
function adminPublishSite() {
  requireAdmin_();
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Falta GITHUB_TOKEN en las propiedades del script (ver sheets/README.md).');
  const res = UrlFetchApp.fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
    payload: JSON.stringify({ event_type: 'sheet-updated' }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 204) {
    throw new Error('GitHub respondió ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  }
  return { ok: true };
}

// ---------- Inventario ------------------------------------------------

/**
 * Entrada, salida o conteo de café tostado.
 * mode "add": suma change_kg (negativo para restar). mode "set": deja stock_kg en ese valor.
 */
function adminAdjustStock(inventoryId, mode, kg, reason) {
  const email = requireAdmin_();
  return withLock_(() => {
    ensureAdminTabs_();
    const row = readTable_('inventory').find((r) => String(r.inventory_id) === String(inventoryId));
    if (!row) throw new Error('No encontré ' + inventoryId);
    const value = Number(kg);
    if (!isFinite(value) || String(kg).trim() === '') throw new Error('Escribe los kg.');
    const current = num_(row.stock_kg);
    const next = round3_(mode === 'set' ? value : current + value);
    if (next < 0 && mode === 'set') throw new Error('El inventario no puede ser negativo.');
    moveStock_(String(inventoryId), round3_(next - current), clean_(reason, 200) || (mode === 'set' ? 'conteo' : 'entrada'), '', email, next);
    return { ok: true, stock_kg: next };
  });
}

function adminSetLowStock(inventoryId, kg) {
  requireAdmin_();
  return withLock_(() => {
    ensureAdminTabs_();
    updateRow_('inventory', 'inventory_id', inventoryId, { low_stock_kg: String(kg).trim() === '' ? '' : Math.max(0, Number(kg) || 0) });
    return { ok: true };
  });
}

/** "SS-MED-340-GR" → "SS-MED": un renglón de inventario por café y tueste. */
function inventoryIdForSku_(sku) {
  return String(sku || '')
    .trim()
    .split('-')
    .slice(0, 2)
    .join('-');
}

function readInventory_() {
  return readTable_('inventory').map((r) => ({
    inventory_id: String(r.inventory_id),
    product: plain_(r.product),
    roast: plain_(r.roast),
    tracked: String(r.stock_kg) !== '' && r.stock_kg != null,
    stock_kg: num_(r.stock_kg),
    low_stock_kg: toNumberOrNull_(r.low_stock_kg),
    updated_at: dateText_(r.updated_at),
    notes: plain_(r.notes),
  }));
}

/** Crea las pestañas inventory e inventory_moves y la columna stock_deducted si faltan. */
function ensureAdminTabs_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let inv = ss.getSheetByName('inventory');
  if (!inv) {
    inv = ss.insertSheet('inventory');
    inv.getRange(1, 1, 1, INVENTORY_COLS.length).setValues([INVENTORY_COLS]).setFontWeight('bold');
    inv.setFrozenRows(1);
  }
  if (!ss.getSheetByName('inventory_moves')) {
    const mv = ss.insertSheet('inventory_moves');
    mv.getRange(1, 1, 1, MOVES_COLS.length).setValues([MOVES_COLS]).setFontWeight('bold');
    mv.setFrozenRows(1);
  }
  ensureColumns_('orders', ['stock_deducted']);

  // Un renglón por café y tueste que aparezca en product_variants.
  const have = {};
  readTable_('inventory').forEach((r) => (have[String(r.inventory_id)] = true));
  readTable_('product_variants').forEach((v) => {
    const id = inventoryIdForSku_(v.sku);
    if (!id || have[id]) return;
    have[id] = true;
    writeRow_('inventory', { inventory_id: id, product: plain_(v.product), roast: plain_(v.roast) });
  });
}

/** Kilos de café de cada renglón de inventario que lleva un pedido. */
function orderKgByInventory_(items) {
  const weights = {};
  readTable_('product_variants').forEach((v) => (weights[String(v.sku).trim()] = num_(v.weight_g)));
  const kg = {};
  items.forEach((i) => {
    const id = inventoryIdForSku_(i.sku);
    kg[id] = round3_((kg[id] || 0) + (num_(i.quantity) * (weights[String(i.sku).trim()] || 0)) / 1000);
  });
  return kg;
}

function deductOrderStock_(orderNumber, by, items) {
  items = items || readTable_('order_items').filter((i) => String(i.order_number) === orderNumber);
  const kg = orderKgByInventory_(items);
  const inv = {};
  readInventory_().forEach((r) => (inv[r.inventory_id] = r));
  Object.keys(kg).forEach((id) => {
    // Un café sin stock_kg escrito todavía no se controla.
    if (!inv[id] || !inv[id].tracked || !kg[id]) return;
    moveStock_(id, -kg[id], 'pedido empacado', orderNumber, by);
  });
}

/** Deshace exactamente lo que se descontó para ese pedido. */
function restoreOrderStock_(orderNumber, by) {
  const net = {};
  readTable_('inventory_moves')
    .filter((m) => String(m.order_number) === orderNumber)
    .forEach((m) => (net[m.inventory_id] = round3_((net[m.inventory_id] || 0) + num_(m.change_kg))));
  Object.keys(net).forEach((id) => {
    if (net[id]) moveStock_(id, -net[id], 'pedido devuelto a inventario', orderNumber, by);
  });
}

function moveStock_(id, changeKg, reason, orderNumber, by, after) {
  const row = readTable_('inventory').find((r) => String(r.inventory_id) === id);
  const next = after !== undefined ? after : round3_(num_(row && row.stock_kg) + changeKg);
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  updateRow_('inventory', 'inventory_id', id, { stock_kg: next, updated_at: now });
  writeRow_('inventory_moves', {
    created_at: now,
    inventory_id: id,
    change_kg: changeKg,
    stock_after_kg: next,
    reason: reason,
    order_number: orderNumber,
    by: by,
  });
}

// ---------- Utilidades del panel ----------------------------------------

/** Mismo teléfono aunque uno lleve código de país (+505 8123 4567 = 81234567). */
function samePhone_(a, b) {
  const x = digits_(a);
  const y = digits_(b);
  if (x.length < 7 || y.length < 7) return false;
  if (x === y) return true;
  const short = x.length < y.length ? x : y;
  const long = x.length < y.length ? y : x;
  return short.length >= 8 && long.slice(-short.length) === short;
}

function money_(v) {
  const n = Number(v);
  return v === '' || v == null || !isFinite(n) || n < 0 ? 0 : Math.round(n * 100) / 100;
}

function priceOrBlank_(v) {
  if (v === '' || v == null) return '';
  const n = Number(v);
  if (!isFinite(n) || n < 0 || n >= 1000000) throw new Error('Precio no válido: ' + v);
  return Math.round(n * 100) / 100;
}

function dateOrBlank_(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Fecha no válida: ' + s);
  return s;
}

function round3_(n) {
  return Math.round(n * 1000) / 1000;
}
