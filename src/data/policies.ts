/*
 * Políticas de la tienda (borradores de la guía de marca).
 * IMPORTANTE: no son asesoría legal. Deben revisarse con un abogado en Nicaragua
 * (Ley 842 de protección al consumidor y Ley 787 de protección de datos personales).
 *
 * Escribe [[texto]] para marcar algo como "por confirmar"; se mostrará resaltado.
 */
import { contact } from './shop';

export type PolicyKey = 'shipping' | 'returns' | 'payments' | 'privacy' | 'terms';

type Policy = { title: string; intro?: string; body: string };

export const policies: Record<PolicyKey, { es: Policy; en: Policy }> = {
  shipping: {
    es: {
      title: 'Envíos',
      body: `
<div class="table-scroll"><table>
<thead><tr><th>Destino</th><th>Transporte</th><th>Tiempo de entrega</th><th>Costo</th></tr></thead>
<tbody>
<tr><td>Managua</td><td>Mensajería local o entrega propia [[por confirmar]]</td><td>1 a 2 días hábiles</td><td>[[C$ ___]]</td></tr>
<tr><td>Resto de Nicaragua</td><td>Mensajería nacional [[por confirmar]]</td><td>2 a 5 días hábiles</td><td>[[C$ ___]]</td></tr>
<tr><td>Centroamérica y EE. UU.</td><td>Servicio postal o mensajería [[por confirmar]]</td><td>7 a 15 días hábiles</td><td>Se calcula con tu pedido</td></tr>
</tbody></table></div>
<ul>
<li>Despachamos los pedidos dentro de [[2]] días hábiles después de recibir el pago. Recibirás un número de rastreo o una confirmación de entrega.</li>
<li>En envíos internacionales, el cliente paga los impuestos o aranceles de importación de su país.</li>
<li>Envío gratis en compras mayores a [[C$ ___]] [[por confirmar]].</li>
</ul>`,
    },
    en: {
      title: 'Shipping',
      body: `
<div class="table-scroll"><table>
<thead><tr><th>Destination</th><th>Carrier</th><th>Delivery time</th><th>Cost</th></tr></thead>
<tbody>
<tr><td>Managua</td><td>Local courier or our own delivery [[to be confirmed]]</td><td>1 to 2 business days</td><td>[[C$ ___]]</td></tr>
<tr><td>Rest of Nicaragua</td><td>National courier [[to be confirmed]]</td><td>2 to 5 business days</td><td>[[C$ ___]]</td></tr>
<tr><td>Central America and the US</td><td>Postal or courier service [[to be confirmed]]</td><td>7 to 15 business days</td><td>Calculated with your order</td></tr>
</tbody></table></div>
<ul>
<li>Orders ship within [[2]] business days of payment. You’ll get a tracking number or a delivery confirmation.</li>
<li>International customers pay any import duties or taxes in their country.</li>
<li>Free shipping on orders over [[C$ ___]] [[to be confirmed]].</li>
</ul>`,
    },
  },
  returns: {
    es: {
      title: 'Devoluciones y reembolsos',
      body: `
<ul>
<li>Puedes solicitar una devolución dentro de [[7]] días después de la entrega, para productos sin abrir y en su empaque original.</li>
<li><strong>Producto dañado o equivocado:</strong> cubrimos el envío de vuelta y te ofrecemos un reemplazo o el reembolso completo. Envíanos una foto dentro de [[48]] horas después de la entrega.</li>
<li><strong>Cambio de opinión:</strong> el cliente paga el envío de vuelta; reembolso o crédito en la tienda [[por confirmar]].</li>
<li>El café es un alimento, así que no aceptamos devoluciones de bolsas abiertas. Si tienes un problema de calidad, envíanos una foto y te ofrecemos un reemplazo o reembolso [[por confirmar]].</li>
<li>Los reembolsos se hacen al mismo método de pago dentro de [[10]] días hábiles después de recibir la devolución.</li>
</ul>`,
    },
    en: {
      title: 'Returns and refunds',
      body: `
<ul>
<li>You can request a return within [[7]] days of delivery for unopened items in their original packaging.</li>
<li><strong>Damaged or wrong items:</strong> we cover return shipping and offer a replacement or a full refund. Send us a photo within [[48]] hours of delivery.</li>
<li><strong>Change of mind:</strong> you pay return shipping; refund or store credit [[to be confirmed]].</li>
<li>Coffee is food, so opened bags can’t be returned. If you have a quality issue, send us a photo and we’ll offer a replacement or refund [[to be confirmed]].</li>
<li>Refunds go back to the original payment method within [[10]] business days of receiving the return.</li>
</ul>`,
    },
  },
  payments: {
    es: {
      title: 'Pagos',
      body: `
<ul>
<li>Formas de pago aceptadas [[por confirmar]]: transferencia a una cuenta bancaria en Nicaragua, PayPal para pedidos internacionales y efectivo contra entrega en Managua. El pago con tarjeta en línea se agregará más adelante.</li>
<li>Los precios se muestran en córdobas (C$) y dólares (US$). Si pagas con una tarjeta internacional, tu banco puede aplicar una conversión de moneda.</li>
<li>Los pedidos con transferencia bancaria se reservan por [[24]] horas mientras confirmamos el pago.</li>
<li><strong>Nunca te pediremos los datos de tu tarjeta por WhatsApp, mensaje directo o correo.</strong></li>
</ul>`,
    },
    en: {
      title: 'Payments',
      body: `
<ul>
<li>Accepted methods [[to be confirmed]]: bank transfer to a Nicaraguan account, PayPal for international orders, and cash on delivery in Managua. Online card payments will be added later.</li>
<li>Prices are shown in córdobas (C$) and US dollars (US$). International cards may see a currency conversion by their bank.</li>
<li>Bank transfer orders are held for [[24]] hours while we confirm payment.</li>
<li><strong>We will never ask for your card details by WhatsApp, DM or email.</strong></li>
</ul>`,
    },
  },
  privacy: {
    es: {
      title: 'Privacidad',
      body: `
<ul>
<li>Sólo recopilamos lo necesario para atender tu pedido: nombre, teléfono, correo, dirección de entrega e historial de pedidos.</li>
<li>Los pagos con tarjeta los procesa el proveedor de pagos; RAJUANSE nunca guarda números de tarjeta completos.</li>
<li>Usamos tus datos para procesar pedidos, darte atención y, sólo con tu permiso, enviarte promociones. Puedes darte de baja cuando quieras.</li>
<li>No vendemos datos personales. Sólo los compartimos con empresas de mensajería y de pagos para completar tu pedido.</li>
<li>Tu carrito se guarda únicamente en tu navegador hasta que nos envías el pedido.</li>
<li>Si creas una cuenta, tu correo o número de teléfono se guarda en Firebase Authentication (Google) sólo para que puedas iniciar sesión. Para entrar con teléfono te enviamos un código por SMS. Puedes pedirnos que borremos tu cuenta en cualquier momento.</li>
<li>Puedes pedir ver, corregir o eliminar tus datos escribiendo a ${contact.email} [[por confirmar]].</li>
</ul>`,
    },
    en: {
      title: 'Privacy',
      body: `
<ul>
<li>We collect only what we need to fulfil your order: name, phone, email, delivery address and order history.</li>
<li>Card payments are processed by the payment provider; RAJUANSE never stores full card numbers.</li>
<li>We use your data to process orders, provide support and, only with your consent, send promotions. You can unsubscribe at any time.</li>
<li>We don’t sell personal data. We share it only with couriers and payment providers to complete your order.</li>
<li>Your cart is stored only in your browser until you send us the order.</li>
<li>If you create an account, your email or phone number is stored in Firebase Authentication (Google) only so you can sign in. To sign in by phone we text you a code. You can ask us to delete your account at any time.</li>
<li>You can ask to see, correct or delete your data by writing to ${contact.email} [[to be confirmed]].</li>
</ul>`,
    },
  },
  terms: {
    es: {
      title: 'Términos del servicio',
      body: `
<ul>
<li><strong>Quiénes somos:</strong> ${contact.legalName} [[razón social y RUC por confirmar]], con sede en [[ciudad]], Nicaragua.</li>
<li>Los pedidos se confirman al recibir el pago. Podemos cancelar un pedido si un producto está agotado o tiene un precio equivocado, con reembolso completo.</li>
<li>Los colores de los productos pueden variar un poco entre la pantalla y la realidad.</li>
<li>Todas las fotos, textos y diseños pertenecen a RAJUANSE y no pueden usarse sin permiso.</li>
<li>Estos términos se rigen por las leyes de Nicaragua. Contacto: ${contact.email} y WhatsApp [[por confirmar]].</li>
</ul>`,
    },
    en: {
      title: 'Terms of service',
      body: `
<ul>
<li><strong>Who we are:</strong> ${contact.legalName} [[legal name and RUC to be confirmed]], based in [[city]], Nicaragua.</li>
<li>Orders are confirmed once payment is received. We may cancel an order if an item is out of stock or mispriced, with a full refund.</li>
<li>Product colors may vary slightly between your screen and real life.</li>
<li>All photos, text and designs belong to RAJUANSE and can’t be reused without permission.</li>
<li>These terms follow the laws of Nicaragua. Contact: ${contact.email} and WhatsApp [[to be confirmed]].</li>
</ul>`,
    },
  },
};

export function renderPolicy(html: string) {
  return html.replace(/\[\[(.+?)\]\]/g, '<span class="tbc">$1</span>');
}
