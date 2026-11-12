
import { Router } from 'express';

import {
  obtenerCampus,
  obtenerDependencias,
  obtenerFacultades,
  obtenerProgramas,
} from '../controllers/institucionalController.js';

const router = Router();

router.get('/campus', obtenerCampus);
router.get('/dependencias', obtenerDependencias);
router.get('/facultades', obtenerFacultades);
router.get('/programas', obtenerProgramas);

export default router;
