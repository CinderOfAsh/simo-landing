import crypto from 'node:crypto';
import { json, stripeGet, enviarConfirmacion } from './_shared.mjs';

export default async (req) => {
  try {
    const raw = await req.text();
    const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
    const sig = req.headers.get('stripe-signature') || '';
    if (secret) {
      const parts = {};
      for (const p of sig.split(',')) { const i = p.indexOf('='); if (i > 0) parts[p.slice(0, i)] = p.slice(i + 1); }
      const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${raw}`).digest();
      const got = Buffer.from(parts.v1 || '', 'hex');
      if (!parts.t || expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) {
        return json({ error: 'Firma inválida' }, 400);
      }
    } else {
      console.warn('AVISO: webhook sin verificar (falta STRIPE_WEBHOOK_SECRET)');
    }
    let event;
    try { event = JSON.parse(raw); } catch { return json({ error: 'JSON inválido' }, 400); }
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      const piId = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
      await enviarConfirmacion({ session: s, piId }).catch(e => console.error('Email falló:', e.message));
    }
    return json({ received: true });
  } catch (e) {
    console.error('webhook:', e.message);
    return json({ error: 'ERROR_INTERNO' }, 500);
  }
};
export const config = { path: '/api/webhook' };
