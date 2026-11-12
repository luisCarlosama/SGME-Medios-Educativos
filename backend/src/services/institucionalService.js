import pg from 'pg';

const VISTAS_INSTITUCIONALES = [
  'vista_info_graduandos',
  'vista_informacion_estudiantes',
];

export async function consultarColumnasInstitucionales(executor, esquema = 'public') {
  const resultado = [];
  for (const vista of VISTAS_INSTITUCIONALES) {
    const consulta = `SELECT * FROM ${pg.escapeIdentifier(esquema)}.${pg.escapeIdentifier(vista)} LIMIT 0`;
    const datos = await executor.query(consulta);
    resultado.push({ vista, columnas: datos.fields.map((campo) => campo.name) });
  }
  return resultado;
}

export async function consultarGraduandosInstitucionales(executor, esquema, pagina) {
  const tamanoPagina = 25;
  const resultado = await executor.query(
    `SELECT nombre_completo AS nombre,
            numero_identificacion::text AS documento,
            programa,
            codigo::text AS codigo,
            estado_aspirante AS estado,
            periodo::text AS periodo
     FROM ${pg.escapeIdentifier(esquema)}.${pg.escapeIdentifier('vista_info_graduandos')}
     ORDER BY nombre_completo NULLS LAST, numero_identificacion NULLS LAST,
              programa NULLS LAST, periodo NULLS LAST
     LIMIT $1 OFFSET $2`,
    [tamanoPagina + 1, (pagina - 1) * tamanoPagina],
  );
  return {
    data: resultado.rows.slice(0, tamanoPagina),
    pagina,
    haySiguiente: resultado.rows.length > tamanoPagina,
  };
}