/**
 * Servicio de Agenda por campus.
 * Conectado a la API real.
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:6001/api";


async function solicitar<T>(ruta: string, opciones?: RequestInit): Promise<T> {
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
      (datos as { mensaje?: string }).mensaje ||
        "No fue posible comunicarse con el servidor."
    );
  }

  return datos as T;
}


/**
 * Lista la agenda (solo aprobadas vigentes según el backend).
 * Filtros opcionales: busqueda, fecha, campus, tipo_espacio, espacio, tipo, hora_inicio, hora_fin
 */
export async function listarAgenda(filtros: Record<string, string> = {}) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const query = params.toString();
  return solicitar<any[]>(`/reservas/agenda${query ? `?${query}` : ""}`);
}