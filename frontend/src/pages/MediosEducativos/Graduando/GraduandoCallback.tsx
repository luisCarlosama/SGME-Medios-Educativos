import { useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { handleRuahCallback } from '../../../services/graduandoAuth.service';

export default function GraduandoCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void handleRuahCallback().then((session) => {
      if (!active) return;
      navigate(
        session ? '/graduando/mis-invitados' : '/graduando/login',
        {
          replace: true,
          state: session ? undefined : { message: 'No se recibió una sesión de RUAH. El acceso de prueba sigue disponible.' },
        },
      );
    });

    return () => { active = false; };
  }, [navigate]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', gap: 1 }}>
      <CircularProgress size={28} />
      <Typography sx={{ color: '#5A6A7A' }}>Preparando sesión de graduando…</Typography>
    </Box>
  );
}