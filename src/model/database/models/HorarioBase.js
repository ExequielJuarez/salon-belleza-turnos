// Horario semanal por defecto: un registro por día de la semana (0 = domingo).
// "horas" se guarda como JSON en texto (funciona igual en MySQL y MariaDB).
module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    "HorarioBase",
    {
      dia_semana: { type: DataTypes.TINYINT, primaryKey: true },
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
    { tableName: "horarios_base" }
  );
