import { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Tab, Tabs, TextField, Typography } from '@mui/material';
import type { Graduando, Invitado } from '../../../Ceremonias/interfaces/ceremonias.interface';
import { getGraduandos, getInvitados } from '../../../Ceremonias/services/ceremonias.service';
import ModalHistorial from './ModalHistorial';

interface Props {
  ceremoniaId: string;
  onClose: () => void;
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
}

export default function ModalParticipantesCeremonia({ ceremoniaId, onClose }: Props) {
  const [graduandos, setGraduandos] = useState<Graduando[]>([]);
  const [invitados, setInvitados] = useState<Invitado[]>([]);
  const [pestana, setPestana] = useState<'graduandos' | 'invitados'>('graduandos');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);
    Promise.all([getGraduandos(ceremoniaId), getInvitados(ceremoniaId)])
      .then(([resultadoGraduandos, resultadoInvitados]) => {
        if (activo) {
          setGraduandos(resultadoGraduandos.data);
          setInvitados(resultadoInvitados);
        }
      })
      .catch((err: unknown) => {
        if (activo) setError(err instanceof Error ? err.message : 'No fue posible consultar los participantes.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => { activo = false; };
  }, [ceremoniaId, intento]);

  const termino = normalizar(busqueda.trim());
  const graduandosFiltrados = graduandos.filter((graduando) =>
    normalizar(`${graduando.nombres} ${graduando.apellidos} ${graduando.documento} ${graduando.programa}`).includes(termino)
  );
  const invitadosFiltrados = invitados.filter((invitado) =>
    normalizar(`${invitado.nombre} ${invitado.documento} ${invitado.graduandoNombre}`).includes(termino)
  );
  const sinResultados = pestana === 'graduandos' ? graduandosFiltrados.length === 0 : invitadosFiltrados.length === 0;

  return (
    <ModalHistorial
      titulo="Graduandos e invitados"
      subtitulo="Consulta los participantes registrados en esta ceremonia."
      onClose={onClose}
    >
      {cargando ? (
        <Box role="status" sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} aria-label="Cargando participantes" />
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
          <Tabs
            value={pestana}
            onChange={(_, valor: 'graduandos' | 'invitados') => setPestana(valor)}
            variant="fullWidth"
            aria-label="Tipo de participantes"
            sx={{ mb: 2 }}
          >
            <Tab value="graduandos" label={`Graduandos (${graduandos.length})`} sx={{ textTransform: 'none' }} />
            <Tab value="invitados" label={`Invitados (${invitados.length})`} sx={{ textTransform: 'none' }} />
          </Tabs>
          <TextField
            fullWidth
            size="small"
            label={pestana === 'graduandos'
              ? 'Buscar por nombre, documento o programa'
              : 'Buscar por nombre, documento o graduando'}
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            sx={{ mb: 2 }}
          />
          {sinResultados ? (
            <Typography color="text.secondary">
              {termino
                ? 'No se encontraron participantes con esa búsqueda.'
                : pestana === 'graduandos'
                  ? 'No hay graduandos registrados para esta ceremonia.'
                  : 'No hay invitados registrados para esta ceremonia.'}
            </Typography>
          ) : (
            <Box sx={{ display: 'grid', gap: 1 }}>
              {pestana === 'graduandos'
                ? graduandosFiltrados.map((graduando) => (
                  <Box key={graduando.id} sx={{ border: '1px solid #E5EAF0', borderRadius: 2, p: 2 }}>
                    <Typography sx={{ fontWeight: 700, color: '#0B1A2A' }}>
                      {graduando.nombres} {graduando.apellidos}
                    </Typography>
                    <Typography sx={{ color: '#5A6A7A' }}>Documento: {graduando.documento || '—'}</Typography>
                    <Typography sx={{ color: '#5A6A7A' }}>Programa: {graduando.programa || '—'}</Typography>
                    <Typography sx={{ color: '#5A6A7A' }}>Sesión: {graduando.sesionLabel || 'Sin asignar'}</Typography>
                  </Box>
                ))
                : invitadosFiltrados.map((invitado) => (
                  <Box key={invitado.id} sx={{ border: '1px solid #E5EAF0', borderRadius: 2, p: 2 }}>
                    <Typography sx={{ fontWeight: 700, color: '#0B1A2A' }}>{invitado.nombre}</Typography>
                    <Typography sx={{ color: '#5A6A7A' }}>Documento: {invitado.documento || '—'}</Typography>
                    <Typography sx={{ color: '#5A6A7A' }}>Graduando: {invitado.graduandoNombre}</Typography>
                    <Typography sx={{ color: '#5A6A7A' }}>Parentesco: {invitado.parentesco || invitado.tipo || '—'}</Typography>
                  </Box>
                ))}
            </Box>
          )}
        </>
      )}
    </ModalHistorial>
  );
}
