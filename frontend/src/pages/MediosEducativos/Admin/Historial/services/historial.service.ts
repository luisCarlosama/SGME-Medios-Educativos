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
    throw new Error(
      (datos as { mensaje?: string }).mensaje ||
        "No fue posible comunicarse con el servidor."
    );
  }

  return datos as T;
}

export async function listarHistorialReservas(
  filtros: Record<string, string> = {}
) {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return solicitar<any[]>(`/historial/reservas${query ? `?${query}` : ""}`);
}

export async function listarHistorialCeremonias(
  filtros: Record<string, string> = {}
) {
  const params = new URLSearchParams();
  params.set("estado", "Finalizada");
  if (filtros.nombre) params.set("nombre", filtros.nombre);
  if (filtros.fecha) params.set("fecha", filtros.fecha);

  const resultado = await solicitar<{ data: any[]; total: number }>(
    `/ceremonias?${params.toString()}`
  );
  return resultado.data || [];
}


export async function getReservaHistoricaById(id: string | number) {
  const data = await solicitar<any>(`/reservas/${id}`);

  return {
    id: data.id,
    codigo: data.codigo,
    ceremonia: data.nombre_actividad || "Reserva",
    fecha: data.fecha_inicio,
    fechaLarga: data.fecha_inicio
      ? `${data.fecha_inicio}${
          data.fecha_fin && data.fecha_fin !== data.fecha_inicio
            ? ` → ${data.fecha_fin}`
            : ""
        }`
      : "—",

    espacio: data.espacio?.nombre || "—",
    campus: data.espacio?.campus || "—",
    estado: data.estado,

    sesiones: "—",
    programasCount: data.solicitante?.programa ? 1 : "—",
    programas: data.solicitante?.programa || "—",
    graduandos: 0,
    invitados: 0,
    ingresosRegistrados: 0,

    // Datos completos de la reserva
    solicitante: data.solicitante,
    hora_inicio: data.hora_inicio,
    hora_fin: data.hora_fin,
    fecha_inicio: data.fecha_inicio,
    fecha_fin: data.fecha_fin,
    nombre_actividad: data.nombre_actividad,
    observaciones: data.observaciones,
    motivo_cancelacion: data.motivo_cancelacion,
    medios_requeridos: data.medios_requeridos,
    es_recurrente: data.es_recurrente,
    frecuencia_recurrencia: data.frecuencia_recurrencia,
    dias_semana: data.dias_semana,
    ocurrencias: data.ocurrencias,
    fecha_registro: data.fecha_registro,
    fecha_actualizacion: data.fecha_actualizacion,
  };
}

export async function getCeremoniaById(id: string | number) {
  const data = await solicitar<any>(`/ceremonias/${id}`);

  return {
    id: data.id,
    codigo: data.codigo,
    ceremonia: data.nombre,
    fecha: data.fecha,
    fechaLarga: data.fecha,
    espacio: data.lugar || "—",
    campus: data.campus || "—",
    estado: data.estado,
    sesiones: data.sesiones ?? "—",
    programasCount: "—",
    programas: "—",
    graduandos: data.graduandos ?? 0,
    invitados: data.invitados ?? 0,
    ingresosRegistrados: 0,
  };
}

export async function obtenerProgramasCatalogo() {
  const data = await solicitar<{ programas: { id_programa?: number; id?: number; nombre: string }[] }>(
    `/reservas/catalogos-institucionales`
  );

  return (data.programas || []).map((p) => ({
    id: p.id_programa ?? p.id ?? 0,
    nombre: p.nombre,
  }));
}