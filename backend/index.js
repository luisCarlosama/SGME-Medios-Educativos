
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './src/db.js';
import authRoutes from './src/routes/authRoutes.js'; 
import dashboardRoutes from './src/routes/dashboardRoutes.js'; 
import reservasRoutes from './src/routes/reservasRoutes.js';
import ceremoniasRoutes from './src/routes/ceremoniasRoutes.js';
import historialRoutes from './src/routes/historialRoutes.js';
import institucionalRoutes from './src/routes/institucionalRoutes.js';
import { iniciarAutomatizacionEstadosSesiones } from './src/services/sesionesScheduler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 6001;
const frontendOrigins = (
  process.env.FRONTEND_ORIGIN ||
  'http://localhost:5173,http://localhost:5174'
)
  .split(',')
  .map((origin) => origin.trim());

app.use(cors({
  origin: frontendOrigins,
}));

app.use(
  '/api/ceremonias/:id/fotografias',
  express.json({ limit: '18mb' })
);
app.use(
  '/api/ceremonias/:id/graduandos/importacion',
  express.json({ limit: '2mb' })
);
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/ceremonias', ceremoniasRoutes);
app.use('/api/historial', historialRoutes);

//view_report data base
app.use('/api/institucional', institucionalRoutes);


app.get('/', (req, res) => {
  res.json({
    mensaje: 'Backend SGME Medios Educativos funcionando',
  });
});

app.get('/api/health/db', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT current_database() AS base_datos, NOW() AS fecha'
    );

    res.json({
      mensaje: 'Conexión a PostgreSQL exitosa',
      baseDatos: resultado.rows[0].base_datos,
      fecha: resultado.rows[0].fecha,
    });
  } catch (error) {
  console.error('Error al conectar con PostgreSQL:', error);

  res.status(500).json({
    mensaje: 'No se pudo conectar a PostgreSQL',
    codigo: error.code || 'DESCONOCIDO',
    detalle: error.message,
  });
}
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend SGME ejecutándose en el puerto ${PORT}`);
  iniciarAutomatizacionEstadosSesiones();
});
