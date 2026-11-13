import { useEffect, useState } from 'react';
import { Box, Button, ButtonBase, CircularProgress, Typography } from '@mui/material';
import {
  getFotografiasCeremonia,
  type FotoCeremonia,
} from '../../../Ceremonias/services/ceremonias.service';
import ModalHistorial from './ModalHistorial';

interface Props {
  ceremoniaId: string;
}

export default function EvidenciasFotograficasCeremonia({ ceremoniaId }: Props) {
  const [fotos, setFotos] = useState<FotoCeremonia[]>([]);
  const [fotoSeleccionada, setFotoSeleccionada] = useState<FotoCeremonia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);
    getFotografiasCeremonia(ceremoniaId)
      .then((resultado) => {
        if (activo) setFotos(resultado);
      })
      .catch((cause: unknown) => {
        if (activo) {
          setError(cause instanceof Error ? cause.message : 'No fue posible consultar las fotografías.');
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => { activo = false; };
  }, [ceremoniaId, intento]);

  if (cargando) {
    return (
      <Box role="status" sx={{ py: 1 }}>
        <CircularProgress size={24} aria-label="Cargando fotografías" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box role="alert">
        <Typography color="error">{error}</Typography>
        <Button onClick={() => setIntento((actual) => actual + 1)} sx={{ textTransform: 'none', mt: 1 }}>
          Reintentar
        </Button>
      </Box>
    );
  }

  if (fotos.length === 0) {
    return <Typography color="text.secondary">No hay fotografías registradas para esta ceremonia.</Typography>;
  }

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
        {fotos.map((foto) => (
          <ButtonBase
            key={foto.slot}
            onClick={() => setFotoSeleccionada(foto)}
            aria-label={`Ampliar fotografía ${foto.slot}`}
            sx={{
              width: 120,
              height: 88,
              borderRadius: '8px',
              overflow: 'hidden',
              '&:focus-visible': { outline: '3px solid #1565C0', outlineOffset: 2 },
            }}
          >
            <Box
              component="img"
              src={`data:${foto.mimeType};base64,${foto.base64}`}
              alt={`Fotografía ${foto.slot} de la ceremonia`}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </ButtonBase>
        ))}
      </Box>
      {fotoSeleccionada && (
        <ModalHistorial
          titulo={`Fotografía ${fotoSeleccionada.slot}`}
          onClose={() => setFotoSeleccionada(null)}
        >
          <Box
            component="img"
            src={`data:${fotoSeleccionada.mimeType};base64,${fotoSeleccionada.base64}`}
            alt={`Fotografía ${fotoSeleccionada.slot} de la ceremonia`}
            sx={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', width: 'auto', height: 'auto', mx: 'auto' }}
          />
        </ModalHistorial>
      )}
    </>
  );
}
