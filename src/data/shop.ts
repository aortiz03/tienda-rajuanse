/*
 * ============================================================
 *  DATOS DE LA TIENDA / SHOP DATA
 * ============================================================
 *  Este es el único archivo que hace falta editar para cambiar
 *  precios, notas de cata, datos de contacto y productos.
 *
 *  This is the one file to edit to change prices, tasting notes,
 *  contact details and products.
 *
 *  Todo lo marcado con  PLACEHOLDER  está por confirmar.
 * ============================================================
 */

// ---------- Contacto / Contact ----------------------------------------
export const contact = {
  // PLACEHOLDER: número de WhatsApp con código de país, sólo dígitos (505 = Nicaragua)
  whatsapp: '50500000000',
  // PLACEHOLDER: correo para pedidos
  email: 'pedidos@rajuanse.com',
  instagram: 'https://www.instagram.com/rajuanse_estates/',
  facebook: 'https://www.facebook.com/rajuanse',
  linkedin: 'https://www.linkedin.com/company/rajuanse-estates',
  website: 'https://www.rajuanse.com',
  // PLACEHOLDER: razón social y RUC
  legalName: 'Agrícola Rajuanse S.A.',
  ruc: '[RUC por confirmar]',
};

// ---------- Precios / Prices ------------------------------------------
// PLACEHOLDER: precios de referencia. Mismo precio en grano o molido.
// nio = córdobas (C$), usd = dólares (US$)
export type SizeId = '340g' | '500g' | '1kg' | '2.5kg';

export const prices: Record<'silent-sunrise' | 'family-reserve', Partial<Record<SizeId, { nio: number; usd: number }>>> = {
  'silent-sunrise': {
    '340g': { nio: 450, usd: 12 },
    '500g': { nio: 620, usd: 17 },
    '1kg': { nio: 1150, usd: 31 },
    '2.5kg': { nio: 2700, usd: 73 },
  },
  'family-reserve': {
    '340g': { nio: 750, usd: 20 },
    '500g': { nio: 1050, usd: 28 },
    '1kg': { nio: 1950, usd: 52 },
  },
};

// Etiquetas de tamaño (métrico + imperial)
export const sizes: Record<SizeId, { label: string; imperial: string }> = {
  '340g': { label: '340 g', imperial: '12 oz' },
  '500g': { label: '500 g', imperial: '1.1 lb' },
  '1kg': { label: '1 kg', imperial: '2.2 lb' },
  '2.5kg': { label: '2.5 kg', imperial: '5.5 lb' },
};

// Si los precios incluyen IVA (15 %). PLACEHOLDER: por confirmar.
export const pricesIncludeIVA = true;

// ---------- Líneas / Product lines ------------------------------------
export type LineId = keyof typeof prices;

export const lines: Record<LineId, { name: string; tagline: { es: string; en: string }; description: { es: string; en: string } }> = {
  'silent-sunrise': {
    name: 'Silent Sunrise',
    tagline: { es: 'Nuestra mezcla de cada día', en: 'Our everyday blend' },
    description: {
      es: 'Silent Sunrise es nuestra mezcla para todos los días: café de la Hacienda Buena Esperanza en Matagalpa, para la primera taza de la mañana y las que vienen después.',
      en: 'Silent Sunrise is our everyday blend: coffee from Hacienda Buena Esperanza in Matagalpa, for the first cup of the morning and every cup after.',
    },
  },
  'family-reserve': {
    name: 'Family Reserve',
    tagline: { es: 'Cafés de una sola variedad', en: 'Single-variety coffees' },
    description: {
      es: 'Family Reserve reúne nuestros cafés de una sola variedad, cada uno con su propio proceso, de la Hacienda Buena Esperanza en Matagalpa.',
      en: 'Family Reserve brings together our single-variety coffees, each with its own process, from Hacienda Buena Esperanza in Matagalpa.',
    },
  },
};

// ---------- Productos / Products --------------------------------------
type Text = { es: string; en: string };

export type Product = {
  slug: string;
  line: LineId;
  name: string; // nombre del café (sin la línea)
  variety: string;
  process: Text;
  roast: Text;
  sizes: SizeId[];
  image: string;
  // PLACEHOLDER: notas de cata vacías hasta confirmar
  tastingNotes: Text;
  intro: Text;
};

const MEDIO: Text = { es: 'Tueste medio', en: 'Medium roast' };
const OSCURO: Text = { es: 'Tueste oscuro', en: 'Dark roast' };
const NATURAL: Text = { es: 'Natural', en: 'Natural' };
const EMPTY: Text = { es: '', en: '' };
const SS_SIZES: SizeId[] = ['340g', '500g', '1kg', '2.5kg'];
const FR_SIZES: SizeId[] = ['340g', '500g', '1kg'];

export const products: Product[] = [
  {
    slug: 'silent-sunrise-medio',
    line: 'silent-sunrise',
    name: 'Tueste medio',
    variety: 'Blend',
    process: { es: 'Mezcla', en: 'Blend' },
    roast: MEDIO,
    sizes: SS_SIZES,
    image: '/images/products/silent-sunrise-medio.webp',
    tastingNotes: EMPTY,
    intro: {
      es: 'Para preparar como más te guste: en greca, prensa francesa o filtro.',
      en: 'For brewing however you like it: moka pot, French press or filter.',
    },
  },
  {
    slug: 'silent-sunrise-oscuro',
    line: 'silent-sunrise',
    name: 'Tueste oscuro',
    variety: 'Blend',
    process: { es: 'Mezcla', en: 'Blend' },
    roast: OSCURO,
    sizes: SS_SIZES,
    image: '/images/products/silent-sunrise-oscuro.webp',
    tastingNotes: EMPTY,
    intro: {
      es: 'Un tueste más profundo, para quien toma su café intenso o con leche.',
      en: 'A deeper roast, for those who like their coffee bold or with milk.',
    },
  },
  {
    slug: 'mariana-maceracion-carbonica',
    line: 'family-reserve',
    name: 'Mariana Maceración Carbónica',
    variety: 'Mariana',
    process: { es: 'Maceración carbónica', en: 'Carbonic maceration' },
    roast: MEDIO,
    sizes: FR_SIZES,
    image: '/images/products/family-reserve-mariana-maceracion-carbonica.webp',
    tastingNotes: EMPTY,
    intro: {
      es: 'Nuestro lote más experimental: la cereza fermenta entera en un ambiente sin oxígeno antes de secarse.',
      en: 'Our most experimental lot: whole cherries ferment without oxygen before drying.',
    },
  },
  {
    slug: 'mariana-natural',
    line: 'family-reserve',
    name: 'Mariana Natural',
    variety: 'Mariana',
    process: NATURAL,
    roast: MEDIO,
    sizes: FR_SIZES,
    image: '/images/products/family-reserve-mariana-natural.webp',
    tastingNotes: EMPTY,
    intro: {
      es: 'La variedad Mariana, secada dentro de la cereza.',
      en: 'The Mariana variety, dried inside the whole cherry.',
    },
  },
  {
    slug: 'pacamara-lavado',
    line: 'family-reserve',
    name: 'Pacamara Lavado',
    variety: 'Pacamara',
    process: { es: 'Lavado', en: 'Washed' },
    roast: MEDIO,
    sizes: FR_SIZES,
    image: '/images/products/family-reserve-pacamara-lavado.webp',
    tastingNotes: EMPTY,
    intro: {
      es: 'Pacamara de grano grande, despulpado y lavado para una taza limpia y clara.',
      en: 'Large-bean Pacamara, pulped and washed for a clean, clear cup.',
    },
  },
  {
    slug: 'parainema-natural',
    line: 'family-reserve',
    name: 'Parainema Natural',
    variety: 'Parainema',
    process: NATURAL,
    roast: MEDIO,
    sizes: FR_SIZES,
    image: '/images/products/family-reserve-parainema-natural.webp',
    tastingNotes: EMPTY,
    intro: {
      es: 'Parainema, una variedad centroamericana, secada dentro de la cereza.',
      en: 'Parainema, a Central American variety, dried inside the whole cherry.',
    },
  },
  {
    slug: 'marsellesa-natural',
    line: 'family-reserve',
    name: 'Marsellesa Natural',
    variety: 'Marsellesa',
    process: NATURAL,
    roast: MEDIO,
    sizes: FR_SIZES,
    image: '/images/products/family-reserve-marsellesa-natural.webp',
    tastingNotes: EMPTY,
    intro: {
      es: 'Marsellesa de proceso natural, cosechada a mano en la Hacienda Buena Esperanza.',
      en: 'Natural-process Marsellesa, hand-picked at Hacienda Buena Esperanza.',
    },
  },
  {
    slug: 'h1-natural',
    line: 'family-reserve',
    name: 'H1 Natural',
    variety: 'H1',
    process: NATURAL,
    roast: MEDIO,
    sizes: FR_SIZES,
    image: '/images/products/family-reserve-h1-natural.webp',
    tastingNotes: EMPTY,
    intro: {
      es: 'El híbrido H1, secado dentro de la cereza.',
      en: 'The H1 hybrid, dried inside the whole cherry.',
    },
  },
];

// ---------- Envíos / Shipping (para el pedido) -------------------------
export const shippingZones = [
  { id: 'managua', es: 'Managua (1 a 2 días hábiles)', en: 'Managua (1 to 2 business days)' },
  { id: 'nicaragua', es: 'Resto de Nicaragua (2 a 5 días hábiles)', en: 'Rest of Nicaragua (2 to 5 business days)' },
  { id: 'intl', es: 'Centroamérica y EE. UU. (7 a 15 días hábiles)', en: 'Central America and the US (7 to 15 business days)' },
];

export const paymentMethods = [
  { id: 'transfer', es: 'Transferencia bancaria', en: 'Bank transfer' },
  { id: 'cash', es: 'Efectivo contra entrega (sólo Managua)', en: 'Cash on delivery (Managua only)' },
  { id: 'paypal', es: 'PayPal (pedidos internacionales)', en: 'PayPal (international orders)' },
];

export function getProduct(slug: string) {
  return products.find((p) => p.slug === slug);
}

export function fullName(p: Product) {
  return `${lines[p.line].name} · ${p.name}`;
}
