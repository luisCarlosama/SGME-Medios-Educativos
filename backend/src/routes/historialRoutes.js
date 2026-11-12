import { Router } from 'express';
import { listarHistorialReservas } from '../controllers/reservasController.js';
// Más adelante puedes importar funciones de ceremonias si quieres

const router = Router();

// Historial de reservas
router.get('/reservas', listarHistorialReservas);

// Aquí podrías agregar después:
// router.get('/ceremonias', listarHistorialCeremonias);

export default router;