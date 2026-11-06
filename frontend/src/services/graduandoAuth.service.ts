import type { Graduando } from '../pages/MediosEducativos/Admin/Ceremonias/interfaces/ceremonias.interface';
import { getGraduandoByDocumento } from '../pages/MediosEducativos/Admin/Ceremonias/services/ceremonias.service';

export type GraduandoProfile = Graduando;

export interface GraduandoSession {
  authProvider: 'demo' | 'ruah';
  accessToken: string | null;
  graduando: GraduandoProfile;
}

export const DEMO_GRADUANDO_CREDENTIALS = {
  documento: '9100000101',
  password: 'demo123',
};

const SESSION_STORAGE_KEY = 'me_graduando_session';

export async function loginWithRuah(
  documento: string,
  password: string,
): Promise<GraduandoSession> {
  // TODO Desarrollo: sustituir el acceso compartido de prueba por autenticación y autorización RUAH.
  if (!documento.trim() || password !== DEMO_GRADUANDO_CREDENTIALS.password) {
    throw new Error('Documento o contraseña incorrectos.');
  }

  const graduando = await getGraduandoByDocumento(documento.trim());
  if (!graduando) {
    throw new Error('No se encontró un graduando con ese documento en una ceremonia activa.');
  }

  const session: GraduandoSession = {
    authProvider: 'demo',
    accessToken: null,
    graduando,
  };

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function handleRuahCallback(): Promise<GraduandoSession | null> {
  const callbackParams = new URLSearchParams(window.location.search);

  // TODO Desarrollo: validar state, intercambiar el code y normalizar la identidad/token de RUAH.
  // Hasta conectar el proveedor, un callback externo nunca crea una sesión de graduando.
  if (callbackParams.has('code') || callbackParams.has('error')) {
    return null;
  }

  return getSession();
}

export function logout(): void {
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function getSession(): GraduandoSession | null {
  const serializedSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!serializedSession) return null;

  try {
    const session = JSON.parse(serializedSession) as GraduandoSession;
    return session?.graduando?.documento && session.graduando.ceremoniaId
      ? session
      : null;
  } catch {
    return null;
  }
}

export function getCurrentGraduando(): GraduandoProfile | null {
  return getSession()?.graduando ?? null;
}

/*
 * NOTAS PARA DESARROLLO (RUAH pendiente, no integrado):
 * - Conectar el inicio/redirección al proveedor en loginWithRuah y validar state/code en handleRuahCallback.
 * - Guardar el token real de forma segura y mapear la identidad a GraduandoProfile.
 * - El backend debe validar la identidad y autorizar cada consulta y cambio de invitados.
 * - La ruta frontend de retorno preparada es /graduando/callback; la sesión normalizada se consume
 *   en /graduando/mis-invitados. El acceso compartido actual solo es apto para pruebas.
 */