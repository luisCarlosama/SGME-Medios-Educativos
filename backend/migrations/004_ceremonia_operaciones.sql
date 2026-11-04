ALTER TABLE public.sgme_ceremonia
  ADD COLUMN IF NOT EXISTS cupo_invitados INTEGER,
  ADD COLUMN IF NOT EXISTS motivo_estado VARCHAR(500);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sgme_ceremonia_cupo_invitados_check'
      AND conrelid = 'public.sgme_ceremonia'::regclass
  ) THEN
    ALTER TABLE public.sgme_ceremonia
      ADD CONSTRAINT sgme_ceremonia_cupo_invitados_check
      CHECK (cupo_invitados IS NULL OR cupo_invitados >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sgme_ceremonia_sesion_programa (
  id_sesion UUID NOT NULL
    REFERENCES public.sgme_ceremonia_sesion (id)
    ON DELETE CASCADE,
  id_programa INTEGER NOT NULL
    REFERENCES public.programa (id_programa)
    ON DELETE RESTRICT,
  PRIMARY KEY (id_sesion, id_programa)
);

CREATE INDEX IF NOT EXISTS sgme_ceremonia_sesion_programa_programa_idx
  ON public.sgme_ceremonia_sesion_programa (id_programa);

ALTER TABLE public.sgme_ceremonia_graduando
  ADD COLUMN IF NOT EXISTS ingreso_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ingreso_sesion_id UUID
    REFERENCES public.sgme_ceremonia_sesion (id)
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.sgme_ceremonia_invitado (
  id UUID PRIMARY KEY,
  id_ceremonia UUID NOT NULL
    REFERENCES public.sgme_ceremonia (id)
    ON DELETE CASCADE,
  id_graduando UUID NOT NULL
    REFERENCES public.sgme_ceremonia_graduando (id)
    ON DELETE CASCADE,
  nombre VARCHAR(180) NOT NULL,
  documento VARCHAR(40),
  telefono VARCHAR(40),
  parentesco VARCHAR(80),
  autorizacion VARCHAR(20) NOT NULL DEFAULT 'Autorizado'
    CHECK (autorizacion IN ('Autorizado', 'Pendiente')),
  ingreso_at TIMESTAMPTZ,
  ingreso_sesion_id UUID
    REFERENCES public.sgme_ceremonia_sesion (id)
    ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sgme_ceremonia_invitado_ceremonia_idx
  ON public.sgme_ceremonia_invitado (id_ceremonia);

CREATE INDEX IF NOT EXISTS sgme_ceremonia_invitado_graduando_idx
  ON public.sgme_ceremonia_invitado (id_graduando);

CREATE INDEX IF NOT EXISTS sgme_ceremonia_invitado_sesion_ingreso_idx
  ON public.sgme_ceremonia_invitado (ingreso_sesion_id);

CREATE UNIQUE INDEX IF NOT EXISTS sgme_ceremonia_invitado_documento_idx
  ON public.sgme_ceremonia_invitado (id_graduando, LOWER(BTRIM(documento)))
  WHERE NULLIF(BTRIM(documento), '') IS NOT NULL;
