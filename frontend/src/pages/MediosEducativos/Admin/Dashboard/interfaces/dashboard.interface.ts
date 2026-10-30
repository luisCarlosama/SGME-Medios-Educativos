
export interface DashboardStats {
  solicitudesPendientes: number;
  solicitudesExternas: number;
  solicitudesInternas: number;
  reservasHoy: number;
}

export interface SolicitudReciente {
  id: string;
  codigo: string;
  solicitante: string;
  espacio: string;
  campus: string;
  tipoSolicitud: 'Interna' | 'Externa';
  fecha: string;
  estado: 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Cancelada';
}

export interface DashboardData {
  stats: DashboardStats;
  solicitudesRecientes: SolicitudReciente[];
}
