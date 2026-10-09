import { json, stripeGet } from './_shared.mjs';

export default async (req) => {
  try {
    const url = new URL(req.url);
    const desde = url.searchParams.get('desde') || '';
    const hasta = url.searchParams.get('hasta') || '';
    if (!process.env.STRIPE_SECRET_KEY) return json([]);
    const r = await stripeGet(`payment_intents/search?query=${encodeURIComponent("status:'succeeded'")}&limit=100`);
    // Deduplicar: una reserva real = un PaymentIntent por sesión de Checkout.
    // (Stripe a veces crea varios PI ligados a la misma checkout_session, ej. al reconfirmar)
    const seen = new Set();
    const rows = {};
    for (const pi of r.data || []) {
      const sessionId = pi.metadata?.session_id || pi.id;
      if (seen.has(sessionId)) continue;
      seen.add(sessionId);
      const f = pi.metadata?.fecha;
      if (!f) continue;
      if (desde && f < desde) continue;
      if (hasta && f > hasta) continue;
      rows[f] = (rows[f] || 0) + Number(pi.metadata?.personas || 0);
    }
    return json(Object.entries(rows).map(([fecha, reservadas]) => ({ fecha, reservadas })));
  } catch (e) {
    console.error('disponibilidad:', e.message);
    return json([], 500);
  }
};
export const config = { path: '/api/disponibilidad' };
