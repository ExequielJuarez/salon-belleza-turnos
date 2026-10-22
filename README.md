# Maison Rosé — Salón de belleza

Landing con turnos online para salón de belleza. Diseño editorial con tipografía serif y formas de arco.

## Qué incluye

- **Landing** con diseño propio, servicios y precios editables desde `config.json`.
- **Reserva de turnos online**: el cliente elige servicio, día y horario libre y confirma por WhatsApp.
- **Panel de administración** en `/admin`:
  - Calendario mensual con días libres, ocupados y con turnos pendientes.
  - Habilitar o cerrar horarios por día (se refleja al instante en la landing).
  - Lista de turnos: confirmar, cancelar y avisar por WhatsApp.
  - Horario base semanal.
- Sin dependencias: solo Node.js 18+. Los datos se guardan en `data/db.json`.

## Cómo correrlo

```bash
node server.js
```

Abrí http://localhost:3000 (landing) y http://localhost:3000/admin (panel).

## Configuración

Editá `config.json`: nombre, WhatsApp (con código de país, ej. `5491155551234`), dirección, servicios, precios y horario.

**Importante:** cambiá la contraseña del panel. Mejor aún, definila como variable de entorno:

```bash
ADMIN_PASSWORD="una-clave-segura" PORT=3000 node server.js
```

## Notas

- Las fechas y horas se calculan con la zona horaria del servidor.
- Para publicarlo necesitás un hosting que ejecute Node.js (Render, Railway, un VPS, etc.) con almacenamiento persistente para `data/`.
