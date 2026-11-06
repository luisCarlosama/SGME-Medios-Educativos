import { AppBar, Avatar, Box, Button, Toolbar, Typography } from '@mui/material';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { Outlet, useNavigate } from 'react-router-dom';
import { getCurrentGraduando, logout } from '../../../services/graduandoAuth.service';

export default function GraduandoLayout() {
  const navigate = useNavigate();
  const graduando = getCurrentGraduando();
  const nombre = graduando ? `${graduando.nombres} ${graduando.apellidos}` : 'Graduando';

  const handleLogout = () => {
    logout();
    navigate('/graduando/login', { replace: true });
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#F5F7FA' }}>
      <AppBar position="static" elevation={0} sx={{ backgroundColor: '#FFFFFF', color: '#102A3A', borderBottom: '1px solid #DDE4E9' }}>
        <Toolbar sx={{ minHeight: 72, gap: 1.5, px: { xs: 2, sm: 3 } }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ color: '#102A3A', fontWeight: 800, fontSize: '0.95rem' }}>
              MEDIOS EDUCATIVOS
            </Typography>
            <Typography sx={{ color: '#697B88', fontSize: '0.75rem' }}>
              Portal del graduando · Acceso de prueba
            </Typography>
          </Box>
          <Avatar sx={{ width: 34, height: 34, bgcolor: '#0B3A5C', fontSize: '0.85rem' }}>
            {nombre.charAt(0)}
          </Avatar>
          <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: '0.875rem', fontWeight: 600 }}>
            {nombre}
          </Typography>
          <Button onClick={handleLogout} startIcon={<LogoutOutlinedIcon />} color="inherit" sx={{ textTransform: 'none', ml: { xs: 0, sm: 1 } }}>
            Cerrar sesión
          </Button>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ width: '100%', maxWidth: 1240, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}