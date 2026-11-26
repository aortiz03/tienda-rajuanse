// Datos del cliente guardados en este dispositivo (por cuenta) y pedidos desde la hoja.
export type Profile = { name?: string; phone?: string; email?: string; address?: string; zone?: string };

export function loadProfile(uid: string): Profile {
  try {
    return JSON.parse(localStorage.getItem(`rj-profile-${uid}`) || '{}');
  } catch {
    return {};
  }
}

export function saveProfile(uid: string, p: Profile) {
  try {
    localStorage.setItem(`rj-profile-${uid}`, JSON.stringify(p));
  } catch {}
}

export type SheetOrder = {
  order_number: string;
  web_ref?: string;
  created_at: string;
  status: string;
  currency: 'NIO' | 'USD';
  subtotal: number;
  shipping?: number;
  discount?: number;
  total: number;
  items: { sku: string; product: string; description?: string; quantity: number; unit_price: number; line_total: number }[];
};

export type MyOrders = {
  ok: boolean;
  error?: string;
  customer?: { full_name?: string; whatsapp_phone?: string; email?: string; address?: string } | null;
  orders?: SheetOrder[];
};

export async function fetchMyOrders(endpoint: string, token: string): Promise<MyOrders> {
  const sep = endpoint.includes('?') ? '&' : '?';
  const res = await fetch(`${endpoint}${sep}action=my_orders&id_token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}
