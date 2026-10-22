module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    "Usuario",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      email: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      password_hash: { type: DataTypes.STRING(100), allowNull: false },
    },
    { tableName: "usuarios" }
  );
