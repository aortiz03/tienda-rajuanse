// Carrito guardado en el navegador del visitante (localStorage).
export type CartItem = { slug: string; size: string; grind: 'whole' | 'ground'; qty: number };

const KEY = 'rj-cart';

export function readCart(): CartItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((i) => i && i.slug && i.size && i.qty > 0) : [];
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
  document.dispatchEvent(new CustomEvent('cart:change'));
}

export function addToCart(item: CartItem) {
  const items = readCart();
  const found = items.find((i) => i.slug === item.slug && i.size === item.size && i.grind === item.grind);
  if (found) found.qty = Math.min(99, found.qty + item.qty);
  else items.push(item);
  writeCart(items);
}

export function cartCount() {
  return readCart().reduce((n, i) => n + i.qty, 0);
}
