// API pública: lo que usa la landing para mostrar horarios y reservar.
const db = require("../model/database/models");
const negocio = require("../config/negocio");
const turnoService = require("../services/turnoService");

module.exports = {
  async config(req, res) {
    const servicios = await db.Servicio.findAll({ order: [["orden", "ASC"], ["id", "ASC"]] });
    res.json({
      name: negocio.nombre,
      whatsapp: negocio.whatsapp,
      address: negocio.direccion,
      hoursText: negocio.horarioTexto,
      allTimes: turnoService.todasLasHoras,
      services: servicios.map((s) => ({ name: s.nombre, price: s.precio, minutes: s.minutos, desc: s.descripcion })),
    });
  },

  async dias(req, res) {
    const cantidad = Math.min(Number(req.query.days) || 21, 60);
    res.json(await turnoService.diasDisponibles(cantidad));
  },

  async horarios(req, res) {
    res.json({ date: req.query.date, times: await turnoService.horasLibres(req.query.date) });
  },

  async reservar(req, res) {
    const { name, phone, service, date, time } = req.body;
    try {
      const turno = await turnoService.reservar({ nombre: name, telefono: phone, servicio: service, fecha: date, hora: time });
      res.status(201).json({ booking: { id: turno.id, date: turno.fecha, time: turno.hora, service: turno.servicio, name: turno.nombre } });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }
  },
};
