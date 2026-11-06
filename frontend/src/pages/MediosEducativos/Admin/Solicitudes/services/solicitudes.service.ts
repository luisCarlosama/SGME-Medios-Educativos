const API_URL = import.meta.env.VITE_API_URL || "http://localhost:6001/api";

async function solicitar<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...opciones?.headers,
    },
  });

  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new Error(datos.mensaje || "No fue posible comunicarse con el servidor.");
  }

  return datos;
}

export async function listarSolicitudes(filtros: Record<string, string> = {}) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const query = params.toString();
  return solicitar<any[]>(`/reservas/${query ? `?${query}` : ""}`);
}

export async function obtenerSolicitudPorId(id: number | string) {
  return solicitar<any>(`/reservas/${id}`);
}

export async function actualizarEstadoSolicitud(
  id: number | string,
  estado: "Aprobada" | "Rechazada" | "Cancelada",
  motivo?: string
) {
  return solicitar<any>(`/reservas/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado, motivo_cancelacion: motivo || null }),
  });
}

export async function actualizarSolicitud(
  id: number | string,
  datos: Record<string, unknown>
) {
  return solicitar<any>(`/reservas/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}
export async function obtenerSolicitudesParaExportar(tipo: "externas" | "internas" | "todas") {
  const filtros: Record<string, string> = {};

  if (tipo === "externas") filtros.tipo = "externo";
  if (tipo === "internas") filtros.tipo = "interno";

  return listarSolicitudes(filtros);
} 