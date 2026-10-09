// Lógica compartida de las funciones SIMO para Netlify (sin estado local:
// Stripe es la fuente de verdad de reservas, plazas e idempotencia de correo).
import nodemailer from 'nodemailer';

export const PRICE_CENTS = 5499;
export const ADMIN_PASSWORD = 'SIMO2026';
export const CAPACITY = 8;
export const WORKSHOP_DOWS = [5, 6];
export const WORKSHOP_HOURS = '17:00–20:00';
export const MIN_DATE = '2026-10-16';
export const LUGAR = 'Casa de las Alajas · C/ Hileras 18, Madrid';

const KEY = () => process.env.STRIPE_SECRET_KEY || '';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export function isValidWorkshopDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return dt >= today && s >= MIN_DATE && WORKSHOP_DOWS.includes(dt.getDay());
}

export async function stripePost(endpoint, params) {
  const body = new URLSearchParams();
  const add = (k, v) => {
    if (v == null) return;
    if (typeof v === 'object') { for (const [k2, v2] of Object.entries(v)) add(`${k}[${k2}]`, v2); return; }
    body.append(k, String(v));
  };
  Object.entries(params).forEach(([k, v]) => add(k, v));
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Stripe HTTP ${res.status}`);
  return data;
}

export async function stripeGet(endpoint) {
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    headers: { Authorization: `Bearer ${KEY()}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Stripe HTTP ${res.status}`);
  return data;
}

/* Plazas reservadas de una fecha = suma de PaymentIntents pagados con esa fecha */
export async function plazasReservadas(fecha) {
  const q = `metadata['fecha']:'${fecha}' AND status:'succeeded'`;
  try {
    const r = await stripeGet(`payment_intents/search?query=${encodeURIComponent(q)}&limit=100`);
    return (r.data || []).reduce((s, pi) => s + Number(pi.metadata?.personas || 0), 0);
  } catch (e) {
    console.error('Búsqueda de plazas falló:', e.message);
    return 0;
  }
}

/* Correo de confirmación (solo se envía una vez: marca el PI con emailed=1) */
const MAIL_USER = process.env.GMAIL_USER || '';
const MAIL_PASS = process.env.GMAIL_APP_PASSWORD || '';
const mailer = MAIL_USER && MAIL_PASS
  ? nodemailer.createTransport({ service: 'gmail', auth: { user: MAIL_USER, pass: MAIL_PASS } })
  : null;

export async function enviarConfirmacion({ session, piId }) {
  if (!mailer) { console.log('Email omitido: falta GMAIL_APP_PASSWORD'); return false; }
  if (piId) {
    try {
      const pi = await stripeGet(`payment_intents/${piId}`);
      if (pi.metadata?.emailed === '1') return false; // ya enviado
    } catch { /* seguimos */ }
  }
  const fecha = session.metadata?.fecha;
  const personas = Number(session.metadata?.personas || 0);
  const nombre = session.metadata?.nombre || '';
  const email = session.customer_email || session.customer_details?.email || '';
  if (!fecha || !email) return false;
  const d = new Date(fecha + 'T12:00:00');
  const fechaLarga = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  const total = ((personas * PRICE_CENTS) / 100).toFixed(2).replace('.', ',');
  await mailer.sendMail({
    from: `"SIMO" <${MAIL_USER}>`,
    to: email,
    subject: 'Tu plaza en el taller SIMO esta confirmada',
    text: `Hola ${nombre}:\n\nTu plaza esta confirmada.\n\nFecha: ${fechaLarga}\nHorario: ${WORKSHOP_HOURS}\nLugar: ${LUGAR}\nPlazas: ${personas}\nTotal pagado: ${total} EUR\n\nTodo incluido: materiales, maquinas, guias, patrones, vino ilimitado y picoteo.\n\nNos vemos en el taller.\nSIMO · Madrid`,
    html: `<div style="font-family:Georgia,serif;color:#101012;max-width:520px;margin:auto;padding:32px"><h1 style="font-size:26px;letter-spacing:.04em">SIMO</h1><p>Hola ${nombre}:</p><p><strong>Tu plaza esta confirmada.</strong></p><table style="font-size:15px;line-height:1.7"><tr><td>Fecha</td><td>&nbsp;&nbsp;<strong>${fechaLarga}</strong></td></tr><tr><td>Horario</td><td>&nbsp;&nbsp;${WORKSHOP_HOURS}</td></tr><tr><td>Lugar</td><td>&nbsp;&nbsp;${LUGAR}</td></tr><tr><td>Plazas</td><td>&nbsp;&nbsp;${personas}</td></tr><tr><td>Total pagado</td><td>&nbsp;&nbsp;<strong>${total} EUR</strong></td></tr></table><p style="font-size:14px;color:#555">Todo incluido: materiales, maquinas, guias, patrones, vino ilimitado y picoteo.</p><p style="font-size:14px">Nos vemos en el taller.<br><em>SIMO · Madrid</em></p></div>`
  });
  if (piId) {
    try { await stripePost(`payment_intents/${piId}`, { metadata: { emailed: '1' } }); } catch {}
  }
  console.log(`Email enviado a ${email}`);
  return true;
}
