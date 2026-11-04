import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import Login from './pages/MediosEducativos/Public/Login/Login';
import Dashboard from './pages/MediosEducativos/Admin/Dashboard/Dashboard';
import AdminLayout from './components/layout/AdminLayout';
import FormularioReserva from './pages/MediosEducativos/Public/Reserva/FormularioReserva';
import ConsultaDisponibilidad from './pages/MediosEducativos/Public/Reserva/ConsultaDisponibilidad';
import ConfirmacionReserva from './pages/MediosEducativos/Public/Reserva/Confirmacion';
import ConsultaEstado from './pages/MediosEducativos/Public/Reserva/ConsultaEstado';
import DetalleSolicitud from './pages/MediosEducativos/Admin/Solicitudes/SolicitudDetalle';
import RechazarSolicitud from './pages/MediosEducativos/Admin/Solicitudes/RechazarSolicitud';
import CeremoniasListado from './pages/MediosEducativos/Admin/Ceremonias/CeremoniasListado';
import NuevaCeremonia from './pages/MediosEducativos/Admin/Ceremonias/NuevaCeremonia';
import DetalleCeremonia from './pages/MediosEducativos/Admin/Ceremonias/DetalleCeremonia';
import ConfigurarSesion from './pages/MediosEducativos/Admin/Ceremonias/ConfigurarSesion';
import Graduandos from './pages/MediosEducativos/Admin/Ceremonias/Graduandos';
import GraduandoFormulario from './pages/MediosEducativos/Admin/Ceremonias/GraduandoFormulario';
import GraduandoDetalle from './pages/MediosEducativos/Admin/Ceremonias/GraduandoDetalle';
import Invitados from './pages/MediosEducativos/Admin/Ceremonias/Invitados';
import ControlIngreso from './pages/MediosEducativos/Admin/Ceremonias/ControlIngreso';



import PublicLayout from './components/layout/PublicLayout';

function CeremoniasAdminLayout() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
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

      {/* Login (normalmente sin el layout público completo) */}
      <Route path="/login" element={<Login />} />

      {/* Rutas administrativas */}
      <Route path="/admin/dashboard" element={<Dashboard />} />
      <Route path="/admin/solicitudes/:id" element={<DetalleSolicitud />} />
      <Route path="/admin/solicitudes/:id/rechazar" element={<RechazarSolicitud />} />
      <Route
        path="/admin/ceremonias"
        element={<Navigate to="/admin/eventos/ceremonias" replace />}
      />
      <Route path="/admin/eventos/ceremonias" element={<CeremoniasAdminLayout />}>
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

      {/* Ruta no encontrada */}
      <Route path="*" element={<Navigate to="/disponibilidad" replace />} />
    </Routes>
  );
}

export default App;