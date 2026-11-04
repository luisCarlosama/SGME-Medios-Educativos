CREATE TABLE IF NOT EXISTS public.sgme_ceremonia_graduando (
  id UUID PRIMARY KEY,
  id_ceremonia UUID NOT NULL
    REFERENCES public.sgme_ceremonia (id)
    ON DELETE CASCADE,
  id_sesion UUID
    REFERENCES public.sgme_ceremonia_sesion (id)
    ON DELETE SET NULL,
  nombres VARCHAR(120) NOT NULL,
  apellidos VARCHAR(120) NOT NULL,
  documento VARCHAR(40) NOT NULL,
  telefono VARCHAR(40),
  correo VARCHAR(254),
  codigo_estudiantil VARCHAR(40),
  talla_toga VARCHAR(20),
  estado BOOLEAN NOT NULL DEFAULT TRUE,
  requisitos_cumplidos BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_ceremonia, documento)
);

CREATE INDEX IF NOT EXISTS sgme_ceremonia_graduando_ceremonia_idx
  ON public.sgme_ceremonia_graduando (id_ceremonia);

CREATE INDEX IF NOT EXISTS sgme_ceremonia_graduando_sesion_idx
  ON public.sgme_ceremonia_graduando (id_sesion);

CREATE TABLE IF NOT EXISTS public.sgme_ceremonia_graduando_programa (
  id_graduando UUID NOT NULL
    REFERENCES public.sgme_ceremonia_graduando (id)
    ON DELETE CASCADE,
  id_programa INTEGER NOT NULL
    REFERENCES public.programa (id_programa)
    ON DELETE RESTRICT,
  PRIMARY KEY (id_graduando, id_programa)
);

CREATE INDEX IF NOT EXISTS sgme_ceremonia_graduando_programa_programa_idx
  ON public.sgme_ceremonia_graduando_programa (id_programa);
