// Servidor de turnos: sin dependencias, requiere Node 18+.
// Datos en data/db.json. Configuración en config.json.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || cfg.adminPassword;

// ---------- utilidades de fecha ----------
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00'));
const isTime = (s) => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
const weekday = (date) => new Date(date + 'T00:00:00').getDay();
const isPast = (date, time) => {
  const n = new Date();
  return `${date} ${time}` <= `${ymd(n)} ${pad(n.getHours())}:${pad(n.getMinutes())}`;
};
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const fromMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

// ---------- horarios posibles y plantilla semanal ----------
const step = cfg.schedule.step || 30;
const allTimes = [];
for (let m = toMin(cfg.schedule.dayStart); m < toMin(cfg.schedule.dayEnd); m += step) allTimes.push(fromMin(m));

function defaultTemplate() {
  const t = {};
  for (let d = 0; d < 7; d++) t[d] = [];
  for (const d of cfg.schedule.openDays) {
    t[d] = allTimes.filter((x) => toMin(x) >= toMin(cfg.schedule.from) && toMin(x) < toMin(cfg.schedule.to));
  }
  return t;
}

// ---------- base de datos (archivo JSON) ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
let db = { bookings: [], overrides: {}, template: defaultTemplate() };
try {
  db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
} catch {}
function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const baseTimes = (date) => (db.overrides[date] ?? db.template[weekday(date)] ?? []).filter((t) => allTimes.includes(t));
const active = (b) => b.status !== 'cancelled';
const taken = (date) => new Set(db.bookings.filter((b) => b.date === date && active(b)).map((b) => b.time));
const freeTimes = (date) => {
  const t = taken(date);
  return baseTimes(date).filter((x) => !t.has(x) && !isPast(date, x));
};

// ---------- sesiones de admin ----------
const sessions = new Map();
const attempts = new Map();
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
function login(ip, password) {
  const a = attempts.get(ip) || { n: 0, until: 0 };
  if (a.n >= 10 && Date.now() < a.until) return null;
  const ok = crypto.timingSafeEqual(sha(password ?? ''), sha(ADMIN_PASSWORD));
  if (!ok) {
    attempts.set(ip, { n: a.n + 1, until: Date.now() + 15 * 60 * 1000 });
    return null;
  }
  attempts.delete(ip);
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + 12 * 60 * 60 * 1000);
  return token;
}
const authed = (req) => {
  const t = req.headers['x-token'];
  const exp = sessions.get(t);
  if (!exp || exp < Date.now()) {
    sessions.delete(t);
    return false;
  }
  return true;
};

// ---------- HTTP ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => {
      s += c;
      if (s.length > 100_000) {
        reject(new Error('too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); }
    });
  });
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin') pathname = '/admin.html';
  const file = path.normalize(path.join(PUBLIC, pathname));
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('No encontrado');
  }
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(file).pipe(res);
}

async function api(req, res, url) {
  const p = url.pathname;
  const q = url.searchParams;
  const m = req.method;

  // ----- público -----
  if (m === 'GET' && p === '/api/config') {
    return send(res, 200, { name: cfg.name, whatsapp: cfg.whatsapp, services: cfg.services, allTimes, address: cfg.address, hoursText: cfg.hoursText });
  }
  if (m === 'GET' && p === '/api/days') {
    const n = Math.min(Number(q.get('days')) || 21, 60);
    const out = {};
    const d = new Date();
    for (let i = 0; i < n; i++) {
      const key = ymd(d);
      out[key] = freeTimes(key).length;
      d.setDate(d.getDate() + 1);
    }
    return send(res, 200, out);
  }
  if (m === 'GET' && p === '/api/slots') {
    const date = q.get('date');
    if (!isDate(date)) return send(res, 400, { error: 'Fecha inválida' });
    return send(res, 200, { date, times: freeTimes(date) });
  }
  if (m === 'POST' && p === '/api/book') {
    const b = await readBody(req);
    const name = clean(b.name, 80), phone = clean(b.phone, 30), service = clean(b.service, 80);
    if (!name || phone.replace(/\D/g, '').length < 8) return send(res, 400, { error: 'Completá nombre y un teléfono válido' });
    if (!cfg.services.some((s) => s.name === service)) return send(res, 400, { error: 'Servicio inválido' });
    if (!isDate(b.date) || !isTime(b.time)) return send(res, 400, { error: 'Fecha u hora inválida' });
    if (!freeTimes(b.date).includes(b.time)) return send(res, 409, { error: 'Ese horario ya no está disponible, elegí otro' });
    const booking = { id: crypto.randomUUID(), name, phone, service, date: b.date, time: b.time, status: 'pending', createdAt: new Date().toISOString() };
    db.bookings.push(booking);
    save();
    return send(res, 201, { booking: { id: booking.id, date: booking.date, time: booking.time, service, name } });
  }
  if (m === 'POST' && p === '/api/login') {
    const b = await readBody(req);
    const token = login(req.socket.remoteAddress, b.password);
    return token ? send(res, 200, { token }) : send(res, 401, { error: 'Contraseña incorrecta' });
  }

  // ----- admin -----
  if (!authed(req)) return send(res, 401, { error: 'No autorizado' });

  if (m === 'GET' && p === '/api/admin/month') {
    const month = q.get('month');
    if (!/^\d{4}-\d{2}$/.test(month || '')) return send(res, 400, { error: 'Mes inválido' });
    const [y, mo] = month.split('-').map(Number);
    const days = {};
    for (let d = 1; d <= new Date(y, mo, 0).getDate(); d++) {
      const key = `${month}-${pad(d)}`;
      const bs = db.bookings.filter((b) => b.date === key && active(b));
      const tk = taken(key);
      days[key] = {
        open: baseTimes(key).filter((t) => !tk.has(t)).length,
        booked: bs.length,
        pending: bs.filter((b) => b.status === 'pending').length,
      };
    }
    return send(res, 200, { days });
  }
  if (m === 'GET' && p === '/api/admin/day') {
    const date = q.get('date');
    if (!isDate(date)) return send(res, 400, { error: 'Fecha inválida' });
    const bookings = db.bookings.filter((b) => b.date === date).sort((a, b) => a.time.localeCompare(b.time));
    return send(res, 200, { date, open: baseTimes(date), bookings });
  }
  if (m === 'PUT' && p === '/api/admin/day') {
    const b = await readBody(req);
    if (!isDate(b.date) || !Array.isArray(b.times)) return send(res, 400, { error: 'Datos inválidos' });
    db.overrides[b.date] = [...new Set(b.times.filter((t) => allTimes.includes(t)))].sort();
    save();
    return send(res, 200, { ok: true });
  }
  if (m === 'DELETE' && p === '/api/admin/day') {
    delete db.overrides[q.get('date')];
    save();
    return send(res, 200, { ok: true });
  }
  if (m === 'GET' && p === '/api/admin/bookings') {
    const status = q.get('status');
    const today = ymd(new Date());
    let list = db.bookings.filter((b) => b.date >= today);
    if (status && status !== 'all') list = list.filter((b) => b.status === status);
    list.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    return send(res, 200, { bookings: list });
  }
  const pm = p.match(/^\/api\/admin\/bookings\/([\w-]+)$/);
  if (m === 'PATCH' && pm) {
    const b = await readBody(req);
    const bk = db.bookings.find((x) => x.id === pm[1]);
    if (!bk) return send(res, 404, { error: 'No existe' });
    if (!['pending', 'confirmed', 'cancelled'].includes(b.status)) return send(res, 400, { error: 'Estado inválido' });
    bk.status = b.status;
    save();
    return send(res, 200, { booking: bk });
  }
  if (m === 'GET' && p === '/api/admin/template') return send(res, 200, { template: db.template });
  if (m === 'PUT' && p === '/api/admin/template') {
    const b = await readBody(req);
    const t = {};
    for (let d = 0; d < 7; d++) t[d] = [...new Set((b.template?.[d] || []).filter((x) => allTimes.includes(x)))].sort();
    db.template = t;
    save();
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: 'No encontrado' });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      serveStatic(req, res, decodeURIComponent(url.pathname));
    } catch (e) {
      send(res, 400, { error: 'Solicitud inválida' });
    }
  })
  .listen(PORT, () => {
    console.log(`${cfg.name} -> http://localhost:${PORT}  (admin: /admin)`);
    if (ADMIN_PASSWORD === cfg.adminPassword) console.log('Aviso: usás la contraseña por defecto. Definí ADMIN_PASSWORD.');
  });
