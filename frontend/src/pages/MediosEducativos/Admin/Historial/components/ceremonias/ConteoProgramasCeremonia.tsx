import { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { contarProgramasSesiones, getSesiones } from '../../../Ceremonias/services/ceremonias.service';

interface Props {
  ceremoniaId: string;
}

export default function ConteoProgramasCeremonia({ ceremoniaId }: Props) {
  const [conteo, setConteo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    setConteo(null);
    setError(null);
    getSesiones(ceremoniaId)
      .then((sesiones) => {
        const conteo = contarProgramasSesiones(sesiones);
        if (activo) setConteo(conteo);
      })
      .catch((cause: unknown) => {
        if (activo) {
          setError(cause instanceof Error ? cause.message : 'No fue posible consultar los programas.');
        }
      });
    return () => { activo = false; };
  }, [ceremoniaId, intento]);

  if (error) {
    return (
      <Box component="span" role="alert" sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography component="span" color="error" sx={{ fontSize: '0.8rem', fontWeight: 400 }}>
          {error}
        </Typography>
        <Button size="small" onClick={() => setIntento((actual) => actual + 1)} sx={{ textTransform: 'none' }}>
          Reintentar
        </Button>
      </Box>
    );
  }

  if (conteo === null) {
    return <CircularProgress size={20} aria-label="Cargando programas" />;
  }

  return conteo;
}
