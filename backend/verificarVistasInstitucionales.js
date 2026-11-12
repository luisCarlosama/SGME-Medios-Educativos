import { obtenerPoolInstitucional } from './src/dbInstitucional.js';
import { consultarColumnasInstitucionales } from './src/services/institucionalService.js';

let pool;
try {
  pool = obtenerPoolInstitucional();
  const vistas = await consultarColumnasInstitucionales(
    pool,
    process.env.INSTITUCIONAL_DB_SCHEMA || 'public',
  );
  for (const { vista, columnas } of vistas) {
    console.log(`${vista}: ${columnas.join(', ')}`);
  }
} catch (error) {
  console.error('No se pudieron comprobar las vistas institucionales:', error.message);
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}