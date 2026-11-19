const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:6001/api";

async function solicitar<T>(
  ruta: string,
  opciones?: RequestInit
): Promise<T> {
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      ...opciones?.headers,
    },
  });

  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new Error(
      datos.mensaje || "No fue posible comunicarse con el servidor."
    );
  }

  return datos;
}

export async function obtenerCampus() {
  return solicitar<any[]>("/reservas/campus");
}

export async function obtenerTiposEspacio(idCampus?: number | string) {
  const parametros = new URLSearchParams();

  if (idCampus) {
    parametros.set("id_campus", String(idCampus));
  }

  const consulta = parametros.toString();

  return solicitar<any[]>(
    `/reservas/tipos-espacio${consulta ? `?${consulta}` : ""}`
  );
}

export async function obtenerEspacios(
  idCampus?: number | string,
  idTipoEspacio?: number | string
) {
  const parametros = new URLSearchParams();

  if (idCampus) parametros.set("id_campus", String(idCampus));
  if (idTipoEspacio) parametros.set("id_tipo_espacio", String(idTipoEspacio));

  const consulta = parametros.toString();

  return solicitar<any[]>(
    `/reservas/espacios${consulta ? `?${consulta}` : ""}`
  );
}

export async function obtenerCatalogosInstitucionales() {
  return solicitar<{
    dependencias: { id_dependencia: number; nombre: string }[];
    facultades: { id_facultad: number; nombre: string }[];
    programas: {
      id_programa: number;
      nombre: string;
      id_facultad: number;
    }[];
  }>("/reservas/catalogos-institucionales");
}

// Funciones de compatibilidad para componentes que aún consulten estos catálogos.
// Los programas conservan id_facultad para permitir su filtrado en el formulario.
export async function obtenerProgramas() {
  const catalogos = await obtenerCatalogosInstitucionales();
  return catalogos.programas;
}

export async function obtenerDependencias() {
  const catalogos = await obtenerCatalogosInstitucionales();
  return catalogos.dependencias;
}

export async function crearSolicitud(datos: Record<string, unknown>) {
  return solicitar<{
    mensaje: string;
    solicitud: {
      id: number;
      codigo: string;
      estado: string;
    };
  }>("/reservas/", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export async function consultarDisponibilidad(datos: {
  id_espacio: string | number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
}) {
  const parametros = new URLSearchParams({
    id_espacio: String(datos.id_espacio),
    fecha: datos.fecha,
    hora_inicio: datos.hora_inicio,
    hora_fin: datos.hora_fin,
  });

  return solicitar<{
    disponible: boolean;
    id_espacio: number;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
  }>(`/reservas/disponibilidad?${parametros.toString()}`);
}

export async function obtenerAgendaDia(
  idEspacio: number,
  fecha: string
) {
  const parametros = new URLSearchParams({
    id_espacio: String(idEspacio),
    fecha,
  });

  return solicitar<{
    id_espacio: number;
    fecha: string;
    reservas: any[];
  }>(`/reservas/agenda-dia?${parametros.toString()}`);
}

export async function obtenerAgendaMes(
  idEspacio: number,
  anio: number,
  mes: number
) {
  const parametros = new URLSearchParams({
    id_espacio: String(idEspacio),
    anio: String(anio),
    mes: String(mes),
  });

  return solicitar<{
    id_espacio: number;
    anio: number;
    mes: number;
    reservas: any[];
  }>(`/reservas/agenda-mes?${parametros.toString()}`);
}

export async function obtenerAgendaMesGeneral(
  anio: number,
  mes: number
) {
  const parametros = new URLSearchParams({
    anio: String(anio),
    mes: String(mes),
  });

  return solicitar<{
    anio: number;
    mes: number;
    fecha_inicio: string;
    fecha_fin: string;
    total_reservas: number;
    reservas: any[];
  }>(`/reservas/agenda-mes-general?${parametros.toString()}`);
}

export async function consultarSolicitudPorCodigo(codigo: string) {
  return solicitar<any>(`/reservas/codigo/${encodeURIComponent(codigo)}`);
}

// Consultas de la base de datos institucional (view_report)
export async function obtenerCampusInstitucional() {
  return solicitar<any[]>("/institucional/campus");
}

export async function obtenerDependenciasInstitucionales() {
  return solicitar<any[]>("/institucional/dependencias");
}

export async function obtenerFacultadesInstitucionales() {
  return solicitar<any[]>("/institucional/facultades");
}

export async function obtenerProgramasInstitucionales() {
  return solicitar<any[]>("/institucional/programas");
}
