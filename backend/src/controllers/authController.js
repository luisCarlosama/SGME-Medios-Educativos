
import { autenticarAdministrador } from '../services/authService.js';

export const login = async (req, res) => {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({
        mensaje: 'Ingresa el correo institucional y la contraseña.',
      });
    }

    if (!correo.toLowerCase().endsWith('@unicesmag.edu.co')) {
      return res.status(400).json({
        mensaje: 'Debes utilizar un correo institucional UNICESMAG.',
      });
    }

    const administrador = await autenticarAdministrador(
      correo.trim(),
      password
    );

    if (!administrador) {
      return res.status(401).json({
        mensaje: 'Credenciales incorrectas o cuenta inactiva.',
      });
    }

    return res.status(200).json({
      mensaje: 'Inicio de sesión exitoso.',
      administrador,
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);

    return res.status(500).json({
      mensaje: 'Ocurrió un error al iniciar sesión.',
    });
  }
};
