UPDATE public.invitado i
SET autorizado = TRUE
FROM public.graduando g
INNER JOIN public.ceremonia_grado c ON c.id_ceremonia = g.id_ceremonia
WHERE i.id_graduando = g.id_graduando
  AND c.estado IN ('Programada', 'En curso')
  AND i.autorizado IS NOT TRUE;
