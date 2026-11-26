# Tienda RAJUANSE

Tienda en línea de **RAJUANSE Estates** (Hacienda Buena Esperanza, Matagalpa, Nicaragua).
Online shop for RAJUANSE Estates: Spanish by default, English for US visitors.

## Qué hay / What's here

- Sólo la tienda (la página principal y la historia siguen en rajuanse.com): catálogo como portada, 8 páginas de producto, carrito y pedido, y 5 políticas (envíos, devoluciones, pagos, privacidad, términos), en español (`/`) e inglés (`/en/`).
- Selector ES / EN y C$ / US$. Visitantes con el navegador en inglés de EE. UU. ven la versión en inglés automáticamente; su elección se recuerda.
- El carrito se guarda en el navegador. Para pagar, el cliente entra con su cuenta (paso 1), llena sus datos y la entrega (paso 2, se guardan para la próxima vez) y elige **tarjeta** o **efectivo contra entrega** (paso 3). El pago con tarjeta es un **marcador de posición**: valida el formato y confirma el pago sin cobrar nada; el número nunca sale del navegador y a la hoja sólo llega "PRUEBA sin cobro · Visa ···· 4242".
- Todo lo que falta confirmar aparece en la página con la etiqueta **POR CONFIRMAR**.

## Conexión con la hoja de pedidos (Google Sheets)

- **Precios y disponibilidad** vienen de la pestaña `product_variants` de la hoja (columnas `price_nio`, `price_usd`, `active`). Si un precio está vacío se usa el precio de referencia de `src/data/shop.ts`; `active = no` oculta ese tamaño/molienda (o el café completo si no queda ninguno).
- **Pedidos:** al pulsar "Enviar pedido" el sitio abre WhatsApp (o el correo) y además envía una copia del pedido al Apps Script de la hoja, con una referencia `WEB-AAAAMMDD-XXXX` que también aparece en el mensaje.
- **Configuración:** en GitHub, *Settings → Secrets and variables → Actions → Variables*, crea `SHEET_API_URL` con la URL del Apps Script (termina en `/exec`). Sin esa variable el sitio funciona igual, con los precios de `shop.ts` y sin enviar copia a la hoja.
- **Actualizar el sitio:** se reconstruye solo cada día a las 6:00 (hora de Nicaragua), con el botón de la hoja (evento `sheet-updated`) o desde *Actions → Publicar en GitHub Pages → Run workflow*. Si la hoja no responde, la publicación se detiene y queda en línea la versión anterior.

## Panel de administración

Página privada (sólo tu cuenta de Google) para ver y mover pedidos, marcarlos como entregados, agregar pedidos de WhatsApp o en persona, llevar el inventario de café tostado y cambiar precios y disponibilidad. Usa la misma hoja de Google. Instalación: `sheets/README.md` → *Admin dashboard*.

## Cuentas de clientes (opcional)

Para comprar hace falta una cuenta. En el carrito el cliente escribe su correo: si ya tiene cuenta entra con su contraseña o con un enlace por correo; si no, crea una con contraseña (o con el enlace). En "Mi cuenta" también puede entrar con un código por SMS (se paga por mensaje).
Si Firebase no está configurado, el carrito avisa y deja seguir sin cuenta para que la tienda no quede bloqueada.
Con sesión iniciada, el pedido se llena solo y "Mi cuenta" muestra sus pedidos y su estado desde la hoja.

Para activarlo:
1. En [console.firebase.google.com](https://console.firebase.google.com) crea un proyecto (sin Google Analytics) y agrega una **app web** (`</>`). Copia `apiKey`, `authDomain` y `projectId`.
2. **Authentication → Sign-in method:** activa **Correo/contraseña** con **Vínculo de correo electrónico (acceso sin contraseña)**, y **Teléfono**. En **Authentication → Settings → User actions**, desactiva **Email enumeration protection** para que el carrito sepa si un correo ya tiene cuenta (si la dejas activada, todos ven primero "Crear cuenta" y quien ya tenga cuenta pasa a "Entrar" al intentarlo). El teléfono requiere el plan Blaze (tarjeta); pon un presupuesto mensual en Google Cloud Billing.
3. **Authentication → Settings → Authorized domains:** agrega `aortiz03.github.io` (y tu dominio propio si lo usas).
4. En GitHub, *Settings → Secrets and variables → Actions → Variables*, crea `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN` y `FIREBASE_PROJECT_ID`.
5. En el Apps Script de la hoja, agrega la propiedad `FIREBASE_API_KEY` (ver `sheets/README.md`).
6. Vuelve a publicar (Actions → Publicar en GitHub Pages → Run workflow).



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
