import { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import type { Graduando, Invitado } from '../../../Ceremonias/interfaces/ceremonias.interface';
import { getCeremoniaById, getGraduandos, getInvitados } from '../../../Ceremonias/services/ceremonias.service';
import ModalHistorial from './ModalHistorial';

interface Props {
  ceremoniaId: string;
  onClose: () => void;
}

export default function ModalControlIngreso({ ceremoniaId, onClose }: Props) {
  const [fecha, setFecha] = useState('');
  const [graduandos, setGraduandos] = useState<Graduando[]>([]);
  const [invitados, setInvitados] = useState<Invitado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);
    Promise.all([getCeremoniaById(ceremoniaId), getGraduandos(ceremoniaId), getInvitados(ceremoniaId)])
      .then(([ceremonia, resultadoGraduandos, resultadoInvitados]) => {
        if (!ceremonia) throw new Error('La ceremonia no existe.');
        if (activo) {
          setFecha(ceremonia.fecha);
          setGraduandos(resultadoGraduandos.data);
          setInvitados(resultadoInvitados);
        }
      })
      .catch((err: unknown) => {
        if (activo) setError(err instanceof Error ? err.message : 'No fue posible consultar los ingresos.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => { activo = false; };
  }, [ceremoniaId, intento]);

  const graduandosIngresados = graduandos.filter((graduando) => graduando.estadoIngreso === 'Ingresó');
  const invitadosIngresados = invitados.filter((invitado) => invitado.estadoIngreso === 'Ingresó');

  return (
    <ModalHistorial
      titulo="Control de ingreso"
      subtitulo="Consulta los ingresos disponibles de la ceremonia."
      onClose={onClose}
    >
      {cargando ? (
        <Box role="status" sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} aria-label="Cargando ingresos" />
        </Box>
      ) : error ? (
        <Box role="alert">
          <Typography color="error">{error}</Typography>
          <Button onClick={() => setIntento((actual) => actual + 1)} sx={{ textTransform: 'none', mt: 1 }}>
            Reintentar
          </Button>
        </Box>
      ) : (
        <>
          <Typography sx={{ fontWeight: 600, color: '#0B1A2A' }}>
            Fecha de la ceremonia: {fecha}
          </Typography>
          <Typography sx={{ color: '#5A6A7A', fontSize: '0.875rem', mt: 0.5, mb: 2 }}>
            Se muestran los ingresos asociados a la sesión actual de cada participante. La fecha indicada es la de la ceremonia, no la fecha real del ingreso.
          </Typography>
          {graduandosIngresados.length === 0 && invitadosIngresados.length === 0 ? (
            <Typography color="text.secondary">No hay ingresos registrados para esta ceremonia</Typography>
          ) : (
            <Box sx={{ display: 'grid', gap: 1 }}>
              {graduandosIngresados.map((graduando) => (
                <Box key={`graduando-${graduando.id}`} sx={{ border: '1px solid #E5EAF0', borderRadius: 2, p: 2 }}>
                  <Typography sx={{ fontWeight: 700, color: '#0B1A2A' }}>
                    {graduando.nombres} {graduando.apellidos}
                  </Typography>
                  <Typography sx={{ color: '#5A6A7A' }}>Graduando · Documento: {graduando.documento || '—'}</Typography>
                  <Typography sx={{ color: '#5A6A7A' }}>Hora de ingreso: {graduando.horaIngreso || 'No disponible'}</Typography>
                  <Typography sx={{ color: '#5A6A7A' }}>Sesión: {graduando.sesionLabel || 'Sin asignar'}</Typography>
                </Box>
              ))}
              {invitadosIngresados.map((invitado) => (
                <Box key={`invitado-${invitado.id}`} sx={{ border: '1px solid #E5EAF0', borderRadius: 2, p: 2 }}>
                  <Typography sx={{ fontWeight: 700, color: '#0B1A2A' }}>{invitado.nombre}</Typography>
                  <Typography sx={{ color: '#5A6A7A' }}>Invitado · Documento: {invitado.documento || '—'}</Typography>
                  <Typography sx={{ color: '#5A6A7A' }}>Hora de ingreso: {invitado.horaIngreso || 'No disponible'}</Typography>
                  <Typography sx={{ color: '#5A6A7A' }}>Graduando: {invitado.graduandoNombre}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}
    </ModalHistorial>
  );
}
