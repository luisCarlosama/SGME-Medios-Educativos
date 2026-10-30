
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

} from '../controllers/reservasController.js';

const router = Router();

router.get('/campus', obtenerCampus);
router.get('/tipos-espacio', obtenerTiposEspacio);
router.get('/espacios', obtenerEspacios);
router.get('/catalogos-institucionales', obtenerCatalogosInstitucionales);
router.post('/', crearSolicitud);
router.get('/disponibilidad', consultarDisponibilidad);
router.get('/agenda-dia', obtenerAgendaDia);
router.get('/codigo/:codigo', consultarSolicitudPorCodigo);
router.get('/:id', obtenerSolicitudPorId);
router.patch('/:id/estado', actualizarEstadoSolicitud);
router.put('/:id', actualizarSolicitud);


export default router;
