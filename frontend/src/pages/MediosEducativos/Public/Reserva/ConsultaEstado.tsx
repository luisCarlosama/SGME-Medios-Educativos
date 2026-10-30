import { useState } from "react";
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { consultarSolicitudPorCodigo } from "./services/reservas.service";

type Solicitud = {
  codigo: string;
  estado: string;
  espacio?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  hora_inicio?: string;
  hora_fin?: string;
  nombre_solicitante?: string;
  es_recurrente?: boolean;
  cantidad_ocurrencias?: number;
};

const estadoColores: Record<string, { bg: string; color: string }> = {
  Pendiente: { bg: "#FFF8E1", color: "#F9A825" },
  "En revisión": { bg: "#E3F2FD", color: "#1565C0" },
  Aprobada: { bg: "#E8F5E9", color: "#2E7D32" },
  Rechazada: { bg: "#FFEBEE", color: "#C62828" },
  Confirmada: { bg: "#E8F5E9", color: "#2E7D32" },
};

export default function ConsultaEstado() {
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);

  const handleConsultar = async () => {
    const codigoLimpio = codigo.trim().toUpperCase();

    if (!codigoLimpio) {
      setError("Ingresa el código de solicitud.");
      return;
    }

    setError(null);
    setSolicitud(null);
    setCargando(true);

    try {
      const data = await consultarSolicitudPorCodigo(codigoLimpio);
      setSolicitud(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo consultar la solicitud. Intenta de nuevo."
      );
    } finally {
      setCargando(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConsultar();
    }
  };

  const colorEstado = solicitud
    ? estadoColores[solicitud.estado] || { bg: "#F5F5F5", color: "#616161" }
    : null;

  return (
    <Box sx={{ backgroundColor: "#F5F7FA", minHeight: "80vh" }}>
      {/* Banner superior */}
      <Box
        sx={{
          backgroundColor: "#0B1A2A",
          color: "#FFFFFF",
          py: { xs: 5, md: 7 },
        }}
      >
        <Container maxWidth="lg">
          <Typography
            sx={{
              fontSize: "0.8rem",
              fontWeight: 600,
              letterSpacing: 1,
              color: "rgba(255,255,255,0.7)",
              mb: 1.5,
            }}
          >
            RESERVAS DE ESPACIOS
          </Typography>

          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: "1.8rem", md: "2.4rem" },
              mb: 1.5,
              lineHeight: 1.2,
            }}
          >
            Consulta el estado de tu solicitud
          </Typography>

          <Typography
            sx={{
              fontSize: "1.05rem",
              color: "rgba(255,255,255,0.85)",
              maxWidth: 520,
            }}
          >
            Ingresa el código que recibiste por correo. No necesitas crear una
            cuenta.
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: 5 }}>
        {/* Tarjeta de búsqueda */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: "16px",
            border: "1px solid #E5EAF0",
            p: { xs: 3, md: 4 },
            mb: 3,
            backgroundColor: "#FFFFFF",
          }}
        >
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: "1.25rem",
              color: "#0B1A2A",
              mb: 0.5,
            }}
          >
            Seguimiento de solicitud
          </Typography>

          <Typography
            sx={{
              color: "#5A6A7A",
              fontSize: "0.95rem",
              mb: 3,
            }}
          >
            Ingresa el código asignado a tu solicitud al enviarla.
          </Typography>

          <Typography
            sx={{
              fontWeight: 600,
              fontSize: "0.875rem",
              color: "#0B1A2A",
              mb: 1,
            }}
          >
            Código de solicitud
          </Typography>

          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              gap: 1.5,
              mb: 2,
            }}
          >
            <TextField
              fullWidth
              size="medium"
              placeholder="Ej. SGME-2026-00125"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={handleKeyPress}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  backgroundColor: "#FAFBFC",
                },
              }}
            />

            <Button
              variant="contained"
              onClick={handleConsultar}
              disabled={cargando}
              sx={{
                backgroundColor: "#E30613",
                textTransform: "none",
                fontWeight: 700,
                borderRadius: "10px",
                px: 3.5,
                py: 1.4,
                whiteSpace: "nowrap",
                boxShadow: "none",
                minWidth: { sm: 180 },
                "&:hover": {
                  backgroundColor: "#C10510",
                  boxShadow: "none",
                },
                "&.Mui-disabled": {
                  backgroundColor: "#E30613",
                  opacity: 0.7,
                  color: "#fff",
                },
              }}
            >
              {cargando ? (
                <CircularProgress size={22} color="inherit" />
              ) : (
                "Consultar estado"
              )}
            </Button>
          </Box>

          <Typography
            sx={{
              fontSize: "0.8rem",
              color: "#9AA5B5",
            }}
          >
            Por privacidad, solo se mostrarán los datos de tu propia solicitud.
          </Typography>
        </Paper>

        {/* Error */}
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 3, borderRadius: "12px" }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Resultado real */}
        {solicitud && (
          <Paper
            elevation={0}
            sx={{
              borderRadius: "16px",
              border: "1px solid #E5EAF0",
              p: { xs: 3, md: 4 },
              backgroundColor: "#FFFFFF",
            }}
          >
            <Typography
              sx={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#9AA5B5",
                letterSpacing: 0.5,
                mb: 1.5,
              }}
            >
              RESULTADO DE LA CONSULTA
            </Typography>

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 2,
                mb: 2,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: "1.3rem",
                  color: "#0B1A2A",
                }}
              >
                Solicitud {solicitud.codigo}
              </Typography>

              {colorEstado && (
                <Box
                  sx={{
                    backgroundColor: colorEstado.bg,
                    color: colorEstado.color,
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    px: 2,
                    py: 0.7,
                    borderRadius: "20px",
                  }}
                >
                  {solicitud.estado}
                </Box>
              )}
            </Box>

            <Typography
              sx={{
                color: "#5A6A7A",
                fontSize: "0.95rem",
                mb: 1.5,
              }}
            >
              {solicitud.espacio && `Espacio: ${solicitud.espacio}`}
              {solicitud.fecha_inicio &&
                ` · Fecha: ${solicitud.fecha_inicio}${
                  solicitud.fecha_fin && solicitud.fecha_fin !== solicitud.fecha_inicio
                    ? ` → ${solicitud.fecha_fin}`
                    : ""
                }`}
              {solicitud.hora_inicio &&
                solicitud.hora_fin &&
                ` · Horario: ${solicitud.hora_inicio}–${solicitud.hora_fin}`}
            </Typography>

            {solicitud.es_recurrente && solicitud.cantidad_ocurrencias && (
              <Typography
                sx={{
                  color: "#5A6A7A",
                  fontSize: "0.9rem",
                  mb: 1.5,
                }}
              >
                Solicitud recurrente · {solicitud.cantidad_ocurrencias} fechas
              </Typography>
            )}

            <Typography
              sx={{
                fontSize: "0.85rem",
                color: "#9AA5B5",
                mt: 2,
              }}
            >
              Si el estado cambia, recibirás una notificación al correo
              registrado.
            </Typography>
          </Paper>
        )}

        {/* Ejemplo de resultado (solo cuando no hay búsqueda) */}
        {!solicitud && !error && !cargando && (
          <Paper
            elevation={0}
            sx={{
              borderRadius: "16px",
              border: "1px solid #E5EAF0",
              p: { xs: 3, md: 4 },
              backgroundColor: "#FFFFFF",
              opacity: 0.85,
            }}
          >
            <Typography
              sx={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#9AA5B5",
                letterSpacing: 0.5,
                mb: 1.5,
              }}
            >
              EJEMPLO DE RESULTADO
            </Typography>

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 2,
                mb: 2,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: "1.3rem",
                  color: "#0B1A2A",
                }}
              >
                Solicitud SGME-2026-00125
              </Typography>

              <Box
                sx={{
                  backgroundColor: "#FFF8E1",
                  color: "#F9A825",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  px: 2,
                  py: 0.7,
                  borderRadius: "20px",
                }}
              >
                Pendiente
              </Box>
            </Box>

            <Typography
              sx={{
                color: "#5A6A7A",
                fontSize: "0.95rem",
                mb: 1.5,
              }}
            >
              Espacio: Auditorio · Fecha: 22 oct 2026 · Horario: 9:00–11:00
            </Typography>

            <Typography
              sx={{
                fontSize: "0.85rem",
                color: "#9AA5B5",
              }}
            >
              Si el estado cambia, recibirás una notificación al correo
              registrado.
            </Typography>
          </Paper>
        )}
      </Container>
    </Box>
  );
}