// Crea la base de datos si no existe, las tablas y los datos iniciales.
// Uso: npm run db:instalar   (se puede repetir sin problema: no pisa datos existentes)
require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const config = require("../src/model/database/config/config")[process.env.NODE_ENV || "development"];
const negocio = require("../src/config/negocio");

(async () => {
  // 1) Crear la base si no existe
  const conexion = await mysql.createConnection({ host: config.host, port: config.port, user: config.username, password: config.password || "" });
  await conexion.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conexion.end();

  // 2) Crear tablas
  const db = require("../src/model/database/models");
  await db.sequelize.sync();

  // 3) Servicios iniciales
  if ((await db.Servicio.count()) === 0) {
    await db.Servicio.bulkCreate(negocio.servicios.map((s, i) => ({ ...s, orden: i })));
    console.log(`• ${negocio.servicios.length} servicios cargados`);
  }

  // 4) Horario semanal inicial
  const { diaInicio, diaFin, paso, desde, hasta, diasAbiertos } = negocio.horario;
  const aMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const deMin = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const horas = [];
  for (let m = aMin(diaInicio); m < aMin(diaFin); m += paso) if (m >= aMin(desde) && m < aMin(hasta)) horas.push(deMin(m));
  for (let d = 0; d < 7; d++) {
    await db.HorarioBase.findOrCreate({ where: { dia_semana: d }, defaults: { horas: diasAbiertos.includes(d) ? horas : [] } });
  }

  // 5) Usuario administrador (usa ADMIN_EMAIL y ADMIN_PASSWORD del .env)
  const email = (process.env.ADMIN_EMAIL || "admin@ejemplo.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "cambiar-esta-clave";
  const [, creado] = await db.Usuario.findOrCreate({ where: { email }, defaults: { password_hash: bcrypt.hashSync(password, 10) } });
  console.log(creado ? `• Administrador creado: ${email}` : `• Administrador ya existía: ${email}`);
  if (creado && password === "cambiar-esta-clave") console.log("⚠️  Usás la contraseña por defecto. Definí ADMIN_PASSWORD en el .env y volvé a instalar con otro email, o cambiala en la base.");

  console.log(`✅ Base "${config.database}" lista. Iniciá el servidor con: npm start`);
  await db.sequelize.close();
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
