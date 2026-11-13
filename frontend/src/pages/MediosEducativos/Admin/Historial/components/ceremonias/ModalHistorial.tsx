import { useId, type ReactNode } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

interface Props {
  titulo: string;
  subtitulo?: string;
  onClose: () => void;
  children: ReactNode;
}

export default function ModalHistorial({ titulo, subtitulo, onClose, children }: Props) {
  const tituloId = useId();
  const subtituloId = useId();

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="md"
      scroll="paper"
      aria-labelledby={tituloId}
      aria-describedby={subtitulo ? subtituloId : undefined}
    >
      <DialogTitle id={tituloId} sx={{ fontWeight: 700, color: '#0B1A2A', pb: 1 }}>
        {titulo}
      </DialogTitle>
      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 } }}>
        {subtitulo && (
          <Typography id={subtituloId} sx={{ color: '#5A6A7A', mb: 2 }}>
            {subtitulo}
          </Typography>
        )}
        {children}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: '#0B3A5C' }}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
