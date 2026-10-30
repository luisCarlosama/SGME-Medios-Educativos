import { Navigate, Route, Routes } from 'react-router-dom';

import Login from './pages/MediosEducativos/Public/Login/Login';
import Dashboard from './pages/MediosEducativos/Admin/Dashboard/Dashboard';
import FormularioReserva from './pages/MediosEducativos/Public/Reserva/FormularioReserva';
import ConsultaDisponibilidad from './pages/MediosEducativos/Public/Reserva/ConsultaDisponibilidad';
import ConfirmacionReserva from './pages/MediosEducativos/Public/Reserva/Confirmacion';
import ConsultaEstado from './pages/MediosEducativos/Public/Reserva/ConsultaEstado';
import DetalleSolicitud from './pages/MediosEducativos/Admin/Solicitudes/SolicitudDetalle';
import RechazarSolicitud from './pages/MediosEducativos/Admin/Solicitudes/RechazarSolicitud';






import PublicLayout from './components/layout/PublicLayout';

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

      {/* Ruta no encontrada */}
      <Route path="*" element={<Navigate to="/disponibilidad" replace />} />
    </Routes>
  );
}

export default App;