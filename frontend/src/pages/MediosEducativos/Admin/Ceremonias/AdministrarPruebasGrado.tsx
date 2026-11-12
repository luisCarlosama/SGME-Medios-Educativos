import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, TextField, Typography } from '@mui/material';
import {
  guardarEstadoGrado, listarEstadosGrado, listarSincronizacionesPrueba, reintentarSincronizacionesPrueba,
  type EstadoGrado, type SincronizacionPrueba,
} from './services/procesosGradoPrueba.service';

export default function AdministrarPruebasGrado({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [estados, setEstados] = useState<EstadoGrado[]>([]);
  const [sincronizaciones, setSincronizaciones] = useState<SincronizacionPrueba[]>([]);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [catalogo, registros] = await Promise.all([listarEstadosGrado(), listarSincronizacionesPrueba()]);
      setEstados(catalogo);
      setSincronizaciones(registros);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar los datos de prueba.');
    }
  }, []);

  useEffect(() => { if (open) void cargar(); }, [open, cargar]);

  const guardar = async (valor: string, elegible: boolean) => {
    setOcupado(true);
    try {
      await guardarEstadoGrado(valor, elegible);
      setNombre('');
      await cargar();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible guardar el estado.');
    } finally { setOcupado(false); }
  };

  const reintentar = async () => {
    setOcupado(true);
    try {
      const resultado = await reintentarSincronizacionesPrueba();
      await cargar();
      if (resultado.errores) setError(`No se pudieron sincronizar ${resultado.errores} procesos. Revisa el detalle.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible reintentar.');
    } finally { setOcupado(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Administrar procesos ficticios</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>Solo para el entorno local de pruebas aislado. No modifica la base institucional.</Alert>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="h6">Estados elegibles</Typography>
        {estados.map((estado) => (
          <FormControlLabel key={estado.id}
            control={<Checkbox checked={estado.elegible} disabled={ocupado || estado.nombre.toLowerCase() === 'titulado'}
              onChange={(event) => void guardar(estado.nombre, event.target.checked)} />}
            label={estado.nombre}
          />
        ))}
        <Box sx={{ display: 'flex', gap: 1, my: 2 }}>
          <TextField size="small" label="Nuevo estado elegible" value={nombre} onChange={(event) => setNombre(event.target.value)} />
          <Button disabled={ocupado || !nombre.trim()} onClick={() => void guardar(nombre, true)}>Agregar</Button>
        </Box>
        <Typography variant="h6">Actualizaciones de prueba</Typography>
        {sincronizaciones.length === 0 && <Typography>No hay actualizaciones solicitadas.</Typography>}
        {sincronizaciones.map((item) => (
          <Typography key={item.id} sx={{ my: 0.5 }}>
            {item.nombres} {item.apellidos} · {item.ceremonia}: {item.estado}{item.error ? ` — ${item.error}` : ''}
          </Typography>
        ))}
        <Button disabled={ocupado || !sincronizaciones.some((item) => item.estado === 'Error' || item.estado === 'Pendiente')}
          onClick={() => void reintentar()}>Reintentar pendientes</Button>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions>
    </Dialog>
  );
}
