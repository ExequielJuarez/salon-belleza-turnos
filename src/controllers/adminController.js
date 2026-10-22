// Panel de administración: calendario, horarios y turnos.
const { Op } = require("sequelize");
const db = require("../model/database/models");
const negocio = require("../config/negocio");
const turnoService = require("../services/turnoService");

const aJson = (t) => ({ id: t.id, name: t.nombre, phone: t.telefono, service: t.servicio, date: t.fecha, time: t.hora, status: t.estado });

module.exports = {
  panel(req, res) {
    res.render("admin", { negocio });
  },

  async mes(req, res) {
    res.json({ days: await turnoService.resumenMes(req.query.month) });
  },

  async dia(req, res) {
    const fecha = req.query.date;
    const [open, turnos] = await Promise.all([
      turnoService.horasBase(fecha),
      db.Turno.findAll({ where: { fecha }, order: [["hora", "ASC"]] }),
    ]);
    res.json({ date: fecha, open, bookings: turnos.map(aJson) });
  },

  async guardarDia(req, res) {
    const horas = turnoService.limpiarHoras(req.body.times);
    await db.DiaEspecial.upsert({ fecha: req.body.date, horas });
    res.json({ ok: true });
  },

  async usarHorarioBase(req, res) {
    await db.DiaEspecial.destroy({ where: { fecha: req.query.date } });
    res.json({ ok: true });
  },

  async turnos(req, res) {
    const where = { fecha: { [Op.gte]: turnoService.ymd(new Date()) } };
    if (req.query.status && req.query.status !== "all") where.estado = req.query.status;
    const turnos = await db.Turno.findAll({ where, order: [["fecha", "ASC"], ["hora", "ASC"]] });
    res.json({ bookings: turnos.map(aJson) });
  },

  async cambiarEstado(req, res) {
    const turno = await db.Turno.findByPk(req.params.id);
    if (!turno) return res.status(404).json({ error: "No existe" });
    await turno.update({ estado: req.body.status });
    res.json({ booking: aJson(turno) });
  },

  async plantilla(req, res) {
    const filas = await db.HorarioBase.findAll();
    const template = {};
    for (let d = 0; d < 7; d++) template[d] = [];
    filas.forEach((f) => (template[f.dia_semana] = turnoService.limpiarHoras(f.horas)));
    res.json({ template });
  },

  async guardarPlantilla(req, res) {
    for (let d = 0; d < 7; d++) {
      await db.HorarioBase.upsert({ dia_semana: d, horas: turnoService.limpiarHoras(req.body.template?.[d]) });
    }
    res.json({ ok: true });
  },
};
