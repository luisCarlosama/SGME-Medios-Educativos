import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonIcon from "@mui/icons-material/Person";
import { useNavigate } from "react-router-dom";

type Resumen = {
  codigo: string;
  estado: string;
  espacio: string;
  fecha: string;
  fecha_fin?: string;
  horario: string;
  solicitante: string;
  es_recurrente?: boolean;
  cantidad_ocurrencias?: number;
};

export default function ConfirmacionReserva() {
  const navigate = useNavigate();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [codigo, setCodigo] = useState<string>("");

  useEffect(() => {
    const codigoGuardado = sessionStorage.getItem("codigo_solicitud");
    const resumenGuardado = sessionStorage.getItem("resumen_solicitud");

    if (!codigoGuardado || !resumenGuardado) {
      // Si no hay datos, redirigimos
      navigate("/reserva", { replace: true });
      return;
    }

    setCodigo(codigoGuardado);
    try {
      setResumen(JSON.parse(resumenGuardado));
    } catch {
      navigate("/reserva", { replace: true });
    }
  }, [navigate]);

  if (!resumen) {
    return null; // o un loading pequeño
  }

  const fechaMostrada =
    resumen.es_recurrente && resumen.fecha_fin
      ? `${resumen.fecha} → ${resumen.fecha_fin}`
      : resumen.fecha;

  return (
    <Box sx={{ backgroundColor: "#F5F7FA", minHeight: "70vh", py: 6 }}>
      <Container maxWidth="md">
        {/* Icono de éxito */}
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              backgroundColor: "#E8F5E9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 42, color: "#2E7D32" }} />
          </Box>

          <Typography
            sx={{
              color: "#2E7D32",
              fontWeight: 700,
              fontSize: "0.8rem",
              letterSpacing: 1,
              mb: 1,
            }}
          >
            SOLICITUD RECIBIDA
          </Typography>

          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: "1.8rem", md: "2.2rem" },
              color: "#0B1A2A",
              mb: 1,
            }}
          >
            Solicitud enviada
          </Typography>

          <Typography
            sx={{
              color: "#5A6A7A",
              fontSize: "1rem",
              maxWidth: 480,
              margin: "0 auto",
            }}
          >
            Tu solicitud fue recibida. Guarda el código de solicitud para
            consultar su estado más adelante.
          </Typography>
        </Box>

        {/* Código de solicitud */}
        <Paper
          elevation={0}
          sx={{
            backgroundColor: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5EAF0",
            py: 2.5,
            px: 3,
            textAlign: "center",
            mb: 4,
            maxWidth: 360,
            margin: "0 auto 32px",
          }}
        >
          <Typography
            sx={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#9AA5B5",
              letterSpacing: 0.5,
              mb: 0.5,
            }}
          >
            CÓDIGO DE SOLICITUD
          </Typography>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: "1.4rem",
              color: "#0B3A5C",
              letterSpacing: 0.5,
            }}
          >
            {codigo}
          </Typography>
        </Paper>

        {/* Resumen de la solicitud */}
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: "1.1rem",
            color: "#0B1A2A",
            mb: 2,
          }}
        >
          Resumen de la solicitud
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
            mb: 3,
          }}
        >
          {/* Espacio */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: "10px",
              border: "1px solid #E5EAF0",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <MeetingRoomIcon sx={{ color: "#0B3A5C", fontSize: 22 }} />
            <Box>
              <Typography
                sx={{ fontSize: "0.7rem", color: "#9AA5B5", fontWeight: 600 }}
              >
                ESPACIO
              </Typography>
              <Typography sx={{ fontWeight: 600, color: "#0B1A2A" }}>
                {resumen.espacio || "—"}
              </Typography>
            </Box>
          </Paper>

          {/* Fecha */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: "10px",
              border: "1px solid #E5EAF0",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <CalendarTodayIcon sx={{ color: "#0B3A5C", fontSize: 20 }} />
            <Box>
              <Typography
                sx={{ fontSize: "0.7rem", color: "#9AA5B5", fontWeight: 600 }}
              >
                FECHA
              </Typography>
              <Typography sx={{ fontWeight: 600, color: "#0B1A2A" }}>
                {fechaMostrada}
                {resumen.es_recurrente && resumen.cantidad_ocurrencias
                  ? ` (${resumen.cantidad_ocurrencias} fechas)`
                  : ""}
              </Typography>
            </Box>
          </Paper>

          {/* Horario */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: "10px",
              border: "1px solid #E5EAF0",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <AccessTimeIcon sx={{ color: "#0B3A5C", fontSize: 22 }} />
            <Box>
              <Typography
                sx={{ fontSize: "0.7rem", color: "#9AA5B5", fontWeight: 600 }}
              >
                HORARIO
              </Typography>
              <Typography sx={{ fontWeight: 600, color: "#0B1A2A" }}>
                {resumen.horario || "—"}
              </Typography>
            </Box>
          </Paper>

          {/* Solicitante */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: "10px",
              border: "1px solid #E5EAF0",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <PersonIcon sx={{ color: "#0B3A5C", fontSize: 22 }} />
            <Box>
              <Typography
                sx={{ fontSize: "0.7rem", color: "#9AA5B5", fontWeight: 600 }}
              >
                SOLICITANTE
              </Typography>
              <Typography sx={{ fontWeight: 600, color: "#0B1A2A" }}>
                {resumen.solicitante || "—"}
              </Typography>
            </Box>
          </Paper>
        </Box>

        {/* Estado + Nota de revisión */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 2,
            mb: 4,
            alignItems: { sm: "stretch" },
          }}
        >
          {/* Badge Pendiente */}
          <Paper
            elevation={0}
            sx={{
              px: 2.5,
              py: 1.5,
              borderRadius: "10px",
              backgroundColor: "#E8F5E9",
              display: "flex",
              alignItems: "center",
              gap: 1,
              minWidth: 140,
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#2E7D32",
              }}
            />
            <Typography
              sx={{ fontWeight: 700, color: "#2E7D32", fontSize: "0.9rem" }}
            >
              PENDIENTE
            </Typography>
          </Paper>

          {/* Nota de revisión */}
          <Paper
            elevation={0}
            sx={{
              flex: 1,
              p: 2,
              borderRadius: "10px",
              border: "1px solid #E5EAF0",
              backgroundColor: "#FFFFFF",
            }}
          >
            <Typography
              sx={{ fontWeight: 700, color: "#0B1A2A", fontSize: "0.95rem", mb: 0.5 }}
            >
              Revisión de la solicitud
            </Typography>
            <Typography sx={{ color: "#5A6A7A", fontSize: "0.9rem" }}>
              La solicitud será revisada por el área encargada antes de su
              confirmación.
            </Typography>
          </Paper>
        </Box>

        {/* Pasos del proceso */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: { xs: 1, sm: 2 },
            flexWrap: "wrap",
            mb: 4,
            color: "#9AA5B5",
            fontSize: "0.85rem",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
            <CheckCircleIcon sx={{ fontSize: 18, color: "#2E7D32" }} />
            <Typography sx={{ color: "#2E7D32", fontWeight: 600 }}>
              Solicitud enviada
            </Typography>
          </Box>

          <Typography sx={{ color: "#C5CDD6" }}>→</Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "2px solid #C5CDD6",
              }}
            />
            <Typography>En revisión</Typography>
          </Box>

          <Typography sx={{ color: "#C5CDD6" }}>→</Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "2px solid #C5CDD6",
              }}
            />
            <Typography>Confirmación</Typography>
          </Box>
        </Box>

        {/* Botón Volver */}
        <Box sx={{ textAlign: "center" }}>
          <Button
            variant="contained"
            onClick={() => navigate("/disponibilidad")}
            sx={{
              backgroundColor: "#E30613",
              textTransform: "none",
              fontWeight: 700,
              borderRadius: "8px",
              px: 4,
              py: 1.3,
              boxShadow: "none",
              "&:hover": {
                backgroundColor: "#C10510",
                boxShadow: "none",
              },
            }}
          >
            Volver al inicio →
          </Button>
        </Box>
      </Container>
    </Box>
  );
}