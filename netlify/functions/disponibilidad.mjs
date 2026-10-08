import { json, stripeGet } from './_shared.mjs';

export default async (req) => {
  try {
    const url = new URL(req.url);
    const desde = url.searchParams.get('desde') || '';
    const hasta = url.searchParams.get('hasta') || '';
    if (!process.env.STRIPE_SECRET_KEY) return json([]);
    const r = await stripeGet(`payment_intents/search?query=${encodeURIComponent("status:'succeeded'")}&limit=100`);
    const rows = {};
    for (const pi of r.data || []) {
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
