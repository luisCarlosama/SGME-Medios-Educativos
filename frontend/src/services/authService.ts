
import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:6001/api'}/auth`;

export interface Administrador {
  id_admin: number;
  nombre: string;
  correo_institucional: string;
  rol: string;
  id_campus: number | null;
  estado: boolean;
}

interface RespuestaLogin {
  mensaje: string;
  administrador: Administrador;
}

export const loginAdmin = async (
  correo: string,
  password: string
): Promise<RespuestaLogin> => {
  const respuesta = await axios.post<RespuestaLogin>(
    `${API_URL}/login`,
    {
      correo,
      password,
    }
  );

  return respuesta.data;
};

