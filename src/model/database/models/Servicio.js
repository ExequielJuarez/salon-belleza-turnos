module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    "Servicio",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      nombre: { type: DataTypes.STRING(80), allowNull: false },
      precio: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      minutos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
      descripcion: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
      orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { tableName: "servicios" }
  );
