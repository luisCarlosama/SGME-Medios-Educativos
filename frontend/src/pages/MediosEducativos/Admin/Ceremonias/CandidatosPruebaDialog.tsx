import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import type { ProgramaOption } from './interfaces/ceremonias.interface';
import { agregarCandidatoPrueba, listarCandidatosPrueba, type CandidatoPrueba } from './services/procesosGradoPrueba.service';

interface Props {
  open: boolean;
  ceremoniaId: string;
  periodo: string | null;
  programas: ProgramaOption[];
  onClose: () => void;
  onAdded: () => void;
}

export default function CandidatosPruebaDialog({ open, ceremoniaId, periodo, programas, onClose, onAdded }: Props) {
  const [candidatos, setCandidatos] = useState<CandidatoPrueba[]>([]);
  const [programaIds, setProgramaIds] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setCandidatos(await listarCandidatosPrueba(ceremoniaId));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar los candidatos ficticios.');
    }
  }, [ceremoniaId]);

  useEffect(() => { if (open) void cargar(); }, [open, cargar]);

  const agregar = async (candidato: CandidatoPrueba) => {
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      await agregarCandidatoPrueba(ceremoniaId, candidato.id, Number(programaIds[candidato.id]));
      setMensaje(`${candidato.nombres} ${candidato.apellidos} fue agregado a la ceremonia.`);
      onAdded();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible agregar el candidato.');
    } finally { setOcupado(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Candidatos ficticios · {periodo || 'Sin periodo'}</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>Datos ficticios aislados. Selecciona el programa de la aplicación para cada proceso antes de agregarlo.</Alert>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {mensaje && <Alert severity="success" sx={{ mb: 2 }}>{mensaje}</Alert>}
        {!error && candidatos.length === 0 && <Typography>No hay candidatos elegibles para este periodo.</Typography>}
        {candidatos.length > 0 && (
          <Table size="small">
            <TableHead><TableRow>{['Nombre', 'Documento', 'Programa de prueba', 'Estado', 'Programa en la aplicación', 'Acción'].map((titulo) => <TableCell key={titulo}>{titulo}</TableCell>)}</TableRow></TableHead>
            <TableBody>{candidatos.map((candidato) => (
              <TableRow key={candidato.id}>
                <TableCell>{candidato.nombres} {candidato.apellidos}</TableCell>
                <TableCell>{candidato.documento}</TableCell>
                <TableCell>{candidato.programa}</TableCell>
                <TableCell>{candidato.estado}</TableCell>
                <TableCell>
                  <TextField select size="small" value={programaIds[candidato.id] || ''}
                    onChange={(event) => setProgramaIds((actual) => ({ ...actual, [candidato.id]: event.target.value }))}
                    slotProps={{ select: { 'aria-label': `Programa para ${candidato.nombres} ${candidato.apellidos}` } }}
                    sx={{ minWidth: 180 }}>
                    <MenuItem value="">Selecciona un programa</MenuItem>
                    {programas.map((programa) => <MenuItem key={programa.id_programa} value={String(programa.id_programa)}>{programa.nombre}</MenuItem>)}
                  </TextField>
                </TableCell>
                <TableCell><Button disabled={ocupado || !programaIds[candidato.id]} onClick={() => void agregar(candidato)}>Agregar</Button></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions>
    </Dialog>
  );
}
