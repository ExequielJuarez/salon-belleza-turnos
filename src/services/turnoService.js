// Lógica de horarios disponibles y reservas.
const { Op } = require("sequelize");
const db = require("../model/database/models");
const negocio = require("../config/negocio");

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const diaSemana = (fecha) => new Date(fecha + "T00:00:00").getDay();
const aMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const deMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const pasado = (fecha, hora) => {
  const n = new Date();
  return `${fecha} ${hora}` <= `${ymd(n)} ${pad(n.getHours())}:${pad(n.getMinutes())}`;
};

// Todas las horas posibles según la configuración del negocio.
const { diaInicio, diaFin, paso } = negocio.horario;
const todasLasHoras = [];
for (let m = aMin(diaInicio); m < aMin(diaFin); m += paso) todasLasHoras.push(deMin(m));

const limpiarHoras = (horas) => [...new Set((horas || []).filter((h) => todasLasHoras.includes(h)))].sort();

async function horasBase(fecha) {
  const especial = await db.DiaEspecial.findByPk(fecha);
  if (especial) return limpiarHoras(especial.horas);
  const base = await db.HorarioBase.findByPk(diaSemana(fecha));
  return base ? limpiarHoras(base.horas) : [];
}

async function horasOcupadas(fecha) {
  const turnos = await db.Turno.findAll({ where: { fecha, estado: { [Op.ne]: "cancelled" } }, attributes: ["hora"] });
  return new Set(turnos.map((t) => t.hora));
}

async function horasLibres(fecha) {
  const [base, ocupadas] = await Promise.all([horasBase(fecha), horasOcupadas(fecha)]);
  return base.filter((h) => !ocupadas.has(h) && !pasado(fecha, h));
}

// { "2026-10-22": 18, ... } con la cantidad de horarios libres de los próximos días.
async function diasDisponibles(cantidad) {
  const out = {};
  const d = new Date();
  for (let i = 0; i < cantidad; i++) {
    const f = ymd(d);
    out[f] = (await horasLibres(f)).length;
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// Reserva con transacción para evitar que dos personas tomen el mismo horario.
async function reservar({ nombre, telefono, servicio, fecha, hora }) {
  return db.sequelize.transaction(async (t) => {
    const ocupado = await db.Turno.findOne({ where: { fecha, hora, estado: { [Op.ne]: "cancelled" } }, transaction: t, lock: t.LOCK.UPDATE });
    const base = await horasBase(fecha);
    if (ocupado || !base.includes(hora) || pasado(fecha, hora)) {
      const err = new Error("Ese horario ya no está disponible, elegí otro");
      err.status = 409;
      throw err;
    }
    return db.Turno.create({ nombre, telefono, servicio, fecha, hora }, { transaction: t });
  });
}

async function resumenMes(mes) {
  const [y, m] = mes.split("-").map(Number);
  const dias = new Date(y, m, 0).getDate();
  const desde = `${mes}-01`, hasta = `${mes}-${pad(dias)}`;
  const [turnos, especiales, bases] = await Promise.all([
    db.Turno.findAll({ where: { fecha: { [Op.between]: [desde, hasta] }, estado: { [Op.ne]: "cancelled" } } }),
    db.DiaEspecial.findAll({ where: { fecha: { [Op.between]: [desde, hasta] } } }),
    db.HorarioBase.findAll(),
  ]);
  const baseMap = Object.fromEntries(bases.map((b) => [b.dia_semana, b.horas]));
  const espMap = Object.fromEntries(especiales.map((e) => [e.fecha, e.horas]));
  const out = {};
  for (let d = 1; d <= dias; d++) {
    const f = `${mes}-${pad(d)}`;
    const ts = turnos.filter((t) => t.fecha === f);
    const ocup = new Set(ts.map((t) => t.hora));
    const horas = limpiarHoras(espMap[f] ?? baseMap[diaSemana(f)] ?? []);
    out[f] = { open: horas.filter((h) => !ocup.has(h)).length, booked: ts.length, pending: ts.filter((t) => t.estado === "pending").length };
  }
  return out;
}

module.exports = { todasLasHoras, limpiarHoras, horasBase, horasLibres, diasDisponibles, reservar, resumenMes, ymd };
