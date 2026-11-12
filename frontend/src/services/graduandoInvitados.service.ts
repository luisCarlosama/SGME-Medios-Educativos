import type { Invitado } from '../pages/MediosEducativos/Admin/Ceremonias/interfaces/ceremonias.interface';
import { addInvitado, getInvitados, updateInvitado } from '../pages/MediosEducativos/Admin/Ceremonias/services/ceremonias.service';
import { getCurrentGraduando } from './graduandoAuth.service';

export interface InvitadoInput {
  nombre: string;
  documento: string;
}

function requireGraduando() {
  const graduando = getCurrentGraduando();
  if (!graduando) throw new Error('Inicia sesión como graduando para gestionar invitados.');
  return graduando;
}

export async function getMisInvitados(): Promise<Invitado[]> {
  const graduando = requireGraduando();
  return getInvitados(graduando.ceremoniaId, graduando.id);
}

export async function addMiInvitado(input: InvitadoInput): Promise<Invitado> {
  const graduando = requireGraduando();
  return addInvitado({
    graduandoId: graduando.id,
    nombre: input.nombre.trim(),
    documento: input.documento.trim(),
  });
}

export async function updateMiInvitado(id: string, input: InvitadoInput): Promise<Invitado> {
  const invitados = await getMisInvitados();
  if (!invitados.some((invitado) => invitado.id === id)) {
    throw new Error('No se encontró el invitado de esta cuenta.');
  }

  const invitadoActualizado = await updateInvitado(id, {
    nombre: input.nombre.trim(),
    documento: input.documento.trim(),
  });
  if (!invitadoActualizado) throw new Error('No se encontró el invitado de esta cuenta.');
  return invitadoActualizado;
}