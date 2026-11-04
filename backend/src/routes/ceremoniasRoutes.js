import { Router } from 'express';
import {
  crearCeremonia,
  guardarFotografiasCeremonia,
  listarGraduandosCeremonia,
  listarProgramasCeremonia,
  listarCeremonias,
  listarSesionesCeremonia,
  obtenerCeremoniaPorId,
  obtenerFotografiasCeremonia,
} from '../controllers/ceremoniasController.js';
import {
  agregarInvitado,
  agregarInvitadosLote,
  actualizarCupoInvitados,
  actualizarEstadoCeremonia,
  actualizarGraduando,
  actualizarInvitado,
  actualizarMaxInvitadosPorGraduando,
  actualizarSesion,
  buscarGraduandosControlIngreso,
  confirmarImportacionGraduandos,
  crearGraduando,
  crearSesion,
  iniciarSesionGraduando,
  listarInvitadosCeremonia,
  listarInvitadosControlIngreso,
  obtenerEstadisticasControlIngreso,
  obtenerGraduandoPorDocumento,
  obtenerGraduandoPorId,
  obtenerSesionPorId,
  registrarIngresoGraduando,
  registrarIngresoInvitado,
  validarImportacionGraduandos,
} from '../controllers/ceremoniasOperacionesController.js';

const router = Router();

router.get('/', listarCeremonias);
router.post('/', crearCeremonia);
router.get('/programas', listarProgramasCeremonia);
router.post('/registro-invitados/login', iniciarSesionGraduando);
router.get('/sesiones/:id', obtenerSesionPorId);
router.patch('/sesiones/:id', actualizarSesion);
router.get('/graduandos/documento/:documento', obtenerGraduandoPorDocumento);
router.get('/graduandos/:id', obtenerGraduandoPorId);
router.patch('/graduandos/:id', actualizarGraduando);
router.post('/graduandos/:id/invitados/lote', agregarInvitadosLote);
router.post('/graduandos/:id/invitados', agregarInvitado);
router.patch('/invitados/:id', actualizarInvitado);
router.post('/invitados/:id/ingreso', registrarIngresoInvitado);
router.patch('/:id/cupo-invitados', actualizarCupoInvitados);
router.patch('/:id/max-invitados-por-graduando', actualizarMaxInvitadosPorGraduando);
router.patch('/:id/estado', actualizarEstadoCeremonia);
router.get('/:id/sesiones', listarSesionesCeremonia);
router.post('/:id/sesiones', crearSesion);
router.get('/:id/fotografias', obtenerFotografiasCeremonia);
router.patch('/:id/fotografias', guardarFotografiasCeremonia);
router.get('/:id/graduandos', listarGraduandosCeremonia);
router.post('/:id/graduandos', crearGraduando);
router.post('/:id/graduandos/importacion/validar', validarImportacionGraduandos);
router.post('/:id/graduandos/importacion/confirmar', confirmarImportacionGraduandos);
router.get('/:id/invitados', listarInvitadosCeremonia);
router.get('/:id/control-ingreso', obtenerEstadisticasControlIngreso);
router.get('/:id/control-ingreso/graduandos', buscarGraduandosControlIngreso);
router.get(
  '/:id/control-ingreso/graduandos/:graduandoId/invitados',
  listarInvitadosControlIngreso,
);
router.post(
  '/:id/graduandos/:graduandoId/ingreso',
  registrarIngresoGraduando,
);
router.get('/:id', obtenerCeremoniaPorId);

export default router;
