ALTER TABLE public.invitado
  DROP CONSTRAINT IF EXISTS chk_invitado_identificacion_digitos;

ALTER TABLE public.invitado
  ADD CONSTRAINT chk_invitado_identificacion_digitos
  CHECK (
    identificacion IS NULL
    OR identificacion ~ '^[0-9]{1,50}$'
  );
