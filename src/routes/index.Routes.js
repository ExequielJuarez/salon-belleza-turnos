const express = require("express");
const { body, query } = require("express-validator");
const db = require("../model/database/models");
const negocio = require("../config/negocio");
const reservaController = require("../controllers/reservaController");
const validar = require("../middlewares/validar");

const router = express.Router();

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fecha = (campo, donde = query) => donde(campo).matches(FECHA).withMessage("Fecha inválida");

// Landing (se renderiza en el servidor con los servicios guardados en la base)
router.get("/", async (req, res) => {
  const servicios = await db.Servicio.findAll({ order: [["orden", "ASC"], ["id", "ASC"]] });
  res.render("index", { negocio, servicios });
});

// API pública
router.get("/api/config", reservaController.config);
router.get("/api/days", reservaController.dias);
router.get("/api/slots", fecha("date"), validar, reservaController.horarios);
router.post(
  "/api/book",
  body("name").trim().notEmpty().withMessage("Completá tu nombre").isLength({ max: 80 }).withMessage("Nombre demasiado largo"),
  body("phone").trim().custom((v) => String(v).replace(/\D/g, "").length >= 8).withMessage("Ingresá un teléfono válido"),
  body("service")
    .trim()
    .custom(async (v) => {
      if (!(await db.Servicio.findOne({ where: { nombre: v } }))) throw new Error("Servicio inválido");
    }),
  fecha("date", body),
  body("time").matches(/^\d{2}:\d{2}$/).withMessage("Hora inválida"),
  validar,
  reservaController.reservar
);

module.exports = router;
