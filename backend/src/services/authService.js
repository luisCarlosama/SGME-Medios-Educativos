
import pool from '../db.js';
import bcrypt from 'bcryptjs';

export const autenticarAdministrador = async (correo, password) => {
  const consulta = `
    SELECT
      id_admin,
      nombre,
      correo_institucional,
      password_hash,
      rol,
      id_campus,
      estado
    FROM usuario_admin
    WHERE LOWER(correo_institucional) = LOWER($1)
    LIMIT 1
  `;

  const resultado = await pool.query(consulta, [correo]);

  if (resultado.rows.length === 0) {
    return null;
  }

  const administrador = resultado.rows[0];

  if (!administrador.estado) {
    return null;
  }

  const passwordValida = await bcrypt.compare(
    password,
    administrador.password_hash
  );

  if (!passwordValida) {
    return null;
  }

  const {
    password_hash,
    ...datosAdministrador
  } = administrador;

  return datosAdministrador;
};
