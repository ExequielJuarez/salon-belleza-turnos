const express = require("express");
const { body, query, param } = require("express-validator");
const adminController = require("../controllers/adminController");
const authController = require("../controllers/authController");
const requiereAdmin = require("../middlewares/requiereAdmin");
const validar = require("../middlewares/validar");

const router = express.Router();

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fecha = (campo, donde = query) => donde(campo).matches(FECHA).withMessage("Fecha inválida");

// Páginas
router.get("/login", authController.formulario);
router.post(
  "/login",
  body("email").trim().isEmail().withMessage("Ingresá un email válido"),
  body("password").notEmpty().withMessage("Ingresá la contraseña"),
  authController.login
);
router.post("/logout", authController.logout);
router.get("/", requiereAdmin.pagina, adminController.panel);

// API del panel (solo con sesión iniciada)
const api = express.Router();
api.use(requiereAdmin.api);
api.get("/month", query("month").matches(/^\d{4}-\d{2}$/).withMessage("Mes inválido"), validar, adminController.mes);
api.get("/day", fecha("date"), validar, adminController.dia);
api.put("/day", fecha("date", body), body("times").isArray().withMessage("Horarios inválidos"), validar, adminController.guardarDia);
api.delete("/day", fecha("date"), validar, adminController.usarHorarioBase);
api.get("/bookings", adminController.turnos);
api.patch(
  "/bookings/:id",
  param("id").isInt().withMessage("Turno inválido"),
  body("status").isIn(["pending", "confirmed", "cancelled"]).withMessage("Estado inválido"),
  validar,
  adminController.cambiarEstado
);
api.get("/template", adminController.plantilla);
api.put("/template", body("template").isObject().withMessage("Horario inválido"), validar, adminController.guardarPlantilla);
router.use("/api", api);

module.exports = router;
