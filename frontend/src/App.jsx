
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import Login from './pages/MediosEducativos/Public/Login/Login';
import Dashboard from './pages/MediosEducativos/Admin/Dashboard/Dashboard';
import AdminLayout from './components/layout/AdminLayout';

import FormularioReserva from './pages/MediosEducativos/Public/Reserva/FormularioReserva';
import ConsultaDisponibilidad from './pages/MediosEducativos/Public/Reserva/ConsultaDisponibilidad';
import ConfirmacionReserva from './pages/MediosEducativos/Public/Reserva/Confirmacion';
import ConsultaEstado from './pages/MediosEducativos/Public/Reserva/ConsultaEstado';

import Solicitudes from './pages/MediosEducativos/Admin/Solicitudes/Solicitudes';
import DetalleSolicitud from './pages/MediosEducativos/Admin/Solicitudes/SolicitudDetalle';
import RechazarSolicitud from './pages/MediosEducativos/Admin/Solicitudes/RechazarSolicitud';
import Agenda from './pages/MediosEducativos/Admin/Agenda/Agenda';

import CeremoniasListado from './pages/MediosEducativos/Admin/Ceremonias/CeremoniasListado';
import NuevaCeremonia from './pages/MediosEducativos/Admin/Ceremonias/NuevaCeremonia';
import DetalleCeremonia from './pages/MediosEducativos/Admin/Ceremonias/DetalleCeremonia';
import ConfigurarSesion from './pages/MediosEducativos/Admin/Ceremonias/ConfigurarSesion';
import Graduandos from './pages/MediosEducativos/Admin/Ceremonias/Graduandos';
import GraduandoFormulario from './pages/MediosEducativos/Admin/Ceremonias/GraduandoFormulario';
import GraduandoDetalle from './pages/MediosEducativos/Admin/Ceremonias/GraduandoDetalle';
import Invitados from './pages/MediosEducativos/Admin/Ceremonias/Invitados';
import ControlIngreso from './pages/MediosEducativos/Admin/Ceremonias/ControlIngreso';

import GraduandoLogin from './pages/MediosEducativos/Graduando/GraduandoLogin';
import GraduandoCallback from './pages/MediosEducativos/Graduando/GraduandoCallback';
import GraduandoLayout from './pages/MediosEducativos/Graduando/GraduandoLayout';
import { getSession as getGraduandoSession } from './services/graduandoAuth.service';

import PublicLayout from './components/layout/PublicLayout';

function CeremoniasAdminLayout() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}

function RequireGraduando() {
  return getGraduandoSession()
    ? <Outlet />
    : <Navigate to="/graduando/login" replace />;
}

function hasAdminSession() {
  try {
    return Boolean(localStorage.getItem('me_admin_user'));
  } catch {
    return false;
  }
}

function RequireAdmin() {
  if (getGraduandoSession()) {
    return <Navigate to="/graduando/mis-invitados" replace />;
  }

  return hasAdminSession()
    ? <Outlet />
    : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Routes>
      {/* Redirección inicial */}
      <Route path="/" element={<Navigate to="/disponibilidad" replace />} />

      {/* Rutas públicas con header + footer */}
      <Route element={<PublicLayout />}>
        <Route path="/disponibilidad" element={<ConsultaDisponibilidad />} />
        <Route path="/reserva" element={<FormularioReserva />} />
        <Route path="/reserva/confirmacion" element={<ConfirmacionReserva />} />
        <Route path="/consulta-estado" element={<ConsultaEstado />} />
      </Route>

      {/* Login administrativo */}
      <Route path="/login" element={<Login />} />

      {/* Acceso separado de graduando */}
      <Route path="/graduando/login" element={<GraduandoLogin />} />
      <Route path="/graduando/callback" element={<GraduandoCallback />} />
      <Route path="/graduando" element={<RequireGraduando />}>
        <Route element={<GraduandoLayout />}>
          <Route path="mis-invitados" element={<GraduandoDetalle modoGraduando />} />
        </Route>
      </Route>

      {/* Rutas administrativas protegidas */}
      <Route path="/admin" element={<RequireAdmin />}>
        {/* Reservas */}
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="solicitudes" element={<Solicitudes />} />
        <Route path="solicitudes/:id" element={<DetalleSolicitud />} />
        <Route path="solicitudes/:id/rechazar" element={<RechazarSolicitud />} />
        <Route path="agenda" element={<Agenda />} />

        {/* Ceremonias */}
        <Route
          path="ceremonias"
          element={<Navigate to="/admin/eventos/ceremonias" replace />}
        />
        <Route path="eventos/ceremonias" element={<CeremoniasAdminLayout />}>
          <Route index element={<CeremoniasListado />} />
          <Route path="nueva" element={<NuevaCeremonia />} />
          <Route path=":id" element={<DetalleCeremonia />} />
          <Route path=":id/sesion/:sesionId" element={<ConfigurarSesion />} />
          <Route path=":id/graduandos" element={<Graduandos />} />
          <Route path=":id/graduandos/nuevo" element={<GraduandoFormulario />} />
          <Route path=":id/graduandos/:graduandoId" element={<GraduandoDetalle />} />
          <Route path=":id/invitados" element={<Invitados />} />
          <Route path=":id/control" element={<ControlIngreso />} />
        </Route>
      </Route>

      {/* Ruta no encontrada */}
      <Route path="*" element={<Navigate to="/disponibilidad" replace />} />
    </Routes>
  );
}

export default App;
