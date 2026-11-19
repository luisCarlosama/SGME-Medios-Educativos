
import axios from 'axios';
import type { DashboardData } from '../interfaces/dashboard.interface';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:6001/api'}/dashboard`;

export async function getDashboard(): Promise<DashboardData> {
  const respuesta = await axios.get<DashboardData>(API_URL, {
    headers: {
      "ngrok-skip-browser-warning": "true",
    },
  });

  return respuesta.data;
}
