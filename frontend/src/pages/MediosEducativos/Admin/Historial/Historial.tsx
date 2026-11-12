import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
} from "@mui/material";
import AdminLayout from "../../../../components/layout/AdminLayout";
import {
  listarHistorialReservas,
  listarHistorialCeremonias,
  obtenerProgramasCatalogo,
} from "./services/historial.service";

import ModalExportarHistorial from "./components/ModalExportarHistorial";

type TabType = "reservas" | "ceremonias";

const MESES = [
  { value: "", label: "Todos" },
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

const ANIOS = [
  { value: "", label: "Todos" },
  { value: "2026", label: "2026" },
  { value: "2025", label: "2025" },
  { value: "2024", label: "2024" },
];


function formatearFecha(fecha: string): string {
  if (!fecha) return "—";
  const solo = fecha.split("T")[0];
  const [anio, mes, dia] = solo.split("-");
  return `${dia}/${mes}/${anio}`;
}

const thSx = {
  fontWeight: 600,
  color: "#334155",
  fontSize: "0.78rem",
  py: 1.5,
  px: 1.5,
  borderBottom: "1px solid #E2E8F0",
};

const tdSx = {
  fontSize: "0.8rem",
  py: 1.5,
  px: 1.5,
  borderBottom: "1px solid #F1F5F9",
};

export default function Historial() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabType>("reservas");

  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalExportar, setModalExportar] = useState(false);

  const [anio, setAnio] = useState("");
  const [mes, setMes] = useState("");
  const [programa, setPrograma] = useState("");
  const [codigoCeremonia, setCodigoCeremonia] = useState("");
  const [programas, setProgramas] = useState<{ id: number; nombre: string }[]>([]);


  const cargarDatos = async (limpiar = false) => {
    setLoading(true);
    setError("");

    const anioFiltro = limpiar ? "" : anio;
    const mesFiltro = limpiar ? "" : mes;
    const programaFiltro = limpiar ? "" : programa;
    const codigoFiltro = limpiar ? "" : codigoCeremonia;

    try {
      if (tab === "reservas") {
        const filtros: Record<string, string> = {};

        if (anioFiltro) filtros.anio = anioFiltro;
        if (mesFiltro) filtros.mes = mesFiltro;
        if (programaFiltro) filtros.programa = programaFiltro;

        const data = await listarHistorialReservas(filtros);

        const ahora = new Date();

        const filtrados = (Array.isArray(data) ? data : []).filter((r: any) => {
          // Rechazadas y Canceladas siempre van a historial
          if (r.estado === "Rechazada" || r.estado === "Cancelada") {
            return true;
          }

          // Vencidas (si existe ese estado)
          if (r.estado === "Vencida") {
            return true;
          }

          // Aprobadas solo si YA TERMINÓ el horario
          if (r.estado === "Aprobada") {
            const fecha = r.fecha || r.fecha_inicio || "";
            const horaFin = r.hora_fin || "23:59:59";

            // Construye la fecha+hora de finalización
            const fechaFin = new Date(`${fecha.split("T")[0]}T${horaFin}`);

            // Si no se pudo parsear la fecha, no la mostramos
            if (isNaN(fechaFin.getTime())) return false;

            return fechaFin < ahora; // ya terminó → historial
          }

          return false;
        });

        setRegistros(filtrados);
      } else {
        const data = await listarHistorialCeremonias({});
        let filtrados = Array.isArray(data) ? [...data] : [];

        if (anioFiltro) {
          filtrados = filtrados.filter((c: any) =>
            String(c.fechaISO || c.fecha || "").includes(anioFiltro)
          );
        }

        if (mesFiltro) {
          filtrados = filtrados.filter((c: any) => {
            const f = String(c.fechaISO || c.fecha || "");
            return (
              f.includes(`-${mesFiltro}-`) ||
              f.includes(`/${mesFiltro}/`)
            );
          });
        }

        if (programaFiltro.trim()) {
          const programaBuscado = programaFiltro.trim().toLowerCase();

          filtrados = filtrados.filter((c: any) =>
            String(c.programas ?? "")
              .toLowerCase()
              .includes(programaBuscado)
          );
        }

        if (codigoFiltro.trim()) {
          const codigo = codigoFiltro.trim().toLowerCase();

          filtrados = filtrados.filter((c: any) =>
            String(c.codigo || "").toLowerCase().includes(codigo)
          );
        }

        setRegistros(filtrados);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "No se pudo cargar el historial."
      );
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    obtenerProgramasCatalogo()
      .then(setProgramas)
      .catch(() => setProgramas([]));
  }, []);

  const handleBuscar = () => cargarDatos();

  const handleLimpiar = () => {
    setAnio("");
    setMes("");
    setPrograma("");
    setCodigoCeremonia("");

    cargarDatos(true);
  };


  const handleExportar = (formato: "xlsx" | "pdf") => {
    if (!registros.length) {
      alert("No hay registros para exportar.");
      return;
    }

    // "registros" contiene los resultados de la pestaña activa
    // después de aplicar los filtros de búsqueda.
    const filas =
      tab === "reservas"
        ? registros.map((r, i) => ({
          "N°": i + 1,
          Código: r.codigo ?? "—",
          Fecha: formatearFecha(r.fecha || r.fecha_inicio),
          Solicitante: r.solicitante ?? "—",
          Tipo: r.tipo ?? "—",
          Programa: r.programa ?? "—",
          Espacio: r.espacio ?? "—",
          Campus: r.campus ?? "—",
          Estado: r.estado ?? "—",
        }))
        : registros.map((c, i) => ({
          "N°": i + 1,
          Código: c.codigo ?? "—",
          Ceremonia: c.nombre ?? "—",
          Fecha: c.fecha ?? c.fechaISO ?? "—",
          Programas: c.programas ?? "—",
          Estado: c.estado ?? "—",
        }));

    const ahora = new Date();
    const fechaGen = [
      ahora.getFullYear(),
      String(ahora.getMonth() + 1).padStart(2, "0"),
      String(ahora.getDate()).padStart(2, "0"),
    ].join("-");

    const nombreHoja = tab === "reservas" ? "Reservas" : "Ceremonias";
    const nombreArchivo =
      tab === "reservas" ? "SGME_Historial_Reservas" : "SGME_Historial_Ceremonias";

    if (formato === "xlsx") {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(filas);
      XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
      XLSX.writeFile(wb, `${nombreArchivo}_${fechaGen}.xlsx`);
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    const titulo =
      tab === "reservas"
        ? "SGME - Historial de reservas"
        : "SGME - Historial de ceremonias";

    doc.setFontSize(14);
    doc.text(titulo, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generado: ${ahora.toLocaleString("es-CO")}`, 14, 22);
    doc.text(`Registros exportados: ${filas.length}`, 14, 27);

    autoTable(doc, {
      startY: 32,
      head: [Object.keys(filas[0])],
      body: filas.map((f) => Object.values(f).map((v) => String(v ?? ""))),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 95] },
    });

    doc.save(`${nombreArchivo}_${fechaGen}.pdf`);
  };


  return (
    <AdminLayout>
      <Box sx={{ width: "100%" }}>
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
              {tab === "reservas"
                ? "Historial de reservas"
                : "Historial de ceremonias"}
            </Typography>
            <Typography sx={{ color: "#64748B", fontSize: "0.95rem" }}>
              {tab === "reservas"
                ? "Consulta y exporta el historial de solicitudes y reservas gestionadas."
                : "Consulta y gestiona el repositorio histórico de ceremonias finalizadas."}
            </Typography>
          </Box>


          <Button
            variant="contained"
            onClick={() => setModalExportar(true)}
            sx={{
              backgroundColor: "#1E3A5F",
              textTransform: "none",
              fontWeight: 600,
              borderRadius: "8px",
              px: 2.5,
              boxShadow: "none",
              "&:hover": { backgroundColor: "#0F2744", boxShadow: "none" },
            }}
          >
            Exportar
          </Button>

        </Box>

        <Box
          sx={{
            display: "flex",
            backgroundColor: "#F1F5F9",
            borderRadius: "12px",
            p: 0.5,
            mb: 3,
            maxWidth: 480,
          }}
        >
          <Button
            fullWidth
            onClick={() => setTab("reservas")}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              borderRadius: "10px",
              py: 1.2,
              backgroundColor: tab === "reservas" ? "#1E3A5F" : "transparent",
              color: tab === "reservas" ? "#FFFFFF" : "#64748B",
              boxShadow: "none",
              "&:hover": {
                backgroundColor: tab === "reservas" ? "#1E3A5F" : "#E2E8F0",
                boxShadow: "none",
              },
            }}
          >
            Reservas
          </Button>
          <Button
            fullWidth
            onClick={() => setTab("ceremonias")}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              borderRadius: "10px",
              py: 1.2,
              backgroundColor: tab === "ceremonias" ? "#1E3A5F" : "transparent",
              color: tab === "ceremonias" ? "#FFFFFF" : "#64748B",
              boxShadow: "none",
              "&:hover": {
                backgroundColor: tab === "ceremonias" ? "#1E3A5F" : "#E2E8F0",
                boxShadow: "none",
              },
            }}
          >
            Ceremonias
          </Button>
        </Box>

        <Box
          sx={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            p: 2.5,
            mb: 3,
          }}
        >
          <Typography
            sx={{ fontWeight: 700, fontSize: "1rem", color: "#0F172A", mb: 2 }}
          >
            Consultar historial
          </Typography>

          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1.5,
              alignItems: "center",
            }}
          >
            <TextField
              select
              size="small"
              label="Año"
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
              sx={{ minWidth: 120 }}
            >
              {ANIOS.map((a) => (
                <MenuItem key={a.value} value={a.value}>
                  {a.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Mes"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              sx={{ minWidth: 130 }}
            >
              {MESES.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Programa"
              value={programa}
              onChange={(e) => setPrograma(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Todos los programas</MenuItem>
              {programas.map((p) => (
                <MenuItem key={p.id} value={p.nombre}>
                  {p.nombre}
                </MenuItem>
              ))}
            </TextField>

            {tab === "ceremonias" && (
              <TextField
                size="small"
                label="Código de ceremonia"
                placeholder="Buscar por código"
                value={codigoCeremonia}
                onChange={(e) => setCodigoCeremonia(e.target.value)}
                sx={{ minWidth: 180 }}
              />
            )}

            <Button
              variant="contained"
              onClick={handleBuscar}
              sx={{
                backgroundColor: "#1E3A5F",
                textTransform: "none",
                fontWeight: 600,
                borderRadius: "8px",
                px: 2.5,
                boxShadow: "none",
                "&:hover": { backgroundColor: "#0F2744", boxShadow: "none" },
              }}
            >
              Buscar
            </Button>

            <Button
              variant="text"
              onClick={handleLimpiar}
              sx={{ textTransform: "none", color: "#64748B" }}
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

        <Typography
          sx={{
            color: "#334155",
            fontWeight: 600,
            fontSize: "0.9rem",
            mb: 1.5,
          }}
        >
          {loading
            ? "Cargando..."
            : `${registros.length} resultados encontrados`}
        </Typography>

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
                {tab === "reservas" ? (
                  <>
                    <TableCell sx={thSx}>Código</TableCell>
                    <TableCell sx={thSx}>Fecha</TableCell>
                    <TableCell sx={thSx}>Programa</TableCell>
                    <TableCell sx={thSx}>Espacio</TableCell>
                    <TableCell sx={thSx}>Estado</TableCell>
                    <TableCell sx={thSx}>Acciones</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell sx={thSx}>Código</TableCell>
                    <TableCell sx={thSx}>Ceremonia</TableCell>
                    <TableCell sx={thSx}>Fecha</TableCell>
                    <TableCell sx={thSx}>Programas</TableCell>
                    <TableCell sx={thSx}>Estado</TableCell>
                    <TableCell sx={thSx}>Acciones</TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: "center", py: 5 }}>
                    <CircularProgress size={26} />
                  </TableCell>
                </TableRow>
              ) : registros.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    sx={{ textAlign: "center", py: 5, color: "#64748B" }}
                  >
                    No se encontraron registros.
                  </TableCell>
                </TableRow>
              ) : tab === "reservas" ? (
                registros.map((r) => (
                  <TableRow
                    key={r.id}
                    sx={{ "&:hover": { backgroundColor: "#F8FAFC" } }}
                  >
                    <TableCell sx={tdSx}>{r.codigo}</TableCell>
                    <TableCell sx={tdSx}>
                      {formatearFecha(r.fecha || r.fecha_inicio)}
                    </TableCell>
                    <TableCell sx={tdSx}>{r.programa || "—"}</TableCell>
                    <TableCell sx={tdSx}>{r.espacio || "—"}</TableCell>
                    <TableCell sx={tdSx}>
                      <Chip
                        label={r.estado}
                        size="small"
                        sx={{
                          backgroundColor: "#E0F2FE",
                          color: "#0369A1",
                          fontWeight: 600,
                          fontSize: "0.7rem",
                          height: 22,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={tdSx}>
                      <Button
                        size="small"
                        onClick={() =>
                          navigate(`/admin/historial/reserva/${r.id}`)
                        }
                        sx={{
                          textTransform: "none",
                          fontWeight: 600,
                          color: "#2563EB",
                        }}
                      >
                        Ver detalle →
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                registros.map((c) => (
                  <TableRow
                    key={c.id}
                    sx={{ "&:hover": { backgroundColor: "#F8FAFC" } }}
                  >
                    <TableCell sx={tdSx}>{c.codigo}</TableCell>
                    <TableCell sx={tdSx}>{c.nombre}</TableCell>
                    <TableCell sx={tdSx}>{c.fecha}</TableCell>
                    <TableCell sx={tdSx}>{c.programas || "—"}</TableCell>
                    <TableCell sx={tdSx}>
                      <Chip
                        label={c.estado}
                        size="small"
                        sx={{
                          backgroundColor: "#D1FAE5",
                          color: "#047857",
                          fontWeight: 600,
                          fontSize: "0.7rem",
                          height: 22,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={tdSx}>
                      <Button
                        size="small"
                        onClick={() =>
                          navigate(`/admin/historial/ceremonia/${c.id}`)
                        }
                        sx={{
                          textTransform: "none",
                          fontWeight: 600,
                          color: "#2563EB",
                        }}
                      >
                        Ver detalle →
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Typography sx={{ color: "#94A3B8", fontSize: "0.8rem", mt: 2 }}>
          Los registros históricos se conservan para consulta y no se editan
          desde este repositorio.
        </Typography>
      </Box>
      <ModalExportarHistorial
        open={modalExportar}
        onClose={() => setModalExportar(false)}
        onExportar={handleExportar}
        tipo={tab}
        cantidad={registros.length}
      />
    </AdminLayout>
  );
}

