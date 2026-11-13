export async function consultarRequisitosInicioCeremonia(executor, ceremoniaId) {
  const resultado = await executor.query(
    `SELECT s.numero_sesion AS "numeroSesion",
            s.nombre,
            s.estado,
            (s.hora_inicio IS NOT NULL AND s.hora_fin IS NOT NULL
             AND s.hora_inicio < s.hora_fin) AS "horarioValido",
            EXISTS (
              SELECT 1 FROM public.sesion_programa sp
              WHERE sp.id_sesion = s.id_sesion
            ) AS "tienePrograma",
            (SELECT COUNT(*)::integer FROM public.graduando g
             WHERE g.id_sesion = s.id_sesion AND g.id_ceremonia = s.id_ceremonia
            ) AS "graduandosCount",
            EXISTS (
              SELECT 1 FROM public.invitado i
              JOIN public.graduando g ON g.id_graduando = i.id_graduando
              WHERE g.id_ceremonia = $1
            ) AS "tieneInvitado"
     FROM public.sesion s
     WHERE s.id_ceremonia = $1
     ORDER BY s.numero_sesion`,
    [ceremoniaId],
  );

  const pendientes = [];
  if (resultado.rows.length === 0) {
    pendientes.push('Agrega y configura al menos una sesión.');
  } else if (!resultado.rows[0].tieneInvitado) {
    pendientes.push('Agrega al menos un invitado a la ceremonia.');
  }
  for (const sesion of resultado.rows) {
    const faltantes = [];
    if (sesion.estado === 'Pendiente') faltantes.push('terminar su configuración');
    if (!sesion.horarioValido) faltantes.push('un horario válido');
    if (!sesion.tienePrograma) faltantes.push('al menos un programa');
    if (sesion.graduandosCount === 0) faltantes.push('al menos un graduando');
    if (faltantes.length > 0) {
      pendientes.push(`Sesión ${sesion.numeroSesion} (${sesion.nombre}): falta ${faltantes.join(', ')}.`);
    }
  }
  return { puedeIniciar: pendientes.length === 0, pendientes };
}
