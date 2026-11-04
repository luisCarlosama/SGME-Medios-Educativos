import { useState, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Avatar,
  Collapse,
  IconButton,
  Badge,
} from '@mui/material';
import { styled } from '@mui/material/styles';

import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CelebrationOutlinedIcon from '@mui/icons-material/CelebrationOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';

const DRAWER_WIDTH = 250;

const Sidebar = styled(Drawer)({
  width: DRAWER_WIDTH,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: DRAWER_WIDTH,
    boxSizing: 'border-box',
    backgroundColor: '#0B1F33', // más oscuro, más cercano al Figma
    color: '#FFFFFF',
    borderRight: 'none',
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    flexDirection: 'column',
  },
});

const TopBar = styled(Box)({
  height: 72,
  minHeight: 72,
  backgroundColor: '#FFFFFF',
  borderBottom: '1px solid #CBD5E1', // línea más visible
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: '28px',
  paddingRight: '28px',
  position: 'sticky',
  top: 0,
  zIndex: 10,
});

interface AdminLayoutProps {
  children: ReactNode;
}

const subMenuItems = [
  {
    label: 'Dashboard',
    path: '/admin/dashboard',
    icon: <DashboardOutlinedIcon />,
  },
  {
    label: 'Solicitudes',
    path: '/admin/solicitudes',
    icon: <AssignmentOutlinedIcon />,
  },
  {
    label: 'Agenda',
    path: '/admin/agenda',
    icon: <CalendarMonthOutlinedIcon />,
  },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [reservasOpen, setReservasOpen] = useState(
    ['/admin/dashboard', '/admin/solicitudes', '/admin/agenda'].includes(
      location.pathname
    )
  );

  const reservasActivas = subMenuItems.some(
    (item) => item.path === location.pathname
  );

  const mainItems = [
    {
      label: 'Ceremonias',
      path: '/admin/eventos/ceremonias',
      icon: <CelebrationOutlinedIcon />,
    },
    {
      label: 'Inventario',
      path: '/admin/inventario',
      icon: <Inventory2OutlinedIcon />,
    },
    {
      label: 'Préstamos',
      path: '/admin/prestamos',
      icon: <HandshakeOutlinedIcon />,
    },
    {
      label: 'Historial',
      path: '/admin/historial',
      icon: <HistoryOutlinedIcon />,
    },
  ];

  const itemStyles = (active: boolean) => ({
    borderRadius: '8px',
    mb: 0.15,
    py: 0.85,
    px: 1.5,
    color: '#FFFFFF',
    backgroundColor: active ? '#2563EB' : 'transparent',
    '&:hover': {
      backgroundColor: active ? '#1D4ED8' : 'rgba(255,255,255,0.08)',
    },
  });

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: '#F5F7FA',
      }}
    >
      {/* ========== SIDEBAR ========== */}
      <Sidebar variant="permanent" anchor="left">
        {/* Logo */}
        <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: '1.15rem',
              lineHeight: 1.1,
              letterSpacing: '0.3px',
              color: '#FFFFFF',
            }}
          >
            SGME
          </Typography>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '0.68rem',
              letterSpacing: '0.5px',
              color: 'rgba(255,255,255,0.8)',
              mt: 0.2,
              textTransform: 'uppercase',
            }}
          >
            MEDIOS EDUCATIVOS
          </Typography>
        </Box>

        {/* MENÚ PRINCIPAL */}
        <Box sx={{ px: 2.5, mb: 0.5 }}>
          <Typography
            sx={{
              fontSize: '0.65rem',
              fontWeight: 600,
              letterSpacing: '0.7px',
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
            }}
          >
            MENÚ PRINCIPAL
          </Typography>
        </Box>

        <List
          sx={{
            flex: 1,
            px: 1.25,
            py: 0,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {/* Reservas (colapsable) */}
          <ListItemButton
            onClick={() => setReservasOpen(!reservasOpen)}
            sx={itemStyles(reservasActivas && !subMenuItems.some(i => i.path === location.pathname))}
          >
            <ListItemIcon sx={{ minWidth: 36, color: '#FFFFFF' }}>
              <CalendarMonthOutlinedIcon fontSize="small" />
            </ListItemIcon>

            <ListItemText
              primary="Reservas"
              primaryTypographyProps={{
                fontSize: '0.9rem',
                fontWeight: 500,
              }}
            />

            {reservasOpen ? (
              <ExpandMoreIcon sx={{ fontSize: 18 }} />
            ) : (
              <ChevronRightIcon sx={{ fontSize: 18 }} />
            )}
          </ListItemButton>

          <Collapse in={reservasOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {subMenuItems.map((item) => {
                const active = location.pathname === item.path;

                return (
                  <ListItemButton
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    sx={{
                      ...itemStyles(active),
                      pl: 2.5,        // menos indentación
                      py: 0.75,
                      ml: 0,
                      width: '100%',
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 34, color: '#FFFFFF' }}>
                      {item.icon}
                    </ListItemIcon>

                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                        fontWeight: active ? 600 : 400,
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Collapse>

          {/* Resto de items */}
          {mainItems.map((item) => {
            const active =
              location.pathname === item.path ||
              location.pathname.startsWith(`${item.path}/`);

            return (
              <ListItemButton
                key={item.path}
                onClick={() => navigate(item.path)}
                sx={itemStyles(active)}
              >
                <ListItemIcon sx={{ minWidth: 36, color: '#FFFFFF' }}>
                  {item.icon}
                </ListItemIcon>

                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.9rem',
                    fontWeight: active ? 600 : 400,
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>

        {/* Footer del sidebar */}
        <Box sx={{ p: 1.5, mt: 'auto' }}>
          <Box
            sx={{
              backgroundColor: 'rgba(0,0,0,0.22)',
              borderRadius: '10px',
              p: 1.5,
              color: '#FFFFFF',
            }}
          >
            <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', mb: 0.3 }}>
              Panel administrativo
            </Typography>
            <Typography
              sx={{
                fontSize: '0.7rem',
                color: 'rgba(255,255,255,0.65)',
                lineHeight: 1.4,
              }}
            >
              Gestión centralizada de reservas, espacios y ceremonias.
            </Typography>
          </Box>
        </Box>
      </Sidebar>

      {/* ========== CONTENIDO PRINCIPAL ========== */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* TopBar */}
        <TopBar>
          {/* Título a la izquierda */}
          <Typography
            sx={{
              fontWeight: 600,
              color: '#0B3A5C',
              fontSize: '0.95rem',
              letterSpacing: '0.3px',
            }}
          >
            MEDIOS EDUCATIVOS
          </Typography>

          {/* Derecha */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography
              sx={{
                fontSize: '0.8rem',
                color: '#64748B',
                display: { xs: 'none', sm: 'block' },
              }}
            >
              Panel administrativo
            </Typography>

            <IconButton size="small" sx={{ color: '#64748B' }}>
              <Badge
                color="error"
                variant="dot"
                overlap="circular"
                sx={{ '& .MuiBadge-badge': { top: 4, right: 4 } }}
              >
                <NotificationsNoneOutlinedIcon fontSize="small" />
              </Badge>
            </IconButton>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: '#2563EB',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                A
              </Avatar>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: '#1A2A3A',
                  display: { xs: 'none', md: 'block' },
                }}
              >
                Administrador
              </Typography>
            </Box>
          </Box>
        </TopBar>

        {/* Contenido de la página */}
        <Box
          component="main"
          sx={{
            flex: 1,
            px: { xs: 2, md: 4 },   // ← separación izquierda y derecha
            py: { xs: 2, md: 3 },     // ← separación arriba y abajo
            minWidth: 0,
            overflow: 'auto',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}