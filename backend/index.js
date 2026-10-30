
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './src/db.js';
import authRoutes from './src/routes/authRoutes.js'; 
import dashboardRoutes from './src/routes/dashboardRoutes.js'; 
import reservasRoutes from './src/routes/reservasRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
}));

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reservas', reservasRoutes);


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

app.listen(PORT, () => {
  console.log(`Backend ejecutándose en http://localhost:${PORT}`);
});
