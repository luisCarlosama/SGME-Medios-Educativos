export async function actualizarSesionesPorHorario(executor, ceremoniaId) {
  return executor.query(
    `UPDATE public.sesion s
     SET estado = CASE
       WHEN c.fecha + s.hora_fin <= LOCALTIMESTAMP THEN 'Finalizada'
       ELSE 'En curso'
     END
     FROM public.ceremonia_grado c
     WHERE c.id_ceremonia = s.id_ceremonia
       AND c.id_ceremonia = $1
       AND c.estado = 'En curso'
       AND s.estado_manual = FALSE
       AND s.estado IN ('Programada', 'En curso')
       AND s.hora_inicio IS NOT NULL
       AND s.hora_fin IS NOT NULL
       AND s.hora_fin > s.hora_inicio
       AND (
         (s.estado = 'Programada' AND c.fecha + s.hora_inicio <= LOCALTIMESTAMP)
         OR (s.estado = 'En curso' AND c.fecha + s.hora_fin <= LOCALTIMESTAMP)
       )
     RETURNING s.id_sesion::text AS id, s.estado`,
    [ceremoniaId],
  );
}
