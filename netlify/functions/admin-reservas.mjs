import { stripeGet, json, ADMIN_PASSWORD } from './_shared.mjs';

export default async (req) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return json({ error: 'Stripe no configurado' }, 503);
    // Validar contraseña en el header 'x-admin-pass'
    const pass = req.headers.get('x-admin-pass') || '';
    if (pass !== (process.env.ADMIN_PASSWORD || 'SIMO2026')) return json({ error: 'NO_AUTORIZADO' }, 401);

    const r = await stripeGet(`payment_intents/search?query=${encodeURIComponent("status:'succeeded'")}&limit=100`);
    const data = (r.data || []).filter(pi => !!pi.metadata?.fecha).map(pi => {
      const created = new Date(pi.created * 1000);
      return {
        id: pi.id,
        fecha: pi.metadata?.fecha || '?',
        personas: Number(pi.metadata?.personas || 0),
        nombre: pi.metadata?.nombre || '',
        email: pi.customer_email || pi.receipt_email || '',
        importe: pi.amount / 100,
        creado: created.toISOString(),
        cuando: created.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
      };
    });
    data.sort((a, b) => (a.fecha + a.creado).localeCompare(b.fecha + b.creado));
    return json({
      total: data.length,
      plazas: data.reduce((s, r) => s + r.personas, 0),
      ingresos: data.reduce((s, r) => s + r.importe, 0),
      reservas: data
    });
  } catch (e) {
    console.error('admin:', e.message);
    return json({ error: 'ERROR_INTERNO', detalle: e.message }, 500);
  }
};
export const config = { path: '/api/admin/reservas' };
