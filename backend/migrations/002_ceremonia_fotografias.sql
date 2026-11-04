CREATE TABLE IF NOT EXISTS public.sgme_ceremonia_fotografia (
  id_ceremonia UUID NOT NULL
    REFERENCES public.sgme_ceremonia (id)
    ON DELETE CASCADE,
  slot SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 4),
  mime_type VARCHAR(32) NOT NULL
    CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
  base64 TEXT NOT NULL,
  tamano_bytes INTEGER NOT NULL
    CHECK (tamano_bytes BETWEEN 1 AND 3145728),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id_ceremonia, slot)
);
