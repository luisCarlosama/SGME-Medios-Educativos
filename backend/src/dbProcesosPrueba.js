import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let pool;

export function obtenerPoolProcesosPrueba() {
  if (pool) return pool;
  const { GRADO_PRUEBA_DB_HOST, GRADO_PRUEBA_DB_NAME, GRADO_PRUEBA_DB_USER } = process.env;
  const password = process.env.GRADO_PRUEBA_DB_PASSWORD;
  if (process.env.NODE_ENV === 'production' || process.env.GRADO_PRUEBA_HABILITADA !== 'true') {
    throw new Error('La base ficticia de procesos de grado no está habilitada.');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(GRADO_PRUEBA_DB_HOST)
    || !/^sgme_grados_prueba_[a-z0-9_]+$/.test(GRADO_PRUEBA_DB_NAME || '')
    || !GRADO_PRUEBA_DB_USER || password === undefined
    || GRADO_PRUEBA_DB_NAME === process.env.DB_NAME
    || GRADO_PRUEBA_DB_NAME === process.env.INSTITUCIONAL_DB_NAME) {
    throw new Error('Configura una base local aislada para los procesos de prueba.');
  }
  const port = Number(process.env.GRADO_PRUEBA_DB_PORT || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('El puerto de la base de prueba no es válido.');
  }
  pool = new pg.Pool({
    host: GRADO_PRUEBA_DB_HOST,
    port,
    database: GRADO_PRUEBA_DB_NAME,
    user: GRADO_PRUEBA_DB_USER,
    password,
    connectionTimeoutMillis: 10000,
  });
  pool.on('error', (error) => console.error('Error en la base ficticia de procesos:', error.message));
  return pool;
}
