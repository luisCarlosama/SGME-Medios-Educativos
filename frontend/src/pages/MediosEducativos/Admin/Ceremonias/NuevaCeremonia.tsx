/**
 * Pantalla: Nueva ceremonia — Formulario
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, TextField, MenuItem, Card, CardContent,
} from '@mui/material';
import {
  createCeremonia,
  getCampusCeremonias,
  getEspaciosActivos,
  type CampusOption,
  type EspacioOption,
} from './services/ceremonias.service';

const campusPermitidos = new Set(['centro', 'san damian', 'santiago']);

function normalizarNombreCampus(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/^campus\s+/, '');
}

function nombreVisibleCampus(nombre: string): string {
  return nombre.replace(/^campus\s+/i, '');
}

export default function NuevaCeremonia() {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState('');
  const [campus, setCampus] = useState<CampusOption[]>([]);
  const [idCampus, setIdCampus] = useState('');
  const [espacios, setEspacios] = useState<EspacioOption[]>([]);
  const [idEspacio, setIdEspacio] = useState('');
  const [maxInvitadosPorGraduando, setMaxInvitadosPorGraduando] = useState(2);
  const [loadingCampus, setLoadingCampus] = useState(true);
  const [loadingEspacios, setLoadingEspacios] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    getCampusCeremonias()
      .then((campusDisponibles) => {
        if (!activo) return;
        const permitidos = campusDisponibles.filter((opcion) =>
          campusPermitidos.has(normalizarNombreCampus(opcion.nombre)),
        );
        setCampus(permitidos);
        if (permitidos.length === 0) {
          setError('No se encontraron los campus Centro, San Damián o Santiago.');
        }
      })
      .catch((cause) => {
        if (activo) {
          setError(cause instanceof Error ? cause.message : 'No fue posible cargar los campus.');
        }
      })
      .finally(() => {
        if (activo) setLoadingCampus(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    let activo = true;
    setIdEspacio('');
    setEspacios([]);
    if (!idCampus) {
      setLoadingEspacios(false);
      return () => {
        activo = false;
      };
    }

    setLoadingEspacios(true);
    getEspaciosActivos(idCampus)
      .then((espaciosActivos) => {
        if (activo) {
          setEspacios(espaciosActivos.filter((espacio) => /auditorio/i.test(espacio.nombre)));
        }
      })
      .catch((cause) => {
        if (activo) {
          setError(cause instanceof Error ? cause.message : 'No fue posible cargar los auditorios.');
        }
      })
      .finally(() => {
        if (activo) setLoadingEspacios(false);
      });

    return () => {
      activo = false;
    };
  }, [idCampus]);

  const handleCrear = async () => {
    setError('');
    if (!nombre.trim() || !fecha || !idCampus || !idEspacio) {
      setError('Completa el nombre, la fecha, el campus y el auditorio.');
      return;
    }
    setSaving(true);
    try {
      const c = await createCeremonia({
        nombre: nombre.trim(),
        fecha,
        idEspacio: Number(idEspacio),
        estado: 'Programada',
        maxInvitadosPorGraduando,
      });
      navigate(`/admin/eventos/ceremonias/${c.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible crear la ceremonia.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#0B1A2A', fontSize: '1.75rem', mb: 0.5 }}>
          Nueva ceremonia
        </Typography>
        <Typography sx={{ color: '#5A6A7A', fontSize: '0.875rem', mb: 0.5 }}>
          Eventos institucionales / Ceremonias de grado / Nueva ceremonia
        </Typography>
        <Typography sx={{ color: '#5A6A7A', fontSize: '0.9rem' }}>
          Registra la información general de la ceremonia para continuar con su configuración.
        </Typography>
      </Box>

      <Card elevation={0} sx={{ borderRadius: '12px', border: '1px solid #E5EAF0', backgroundColor: '#FFFFFF', maxWidth: 800 }}>
        <CardContent sx={{ p: 3.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#1565C0', letterSpacing: 0.5, mb: 0.5 }}>
            INFORMACIÓN GENERAL
          </Typography>
          <Typography sx={{ color: '#5A6A7A', fontSize: '0.875rem', mb: 0.5 }}>
            Datos generales para identificar y programar la ceremonia.
          </Typography>
          <Box sx={{ width: 40, height: 3, backgroundColor: '#E30613', mb: 2.5 }} />

          <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', color: '#1A2A3A', mb: 0.75 }}>
            Nombre de la ceremonia
          </Typography>
          <TextField fullWidth size="small" placeholder="Ingresa el nombre de la ceremonia"
            value={nombre} onChange={(e) => setNombre(e.target.value)}
            sx={{ mb: 2.5, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 3 }}>
            <Box>
              <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', color: '#1A2A3A', mb: 0.75 }}>Fecha</Typography>
              <TextField fullWidth size="small" type="date" slotProps={{ inputLabel: { shrink: true } }}
                required
                value={fecha} onChange={(e) => setFecha(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', color: '#1A2A3A', mb: 0.75 }}>Campus</Typography>
              <TextField select fullWidth size="small" value={idCampus}
                onChange={(e) => {
                  setError('');
                  setIdCampus(e.target.value);
                }}
                disabled={loadingCampus || campus.length === 0}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              >
                <MenuItem value="">{loadingCampus ? 'Cargando campus...' : 'Selecciona un campus'}</MenuItem>
                {campus.map((opcion) => (
                  <MenuItem key={opcion.id_campus} value={String(opcion.id_campus)}>
                    {nombreVisibleCampus(opcion.nombre)}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', color: '#1A2A3A', mb: 0.75 }}>Auditorio</Typography>
              <TextField select fullWidth size="small" value={idEspacio}
                onChange={(e) => setIdEspacio(e.target.value)}
                disabled={!idCampus || loadingEspacios}
                helperText={
                  !idCampus
                    ? 'Selecciona primero un campus.'
                    : loadingEspacios
                      ? 'Cargando auditorios...'
                      : espacios.length === 0
                        ? 'Este campus no tiene auditorios disponibles.'
                        : ''
                }
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              >
                <MenuItem value="">
                  {espacios.length === 0 && idCampus && !loadingEspacios
                    ? 'No hay auditorios disponibles'
                    : 'Selecciona un auditorio'}
                </MenuItem>
                {espacios.map((espacio) => (
                  <MenuItem key={espacio.id_espacio} value={String(espacio.id_espacio)}>
                    {espacio.nombre}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', color: '#1A2A3A', mb: 0.75 }}>Estado</Typography>
              <TextField fullWidth size="small" value="Programada"
                slotProps={{ input: { readOnly: true } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              />
            </Box>
          </Box>

          <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#1565C0', letterSpacing: 0.5, mb: 0.5 }}>
            INVITADOS
          </Typography>
          <Typography sx={{ color: '#5A6A7A', fontSize: '0.875rem', mb: 1.5 }}>
            Define cuántos invitados puede registrar cada graduando en esta ceremonia.
          </Typography>
          <Box sx={{ maxWidth: 380, mb: 3 }}>
            <TextField
              select
              fullWidth
              label="Máximo por graduando"
              value={maxInvitadosPorGraduando}
              onChange={(e) => setMaxInvitadosPorGraduando(Number(e.target.value))}
              helperText="El valor habitual es 2; puedes permitir hasta 4."
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            >
              {[2, 3, 4].map((limite) => (
                <MenuItem key={limite} value={limite}>{limite} invitados</MenuItem>
              ))}
            </TextField>
          </Box>

          {error && (
            <Typography role="alert" sx={{ color: '#B42318', fontSize: '0.875rem', mb: 2 }}>
              {error}
            </Typography>
          )}

          <Box sx={{ backgroundColor: '#F0F5FA', borderRadius: '10px', p: 2, mb: 3 }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#0B1A2A', mb: 0.4 }}>
              Siguiente paso
            </Typography>
            <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem' }}>
              Después de crear la ceremonia podrás configurar sus sesiones, horarios, programas y graduandos.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
            <Button variant="outlined" onClick={() => navigate('/admin/eventos/ceremonias')}
              sx={{ textTransform: 'none', fontWeight: 500, borderRadius: '8px', borderColor: '#C5CDD8', color: '#1A2A3A' }}>
              Cancelar
            </Button>
            <Button variant="contained" disabled={saving || loadingCampus || loadingEspacios || !nombre.trim()} onClick={handleCrear}
              sx={{
                backgroundColor: '#E30613', textTransform: 'none', fontWeight: 600, borderRadius: '8px',
                px: 2.5, boxShadow: 'none', '&:hover': { backgroundColor: '#C10510', boxShadow: 'none' },
              }}>
              Crear ceremonia
            </Button>
          </Box>
        </CardContent>
      </Card>
    </>
  );
}
