// Login del administrador con sesión y contraseña encriptada (bcrypt).
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const db = require("../model/database/models");
const negocio = require("../config/negocio");

// Freno simple contra fuerza bruta: 10 intentos fallidos por IP cada 15 minutos.
const intentos = new Map();
const bloqueado = (ip) => {
  const a = intentos.get(ip);
  return a && a.n >= 10 && Date.now() < a.hasta;
};
const falla = (ip) => {
  const a = intentos.get(ip) || { n: 0 };
  intentos.set(ip, { n: a.n + 1, hasta: Date.now() + 15 * 60 * 1000 });
};

module.exports = {
  formulario(req, res) {
    if (req.session.adminId) return res.redirect("/admin");
    res.render("login", { negocio, error: null });
  },

  async login(req, res) {
    const ip = req.ip;
    if (bloqueado(ip)) return res.status(429).render("login", { negocio, error: "Demasiados intentos, probá más tarde" });
    const errores = validationResult(req);
    if (!errores.isEmpty()) return res.status(400).render("login", { negocio, error: errores.array()[0].msg });

    const usuario = await db.Usuario.findOne({ where: { email: req.body.email.toLowerCase() } });
    if (!usuario || !bcrypt.compareSync(req.body.password, usuario.password_hash)) {
      falla(ip);
      return res.status(401).render("login", { negocio, error: "Email o contraseña incorrectos" });
    }
    intentos.delete(ip);
    // Regenera la sesión al ingresar (evita fijación de sesión).
    req.session.regenerate((err) => {
      if (err) throw err;
      req.session.adminId = usuario.id;
      res.redirect("/admin");
    });
  },

  logout(req, res) {
    req.session.destroy(() => res.json({ ok: true }));
  },
};
