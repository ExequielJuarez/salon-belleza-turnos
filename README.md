# Maison Rosé — Salón de belleza

Landing con turnos online para salón de belleza. Diseño editorial con tipografía serif y formas de arco.

Hecho sobre la base de proyectos `carpeta-base`: **Node.js + Express 5 + EJS + Sequelize + MySQL**, sesiones con `express-session`, contraseñas con `bcryptjs` y validaciones con `express-validator`.

## Qué incluye

- **Landing** con diseño propio. Los servicios y precios se leen de la base de datos.
- **Reserva de turnos online**: el cliente elige servicio, día y horario libre y confirma por WhatsApp.
- **Panel de administración** en `/admin` (con login):
  - Calendario mensual con días libres, ocupados y con turnos pendientes.
  - Habilitar o cerrar horarios por día: se refleja al instante en la landing.
  - Lista de turnos: confirmar, cancelar y avisar por WhatsApp.
  - Horario base semanal.

## Estructura

```
src/
  app.js                 servidor Express
  config/negocio.js      datos del negocio (nombre, WhatsApp, horario, servicios iniciales)
  model/database/        configuración de Sequelize y modelos
  routes/                index.Routes.js (landing + API pública) y admin.Routes.js
  controllers/           reservas, panel y login
  services/              lógica de horarios libres y reservas
  middlewares/           validación y protección del panel
  views/                 EJS: landing, login y panel
public/                  CSS y JS del navegador
database/instalar.js     crea la base, las tablas y los datos iniciales
```

## Cómo correrlo

1. Tené MySQL o MariaDB encendido (por ejemplo, con XAMPP).
2. Instalá las dependencias y configurá el entorno:

```bash
npm install
```

3. Copiá `.env.example` como `.env` y completá `DB_PASSWORD`, `SESSION_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
4. Creá la base, las tablas y el administrador:

```bash
npm run db:instalar
```

5. Iniciá el servidor:

```bash
npm start
```

Abrí http://localhost:3000 (landing) y http://localhost:3000/admin (panel).

## Personalizar

Editá `src/config/negocio.js` (nombre, WhatsApp con código de país como `5491155551234`, dirección, horario y servicios iniciales) **antes** de correr `npm run db:instalar`. Después de instalado, los servicios viven en la tabla `servicios`.

## Notas

- Las fechas y horas usan la zona horaria del servidor.
- En producción definí `NODE_ENV=production` y usá un store de sesiones persistente (el de memoria es solo para desarrollo).