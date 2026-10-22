// Horarios de una fecha puntual: reemplazan al horario base. Lista vacía = día cerrado.
module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    "DiaEspecial",
    {
      fecha: { type: DataTypes.DATEONLY, primaryKey: true },
      horas: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "[]",
        get() {
          return JSON.parse(this.getDataValue("horas") || "[]");
        },
        set(v) {
          this.setDataValue("horas", JSON.stringify(v));
        },
      },
    },
    { tableName: "dias_especiales" }
  );
