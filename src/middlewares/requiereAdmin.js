// Protege el panel: las páginas redirigen al login y la API responde 401.
const pagina = (req, res, next) => (req.session.adminId ? next() : res.redirect("/admin/login"));
const api = (req, res, next) => (req.session.adminId ? next() : res.status(401).json({ error: "No autorizado" }));

module.exports = { pagina, api };
