// Panel de administración: calendario, turnos y horarios base.
import { h, api, ymd, pad, parse, DOW, DOW_LONG, MONTHS, longDate, waLink, toast } from './common.js';

const app = document.getElementById('app');
const cfg = await api('/api/config');
document.title = 'Panel · ' + cfg.name;

const today = ymd(new Date());
const st = { tab: 'calendar', month: today.slice(0, 7), sel: today, monthData: {}, day: null, filter: 'pending', list: [], template: null };
const STATUS = { pending: 'Pendiente', confirmed: 'Confirmado', cancelled: 'Cancelado' };

const logout = () => { try { localStorage.removeItem('token'); } catch {} showLogin(); };
const guard = async (fn) => {
  try { return await fn(); } catch (e) { if (e.status === 401) logout(); else toast(e.message); }
};

// ---------- login ----------
function showLogin(msg) {
  const pw = h('input', { type: 'password', id: 'pw', placeholder: 'Contraseña', autocomplete: 'current-password', required: true });
  const err = h('p', { class: 'err', role: 'alert' }, msg || '');
  app.replaceChildren(
    h('main', { class: 'login' },
      h('form', { class: 'login-card', onsubmit: async (e) => {
        e.preventDefault();
        try {
          const { token } = await api('/api/login', { method: 'POST', body: { password: pw.value } });
          try { localStorage.setItem('token', token); } catch {}
          boot();
        } catch (ex) { err.textContent = ex.message; pw.select(); }
      } },
        h('p', { class: 'eyebrow' }, 'Panel de administración'),
        h('h1', {}, cfg.name),
        h('label', { for: 'pw' }, 'Contraseña'), pw, err,
        h('button', { class: 'btn primary', type: 'submit' }, 'Ingresar'),
        h('a', { class: 'back', href: '/' }, '← Volver a la web')
      )
    )
  );
  pw.focus();
}

// ---------- datos ----------
const loadMonth = () => guard(async () => { st.monthData = (await api('/api/admin/month?month=' + st.month)).days; });
const loadDay = () => guard(async () => { st.day = await api('/api/admin/day?date=' + st.sel); });
const loadList = () => guard(async () => { st.list = (await api('/api/admin/bookings?status=' + st.filter)).bookings; });
const loadTemplate = () => guard(async () => { st.template = (await api('/api/admin/template')).template; });

async function setBooking(b, status) {
  await guard(async () => {
    await api('/api/admin/bookings/' + b.id, { method: 'PATCH', body: { status } });
    toast(status === 'confirmed' ? 'Turno confirmado' : 'Turno cancelado');
    await Promise.all([loadMonth(), loadDay(), loadList()]);
    render();
  });
  if (status === 'confirmed' && confirm('¿Avisarle al cliente por WhatsApp?')) {
    window.open(waLink(b.phone, `Hola ${b.name}! Tu turno de ${b.service} del ${longDate(b.date)} a las ${b.time} hs está confirmado ✅`), '_blank', 'noopener');
  }
}

async function saveDay(times) {
  await guard(async () => {
    await api('/api/admin/day', { method: 'PUT', body: { date: st.sel, times } });
    await Promise.all([loadMonth(), loadDay()]);
    render();
  });
}

// ---------- componentes ----------
const bookingCard = (b, showDate) =>
  h('article', { class: 'bcard ' + b.status },
    h('div', { class: 'bcard-main' },
      h('strong', {}, `${showDate ? longDate(b.date) + ' · ' : ''}${b.time} hs`),
      h('span', { class: 'badge ' + b.status }, STATUS[b.status]),
      h('p', {}, `${b.name} · ${b.service}`),
      h('a', { class: 'tel', href: 'tel:' + b.phone }, b.phone)
    ),
    h('div', { class: 'bcard-actions' },
      b.status !== 'confirmed' && b.status !== 'cancelled' ? h('button', { class: 'btn primary sm', onclick: () => setBooking(b, 'confirmed') }, 'Confirmar') : null,
      h('a', { class: 'btn sm', target: '_blank', rel: 'noopener', href: waLink(b.phone, `Hola ${b.name}! Te escribo por tu turno del ${longDate(b.date)} a las ${b.time} hs.`) }, 'WhatsApp'),
      b.status !== 'cancelled' ? h('button', { class: 'btn danger sm', onclick: () => confirm('¿Cancelar este turno? El horario queda libre.') && setBooking(b, 'cancelled') }, 'Cancelar') : null,
      b.status === 'cancelled' ? h('button', { class: 'btn sm', onclick: () => setBooking(b, 'pending') }, 'Reactivar') : null
    )
  );

function calendarView() {
  const [y, m] = st.month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const total = new Date(y, m, 0).getDate();
  const shiftMonth = async (n) => {
    const d = new Date(y, m - 1 + n, 1);
    st.month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    await loadMonth();
    render();
  };
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(h('span', { class: 'cal-blank' }));
  for (let d = 1; d <= total; d++) {
    const key = `${st.month}-${pad(d)}`;
    const info = st.monthData[key] || { open: 0, booked: 0, pending: 0 };
    const cls = ['cal-day', info.open > 0 ? 'has-open' : '', info.booked > 0 ? 'has-booked' : '', info.open === 0 && info.booked > 0 ? 'full' : '',
      key === today ? 'today' : '', key === st.sel ? 'sel' : '', key < today ? 'past' : ''].join(' ');
    cells.push(
      h('button', { type: 'button', class: cls, 'aria-pressed': String(key === st.sel), 'aria-label': `${longDate(key)}: ${info.open} libres, ${info.booked} ocupados`,
        onclick: async () => { st.sel = key; await loadDay(); render(); } },
        h('b', {}, String(d)),
        h('span', { class: 'cal-badges' },
          info.open ? h('i', { class: 'dot free', title: 'Libres' }, String(info.open)) : null,
          info.booked ? h('i', { class: 'dot busy' + (info.pending ? ' pend' : ''), title: 'Ocupados' }, String(info.booked)) : null)
      )
    );
  }

  const day = st.day;
  const times = new Set(day?.open || []);
  const byTime = new Map((day?.bookings || []).filter((b) => b.status !== 'cancelled').map((b) => [b.time, b]));
  const grid = cfg.allTimes.map((t) => {
    const b = byTime.get(t);
    if (b) return h('button', { type: 'button', class: 'slot busy ' + b.status, title: `${b.name} · ${b.service}` }, h('span', {}, t), h('small', {}, b.name.split(' ')[0]));
    const on = times.has(t);
    return h('button', { type: 'button', class: 'slot ' + (on ? 'on' : 'off'), 'aria-pressed': String(on),
      onclick: () => saveDay(on ? [...times].filter((x) => x !== t) : [...times, t]) }, h('span', {}, t), h('small', {}, on ? 'Libre' : 'Cerrado'));
  });

  return h('div', { class: 'cal-layout' },
    h('section', { class: 'panel' },
      h('div', { class: 'cal-head' },
        h('button', { class: 'btn icon', 'aria-label': 'Mes anterior', onclick: () => shiftMonth(-1) }, '‹'),
        h('h2', {}, `${MONTHS[m - 1]} ${y}`),
        h('button', { class: 'btn icon', 'aria-label': 'Mes siguiente', onclick: () => shiftMonth(1) }, '›')),
      h('div', { class: 'cal-grid' }, ...['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => h('span', { class: 'cal-dow' }, d)), ...cells),
      h('p', { class: 'legend' }, h('i', { class: 'dot free' }, ''), ' Libres  ', h('i', { class: 'dot busy' }, ''), ' Ocupados  ', h('i', { class: 'dot busy pend' }, ''), ' Con pendientes')
    ),
    h('section', { class: 'panel' },
      h('h2', { class: 'cap' }, longDate(st.sel)),
      h('p', { class: 'hint' }, 'Tocá un horario para habilitarlo (se ve en la web) o cerrarlo. Los ocupados no se pueden cerrar.'),
      h('div', { class: 'slot-grid' }, ...grid),
      h('div', { class: 'row' },
        h('button', { class: 'btn sm', onclick: () => saveDay(cfg.allTimes) }, 'Abrir todo el día'),
        h('button', { class: 'btn sm', onclick: () => saveDay([]) }, 'Cerrar el día'),
        h('button', { class: 'btn sm', onclick: () => guard(async () => { await api('/api/admin/day?date=' + st.sel, { method: 'DELETE' }); await Promise.all([loadMonth(), loadDay()]); render(); toast('Se usa el horario base'); }) }, 'Usar horario base')),
      h('h3', {}, 'Turnos del día'),
      day?.bookings.length ? h('div', { class: 'blist' }, ...day.bookings.map((b) => bookingCard(b, false))) : h('p', { class: 'hint' }, 'Sin turnos este día.')
    )
  );
}

function listView() {
  const filters = [['pending', 'Pendientes'], ['confirmed', 'Confirmados'], ['all', 'Todos']];
  return h('section', { class: 'panel' },
    h('div', { class: 'seg', role: 'tablist' },
      ...filters.map(([k, label]) => h('button', { class: 'seg-b' + (st.filter === k ? ' on' : ''), role: 'tab', 'aria-selected': String(st.filter === k),
        onclick: async () => { st.filter = k; await loadList(); render(); } }, label))),
    st.list.length ? h('div', { class: 'blist' }, ...st.list.map((b) => bookingCard(b, true))) : h('p', { class: 'hint' }, 'No hay turnos en esta vista.')
  );
}

function templateView() {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const t = st.template;
  return h('section', { class: 'panel' },
    h('p', { class: 'hint' }, 'Horario semanal por defecto. Cada día de la web usa este horario salvo que lo cambies en el calendario.'),
    ...order.map((d) =>
      h('div', { class: 'tpl-row' },
        h('h3', {}, DOW_LONG[d]),
        h('div', { class: 'slot-grid compact' },
          ...cfg.allTimes.map((x) => {
            const on = t[d].includes(x);
            return h('button', { type: 'button', class: 'slot ' + (on ? 'on' : 'off'), 'aria-pressed': String(on),
              onclick: (e) => {
                const now = t[d].includes(x);
                t[d] = now ? t[d].filter((y) => y !== x) : [...t[d], x].sort();
                e.currentTarget.classList.toggle('on', !now);
                e.currentTarget.classList.toggle('off', now);
                e.currentTarget.setAttribute('aria-pressed', String(!now));
              } }, x);
          })))
    ),
    h('button', { class: 'btn primary', onclick: () => guard(async () => { await api('/api/admin/template', { method: 'PUT', body: { template: t } }); toast('Horario base guardado'); await Promise.all([loadMonth(), loadDay()]); }) }, 'Guardar horario base')
  );
}

// ---------- layout ----------
function render() {
  const tabs = [['calendar', 'Calendario'], ['list', 'Turnos'], ['template', 'Horario base']];
  const scroll = window.scrollY;
  const view = st.tab === 'calendar' ? calendarView() : st.tab === 'list' ? listView() : templateView();
  app.replaceChildren(
    h('header', { class: 'top' },
      h('div', {}, h('p', { class: 'eyebrow' }, 'Panel'), h('h1', {}, cfg.name)),
      h('div', { class: 'row' }, h('a', { class: 'btn sm', href: '/', target: '_blank' }, 'Ver web'), h('button', { class: 'btn sm', onclick: logout }, 'Salir'))),
    h('nav', { class: 'tabs', role: 'tablist' },
      ...tabs.map(([k, label]) => h('button', { class: 'tab' + (st.tab === k ? ' on' : ''), role: 'tab', 'aria-selected': String(st.tab === k),
        onclick: async () => {
          st.tab = k;
          if (k === 'list') await loadList();
          if (k === 'template' && !st.template) await loadTemplate();
          render();
        } }, label))),
    h('main', { class: 'view' }, view)
  );
  window.scrollTo(0, scroll);
}

async function boot() {
  try {
    await api('/api/admin/template');
  } catch { return showLogin(); }
  await Promise.all([loadMonth(), loadDay(), loadList(), loadTemplate()]);
  render();
}

boot();
