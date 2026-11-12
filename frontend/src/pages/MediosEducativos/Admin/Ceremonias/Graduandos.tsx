/**
 * Pantalla: Graduandos — Listado
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Typography, Button, TextField, MenuItem, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Card, CardContent,
  CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import StorageIcon from '@mui/icons-material/Storage';
import type { Ceremonia, Graduando, GraduandoFilters, ProgramaOption, Sesion } from './interfaces/ceremonias.interface';
import { getGraduandos, getCeremoniaById, getProgramasCatalogo, getSesiones, getGraduandosInstitucionales, type GraduandoInstitucional } from './services/ceremonias.service';
import ImportarGraduandosDialog from './ImportarGraduandosDialog';
import CandidatosPruebaDialog from './CandidatosPruebaDialog';

export default function Graduandos() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const programaFiltroInicial = searchParams.get('programa') || '';
  const [items, setItems] = useState<Graduando[]>([]);
  const [stats, setStats] = useState({ total: 0, revisados: 0, errores: 0 });
  const [ceremonia, setCeremonia] = useState<Ceremonia | null>(null);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [programas, setProgramas] = useState<ProgramaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<GraduandoFilters>(() =>
    programaFiltroInicial ? { programa: programaFiltroInicial } : {}
  );
  const [importOpen, setImportOpen] = useState(false);
  const [consultaOpen, setConsultaOpen] = useState(false);
  const [candidatosOpen, setCandidatosOpen] = useState(false);
  const [paginaInstitucional, setPaginaInstitucional] = useState(1);
  const [graduandosInstitucionales, setGraduandosInstitucionales] = useState<GraduandoInstitucional[]>([]);
  const [haySiguiente, setHaySiguiente] = useState(false);
  const [cargandoInstitucional, setCargandoInstitucional] = useState(false);
  const [errorInstitucional, setErrorInstitucional] = useState('');
  const programaFiltroVisible = filters.programa
    && programas.some((programa) => String(programa.id_programa) === filters.programa)
    ? filters.programa
    : 'Todos los programas';

  const load = useCallback(async (f?: GraduandoFilters) => {
    if (!id) return;
    setLoading(true);
    try {
      const [res, c] = await Promise.all([
        getGraduandos(id, f),
        getCeremoniaById(id),
      ]);
      setItems(res.data);
      setStats(res.stats);
      setCeremonia(c);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No fue posible cargar los graduandos.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load(programaFiltroInicial ? { programa: programaFiltroInicial } : {});
  }, [load, programaFiltroInicial]);

  useEffect(() => {
    if (!id) return;
    Promise.all([getSesiones(id), getProgramasCatalogo()])
      .then(([sesionesActivas, programasDisponibles]) => {
        setSesiones(sesionesActivas);
        setProgramas(programasDisponibles.filter((programa) => programa.estado));
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : 'No fue posible cargar las opciones de filtro.');
      });
  }, [id]);

  useEffect(() => {
    if (!consultaOpen) return;
    let vigente = true;
    setCargandoInstitucional(true);
    setErrorInstitucional('');
    getGraduandosInstitucionales(paginaInstitucional)
      .then((resultado) => {
        if (!vigente) return;
        setGraduandosInstitucionales(resultado.data);
        setHaySiguiente(resultado.haySiguiente);
      })
      .catch((consultaError: unknown) => {
        if (!vigente) return;
        setGraduandosInstitucionales([]);
        setHaySiguiente(false);
        setErrorInstitucional(consultaError instanceof Error ? consultaError.message : 'No fue posible consultar los graduandos.');
      })
      .finally(() => { if (vigente) setCargandoInstitucional(false); });
    return () => { vigente = false; };
  }, [consultaOpen, paginaInstitucional]);

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#0B1A2A', fontSize: '1.75rem', mb: 0.5 }}>
            Graduandos
          </Typography>
          <Typography sx={{ color: '#5A6A7A', fontSize: '0.875rem' }}>
            Eventos institucionales / Ceremonias de grado / Graduandos
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<AddIcon />}
            onClick={() => navigate(`/admin/eventos/ceremonias/${id}/graduandos/nuevo`)}
            sx={{ textTransform: 'none', fontWeight: 500, borderRadius: '8px', borderColor: '#C5CDD8', color: '#1A2A3A' }}>
            + Agregar graduando
          </Button>
          <Button variant="contained" onClick={() => setImportOpen(true)} sx={{
            backgroundColor: '#0B3A5C', textTransform: 'none', fontWeight: 600, borderRadius: '8px',
            boxShadow: 'none', '&:hover': { backgroundColor: '#062A42', boxShadow: 'none' },
          }}>
            Importar graduandos
          </Button>
          <Button variant="outlined" startIcon={<StorageIcon />} onClick={() => setConsultaOpen(true)}
            sx={{ textTransform: 'none', borderRadius: '8px', borderColor: '#C5CDD8', color: '#1A2A3A' }}>
            Consultar base de prueba
          </Button>
          {import.meta.env.DEV && (
            <Button variant="outlined" onClick={() => setCandidatosOpen(true)}>Candidatos ficticios</Button>
          )}
        </Box>
      </Box>

      <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: '#0B1A2A', mt: 1 }}>
        {ceremonia?.nombre.replace(/ — Ejemplo \d+/, '') || 'Ceremonia de grados'}
      </Typography>
      <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem', mb: 2 }}>
        {ceremonia ? `${ceremonia.fecha} · ${ceremonia.lugar}` : 'Fecha · Lugar'}
      </Typography>

      {/* Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 3 }}>
        {[
          { label: 'Total de graduandos', value: stats.total },
          { label: 'Registros revisados', value: stats.revisados },
          { label: 'Registros con errores', value: stats.errores, red: true },
          { label: 'Registros activos', value: items.filter((graduando) => graduando.estado).length },
        ].map((s) => (
          <Card key={s.label} elevation={0} sx={{ borderRadius: '10px', border: '1px solid #E5EAF0' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography sx={{ color: '#5A6A7A', fontSize: '0.8rem', mb: 0.5 }}>{s.label}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', color: s.red ? '#E30613' : '#0B1A2A' }}>
                {loading ? '—' : s.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Filtros */}
      <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: '#1A2A3A', mb: 1 }}>Consultar graduandos</Typography>
      <Box sx={{
        backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5EAF0',
        p: 2, mb: 2.5, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center',
      }}>
        <TextField size="small" placeholder="Buscar por nombre o documento"
          value={filters.search || ''}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          sx={{ flex: 1, minWidth: 180, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
        />
        <TextField select size="small" label="Sesión" value={filters.sesion || 'Todas las sesiones'}
          onChange={(e) => setFilters({ ...filters, sesion: e.target.value })}
          sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}>
          <MenuItem value="Todas las sesiones">Todas las sesiones</MenuItem>
          <MenuItem value="sin-asignar">Sin asignar</MenuItem>
          {sesiones.map((sesion) => <MenuItem key={sesion.id} value={sesion.id}>{sesion.nombre}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Programa académico" value={programaFiltroVisible}
          onChange={(e) => setFilters({ ...filters, programa: e.target.value })}
          sx={{ minWidth: 170, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}>
          <MenuItem value="Todos los programas">Todos los programas</MenuItem>
          {programas.map((programa) => <MenuItem key={programa.id_programa} value={String(programa.id_programa)}>{programa.nombre}</MenuItem>)}
        </TextField>
        <Button variant="contained" onClick={() => load(filters)}
          sx={{ backgroundColor: '#0B3A5C', textTransform: 'none', fontWeight: 600, borderRadius: '8px', '&:hover': { backgroundColor: '#062A42' } }}>
          Buscar
        </Button>
        <Button variant="text" onClick={() => { setFilters({}); load({}); }}
          sx={{ color: '#5A6A7A', textTransform: 'none' }}>
          Limpiar filtros
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Tabla */}
      <TableContainer sx={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5EAF0', overflow: 'hidden', mb: 2.5 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#FAFBFC' }}>
              {['Graduando', 'Documento', 'Programa', 'Sesión', 'Invitados', 'Acción'].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 600, color: '#1A2A3A', fontSize: '0.85rem', borderBottom: '1px solid #E5EAF0', py: 1.75 }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: '#5A6A7A' }}>Cargando…</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: '#5A6A7A' }}>No hay graduandos para los filtros seleccionados.</TableCell></TableRow>
            ) : items.map((g) => (
              <TableRow key={g.id} sx={{ '&:hover': { backgroundColor: '#F8FAFC' }, '& td': { borderBottom: '1px solid #F0F3F7' } }}>
                <TableCell sx={{ fontWeight: 600, color: '#1A2A3A', fontSize: '0.875rem' }}>
                  {g.nombres} {g.apellidos}
                </TableCell>
                <TableCell sx={{ color: '#1A2A3A', fontSize: '0.875rem' }}>{g.documento}</TableCell>
                <TableCell sx={{ color: '#1A2A3A', fontSize: '0.875rem' }}>{g.programa}</TableCell>
                <TableCell sx={{ color: '#1A2A3A', fontSize: '0.875rem' }}>{g.sesionLabel || 'Sin asignar'}</TableCell>
                <TableCell sx={{ color: '#1A2A3A', fontSize: '0.875rem' }}>
                  {g.invitadosCount} invitado{g.invitadosCount !== 1 ? 's' : ''}
                </TableCell>
                <TableCell>
                  <Button variant="text"
                    onClick={() => navigate(`/admin/eventos/ceremonias/${id}/graduandos/${g.id}`)}
                    sx={{ color: '#1565C0', textTransform: 'none', fontWeight: 500, fontSize: '0.875rem', p: 0, minWidth: 'auto',
                      '&:hover': { backgroundColor: 'transparent', textDecoration: 'underline' } }}>
                    Ver detalle
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Importar bloque */}
      <Card elevation={0} sx={{ borderRadius: '12px', border: '1px solid #E5EAF0' }}>
        <CardContent sx={{ p: 2.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#0B1A2A', mb: 0.5 }}>
            Importar graduandos
          </Typography>
          <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem', mb: 1.5 }}>
            1 Cargar archivo → 2 Revisar → 3 Validar → 4 Confirmar / Importar
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography sx={{ fontWeight: 500, fontSize: '0.9rem', color: '#1A2A3A' }}>
                Importa hasta 1.000 graduandos desde una plantilla .xlsx.
              </Typography>
              <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem' }}>
                La vista previa reporta errores y no guarda nada hasta que confirmes.
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => setImportOpen(true)}
              sx={{ textTransform: 'none', borderRadius: '8px', borderColor: '#C5CDD8', color: '#1A2A3A' }}>
                Abrir importador
              </Button>
          </Box>
          <Typography sx={{ color: '#5A6A7A', fontSize: '0.8rem', mt: 1.5 }}>
            Los invitados se registran posteriormente desde el detalle del graduando.
          </Typography>
        </CardContent>
      </Card>
      <ImportarGraduandosDialog
        open={importOpen}
        ceremoniaId={id || ''}
        onClose={() => setImportOpen(false)}
        onImported={() => { void load(filters); }}
      />
      <CandidatosPruebaDialog open={candidatosOpen} ceremoniaId={id || ''} periodo={ceremonia?.periodoGrado ?? null}
        programas={programas} onClose={() => setCandidatosOpen(false)} onAdded={() => { void load(filters); }} />
      <Dialog open={consultaOpen} onClose={() => setConsultaOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Graduandos de la base de prueba</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#5A6A7A', fontSize: '0.875rem', mb: 2 }}>
            Vista previa local. Estos registros no están asociados a la ceremonia.
          </Typography>
          {errorInstitucional && <Alert severity="error" sx={{ mb: 2 }}>{errorInstitucional}</Alert>}
          {cargandoInstitucional ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
          ) : !errorInstitucional && graduandosInstitucionales.length === 0 ? (
            <Typography sx={{ py: 3, textAlign: 'center', color: '#5A6A7A' }}>No hay registros en esta página.</Typography>
          ) : (
            <TableContainer>
              <Table size="small" sx={{ minWidth: 700 }}>
                <TableHead><TableRow>
                  {['Graduando', 'Documento', 'Programa', 'Código', 'Estado', 'Periodo'].map((columna) => (
                    <TableCell key={columna} sx={{ fontWeight: 600 }}>{columna}</TableCell>
                  ))}
                </TableRow></TableHead>
                <TableBody>
                  {graduandosInstitucionales.map((graduando, index) => (
                    <TableRow key={`${graduando.codigo}-${graduando.documento}-${index}`}>
                      <TableCell>{graduando.nombre || '—'}</TableCell>
                      <TableCell>{graduando.documento || '—'}</TableCell>
                      <TableCell>{graduando.programa || '—'}</TableCell>
                      <TableCell>{graduando.codigo || '—'}</TableCell>
                      <TableCell>{graduando.estado || '—'}</TableCell>
                      <TableCell>{graduando.periodo || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', px: 3, pb: 2 }}>
          <Button disabled={paginaInstitucional === 1 || cargandoInstitucional} onClick={() => setPaginaInstitucional((pagina) => pagina - 1)}>Anterior</Button>
          <Typography sx={{ fontSize: '0.875rem' }}>Página {paginaInstitucional}</Typography>
          <Button disabled={!haySiguiente || cargandoInstitucional} onClick={() => setPaginaInstitucional((pagina) => pagina + 1)}>Siguiente</Button>
          <Button onClick={() => setConsultaOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
