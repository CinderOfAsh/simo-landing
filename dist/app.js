'use strict';

/* ---- Config ---- */
const PRICE_CENTS = 5499;          // 54,99 € por persona
const CAPACITY = 8;                // plazas por fecha
const WORKSHOP_DOWS = [5, 6];      // viernes(5) y sábados(6)
const MIN_DATE = '2026-10-23';     // los talleres empiezan el 23 de octubre
const WORKSHOP_HOURS = '17:00–20:00';
const CONTACTO = {
  instagram: 'https://www.instagram.com/simo.bysimone/',
  tiktok: 'https://www.tiktok.com/@simone.eppi',
  email: ''                          // pendiente de confirmar
};

const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const fmtLong = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

document.getElementById('year').textContent = String(new Date().getFullYear());

/* ---- Contactos del footer ---- */
if (CONTACTO.instagram) document.getElementById('link-instagram').href = CONTACTO.instagram;
if (CONTACTO.tiktok) document.getElementById('link-tiktok').href = CONTACTO.tiktok;
if (CONTACTO.email) { const a = document.getElementById('link-email'); a.href = 'mailto:' + CONTACTO.email; a.textContent = CONTACTO.email; }

/* ---- Galería: oculta fotos opcionales si el archivo aún no existe ---- */
document.querySelectorAll('#gallery-grid img').forEach(img => {
  img.addEventListener('error', () => {
    const fig = img.closest('figure');
    if (fig) fig.hidden = true;
  });
});

/* ---- Fechas ---- */
function isWorkshopDate(y, m, d) {
  return WORKSHOP_DOWS.includes(new Date(y, m, d).getDay());
}
function iso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const today = new Date(); today.setHours(0, 0, 0, 0);
const nowY = today.getFullYear(), nowM = today.getMonth();
let monthOffset = 0;
let selectedDate = null;
let availability = {}; // 'YYYY-MM-DD' -> plazas ya reservadas

const calendarDays = document.getElementById('calendar-days');
const monthLabel = document.getElementById('month-label');
const dateSelection = document.getElementById('date-selection');
const sessionInput = document.getElementById('session-date');
const spotsNote = document.getElementById('spots-note');
const monthNames = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });

async function fetchAvailability(from, to) {
  try {
    const res = await fetch(`/api/disponibilidad?desde=${from}&hasta=${to}`);
    if (!res.ok) return;
    const rows = await res.json();
    rows.forEach(r => { availability[r.fecha] = r.reservadas; });
    if (selectedDate) selectDate(selectedDate, true);
    renderCalendar();
  } catch { /* sin backend: todo disponible */ }
}

function renderCalendar() {
  const base = new Date(nowY, nowM + monthOffset, 1);
  const y = base.getFullYear(), m = base.getMonth();
  monthLabel.textContent = monthNames.format(base);
  calendarDays.replaceChildren();

  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  for (let i = 0; i < firstDow; i++) {
    const pad = document.createElement('span');
    pad.className = 'cal-empty';
    pad.setAttribute('aria-hidden', 'true');
    calendarDays.append(pad);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const key = iso(y, m, d);
    const past = new Date(y, m, d) < today || key < MIN_DATE;
    const workshop = isWorkshopDate(y, m, d) && !past;
    const booked = availability[key] || 0;
    const full = booked >= CAPACITY;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = String(d);
    btn.dataset.date = key;
    if (workshop && !full) {
      btn.className = 'available';
      btn.setAttribute('aria-label', `${fmtLong.format(new Date(y, m, d))}, ${WORKSHOP_HOURS}, ${CAPACITY - booked} plazas libres`);
      if (selectedDate === key) btn.classList.add('selected');
      btn.addEventListener('click', () => selectDate(key));
    } else {
      btn.disabled = true;
      btn.className = workshop ? 'full' : 'empty';
      if (workshop) btn.setAttribute('aria-label', `${fmtLong.format(new Date(y, m, d))}, completo`);
    }
    calendarDays.append(btn);
  }

  document.getElementById('prev-month').disabled = monthOffset === 0;
  document.getElementById('next-month').disabled = monthOffset === 3;
}

function selectDate(key, keepPeople = false) {
  selectedDate = key;
  sessionInput.value = key;
  const [y, m, d] = key.split('-').map(Number);
  const free = CAPACITY - (availability[key] || 0);
  dateSelection.textContent = `${fmtLong.format(new Date(y, m - 1, d))} · ${WORKSHOP_HOURS} · Lugar: Casa de las Alajas, Hileras 18 · quedan ${free} ${free === 1 ? 'plaza' : 'plazas'}`;
  if (!keepPeople) {
    const people = document.getElementById('people');
    const max = Math.max(1, Math.min(CAPACITY, free));
    if (Number(people.value) > max) people.value = String(max);
  }
  spotsNote.hidden = false;
  spotsNote.textContent = `Máximo ${free} ${free === 1 ? 'plaza' : 'plazas'} disponibles en esta fecha.`;
  renderCalendar();
}

document.getElementById('prev-month').addEventListener('click', () => { if (monthOffset > 0) { monthOffset--; renderCalendar(); } });
document.getElementById('next-month').addEventListener('click', () => { if (monthOffset < 3) { monthOffset++; renderCalendar(); } });

/* ---- Personas + total ---- */
const people = document.getElementById('people');
const totalEl = document.getElementById('total');
const payTotal = document.getElementById('pay-total');

function updateTotal() {
  const total = money.format(Number(people.value) * PRICE_CENTS / 100);
  totalEl.textContent = total;
  payTotal.textContent = total;
}
document.getElementById('people-minus').addEventListener('click', () => {
  people.value = String(Math.max(1, Number(people.value) - 1));
  updateTotal();
});
document.getElementById('people-plus').addEventListener('click', () => {
  const free = selectedDate ? Math.max(1, Math.min(CAPACITY, CAPACITY - (availability[selectedDate] || 0))) : CAPACITY;
  people.value = String(Math.min(free, Number(people.value) + 1));
  updateTotal();
});
people.addEventListener('change', updateTotal);
updateTotal();

/* ---- Toast ---- */
const toast = document.getElementById('toast');
let toastTimer = null;
function showToast(msg, ms = 6000) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, ms);
}

/* ---- Submit → Stripe Checkout ---- */
const payButton = document.getElementById('pay-button');
document.getElementById('booking-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!selectedDate) { showToast('Elige una sesión primero.'); return; }
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const nPeople = Number(people.value);
  payButton.disabled = true;
  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha: selectedDate, personas: nPeople, nombre: name, email })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se ha podido iniciar el pago.');
    window.location.href = data.url;
  } catch (err) {
    if (err.message === 'STRIPE_NO_CONFIGURADO') {
      showToast('El pago todavía no está activado: falta configurar la cuenta de Stripe.');
    } else if (err.message === 'SIN_PLAZAS') {
      showToast('Esa fecha ya no tiene plazas suficientes. Elige otra.');
      renderCalendar();
    } else {
      showToast(err.message);
    }
    payButton.disabled = false;
  }
});

/* ---- Init ---- */
renderCalendar();
const monthEnd = new Date(nowY, nowM + 4, 0);
fetchAvailability(iso(nowY, nowM, 1), iso(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate()));
