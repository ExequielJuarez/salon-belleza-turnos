// Lógica de la landing: servicios, widget de reserva, WhatsApp y animaciones de entrada.
import { h, api, ymd, DOW, MONTHS, parse, longDate, waLink, toast } from './common.js';

const cfg = await api('/api/config');
const money = (n) => (n ? '$' + Number(n).toLocaleString('es-AR') : '');

// Texto de config en elementos con data-cfg="name|address|hoursText"
document.querySelectorAll('[data-cfg]').forEach((el) => (el.textContent = cfg[el.dataset.cfg] ?? ''));
document.querySelectorAll('[data-wa]').forEach((el) => {
  el.href = waLink(cfg.whatsapp, el.dataset.wa || 'Hola, quiero consultar por un turno');
  el.target = '_blank';
  el.rel = 'noopener';
});

// Servicios
const svcBox = document.getElementById('services');
if (svcBox) {
  cfg.services.forEach((s) =>
    svcBox.append(
      h('article', { class: 'svc reveal' },
        h('div', { class: 'svc-top' }, h('h3', {}, s.name), s.price ? h('span', { class: 'svc-price' }, money(s.price)) : null),
        h('p', {}, s.desc || ''),
        s.minutes ? h('span', { class: 'svc-time' }, `${s.minutes} min`) : null
      )
    )
  );
}

// ---------- widget de reserva ----------
const mount = document.getElementById('booking');
if (mount) {
  const st = { service: cfg.services[0].name, date: null, time: null, days: {} };
  const servicesEl = h('div', { class: 'bk-services', role: 'radiogroup', 'aria-label': 'Servicio' });
  const daysEl = h('div', { class: 'bk-days', role: 'radiogroup', 'aria-label': 'Día' });
  const timesEl = h('div', { class: 'bk-times', role: 'radiogroup', 'aria-label': 'Horario' });
  const nameIn = h('input', { id: 'bk-name', name: 'name', placeholder: 'Tu nombre', autocomplete: 'name', required: true, maxlength: 80 });
  const phoneIn = h('input', { id: 'bk-phone', name: 'phone', placeholder: 'Tu WhatsApp (ej: 11 5555 1234)', type: 'tel', inputmode: 'tel', autocomplete: 'tel', required: true, maxlength: 30 });
  const summary = h('p', { class: 'bk-summary' }, 'Elegí un día y un horario.');
  const submit = h('button', { class: 'bk-submit', type: 'submit', disabled: true }, 'Reservar turno');
  const form = h('form', { class: 'bk-form', novalidate: true }, h('label', { for: 'bk-name' }, 'Nombre'), nameIn, h('label', { for: 'bk-phone' }, 'WhatsApp'), phoneIn, summary, submit);
  const done = h('div', { class: 'bk-done', hidden: true });

  mount.classList.add('bk');
  mount.append(
    h('h3', { class: 'bk-h' }, h('span', {}, '1'), 'Servicio'), servicesEl,
    h('h3', { class: 'bk-h' }, h('span', {}, '2'), 'Día'), daysEl,
    h('h3', { class: 'bk-h' }, h('span', {}, '3'), 'Horario'), timesEl,
    h('h3', { class: 'bk-h' }, h('span', {}, '4'), 'Tus datos'), form, done
  );

  const refreshSummary = () => {
    summary.textContent = st.date && st.time ? `${longDate(st.date)} · ${st.time} hs · ${st.service}` : 'Elegí un día y un horario.';
    submit.disabled = !(st.date && st.time);
  };

  const renderServices = () => {
    servicesEl.replaceChildren(
      ...cfg.services.map((s) =>
        h('button', { type: 'button', role: 'radio', 'aria-checked': String(s.name === st.service), class: 'bk-chip' + (s.name === st.service ? ' on' : ''),
          onclick: () => { st.service = s.name; renderServices(); refreshSummary(); } },
          s.name, s.price ? h('small', {}, money(s.price)) : null)
      )
    );
  };

  const renderDays = () => {
    daysEl.replaceChildren(
      ...Object.entries(st.days).map(([date, n]) => {
        const d = parse(date);
        return h('button', { type: 'button', role: 'radio', 'aria-checked': String(date === st.date), class: 'bk-day' + (date === st.date ? ' on' : ''), disabled: n === 0,
          'aria-label': longDate(date), onclick: () => pickDay(date) },
          h('span', {}, DOW[d.getDay()]), h('strong', {}, String(d.getDate())), h('span', {}, MONTHS[d.getMonth()].slice(0, 3)));
      })
    );
  };

  async function pickDay(date) {
    st.date = date;
    st.time = null;
    renderDays();
    timesEl.replaceChildren(h('p', { class: 'bk-empty' }, 'Cargando…'));
    refreshSummary();
    const { times } = await api('/api/slots?date=' + date);
    if (st.date !== date) return;
    timesEl.replaceChildren(
      ...(times.length
        ? times.map((t) => h('button', { type: 'button', role: 'radio', 'aria-checked': 'false', class: 'bk-time', onclick: (e) => {
            st.time = t;
            timesEl.querySelectorAll('.bk-time').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-checked', 'false'); });
            e.currentTarget.classList.add('on');
            e.currentTarget.setAttribute('aria-checked', 'true');
            refreshSummary();
          } }, t))
        : [h('p', { class: 'bk-empty' }, 'No hay horarios libres ese día.')])
    );
  }

  async function loadDays() {
    st.days = await api('/api/days?days=21');
    renderDays();
    if (!st.date) {
      const first = Object.entries(st.days).find(([, n]) => n > 0);
      if (first) pickDay(first[0]);
      else timesEl.replaceChildren(h('p', { class: 'bk-empty' }, 'Por ahora no hay turnos disponibles. Escribinos por WhatsApp.'));
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!st.date || !st.time) return;
    submit.disabled = true;
    try {
      const { booking } = await api('/api/book', { method: 'POST', body: { name: nameIn.value, phone: phoneIn.value, service: st.service, date: st.date, time: st.time } });
      const msg = `Hola! Soy ${booking.name}. Reservé un turno de ${booking.service} para el ${longDate(booking.date)} a las ${booking.time} hs. ¿Me lo confirman?`;
      form.hidden = true;
      done.hidden = false;
      done.replaceChildren(
        h('h3', {}, '¡Turno reservado!'),
        h('p', {}, `${longDate(booking.date)} · ${booking.time} hs · ${booking.service}`),
        h('p', {}, 'Quedó pendiente de confirmación. Avisanos por WhatsApp para confirmarlo más rápido.'),
        h('a', { class: 'bk-wa', href: waLink(cfg.whatsapp, msg), target: '_blank', rel: 'noopener' }, 'Confirmar por WhatsApp'),
        h('button', { type: 'button', class: 'bk-again', onclick: () => { form.hidden = false; done.hidden = true; st.date = st.time = null; refreshSummary(); loadDays(); } }, 'Reservar otro turno')
      );
    } catch (err) {
      toast(err.message);
      submit.disabled = false;
      loadDays();
      if (st.date) pickDay(st.date);
    }
  });

  renderServices();
  loadDays();
}

// ---------- animaciones de entrada (solo transform/opacity) ----------
const io = new IntersectionObserver(
  (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }),
  { rootMargin: '0px 0px -8% 0px' }
);
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
