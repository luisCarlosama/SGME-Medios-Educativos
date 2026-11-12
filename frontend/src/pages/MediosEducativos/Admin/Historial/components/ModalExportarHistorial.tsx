
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

interface Props {
  open: boolean;
  onClose: () => void;
  onExportar: (formato: "xlsx" | "pdf") => void;
  tipo: "reservas" | "ceremonias";
  cantidad: number;
}

export default function ModalExportarHistorial({
  open,
  onClose,
  onExportar,
  tipo,
  cantidad,
}: Props) {
  const nombreTipo = tipo === "reservas" ? "reservas" : "ceremonias";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, color: "#0F172A" }}>
        Exportar historial
      </DialogTitle>

      <DialogContent>
        <Typography sx={{ color: "#475569", mb: 1 }}>
          Se exportarán los {nombreTipo} que coinciden con los filtros
          aplicados.
        </Typography>

        <Typography sx={{ color: "#64748B", fontSize: "0.9rem" }}>
          Registros encontrados: <strong>{cantidad}</strong>
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#64748B" }}>
          Cancelar
        </Button>

        <Button
          variant="outlined"
          disabled={cantidad === 0}
          onClick={() => onExportar("xlsx")}
          sx={{ textTransform: "none", borderColor: "#1E3A5F", color: "#1E3A5F" }}
        >
          Excel
        </Button>

        <Button
          variant="contained"
          disabled={cantidad === 0}
          onClick={() => onExportar("pdf")}
          sx={{
            textTransform: "none",
            backgroundColor: "#1E3A5F",
            "&:hover": { backgroundColor: "#0F2744" },
          }}
        >
          PDF
        </Button>
      </DialogActions>
    </Dialog>
  );
}
