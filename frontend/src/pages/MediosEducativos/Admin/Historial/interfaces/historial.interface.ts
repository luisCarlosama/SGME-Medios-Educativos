export interface HistorialRegistro {
  id: number;
  codigo: string;
  solicitante?: string;
  tipo?: "interno" | "externo";
  espacio?: string;
  campus?: string;
  fecha_inicio?: string;
  fecha?: string;
  hora_inicio?: string;
  hora_fin?: string;
  estado: string;
  programa?: string;
  fecha_registro?: string;
  fecha_actualizacion?: string;
}

export interface HistorialCeremonia {
  id: string | number;
  codigo: string;
  ceremonia: string;
  fecha: string;
  fechaLarga?: string;
  espacio?: string;
  campus?: string;
  estado: string;
  sesiones?: number | string;
  programasCount?: number | string;
  programas?: string;
  graduandos?: number;
  invitados?: number;
  ingresosRegistrados?: number;
}

export interface FiltrosHistorial {
  busqueda?: string;
  estado?: string;
  tipo?: string;
  campus?: string;
  anio?: string;
  mes?: string;
  programa?: string;
}