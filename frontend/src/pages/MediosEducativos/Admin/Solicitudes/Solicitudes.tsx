import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  FormControl,
  Select,
  type SelectChangeEvent,
} from "@mui/material";
import AdminLayout from "../../../../components/layout/AdminLayout";
import { listarSolicitudes } from "./services/solicitudes.service";
import {
  obtenerCampus,
  obtenerEspacios,
} from "../../Public/Reserva/services/reservas.service";

const estadoStyles: Record<string, { bg: string; color: string }> = {
  Pendiente: { bg: "#FEF3C7", color: "#B45309" },
  Aprobada: { bg: "#D1FAE5", color: "#047857" },
  Rechazada: { bg: "#FEE2E2", color: "#B91C1C" },
  Cancelada: { bg: "#F3F4F6", color: "#4B5563" },
  "En proceso": { bg: "#DBEAFE", color: "#1D4ED8" },
};

function formatearFecha(fecha: string): string {
  if (!fecha) return "—";
  const soloFecha = fecha.split("T")[0];
  const [anio, mes, dia] = soloFecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatearHora(hora: string): string {
  if (!hora) return "";
  return hora.slice(0, 5);
}

export default function Solicitudes() {
  const navigate = useNavigate();

  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  //const [estado, setEstado] = useState("");
  const [tipo, setTipo] = useState("");
  const [campus, setCampus] = useState("");
  const [fecha, setFecha] = useState("");
  const [espacio, setEspacio] = useState("");
  const [horario, setHorario] = useState("");

  const [campusLista, setCampusLista] = useState<any[]>([]);
  const [espaciosLista, setEspaciosLista] = useState<any[]>([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);

  const cargarSolicitudes = async (filtros: Record<string, string> = {}) => {
    setLoading(true);
    setError("");
    try {
      const data = await listarSolicitudes(filtros);

      // Solo se muestran las que aún no se han resuelto
      const pendientes = data.filter((s: any) => s.estado === "Pendiente");
      setSolicitudes(pendientes);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las solicitudes."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSolicitudes();
  }, []);

  useEffect(() => {
    const cargarCatalogos = async () => {
      setCargandoCatalogos(true);

      try {
        const [campusData, espaciosData] = await Promise.all([
          obtenerCampus(),
          obtenerEspacios(),
        ]);

        setCampusLista(campusData || []);
        setEspaciosLista(espaciosData || []);
      } catch (err) {
        console.error("Error al cargar filtros de solicitudes:", err);
        setError("No se pudieron cargar los filtros de campus y espacios.");
      } finally {
        setCargandoCatalogos(false);
      }
    };

    cargarCatalogos();
  }, []);

  const handleFiltrar = () => {
    const filtros: Record<string, string> = {};
    if (busqueda.trim()) filtros.busqueda = busqueda.trim();
    //if (estado) filtros.estado = estado;
    if (tipo) filtros.tipo = tipo;
    if (campus) filtros.campus = campus;
    if (fecha) filtros.fecha = fecha;
    if (espacio) filtros.espacio = espacio;
    if (horario) filtros.horario = horario;
    cargarSolicitudes(filtros);
  };

  const handleLimpiar = () => {
    setBusqueda("");
    //setEstado("");
    setTipo("");
    setCampus("");
    setFecha("");
    setEspacio("");
    setHorario("");
    cargarSolicitudes();
  };

  return (
    <AdminLayout>
      <Box sx={{ width: "100%" }}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 3,
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: "1.75rem",
                color: "#0F172A",
                mb: 0.5,
              }}
            >
              Solicitudes
            </Typography>
            <Typography sx={{ color: "#64748B", fontSize: "0.95rem" }}>
              Gestiona y revisa las solicitudes externas e internas de reserva
            </Typography>
          </Box>

          <Button
            variant="contained"
            onClick={() => navigate("/reserva")}
            sx={{
              backgroundColor: "#E30613",
              textTransform: "none",
              fontWeight: 600,
              borderRadius: "8px",
              px: 2.5,
              boxShadow: "none",
              "&:hover": { backgroundColor: "#C10510", boxShadow: "none" },
            }}
          >
            Nueva solicitud
          </Button>
        </Box>

        {/* Filtros — estilo Figma */}
        <Box
          sx={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            px: 2,
            py: 1.75,
            mb: 3,
          }}
        >
          <Typography
            sx={{
              fontSize: "0.72rem",
              fontWeight: 600,
              color: "#64748B",
              mb: 1,
            }}
          >
            Buscar solicitud
          </Typography>

          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1.25,
              alignItems: "center",
            }}
          >
            {/* Búsqueda */}
            <TextField
              size="small"
              placeholder="Código o solicitante"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              sx={{
                minWidth: 180,
                flex: "1 1 160px",
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                  height: 36,
                  fontSize: "0.85rem",
                },
              }}
            />

            {/* Estado */}
            {/* ========== FILTRO ESTADO (oculto por ahora - solo se muestran Pendientes) ==========
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                displayEmpty
                value={estado}
                onChange={(e: SelectChangeEvent) => setEstado(e.target.value)}
                renderValue={(selected) =>
                  selected ? (
                    selected
                  ) : (
                    <span style={{ color: "#94A3B8" }}>Estado</span>
                  )
                }
                sx={{ borderRadius: "8px", height: 36, fontSize: "0.85rem" }}
              >
                <MenuItem value="">Estado</MenuItem>
                <MenuItem value="Pendiente">Pendiente</MenuItem>
                <MenuItem value="Aprobada">Aprobada</MenuItem>
                <MenuItem value="Rechazada">Rechazada</MenuItem>
                <MenuItem value="Cancelada">Cancelada</MenuItem>
              </Select>
            </FormControl>
========== FIN FILTRO ESTADO ========== */}
            {/* Campus */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                displayEmpty
                disabled={cargandoCatalogos}
                value={campus}
                onChange={(e: SelectChangeEvent) => setCampus(e.target.value)}
                renderValue={(selected) =>
                  selected ? selected : <span style={{ color: "#94A3B8" }}>Campus</span>
                }
                sx={{ borderRadius: "8px", height: 36, fontSize: "0.85rem" }}
              >
                <MenuItem value="">Campus</MenuItem>

                {campusLista.map((c: any) => (
                  <MenuItem
                    key={c.id_campus}
                    value={c.nombre}
                  >
                    {c.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Fecha */}
            <TextField
              size="small"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{
                minWidth: 140,
                "& .MuiOutlinedInput-root": { borderRadius: "8px", height: 36 },
                "& .MuiInputBase-input": { fontSize: "0.85rem" },
              }}
            />

            {/* Espacio */}
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <Select
                displayEmpty
                disabled={cargandoCatalogos}
                value={espacio}
                onChange={(e: SelectChangeEvent) => setEspacio(e.target.value)}
                renderValue={(selected) => {
                  if (!selected) {
                    return <span style={{ color: "#94A3B8" }}>Espacio</span>;
                  }

                  const espacioSeleccionado = espaciosLista.find(
                    (e: any) => String(e.id_espacio) === selected
                  );

                  return espacioSeleccionado?.nombre || "Espacio";
                }}
                sx={{ borderRadius: "8px", height: 36, fontSize: "0.85rem" }}
              >
                <MenuItem value="">Espacio</MenuItem>

                {espaciosLista.map((e: any) => (
                  <MenuItem
                    key={e.id_espacio}
                    value={String(e.id_espacio)}
                  >
                    {e.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Tipo */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                displayEmpty
                value={tipo}
                onChange={(e: SelectChangeEvent) => setTipo(e.target.value)}
                renderValue={(selected) => {
                  if (!selected) return <span style={{ color: "#94A3B8" }}>Tipo</span>;
                  if (selected === "interno") return "Institucional";
                  if (selected === "externo") return "Externa";
                  return selected;
                }}
                sx={{ borderRadius: "8px", height: 36, fontSize: "0.85rem" }}
              >
                <MenuItem value="">Tipo</MenuItem>
                <MenuItem value="interno">Institucional</MenuItem>
                <MenuItem value="externo">Externa</MenuItem>
              </Select>
            </FormControl>

            {/* Horario */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                displayEmpty
                value={horario}
                onChange={(e: SelectChangeEvent) => setHorario(e.target.value)}
                renderValue={(selected) => {
                  if (!selected) return <span style={{ color: "#94A3B8" }}>Horario</span>;
                  if (selected === "manana") return "Mañana";
                  if (selected === "tarde") return "Tarde";
                  if (selected === "noche") return "Noche";
                  return selected;
                }}
                sx={{ borderRadius: "8px", height: 36, fontSize: "0.85rem" }}
              >
                <MenuItem value="">Horario</MenuItem>
                <MenuItem value="manana">Mañana</MenuItem>
                <MenuItem value="tarde">Tarde</MenuItem>
                <MenuItem value="noche">Noche</MenuItem>
              </Select>
            </FormControl>

            {/* Botones */}
            <Button
              variant="contained"
              onClick={handleFiltrar}
              sx={{
                backgroundColor: "#1E3A5F",
                textTransform: "none",
                fontWeight: 600,
                borderRadius: "8px",
                height: 36,
                px: 2.5,
                boxShadow: "none",
                whiteSpace: "nowrap",
                fontSize: "0.85rem",
                "&:hover": { backgroundColor: "#0F2744", boxShadow: "none" },
              }}
            >
              Filtrar
            </Button>

            <Button
              variant="text"
              onClick={handleLimpiar}
              sx={{
                textTransform: "none",
                color: "#64748B",
                fontWeight: 500,
                fontSize: "0.85rem",
                whiteSpace: "nowrap",
                minWidth: "auto",
                px: 1,
                "&:hover": { backgroundColor: "transparent", color: "#1E3A5F" },
              }}
            >
              Limpiar filtros
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Tabla */}
        <TableContainer
          sx={{
            backgroundColor: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E2E8F0",
            overflow: "hidden",
          }}
        >
          <Table sx={{ width: "100%", tableLayout: "fixed" }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#F8FAFC" }}>
                {[
                  { label: "Código", width: "12%" },
                  { label: "Solicitante", width: "14%" },
                  { label: "Tipo de solicitud", width: "12%" },
                  { label: "Espacio", width: "14%" },
                  { label: "Fecha", width: "10%" },
                  { label: "Horario", width: "12%" },
                  { label: "Campus", width: "10%" },
                  { label: "Estado", width: "10%" },
                ].map((col) => (
                  <TableCell
                    key={col.label}
                    sx={{
                      fontWeight: 600,
                      color: "#334155",
                      fontSize: "0.78rem",
                      py: 1.5,
                      px: 1.5,
                      width: col.width,
                      borderBottom: "1px solid #E2E8F0",
                    }}
                  >
                    {col.label}
                  </TableCell>
                ))}
                <TableCell
                  sx={{
                    fontWeight: 600,
                    color: "#334155",
                    fontSize: "0.78rem",
                    py: 1.5,
                    px: 1.5,
                    width: "6%",
                    borderBottom: "1px solid #E2E8F0",
                  }}
                />
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} sx={{ textAlign: "center", py: 5 }}>
                    <CircularProgress size={26} />
                    <Typography sx={{ mt: 1, color: "#64748B", fontSize: "0.85rem" }}>
                      Cargando solicitudes...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : solicitudes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} sx={{ textAlign: "center", py: 5, color: "#64748B" }}>
                    No se encontraron solicitudes.
                  </TableCell>
                </TableRow>
              ) : (
                solicitudes.map((s) => (
                  <TableRow
                    key={s.id}
                    sx={{
                      "&:hover": { backgroundColor: "#F8FAFC" },
                      "& td": { borderBottom: "1px solid #F1F5F9" },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem", py: 1.5, px: 1.5 }}>
                      {s.codigo}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        py: 1.5,
                        px: 1.5,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.solicitante}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem", py: 1.5, px: 1.5 }}>
                      {s.tipo === "interno" ? "Institucional" : "Externa"}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        py: 1.5,
                        px: 1.5,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.espacio}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem", py: 1.5, px: 1.5, whiteSpace: "nowrap" }}>
                      {formatearFecha(s.fecha)}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem", py: 1.5, px: 1.5, whiteSpace: "nowrap" }}>
                      {formatearHora(s.hora_inicio)} – {formatearHora(s.hora_fin)}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem", py: 1.5, px: 1.5 }}>
                      {s.campus}
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 1.5 }}>
                      <Chip
                        label={s.estado}
                        size="small"
                        sx={{
                          backgroundColor: estadoStyles[s.estado]?.bg ?? "#F3F4F6",
                          color: estadoStyles[s.estado]?.color ?? "#4B5563",
                          fontWeight: 600,
                          fontSize: "0.7rem",
                          height: 22,
                          borderRadius: "999px",
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 1.5 }}>
                      <Button
                        size="small"
                        onClick={() => navigate(`/admin/solicitudes/${s.id}`)}
                        sx={{
                          textTransform: "none",
                          fontWeight: 600,
                          color: "#2563EB",
                          fontSize: "0.8rem",
                          minWidth: "auto",
                          px: 0.5,
                        }}
                      >
                        Ver →
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Typography
          sx={{
            mt: 2,
            fontSize: "0.8rem",
            color: "#94A3B8",
          }}
        >

        </Typography>
      </Box>
    </AdminLayout>
  );
}