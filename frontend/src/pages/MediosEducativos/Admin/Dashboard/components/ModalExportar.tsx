import {
  Box,
  Button,
  Dialog,
  DialogContent,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onExportar: (
    tipo: "externas" | "internas" | "todas",
    formato: "xlsx" | "pdf"
  ) => void;
}

export default function ModalExportar({ open, onClose, onExportar }: Props) {
  const [tipo, setTipo] = useState<"externas" | "internas" | "todas">("todas");
  const [formato, setFormato] = useState<"xlsx" | "pdf">("xlsx");

  // Reiniciar valores cada vez que se abre el modal
  useEffect(() => {
    if (open) {
      setTipo("todas");
      setFormato("xlsx");
    }
  }, [open]);

  const handleExportar = () => {
    onExportar(tipo, formato);
    onClose();
  };

  const estiloBoton = (activo: boolean) => ({
    textTransform: "none" as const,
    borderRadius: "10px",
    px: 2.5,
    py: 1.1,
    fontWeight: 500,
    fontSize: "0.9rem",
    border: "1.5px solid",
    borderColor: activo ? "#93C5FD" : "#E2E8F0",
    backgroundColor: activo ? "#EFF6FF" : "#FFFFFF",
    color: activo ? "#1E40AF" : "#334155",
    boxShadow: "none",
    flex: 1,
    transition: "all 0.15s ease",
    "&:hover": {
      backgroundColor: activo ? "#DBEAFE" : "#F8FAFC",
      borderColor: activo ? "#60A5FA" : "#CBD5E1",
      boxShadow: "none",
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "16px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.12)",
        },
      }}
    >
      <DialogContent sx={{ p: 3.5 }}>
        {/* Título */}
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: "1.3rem",
            color: "#0F172A",
            mb: 0.75,
          }}
        >
          Exportar solicitudes
        </Typography>

        <Typography
          sx={{
            color: "#64748B",
            fontSize: "0.9rem",
            mb: 3.5,
            lineHeight: 1.5,
          }}
        >
          Selecciona qué registros deseas descargar y en qué formato.
        </Typography>

        {/* Tipo de solicitudes */}
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: "0.875rem",
            color: "#0F172A",
            mb: 1.5,
          }}
        >
          Tipo de solicitudes
        </Typography>

        <Box sx={{ display: "flex", gap: 1.25, mb: 1.25 }}>
          <Button
            onClick={() => setTipo("externas")}
            sx={estiloBoton(tipo === "externas")}
          >
            Externas
          </Button>
          <Button
            onClick={() => setTipo("internas")}
            sx={estiloBoton(tipo === "internas")}
          >
            Internas
          </Button>
        </Box>

        <Button
          onClick={() => setTipo("todas")}
          sx={{ ...estiloBoton(tipo === "todas"), width: "100%", mb: 3.5 }}
        >
          Todas
        </Button>

        {/* Formato de archivo */}
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: "0.875rem",
            color: "#0F172A",
            mb: 1.5,
          }}
        >
          Formato de archivo
        </Typography>

        <Box sx={{ display: "flex", gap: 1.25, mb: 2 }}>
          <Button
            onClick={() => setFormato("xlsx")}
            sx={estiloBoton(formato === "xlsx")}
          >
            Excel (.xlsx)
          </Button>
          <Button
            onClick={() => setFormato("pdf")}
            sx={estiloBoton(formato === "pdf")}
          >
            PDF (.pdf)
          </Button>
        </Box>

        <Typography
          sx={{
            color: "#94A3B8",
            fontSize: "0.8rem",
            mb: 3.5,
            lineHeight: 1.5,
          }}
        >
          Se exportarán los datos resumidos de las solicitudes según el tipo
          seleccionado.
        </Typography>

        {/* Botones de acción */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 1.5,
          }}
        >
          <Button
            onClick={onClose}
            sx={{
              textTransform: "none",
              color: "#64748B",
              fontWeight: 500,
              borderRadius: "10px",
              px: 2.5,
              "&:hover": {
                backgroundColor: "#F1F5F9",
              },
            }}
          >
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={handleExportar}
            sx={{
              backgroundColor: "#1E3A5F",
              textTransform: "none",
              fontWeight: 600,
              borderRadius: "10px",
              px: 3.5,
              py: 1,
              boxShadow: "none",
              "&:hover": {
                backgroundColor: "#0F2744",
                boxShadow: "none",
              },
            }}
          >
            Exportar
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}