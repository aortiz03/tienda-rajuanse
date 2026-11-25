# Tienda RAJUANSE

Tienda en línea de **RAJUANSE Estates** (Hacienda Buena Esperanza, Matagalpa, Nicaragua).
Online shop for RAJUANSE Estates: Spanish by default, English for US visitors.

## Qué hay / What's here

- Sólo la tienda (la página principal y la historia siguen en rajuanse.com): catálogo como portada, 8 páginas de producto, carrito y pedido, y 5 políticas (envíos, devoluciones, pagos, privacidad, términos), en español (`/`) e inglés (`/en/`).
- Selector ES / EN y C$ / US$. Visitantes con el navegador en inglés de EE. UU. ven la versión en inglés automáticamente; su elección se recuerda.
- El carrito se guarda en el navegador. El cliente envía el pedido por **WhatsApp** o **correo**; no hay pago con tarjeta todavía.
- Todo lo que falta confirmar aparece en la página con la etiqueta **POR CONFIRMAR**.

## Conexión con la hoja de pedidos (Google Sheets)

- **Precios y disponibilidad** vienen de la pestaña `product_variants` de la hoja (columnas `price_nio`, `price_usd`, `active`). Si un precio está vacío se usa el precio de referencia de `src/data/shop.ts`; `active = no` oculta ese tamaño/molienda (o el café completo si no queda ninguno).
- **Pedidos:** al pulsar "Enviar pedido" el sitio abre WhatsApp (o el correo) y además envía una copia del pedido al Apps Script de la hoja, con una referencia `WEB-AAAAMMDD-XXXX` que también aparece en el mensaje.
- **Configuración:** en GitHub, *Settings → Secrets and variables → Actions → Variables*, crea `SHEET_API_URL` con la URL del Apps Script (termina en `/exec`). Sin esa variable el sitio funciona igual, con los precios de `shop.ts` y sin enviar copia a la hoja.
- **Actualizar el sitio:** se reconstruye solo cada día a las 6:00 (hora de Nicaragua), con el botón de la hoja (evento `sheet-updated`) o desde *Actions → Publicar en GitHub Pages → Run workflow*. Si la hoja no responde, la publicación se detiene y queda en línea la versión anterior.

## Cómo cambiar precios, notas de cata y contacto

Todo está en **`src/data/shop.ts`** (precios, productos, notas de cata, WhatsApp, correo, razón social).
Las políticas están en **`src/data/policies.ts`**; escribe `[[texto]]` para marcar algo como "por confirmar".
Las fotos de producto están en `public/images/products/` (imágenes de referencia; reemplazar por fotos reales de 2000 × 2000 px).

## Para desarrolladores

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # genera el sitio estático en dist/
```

Built with [Astro](https://astro.build) 5 as a fully static site, so it can be hosted on Netlify, Cloudflare Pages, Vercel or GitHub Pages and pointed at a subdomain such as `tienda.rajuanse.com` (set `site` in `astro.config.mjs`).

## Pendiente antes de lanzar

- Precios reales, IVA, costos de envío, número de WhatsApp y correo de pedidos.
- Notas de cata, altitud, cosecha, puntaje y lote de cada café.
- Fotos reales de producto.
- Fuentes: Palaestra y Aktiv Grotesk vienen de Adobe Fonts vía Squarespace; aquí se usan sustitutos libres (Playfair Display, Barlow, Barlow Condensed) hasta confirmar la licencia.
- Revisión legal de las políticas (Ley 842, Ley 787). Ventas a consumidores en EE. UU. requieren registro FDA y Prior Notice por envío.
- Pago en línea (tarjeta / PayPal) cuando se elija un proveedor.
