import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { DEMO_GRADUANDO_CREDENTIALS, getSession, loginWithRuah } from '../../../services/graduandoAuth.service';

export default function GraduandoLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [documento, setDocumento] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    (location.state as { message?: string } | null)?.message ?? '',
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getSession()) navigate('/graduando/mis-invitados', { replace: true });
  }, [navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!documento.trim() || !password) {
      setError('Ingresa tu documento y contraseña.');
      return;
    }

    setLoading(true);
    try {
      await loginWithRuah(documento, password);
      navigate('/graduando/mis-invitados', { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'No fue posible iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 4,
        backgroundColor: '#F2F5F7',
      }}
    >
      <Paper
        component="form"
        noValidate
        onSubmit={handleSubmit}
        elevation={0}
        sx={{ width: '100%', maxWidth: 440, p: { xs: 3, sm: 4 }, border: '1px solid #DDE4E9', borderRadius: 2 }}
      >
        <Typography sx={{ color: '#E30613', fontSize: '0.75rem', fontWeight: 800, letterSpacing: 0.6 }}>
          MEDIOS EDUCATIVOS
        </Typography>
        <Typography variant="h5" sx={{ color: '#102A3A', fontWeight: 700, mt: 1 }}>
          Acceso de graduando
        </Typography>
        <Typography sx={{ color: '#5A6A7A', fontSize: '0.9rem', mt: 0.75, mb: 2.5 }}>
          Ingresa para consultar y gestionar tus invitados.
        </Typography>

        <Alert severity="warning" sx={{ mb: 2 }}>
          ACCESO DE PRUEBA. Usa el documento de un graduando importado y la contraseña de demostración. RUAH no está integrado.
        </Alert>

        {error && <Alert severity="error" role="alert" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          fullWidth
          required
          label="Documento"
          value={documento}
          onChange={(event) => setDocumento(event.target.value)}
          autoComplete="username"
          slotProps={{ htmlInput: { maxLength: 20 } }}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          required
          type="password"
          label="Contraseña"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          sx={{ mb: 2.5 }}
        />
        <Button type="submit" variant="contained" fullWidth disabled={loading} sx={{ py: 1.15, backgroundColor: '#E30613' }}>
          {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
        </Button>

        <Box sx={{ mt: 2.5, p: 1.5, backgroundColor: '#F7F9FA', border: '1px solid #E5EAF0', borderRadius: 1 }}>
          <Typography sx={{ color: '#34495A', fontSize: '0.8rem', fontWeight: 700, mb: 0.5 }}>
            Credenciales de prueba
          </Typography>
          <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem' }}>
            Documento de ejemplo: {DEMO_GRADUANDO_CREDENTIALS.documento}
          </Typography>
          <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem' }}>
            Contraseña: {DEMO_GRADUANDO_CREDENTIALS.password}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}