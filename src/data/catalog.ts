/*
 * Precios y disponibilidad de cada bolsa.
 *
 * Si la variable SHEET_API_URL está definida al construir el sitio, los precios
 * y la columna "active" se leen de la pestaña product_variants de la hoja de
 * pedidos (Google Sheets, a través de su Apps Script). Si no, se usan los
 * precios de referencia de shop.ts.
 */
import { type Product, type SizeId, prices, sizes } from './shop';

export type Grind = 'whole' | 'ground';
export const grinds: Grind[] = ['whole', 'ground'];

export type Variant = { sku: string; size: SizeId; grind: Grind; nio: number; usd: number; active: boolean };

type SheetRow = { sku: string; price_nio?: unknown; price_usd?: unknown; active?: unknown };

export const sheetUrl = (process.env.SHEET_API_URL || '').trim();

async function loadSheet(): Promise<Map<string, SheetRow>> {
  const map = new Map<string, SheetRow>();
  if (!sheetUrl) return map;
  // Si la hoja no responde, la construcción falla a propósito: así sigue
  // publicada la versión anterior en lugar de una con precios equivocados.
  const res = await fetch(`${sheetUrl}${sheetUrl.includes('?') ? '&' : '?'}action=variants`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Sheet API answered ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.variants)) throw new Error('Sheet API: missing "variants" list');
  for (const row of data.variants as SheetRow[]) {
    if (row && typeof row.sku === 'string') map.set(row.sku.trim().toUpperCase(), row);
  }
  console.log(`[catalog] ${map.size} variants loaded from the order sheet`);
  return map;
}

const sheet = await loadSheet();

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function skuFor(p: Product, size: SizeId, grind: Grind) {
  return `${p.code}-${sizes[size].grams}-${grind === 'whole' ? 'GR' : 'MO'}`;
}

export function variantsOf(p: Product): Variant[] {
  return p.sizes.flatMap((size) =>
    grinds.map((grind) => {
      const sku = skuFor(p, size, grind);
      const fallback = prices[p.line][size]!;
      const row = sheet.get(sku);
      const active = row ? !/^(no|false|0|inactive)$/i.test(String(row.active ?? 'yes').trim()) : true;
      return {
        sku,
        size,
        grind,
        nio: num(row?.price_nio) ?? fallback.nio,
        usd: num(row?.price_usd) ?? fallback.usd,
        active,
      };
    }),
  );
}

export function activeVariants(p: Product) {
  return variantsOf(p).filter((v) => v.active);
}

export function isAvailable(p: Product) {
  return activeVariants(p).length > 0;
}

/** Precio más bajo disponible ("Desde ...") */
export function fromPrice(p: Product) {
  const vs = activeVariants(p);
  const min = vs.reduce((a, b) => (b.nio < a.nio ? b : a), vs[0]);
  return min;
}
