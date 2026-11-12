
import { obtenerPoolInstitucional } from '../dbInstitucional.js';

const poolInstitucional = obtenerPoolInstitucional();

// Consultar campus institucionales
export const obtenerCampus = async (req, res) => {
  try {
    const resultado = await poolInstitucional.query(`
      SELECT nombre, ubicacion, abreviatura
      FROM view_report.vista_campus
      ORDER BY nombre ASC
    `);

    return res.json(resultado.rows);
  } catch (error) {
    console.error('Error al consultar campus institucionales:', error.message);

    return res.status(500).json({
      mensaje: 'No se pudieron consultar los campus institucionales.',
    });
  }
};

// Consultar dependencias institucionales
export const obtenerDependencias = async (req, res) => {
  try {
    const resultado = await poolInstitucional.query(`
      SELECT nombre, telefonos, contacto
      FROM view_report.vista_dependencias
      ORDER BY nombre ASC
    `);

    return res.json(resultado.rows);
  } catch (error) {
    console.error('Error al consultar dependencias institucionales:', error.message);

    return res.status(500).json({
      mensaje: 'No se pudieron consultar las dependencias institucionales.',
    });
  }
};

// Consultar facultades institucionales
export const obtenerFacultades = async (req, res) => {
  try {
    const resultado = await poolInstitucional.query(`
      SELECT
        facultad,
        "PRIMER_APELLIDO_DECANO",
        "SEGUNDO_APELLIDO",
        "PRIMER_NOMBRE",
        "SEGUNDO_NOMBRE",
        activado
      FROM view_report.vista_facultades
      ORDER BY facultad ASC
    `);

    return res.json(resultado.rows);
  } catch (error) {
    console.error('Error al consultar facultades institucionales:', error.message);

    return res.status(500).json({
      mensaje: 'No se pudieron consultar las facultades institucionales.',
    });
  }
};

// Consultar programas institucionales
export const obtenerProgramas = async (req, res) => {
  try {
    const resultado = await poolInstitucional.query(`
      SELECT nombre_programa, codigo, nombre_facultad
      FROM view_report.vista_programas
      ORDER BY nombre_programa ASC
    `);

    return res.json(resultado.rows);
  } catch (error) {
    console.error('Error al consultar programas institucionales:', error.message);

    return res.status(500).json({
      mensaje: 'No se pudieron consultar los programas institucionales.',
    });
  }
};
