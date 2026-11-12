import { obtenerPoolProcesosPrueba } from './src/dbProcesosPrueba.js';

let pool;
try {
  pool = obtenerPoolProcesosPrueba();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.proceso_grado_prueba (
      id_proceso TEXT PRIMARY KEY,
      nombres TEXT NOT NULL,
      apellidos TEXT NOT NULL,
      documento TEXT NOT NULL,
      codigo TEXT NOT NULL,
      programa TEXT NOT NULL,
      periodo TEXT NOT NULL,
      estado TEXT NOT NULL,
      es_prueba BOOLEAN NOT NULL CHECK (es_prueba)
    )
  `);
  const resultado = await pool.query(`
    INSERT INTO public.proceso_grado_prueba
      (id_proceso, nombres, apellidos, documento, codigo, programa, periodo, estado, es_prueba)
    VALUES
      ('ficticio-pregrado-1', 'Ana', 'Ejemplo', '900000001', 'PRUEBA001', 'Programa de prueba', '2026-1', 'Titulado', TRUE),
      ('ficticio-posgrado-1', 'Ana', 'Ejemplo', '900000001', 'PRUEBA002', 'Posgrado de prueba', '2026-2', 'Pendiente', TRUE),
      ('ficticio-pregrado-2', 'Luis', 'Ejemplo', '900000002', 'PRUEBA003', 'Programa de prueba', '2026-2', 'Pendiente', TRUE)
    ON CONFLICT (id_proceso) DO NOTHING
  `);
  console.log(`Se crearon ${resultado.rowCount} procesos ficticios.`);
} catch (error) {
  console.error('No fue posible crear los procesos ficticios:', error.message);
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
