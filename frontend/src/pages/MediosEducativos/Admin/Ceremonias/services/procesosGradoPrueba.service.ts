import { fetchBackend } from '../../../../../services/api';

export interface EstadoGrado {
  id: number;
  nombre: string;
  elegible: boolean;
}

export interface CandidatoPrueba {
  id: string;
  nombres: string;
  apellidos: string;
  documento: string;
  codigo: string;
  programa: string;
  periodo: string;
  estado: string;
}

export interface SincronizacionPrueba {
  id: number;
  nombres: string;
  apellidos: string;
  ceremonia: string;
  estado: string;
  error: string | null;
}

async function solicitar<T>(url: string, body?: object): Promise<T> {
  const respuesta = await fetchBackend(url, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const resultado = await respuesta.json();
  if (!respuesta.ok) throw new Error(resultado.mensaje || 'No fue posible completar la operación de prueba.');
  return resultado as T;
}

export const listarEstadosGrado = () => solicitar<EstadoGrado[]>('/api/ceremonias/prueba/catalogo-estados');
export const guardarEstadoGrado = (nombre: string, elegible: boolean) =>
  solicitar<EstadoGrado>('/api/ceremonias/prueba/catalogo-estados', { nombre, elegible });
export const listarCandidatosPrueba = (id: string) =>
  solicitar<CandidatoPrueba[]>(`/api/ceremonias/${encodeURIComponent(id)}/prueba/candidatos`);
export const agregarCandidatoPrueba = (id: string, procesoId: string, programaId: number) =>
  solicitar<{ id: string }>(`/api/ceremonias/${encodeURIComponent(id)}/prueba/candidatos`, { procesoId, programaId });
export const listarSincronizacionesPrueba = () =>
  solicitar<SincronizacionPrueba[]>('/api/ceremonias/prueba/sincronizaciones');
export const reintentarSincronizacionesPrueba = () =>
  solicitar<{ actualizados: number; errores: number }>('/api/ceremonias/prueba/sincronizaciones/reintentar', {});
