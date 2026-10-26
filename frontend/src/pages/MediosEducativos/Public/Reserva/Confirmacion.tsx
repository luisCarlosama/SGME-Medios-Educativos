/**
 * Portal público – Confirmación de solicitud
 */

import { useEffect, useState } from "react";
import { Box, Typography, Button, Container, Card, Chip } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNavigate } from "react-router-dom";

type Resumen = {
  codigo: string;
  espacio: string;
  fecha: string;
  horario: string;
  solicitante: string;
};

export default function Confirmacion() {
  const navigate = useNavigate();
  const [resumen, setResumen] = useState<Resumen | null>(null);

  useEffect(() => {
    const codigo = sessionStorage.getItem("codigo_solicitud");
    const raw = sessionStorage.getItem("resumen_solicitud");

    if (raw) {
      try {
        setResumen(JSON.parse(raw) as Resumen);
        return;
      } catch {
        // sigue con fallback
      }
    }

    if (codigo) {
      setResumen({
        codigo,
        espacio: "—",
        fecha: "—",
        horario: "—",
        solicitante: "—",
      });
    }
  }, []);

  // Si entró directo sin enviar el formulario
  if (!resumen) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: "center" }}>
        <Typography sx={{ fontWeight: 700, mb: 2, color: "#0B1A2A" }}>
          No hay una solicitud reciente
        </Typography>
        <Typography sx={{ color: "#5A6A7A", mb: 3 }}>
          Debes completar el formulario de reserva primero.
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate("/reserva")}
          sx={{
            backgroundColor: "#E30613",
            textTransform: "none",
            fontWeight: 700,
            borderRadius: "8px",
            "&:hover": { backgroundColor: "#C10510" },
          }}
        >
          Ir al formulario →
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8, textAlign: "center" }}>
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          backgroundColor: "#E6F4EA",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mx: "auto",
          mb: 2,
        }}
      >
        <CheckCircleIcon sx={{ fontSize: 40, color: "#1B7A3D" }} />
      </Box>

      <Typography
        sx={{
          color: "#1B7A3D",
          fontSize: "0.8rem",
          fontWeight: 700,
          letterSpacing: 1,
          mb: 1,
        }}
      >
        SOLICITUD RECIBIDA
      </Typography>
      <Typography
        sx={{ fontWeight: 800, fontSize: "1.75rem", color: "#0B1A2A", mb: 0.5 }}
      >
        Solicitud enviada
      </Typography>
      <Typography sx={{ color: "#5A6A7A", fontSize: "1rem", mb: 3 }}>
        Tu solicitud de reserva fue recibida correctamente.
      </Typography>

      <Card
        elevation={0}
        sx={{
          borderRadius: "12px",
          border: "1px solid #E5EAF0",
          mb: 3,
          display: "inline-block",
          px: 4,
          py: 1.5,
        }}
      >
        <Typography
          sx={{
            color: "#5A6A7A",
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
        >
          NÚMERO DE SOLICITUD
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: "1.5rem", color: "#0B1A2A" }}>
          {resumen.codigo}
        </Typography>
      </Card>

      <Typography
        sx={{
          fontWeight: 700,
          fontSize: "1rem",
          color: "#0B1A2A",
          mb: 1.5,
          textAlign: "left",
        }}
      >
        Resumen de la solicitud
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 1.5,
          mb: 2,
          textAlign: "left",
        }}
      >
        {[
          { label: "ESPACIO", value: resumen.espacio },
          { label: "FECHA", value: resumen.fecha },
          { label: "HORARIO", value: resumen.horario },
          { label: "SOLICITANTE", value: resumen.solicitante },
        ].map((item) => (
          <Box
            key={item.label}
            sx={{
              backgroundColor: "#FFFFFF",
              borderRadius: "8px",
              border: "1px solid #E5EAF0",
              p: 1.5,
            }}
          >
            <Typography
              sx={{ color: "#5A6A7A", fontSize: "0.7rem", fontWeight: 600 }}
            >
              {item.label}
            </Typography>
            <Typography sx={{ color: "#1A2A3A", fontSize: "0.85rem" }}>
              {item.value || "—"}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mb: 2 }}>
        <Chip
          label="PENDIENTE DE REVISIÓN"
          size="small"
          sx={{ backgroundColor: "#E6F4EA", color: "#1B7A3D", fontWeight: 600 }}
        />
      </Box>

      <Box
        sx={{
          backgroundColor: "#FFFFFF",
          borderRadius: "10px",
          border: "1px solid #E5EAF0",
          p: 2,
          mb: 3,
          textAlign: "left",
        }}
      >
        <Typography
          sx={{ fontWeight: 600, fontSize: "0.9rem", color: "#0B1A2A", mb: 0.5 }}
        >
          Revisión de la solicitud
        </Typography>
        <Typography sx={{ color: "#5A6A7A", fontSize: "0.85rem" }}>
          La solicitud será revisada por el área encargada antes de su
          confirmación.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          gap: 1,
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
        }}
      >
        <Typography sx={{ color: "#1B7A3D", fontSize: "0.8rem", fontWeight: 600 }}>
          ✓ Solicitud enviada
        </Typography>
        <Typography sx={{ color: "#9AA5B5" }}>→</Typography>
        <Typography sx={{ color: "#9AA5B5", fontSize: "0.8rem" }}>
          En revisión
        </Typography>
        <Typography sx={{ color: "#9AA5B5" }}>→</Typography>
        <Typography sx={{ color: "#9AA5B5", fontSize: "0.8rem" }}>
          Confirmación
        </Typography>
      </Box>

      <Button
        variant="contained"
        onClick={() => navigate("/")}
        sx={{
          backgroundColor: "#E30613",
          textTransform: "none",
          fontWeight: 700,
          borderRadius: "8px",
          px: 4,
          py: 1.2,
          boxShadow: "none",
          "&:hover": { backgroundColor: "#C10510", boxShadow: "none" },
        }}
      >
        Volver al inicio →
      </Button>
    </Container>
  );
}