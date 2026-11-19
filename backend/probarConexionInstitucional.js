
import { obtenerPoolInstitucional } from './src/dbInstitucional.js';

async function probarConexion() {
  let poolInstitucional;

  const consultas = [
    {
      nombre: 'Campus',
      sql: 'SELECT * FROM view_report.vista_campus LIMIT 5',
    },
    {
      nombre: 'Dependencias',
      sql: 'SELECT * FROM view_report.vista_dependencias LIMIT 5',
    },
    {
      nombre: 'Facultades',
      sql: 'SELECT * FROM view_report.vista_facultades LIMIT 5',
    },
    {
      nombre: 'Programas',
      sql: 'SELECT * FROM view_report.vista_programas LIMIT 5',
    },
  ];

  try {
    poolInstitucional = obtenerPoolInstitucional();

    for (const consulta of consultas) {
      const resultado = await poolInstitucional.query(consulta.sql);

      console.log(`\n--- ${consulta.nombre} ---`);
      console.table(resultado.rows);
    }

    console.log('\nPrueba de los cuatro catálogos finalizada.');
  } catch (error) {
    console.error('Error consultando los catálogos:', error.message);
    process.exitCode = 1;
  } finally {
    if (poolInstitucional) {
      await poolInstitucional.end();
    }
  }
}

probarConexion();
