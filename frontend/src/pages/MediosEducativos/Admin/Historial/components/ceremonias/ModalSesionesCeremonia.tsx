import { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import type { Sesion } from '../../../Ceremonias/interfaces/ceremonias.interface';
import { formatearHora12, getSesiones } from '../../../Ceremonias/services/ceremonias.service';
import ModalHistorial from './ModalHistorial';

interface Props {
  ceremoniaId: string;
  onClose: () => void;
}

export default function ModalSesionesCeremonia({ ceremoniaId, onClose }: Props) {
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);
    getSesiones(ceremoniaId)
      .then((resultado) => {
        if (activo) setSesiones(resultado);
      })
      .catch((err: unknown) => {
        if (activo) setError(err instanceof Error ? err.message : 'No fue posible consultar las sesiones.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => { activo = false; };
  }, [ceremoniaId, intento]);

  return (
    <ModalHistorial
      titulo="Sesiones de la ceremonia"
      subtitulo="Consulta las sesiones y sus programas asociados."
      onClose={onClose}
    >
      {cargando ? (
        <Box role="status" sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} aria-label="Cargando sesiones" />
        </Box>
      ) : error ? (
        <Box role="alert">
          <Typography color="error">{error}</Typography>
          <Button onClick={() => setIntento((actual) => actual + 1)} sx={{ textTransform: 'none', mt: 1 }}>
            Reintentar
          </Button>
        </Box>
      ) : sesiones.length === 0 ? (
        <Typography color="text.secondary">No hay sesiones registradas para esta ceremonia.</Typography>
      ) : (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {sesiones.map((sesion) => (
            <Box key={sesion.id} sx={{ border: '1px solid #E5EAF0', borderRadius: 2, p: 2 }}>
              <Typography sx={{ fontWeight: 700, color: '#0B1A2A' }}>
                Sesión {sesion.numeroSesion} · {sesion.nombre}
              </Typography>
              <Typography sx={{ color: '#5A6A7A', mt: 0.5 }}>
                Horario: {formatearHora12(sesion.horaInicio) || '—'} – {formatearHora12(sesion.horaFin) || '—'}
              </Typography>
              <Typography sx={{ color: '#5A6A7A' }}>Estado: {sesion.estado}</Typography>
              <Typography sx={{ mt: 1 }}>
                Programas: {sesion.programas.length ? sesion.programas.join(', ') : 'Sin programas registrados'}
              </Typography>
              <Typography sx={{ color: '#5A6A7A', fontSize: '0.875rem', mt: 0.5 }}>
                Graduandos: {sesion.graduandosCount} · Invitados: {sesion.invitadosCount}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </ModalHistorial>
  );
}
