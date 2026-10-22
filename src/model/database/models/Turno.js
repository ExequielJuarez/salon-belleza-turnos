// Estados: pending (pendiente), confirmed (confirmado), cancelled (cancelado).
module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    "Turno",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      nombre: { type: DataTypes.STRING(80), allowNull: false },
      telefono: { type: DataTypes.STRING(30), allowNull: false },
      servicio: { type: DataTypes.STRING(80), allowNull: false },
      fecha: { type: DataTypes.DATEONLY, allowNull: false },
      hora: { type: DataTypes.STRING(5), allowNull: false },
      estado: { type: DataTypes.ENUM("pending", "confirmed", "cancelled"), allowNull: false, defaultValue: "pending" },
    },
    { tableName: "turnos", indexes: [{ fields: ["fecha", "hora"] }] }
  );
