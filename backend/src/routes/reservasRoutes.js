import { Router } from 'express';
import {
  obtenerCampus,
  obtenerTiposEspacio,
  obtenerEspacios,
  obtenerCatalogosInstitucionales,
  crearSolicitud,
  consultarDisponibilidad,
  obtenerAgendaDia,
  consultarSolicitudPorCodigo,
  obtenerSolicitudPorId,
  actualizarEstadoSolicitud,
  actualizarSolicitud,
  listarSolicitudes,
  listarAgenda,
} from '../controllers/reservasController.js';

const router = Router();

// Rutas específicas primero
router.get('/campus', obtenerCampus);
router.get('/tipos-espacio', obtenerTiposEspacio);
router.get('/espacios', obtenerEspacios);
router.get('/catalogos-institucionales', obtenerCatalogosInstitucionales);
router.get('/disponibilidad', consultarDisponibilidad);
router.get('/agenda-dia', obtenerAgendaDia);
router.get('/codigo/:codigo', consultarSolicitudPorCodigo);
router.get('/agenda', listarAgenda);

// Lista de solicitudes (antes del :id)
router.get('/', listarSolicitudes);

// Rutas dinámicas al final
router.get('/:id', obtenerSolicitudPorId);
router.get('/', listarSolicitudes);
router.patch('/:id/estado', actualizarEstadoSolicitud);
router.put('/:id', actualizarSolicitud);

router.post('/', crearSolicitud);

export default router;