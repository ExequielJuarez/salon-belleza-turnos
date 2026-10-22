// Datos del negocio. Los servicios se cargan en la base con: npm run db:instalar
// (después se leen desde la base de datos).
module.exports = {
    "nombre":  "Maison Rosé",
    "whatsapp":  "5491155553456",
    "direccion":  "Gorriti 5120, Palermo, CABA",
    "horarioTexto":  "Mar a Sáb · 10 a 19 hs",
    "horario":  {
                    "diaInicio":  "09:00",
                    "diaFin":  "20:00",
                    "paso":  30,
                    "desde":  "10:00",
                    "hasta":  "19:00",
                    "diasAbiertos":  [
                                         2,
                                         3,
                                         4,
                                         5,
                                         6
                                     ]
                },
    "servicios":  [
                      {
                          "nombre":  "Corte y brushing",
                          "precio":  18000,
                          "minutos":  60,
                          "descripcion":  "Corte a medida, lavado y peinado."
                      },
                      {
                          "nombre":  "Color completo",
                          "precio":  45000,
                          "minutos":  120,
                          "descripcion":  "Tintura raíz a puntas con tratamiento."
                      },
                      {
                          "nombre":  "Balayage / mechas",
                          "precio":  85000,
                          "minutos":  180,
                          "descripcion":  "Luces naturales, trabajadas a mano."
                      },
                      {
                          "nombre":  "Manicuría semipermanente",
                          "precio":  14000,
                          "minutos":  60,
                          "descripcion":  "Esmaltado duradero, brillo por semanas."
                      },
                      {
                          "nombre":  "Tratamiento capilar",
                          "precio":  22000,
                          "minutos":  60,
                          "descripcion":  "Nutrición y reparación profunda."
                      },
                      {
                          "nombre":  "Maquillaje",
                          "precio":  25000,
                          "minutos":  60,
                          "descripcion":  "Social, de día o de noche."
                      }
                  ]
};
