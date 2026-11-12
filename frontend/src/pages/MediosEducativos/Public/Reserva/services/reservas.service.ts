
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

export async function obtenerTiposEspacio() {
  return solicitar<any[]>("/reservas/tipos-espacio");
}

export async function obtenerEspacios(
  idCampus?: string,
  idTipoEspacio?: string
) {
  const parametros = new URLSearchParams();

  if (idCampus) parametros.set("id_campus", idCampus);
  if (idTipoEspacio) parametros.set("id_tipo_espacio", idTipoEspacio);

  const consulta = parametros.toString();

  return solicitar<any[]>(
    `/reservas/espacios${consulta ? `?${consulta}` : ""}`
  );
}

export async function obtenerCatalogosInstitucionales() {
  return solicitar<{
    dependencias: any[];
    programas: any[];
    areas: any[];
    departamentos: any[];
  }>("/reservas/catalogos-institucionales");
}

export async function obtenerProgramas() {
  const catalogos = await obtenerCatalogosInstitucionales();
  return catalogos.programas;
}

export async function obtenerDependencias() {
  const catalogos = await obtenerCatalogosInstitucionales();
  return catalogos.dependencias;
}

export async function obtenerAreas() {
  const catalogos = await obtenerCatalogosInstitucionales();
  return catalogos.areas;
}

export async function obtenerDepartamentos() {
  const catalogos = await obtenerCatalogosInstitucionales();
  return catalogos.departamentos;
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
export async function consultarSolicitudPorCodigo(codigo: string) {
  return solicitar<any>(`/reservas/codigo/${codigo}`);
}
// Consultas de la base de datos institucional (view_report)
// Consultas de la base de datos institucional (view_report)
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

// Consultas de la base de datos institucional (view_report)
// Consultas de la base de datos institucional (view_report)
// Consultas de la base de datos institucional (view_report)