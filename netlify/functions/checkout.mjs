import { json, isValidWorkshopDate, stripePost, plazasReservadas, PRICE_CENTS, CAPACITY, WORKSHOP_HOURS } from './_shared.mjs';

export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'METODO_NO_PERMITIDO' }, 405);
    const body = await req.json().catch(() => ({}));
    const { fecha, personas, nombre, email } = body;
    if (!isValidWorkshopDate(String(fecha || ''))) return json({ error: 'FECHA_INVALIDA' }, 400);
    if (!Number.isInteger(personas) || personas < 1 || personas > CAPACITY) return json({ error: 'PERSONAS_INVALIDAS' }, 400);
    if (!nombre || String(nombre).trim().length < 2) return json({ error: 'NOMBRE_INVALIDO' }, 400);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return json({ error: 'EMAIL_INVALIDO' }, 400);
    if (!process.env.STRIPE_SECRET_KEY) return json({ error: 'STRIPE_NO_CONFIGURADO' }, 503);

    const reservadas = await plazasReservadas(fecha);
    if (reservadas + personas > CAPACITY) return json({ error: 'SIN_PLAZAS' }, 409);

    const origin = new URL(req.url).origin;
    const session = await stripePost('checkout/sessions', {
      mode: 'payment',
      success_url: `${origin}/exito.html?sesion={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancelo.html`,
      customer_email: email,
      line_items: [{
        quantity: personas,
        price_data: {
          currency: 'eur',
          unit_amount: PRICE_CENTS,
          product_data: { name: `Taller SIMO · ${fecha} · ${WORKSHOP_HOURS} · Hileras 18` }
        }
      }],
      metadata: { fecha, personas: String(personas), nombre: String(nombre).trim() },
      payment_intent_data: { metadata: { fecha, personas: String(personas), nombre: String(nombre).trim() } }
    });
    return json({ url: session.url });
  } catch (e) {
    console.error('checkout:', e.message);
    return json({ error: 'ERROR_INTERNO' }, 500);
  }
};
export const config = { path: '/api/checkout' };
