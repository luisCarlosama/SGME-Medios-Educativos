import { Router } from 'express';
import {
  agregarCandidatoPrueba, guardarEstadoCatalogo, listarCandidatosPrueba, listarCatalogoEstados,
  listarSincronizacionesPrueba, reintentarSincronizacionesPrueba,
} from '../controllers/procesosGradoPruebaController.js';
import {
  crearCeremonia,
  eliminarFotografiaCeremonia,
  guardarFotografiasCeremonia,
  listarGraduandosCeremonia,
  listarGraduandosInstitucionales,
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
  buscarInvitadosControlIngreso,
  confirmarImportacionGraduandos,
  crearGraduando,
  crearSesion,
  iniciarSesionGraduando,
  listarInvitadosCeremonia,
  listarInvitadosControlIngreso,
  obtenerEstadisticasControlIngreso,
  obtenerGraduandoPorDocumento,
  obtenerGraduandoPorId,
  obtenerRequisitosInicioCeremonia,
  obtenerSesionPorId,
  registrarIngresoGraduando,
  registrarIngresoInvitado,
  validarImportacionGraduandos,
} from '../controllers/ceremoniasOperacionesController.js';

const router = Router();

router.get('/', listarCeremonias);
router.post('/', crearCeremonia);
router.get('/programas', listarProgramasCeremonia);
router.get('/graduandos-institucionales', listarGraduandosInstitucionales);
router.get('/prueba/catalogo-estados', listarCatalogoEstados);
router.post('/prueba/catalogo-estados', guardarEstadoCatalogo);
router.get('/prueba/sincronizaciones', listarSincronizacionesPrueba);
router.post('/prueba/sincronizaciones/reintentar', reintentarSincronizacionesPrueba);
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
router.get('/:id/requisitos-inicio', obtenerRequisitosInicioCeremonia);
router.get('/:id/prueba/candidatos', listarCandidatosPrueba);
router.post('/:id/prueba/candidatos', agregarCandidatoPrueba);
router.get('/:id/sesiones', listarSesionesCeremonia);
router.post('/:id/sesiones', crearSesion);
router.get('/:id/fotografias', obtenerFotografiasCeremonia);
router.patch('/:id/fotografias', guardarFotografiasCeremonia);
router.delete('/:id/fotografias/:slot', eliminarFotografiaCeremonia);
router.get('/:id/graduandos', listarGraduandosCeremonia);
router.post('/:id/graduandos', crearGraduando);
router.post('/:id/graduandos/importacion/validar', validarImportacionGraduandos);
router.post('/:id/graduandos/importacion/confirmar', confirmarImportacionGraduandos);
router.get('/:id/invitados', listarInvitadosCeremonia);
router.get('/:id/control-ingreso', obtenerEstadisticasControlIngreso);
router.get('/:id/control-ingreso/graduandos', buscarGraduandosControlIngreso);
router.get('/:id/control-ingreso/invitados', buscarInvitadosControlIngreso);
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
