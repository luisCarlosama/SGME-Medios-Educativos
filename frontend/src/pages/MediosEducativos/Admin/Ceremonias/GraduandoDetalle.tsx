/**
 * Pantalla: Graduando + invitados — Detalle
 * Modales: Editar graduando, Agregar invitado, Editar invitado
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, IconButton, CircularProgress, Card, CardContent,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import type { Graduando, Invitado, ProgramaOption, Sesion } from './interfaces/ceremonias.interface';
import {
  getGraduandoById, getInvitados, updateInvitado, addInvitado,
  getProgramasCatalogo, getSesiones, updateGraduando,
} from './services/ceremonias.service';
import { getCurrentGraduando } from '../../../../services/graduandoAuth.service';
import {
  addMiInvitado, getMisInvitados, updateMiInvitado,
} from '../../../../services/graduandoInvitados.service';

interface GraduandoDetalleProps {
  modoGraduando?: boolean;
}

export default function GraduandoDetalle({ modoGraduando = false }: GraduandoDetalleProps) {
  const routeParams = useParams<{ id: string; graduandoId: string }>();
  const currentGraduando = modoGraduando ? getCurrentGraduando() : null;
  const id = routeParams.id ?? currentGraduando?.ceremoniaId;
  const graduandoId = routeParams.graduandoId ?? currentGraduando?.id;
  const navigate = useNavigate();
  const [graduando, setGraduando] = useState<Graduando | null>(null);
  const [invitados, setInvitados] = useState<Invitado[]>([]);
  const [programas, setProgramas] = useState<ProgramaOption[]>([]);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [savingGraduando, setSavingGraduando] = useState(false);
  const [invError, setInvError] = useState('');
  const [savingInvitado, setSavingInvitado] = useState(false);

  // Modals
  const [editGradOpen, setEditGradOpen] = useState(false);
  const [addInvOpen, setAddInvOpen] = useState(false);
  const [editInvOpen, setEditInvOpen] = useState(false);
  const [selectedInv, setSelectedInv] = useState<Invitado | null>(null);

  // Form states
  const [formNombres, setFormNombres] = useState('');
  const [formApellidos, setFormApellidos] = useState('');
  const [formDoc, setFormDoc] = useState('');
  const [formTel, setFormTel] = useState('');
  const [formCorreo, setFormCorreo] = useState('');
  const [formCodigo, setFormCodigo] = useState('');
  const [formPrograma, setFormPrograma] = useState('');
  const [formSesion, setFormSesion] = useState('');
  const [invNombre, setInvNombre] = useState('');
  const [invDoc, setInvDoc] = useState('');

  const load = useCallback(async () => {
    if (!modoGraduando && (!graduandoId || !id)) return;
    setLoading(true);
    try {
      let g: Graduando | null;

      if (modoGraduando) {
        const perfil = getCurrentGraduando();
        if (!perfil) throw new Error('La sesión de graduando no está disponible.');
        g = perfil;
        setInvitados(await getMisInvitados());
        setProgramas([]);
        setSesiones([]);
      } else if (id && graduandoId) {
        const [graduandoActual, invitadosActuales, programasDisponibles, sesionesDisponibles] = await Promise.all([
          getGraduandoById(graduandoId),
          getInvitados(id, graduandoId),
          getProgramasCatalogo(),
          getSesiones(id),
        ]);
        g = graduandoActual;
        setInvitados(invitadosActuales);
        setProgramas(programasDisponibles.filter((programa) => programa.estado));
        setSesiones(sesionesDisponibles);
      } else {
        return;
      }

      setGraduando(g);
      setLoadError('');
      if (g) {
        setFormNombres(g.nombres);
        setFormApellidos(g.apellidos);
        setFormDoc(g.documento);
        setFormTel(g.telefono || '');
        setFormCorreo(g.correo || '');
        setFormCodigo(g.codigoEstudiantil || '');
        const programasGraduando = g.programaIds ?? [];
        setFormPrograma(
          programasGraduando.length === 1 ? String(programasGraduando[0]) : '',
        );
        setFormSesion(g.sesionId || '');
      }
    } catch (loadFailure) {
      setLoadError(loadFailure instanceof Error ? loadFailure.message : 'No fue posible cargar el detalle del graduando.');
    } finally {
      setLoading(false);
    }
  }, [id, modoGraduando, graduandoId]);

  useEffect(() => { load(); }, [load]);

  const programaSeleccionado = programas.find(
    (programa) => String(programa.id_programa) === formPrograma,
  );
  const sesionesCompatibles = sesiones.filter((sesionActual) =>
    Boolean(programaSeleccionado && (
      sesionActual.programaIds?.includes(programaSeleccionado.id_programa)
      ?? sesionActual.programas.includes(programaSeleccionado.nombre)
    ))
  );
  const programaId = graduando?.programaIds?.[0];

  const handleSaveGraduando = async () => {
    if (!graduandoId || !graduando) return;
    if (!formPrograma) {
      setFormError('Selecciona un programa académico.');
      return;
    }
    setSavingGraduando(true);
    setFormError('');
    try {
      const actualizado = await updateGraduando(graduandoId, {
        nombres: formNombres,
        apellidos: formApellidos,
        documento: formDoc,
        telefono: formTel,
        correo: formCorreo,
        codigoEstudiantil: formCodigo,
        programaIds: [Number(formPrograma)],
        idSesion: formSesion || null,
        estado: graduando.estado ?? true,
        requisitosCumplidos: graduando.requisitosCumplidos ?? false,
        tallaToga: graduando.tallaToga,
      });
      setGraduando(actualizado);
      setEditGradOpen(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'No fue posible actualizar el graduando.');
    } finally {
      setSavingGraduando(false);
    }
  };

  const openEditInv = (inv: Invitado) => {
    setSelectedInv(inv);
    setInvNombre(inv.nombre);
    setInvDoc(inv.documento);
    setInvError('');
    setEditInvOpen(true);
  };

  const handleSaveInv = async () => {
    if (!invNombre.trim()) {
      setInvError('Ingresa el nombre del invitado.');
      return;
    }
    setSavingInvitado(true);
    setInvError('');
    try {
      let invitadoGuardado: Invitado | null = null;
      if (modoGraduando) {
        const input = {
          nombre: invNombre,
          documento: invDoc,
        };
        invitadoGuardado = selectedInv
          ? await updateMiInvitado(selectedInv.id, input)
          : await addMiInvitado(input);
      } else if (selectedInv) {
        invitadoGuardado = await updateInvitado(selectedInv.id, {
          nombre: invNombre,
          documento: invDoc,
        });
      } else if (graduandoId) {
        invitadoGuardado = await addInvitado({
          graduandoId,
          nombre: invNombre,
          documento: invDoc,
        });
      }
      if (!invitadoGuardado) {
        throw new Error('No fue posible guardar el invitado.');
      }
      setInvitados((actuales) => selectedInv
        ? actuales.map((invitado) => invitado.id === invitadoGuardado?.id ? invitadoGuardado : invitado)
        : [...actuales, invitadoGuardado]);
      setEditInvOpen(false);
      setAddInvOpen(false);
      setSelectedInv(null);
    } catch (saveError) {
      setInvError(saveError instanceof Error ? saveError.message : 'No fue posible guardar el invitado.');
    } finally {
      setSavingInvitado(false);
    }
  };

  if (loading) {
    return (
      <>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#0B3A5C' }} />
        </Box>
      </>
    );
  }

  const ingresos = invitados.filter((i) => i.estadoIngreso === 'Ingresó').length;
  const registrosSinAutorizacion = invitados.filter((i) => i.autorizacion !== 'Autorizado').length;

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#0B1A2A', fontSize: '1.75rem', mb: 0.5 }}>
          Graduando + invitados — Detalle
        </Typography>
        <Typography sx={{ color: '#5A6A7A', fontSize: '0.875rem' }}>
          {modoGraduando
            ? 'Consulta tu ficha y gestiona tus invitados.'
            : ''}
        </Typography>
      </Box>
      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}
      {modoGraduando && (
        <Alert severity="info" sx={{ mb: 2 }}>
          ACCESO DE PRUEBA. La ficha y los invitados proceden de los registros importados; los cambios se guardan en la base de datos. RUAH aún no está integrado.
        </Alert>
      )}

      {/* Breadcrumb bar */}
      {modoGraduando ? (
        <Box sx={{
          backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E5EAF0',
          borderLeft: '4px solid #E30613', px: 2.5, py: 1.5, mb: 2.5,
        }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#0B1A2A' }}>
            Ceremonia de grados
          </Typography>
          <Typography sx={{ color: '#5A6A7A', fontSize: '0.8rem' }}>
            {graduando?.sesionLabel || 'Sesión asociada'}
          </Typography>
        </Box>
      ) : (
      <Box sx={{
        backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E5EAF0',
        borderLeft: '4px solid #E30613', px: 2.5, py: 1.5, mb: 2.5,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1,
      }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#0B1A2A' }}>Ceremonia de grados</Typography>
          <Typography sx={{ color: '#5A6A7A', fontSize: '0.8rem' }}>Fecha · Lugar</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.25 }}>
          <Button
            size="small"
            disabled={!id}
            onClick={() => navigate(`/admin/eventos/ceremonias/${id}`)}
            sx={{ color: '#1565C0', fontSize: '0.75rem', fontWeight: 600, letterSpacing: 0.5, minWidth: 0 }}
          >
            CEREMONIA
          </Button>
          <Typography aria-hidden="true" sx={{ color: '#1565C0', fontSize: '0.75rem' }}>→</Typography>
          <Button
            size="small"
            disabled={!id || !graduando?.sesionId}
            onClick={() => navigate(`/admin/eventos/ceremonias/${id}/sesion/${graduando?.sesionId}`)}
            sx={{ color: '#1565C0', fontSize: '0.75rem', fontWeight: 600, letterSpacing: 0.5, minWidth: 0 }}
          >
            SESIÓN
          </Button>
          <Typography aria-hidden="true" sx={{ color: '#1565C0', fontSize: '0.75rem' }}>→</Typography>
          <Button
            size="small"
            disabled={!id || !programaId}
            onClick={() => {
              if (!id || !programaId) return;
              navigate(`/admin/eventos/ceremonias/${id}/graduandos?programa=${encodeURIComponent(String(programaId))}`);
            }}
            sx={{ color: '#1565C0', fontSize: '0.75rem', fontWeight: 600, letterSpacing: 0.5, minWidth: 0 }}
          >
            PROGRAMA
          </Button>
          <Typography aria-hidden="true" sx={{ color: '#1565C0', fontSize: '0.75rem' }}>→</Typography>
          <Typography aria-current="page" sx={{ color: '#1565C0', fontSize: '0.75rem', fontWeight: 600, letterSpacing: 0.5, px: 1 }}>
            GRADUANDO
          </Typography>
        </Box>
      </Box>
      )}

      {/* Info graduando */}
      <Card elevation={0} sx={{ borderRadius: '12px', border: '1px solid #E5EAF0', mb: 2.5 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#0B1A2A' }}>Información del graduando</Typography>
              <Box sx={{ width: 40, height: 3, backgroundColor: '#E30613', mt: 0.5 }} />
            </Box>
            {!modoGraduando && (
              <Button variant="text" onClick={() => setEditGradOpen(true)}
                sx={{ color: '#1565C0', textTransform: 'none', fontWeight: 500, fontSize: '0.875rem' }}>
                Editar →
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            {[
              { label: 'Nombre completo', value: graduando ? `${graduando.nombres} ${graduando.apellidos}` : '—' },
              { label: 'Programa académico', value: graduando?.programa || '—' },
              { label: 'Documento', value: graduando?.documento || '—' },
              { label: 'Sesión', value: graduando?.sesionLabel || 'Sesión asociada' },
              { label: 'Código estudiantil', value: graduando?.codigoEstudiantil || 'No registrado' },
              { label: 'Horario de la sesión', value: 'Según configuración de la sesión' },
            ].map((f) => (
              <Box key={f.label}>
                <Typography sx={{ color: '#5A6A7A', fontSize: '0.8rem' }}>{f.label}</Typography>
                <Typography sx={{ fontWeight: 600, color: '#1A2A3A', fontSize: '0.9rem' }}>{f.value}</Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Stats invitados */}
      <Box sx={{
        backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E5EAF0',
        px: 2.5, py: 1.75, mb: 2.5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
      }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', color: '#0B1A2A' }}>{invitados.length}</Typography>
        <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem' }}>Invitados registrados</Typography>
        <Chip label={`${ingresos} Ingresaron`} size="small" sx={{ backgroundColor: '#E6F4EA', color: '#1B7A3D', fontWeight: 600 }} />
        <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem', ml: 'auto' }}>
          Invitados asociados al registro del graduando
        </Typography>
      </Box>

      {/* Relación de invitados */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#0B1A2A' }}>Relación de invitados</Typography>
          <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem' }}>
            Los invitados registrados quedan autorizados automáticamente.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />}
          onClick={() => { setSelectedInv(null); setInvNombre(''); setInvDoc(''); setInvError(''); setAddInvOpen(true); }}
          sx={{
            backgroundColor: '#E30613', textTransform: 'none', fontWeight: 600, borderRadius: '8px',
            boxShadow: 'none', '&:hover': { backgroundColor: '#C10510', boxShadow: 'none' },
          }}>
          Agregar invitado
        </Button>
      </Box>

      {registrosSinAutorizacion > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Hay {registrosSinAutorizacion} registro(s) antiguo(s) sin autorización que requieren revisión antes del ingreso.
        </Alert>
      )}
      <TableContainer sx={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5EAF0', overflow: 'hidden', mb: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#FAFBFC' }}>
              {['Invitado', 'Documento', 'Ingreso', 'Acción'].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 600, color: '#1A2A3A', fontSize: '0.85rem', borderBottom: '1px solid #E5EAF0', py: 1.5 }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {invitados.map((inv) => (
              <TableRow key={inv.id} sx={{ '& td': { borderBottom: '1px solid #F0F3F7' } }}>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{inv.nombre}</TableCell>
                <TableCell sx={{ fontSize: '0.875rem' }}>{inv.documento}</TableCell>
                <TableCell>
                  <Chip label={inv.estadoIngreso ?? 'No disponible'} size="small" sx={{
                    backgroundColor: inv.estadoIngreso === 'Ingresó' ? '#E6F4EA' : '#FFF4E5',
                    color: inv.estadoIngreso === 'Ingresó' ? '#1B7A3D' : '#B76E00',
                    fontWeight: 600, fontSize: '0.75rem', height: 24,
                  }} />
                </TableCell>
                <TableCell>
                  <Button variant="text" onClick={() => openEditInv(inv)}
                    sx={{ color: '#1565C0', textTransform: 'none', fontWeight: 500, fontSize: '0.875rem', p: 0, minWidth: 'auto' }}>
                    Editar →
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2,
        backgroundColor: '#F8FAFC', borderRadius: '8px', p: 1.5,
      }}>
        <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem' }}>
          Los invitados son registrados por el graduando y quedan asociados a su registro.
        </Typography>
        <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem' }}>
          {modoGraduando
            ? 'Tus invitados quedan asociados a tu registro.'
            : 'El ingreso se registra posteriormente desde Control de ingreso por sesión.'}
        </Typography>
      </Box>

      {!modoGraduando && (
        <Button variant="outlined" onClick={() => navigate(`/admin/eventos/ceremonias/${id}/graduandos`)}
          sx={{ textTransform: 'none', borderRadius: '8px', borderColor: '#C5CDD8', color: '#1A2A3A' }}>
          Volver a graduandos
        </Button>
      )}

      {/* Modal Editar graduando */}
      <Dialog open={editGradOpen && !modoGraduando} onClose={() => setEditGradOpen(false)} maxWidth="md" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '12px' } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Editar graduando
          <IconButton onClick={() => setEditGradOpen(false)} sx={{ position: 'absolute', right: 12, top: 12 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Typography sx={{ color: '#5A6A7A', fontSize: '0.875rem', mb: 2 }}>
            Actualiza la información del graduando registrado en la ceremonia.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 0.5 }}>Información personal</Typography>
              <Box sx={{ width: 40, height: 3, backgroundColor: '#E30613', mb: 1.5 }} />
              <TextField fullWidth size="small" label="Nombres" value={formNombres} onChange={(e) => setFormNombres(e.target.value)} sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
              <TextField fullWidth size="small" label="Apellidos" value={formApellidos} onChange={(e) => setFormApellidos(e.target.value)} sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
              <TextField fullWidth size="small" label="Documento" value={formDoc} onChange={(e) => setFormDoc(e.target.value.replace(/\D/g, ''))} sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
              <TextField fullWidth size="small" label="Teléfono" value={formTel} onChange={(e) => setFormTel(e.target.value)} sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
              <TextField fullWidth size="small" label="Correo electrónico" value={formCorreo} onChange={(e) => setFormCorreo(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 0.5 }}>Información académica</Typography>
              <Box sx={{ width: 40, height: 3, backgroundColor: '#E30613', mb: 1.5 }} />
              <TextField fullWidth size="small" label="Código estudiantil" value={formCodigo} onChange={(e) => setFormCodigo(e.target.value)} sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
              <TextField
                select
                fullWidth
                size="small"
                label="Programa académico"
                value={formPrograma}
                helperText={(graduando?.programaIds?.length ?? 0) > 1
                  ? 'Este registro tiene varios programas. Selecciona uno para conservarlo al guardar.'
                  : undefined}
                onChange={(e) => {
                  const seleccionado = e.target.value;
                  setFormPrograma(seleccionado);
                  const sesionActual = sesiones.find((sesionItem) => sesionItem.id === formSesion);
                  const programa = programas.find(
                    (item) => String(item.id_programa) === seleccionado,
                  );
                  const coincide = Boolean(programa && sesionActual && (
                    sesionActual.programaIds?.includes(programa.id_programa)
                    ?? sesionActual.programas.includes(programa.nombre)
                  ));
                  if (!coincide) setFormSesion('');
                }} sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}>
                <MenuItem value="">Selecciona un programa</MenuItem>
                {programas.map((programa) => (
                  <MenuItem key={programa.id_programa} value={String(programa.id_programa)}>
                    {programa.nombre}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select fullWidth size="small" label="Sesión" value={formSesion}
                onChange={(e) => setFormSesion(e.target.value)}
                helperText={
                  sesiones.length === 0
                    ? 'No hay sesiones configuradas para esta ceremonia.'
                    : sesionesCompatibles.length === 0
                      ? 'No hay sesiones asociadas a los programas académicos de este graduando.'
                      : 'Solo se muestran sesiones asociadas a sus programas académicos.'
                }
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}>
                <MenuItem value="">Sin asignar</MenuItem>
                {sesionesCompatibles.map((sesion) => <MenuItem key={sesion.id} value={sesion.id}>{sesion.nombre}</MenuItem>)}
              </TextField>
              <Typography sx={{ color: '#5A6A7A', fontSize: '0.8rem', mt: 1 }}>
                Los campos muestran la información actual registrada del graduando.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditGradOpen(false)} sx={{ textTransform: 'none', color: '#5A6A7A' }}>Cancelar</Button>
          <Button variant="contained" disabled={savingGraduando} onClick={handleSaveGraduando}
            sx={{ backgroundColor: '#0B3A5C', textTransform: 'none', fontWeight: 600, borderRadius: '8px', '&:hover': { backgroundColor: '#062A42' } }}>
            {savingGraduando ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Agregar / Editar invitado */}
      <Dialog open={addInvOpen || editInvOpen} onClose={() => { setAddInvOpen(false); setEditInvOpen(false); }} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '12px' } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editInvOpen ? 'Editar invitado' : 'Agregar invitado'}
          <IconButton onClick={() => { setAddInvOpen(false); setEditInvOpen(false); }} sx={{ position: 'absolute', right: 12, top: 12 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {invError && <Alert severity="error" sx={{ mb: 2 }}>{invError}</Alert>}
          <Typography sx={{ color: '#5A6A7A', fontSize: '0.875rem', mb: 2 }}>
            Actualiza la información del invitado asociado al graduando.
          </Typography>
          <TextField fullWidth size="small" label="Nombre" value={invNombre} onChange={(e) => setInvNombre(e.target.value)}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
          <TextField fullWidth size="small" label="Documento" value={invDoc}
            onChange={(e) => setInvDoc(e.target.value.replace(/\D/g, ''))}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => { setAddInvOpen(false); setEditInvOpen(false); }} sx={{ textTransform: 'none', color: '#5A6A7A' }}>
            Cancelar
          </Button>
          <Button variant="contained" disabled={savingInvitado} onClick={handleSaveInv}
            sx={{
              backgroundColor: '#E30613', textTransform: 'none', fontWeight: 600, borderRadius: '8px',
              boxShadow: 'none', '&:hover': { backgroundColor: '#C10510', boxShadow: 'none' },
            }}>
            {savingInvitado ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
