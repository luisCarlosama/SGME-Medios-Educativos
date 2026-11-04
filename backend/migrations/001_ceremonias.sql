CREATE TABLE IF NOT EXISTS public.sgme_ceremonia (
  id UUID PRIMARY KEY,
  codigo VARCHAR(32) NOT NULL UNIQUE,
  nombre VARCHAR(180) NOT NULL,
  fecha DATE NOT NULL,
  id_espacio INTEGER NOT NULL
    REFERENCES public.espacio (id_espacio)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  estado VARCHAR(20) NOT NULL DEFAULT 'Programada'
    CHECK (estado IN ('Programada', 'En curso', 'Finalizada', 'Cancelada')),
  max_invitados_por_graduando SMALLINT NOT NULL DEFAULT 2
    CHECK (max_invitados_por_graduando BETWEEN 2 AND 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sgme_ceremonia_fecha_idx
  ON public.sgme_ceremonia (fecha);

CREATE INDEX IF NOT EXISTS sgme_ceremonia_estado_idx
  ON public.sgme_ceremonia (estado);

CREATE TABLE IF NOT EXISTS public.sgme_ceremonia_sesion (
  id UUID PRIMARY KEY,
  id_ceremonia UUID NOT NULL
    REFERENCES public.sgme_ceremonia (id)
    ON DELETE CASCADE,
  numero_sesion INTEGER NOT NULL CHECK (numero_sesion > 0),
  nombre VARCHAR(180) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
    CHECK (estado IN ('Pendiente', 'En curso', 'Finalizada')),
  hora_inicio TIME,
  hora_fin TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_ceremonia, numero_sesion),
  CHECK (
    (hora_inicio IS NULL AND hora_fin IS NULL)
    OR (hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_fin > hora_inicio)
  )
);

CREATE INDEX IF NOT EXISTS sgme_ceremonia_sesion_ceremonia_idx
  ON public.sgme_ceremonia_sesion (id_ceremonia, numero_sesion);
