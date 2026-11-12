import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let pool;

export function obtenerPoolInstitucional() {
  if (pool) return pool;

  const { INSTITUCIONAL_DB_HOST, INSTITUCIONAL_DB_NAME, INSTITUCIONAL_DB_USER } = process.env;
  const password = process.env.INSTITUCIONAL_DB_PASSWORD;
  if (!INSTITUCIONAL_DB_HOST || !INSTITUCIONAL_DB_NAME || !INSTITUCIONAL_DB_USER || password === undefined) {
    throw new Error('Falta configurar la conexión a la base de datos institucional.');
  }

  const port = Number(process.env.INSTITUCIONAL_DB_PORT || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('El puerto de la base de datos institucional no es válido.');
  }

  pool = new pg.Pool({
    host: INSTITUCIONAL_DB_HOST,
    port,
    database: INSTITUCIONAL_DB_NAME,
    user: INSTITUCIONAL_DB_USER,
    password,
    ssl: process.env.INSTITUCIONAL_DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
    connectionTimeoutMillis: 10000,
  });
  pool.on('error', (error) => {
    console.error('Error inesperado en PostgreSQL institucional:', error.message);
  });
  return pool;
}