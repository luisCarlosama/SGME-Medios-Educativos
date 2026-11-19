
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
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
} from "@mui/material";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import AdminLayout from "../../../../components/layout/AdminLayout";
import ModalExportarAgenda from "./components/ModalExportarAgenda";
import { listarAgenda } from "./services/agenda.service";
import {
  obtenerCampus,
  obtenerTiposEspacio,
  obtenerEspacios,
} from "../../Public/Reserva/services/reservas.service";

const estadoStyles: Record<string, { bg: string; color: string }> = {
  Aprobada: { bg: "#D1FAE5", color: "#047857" },
  Activa: { bg: "#D1FAE5", color: "#047857" },
  Pendiente: { bg: "#FEF3C7", color: "#B45309" },
  Bloqueado: { bg: "#E5E7EB", color: "#4B5563" },
};

function formatearFecha(fecha: string): string {
  if (!fecha) return "—";

  const solo = String(fecha).split("T")[0];
  const [a, m, d] = solo.split("-");

  return `${d}/${m}/${a}`;
}

function formatearHora(hora: string): string {
  if (!hora) return "";
  return String(hora).slice(0, 5);
}

export default function Agenda() {
  const navigate = useNavigate();

  // Estado del modal de exportación
  const [modalExportar, setModalExportar] = useState(false);

  // Datos de agenda
  const [reservas, setReservas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Catálogos
  const [campusLista, setCampusLista] = useState<any[]>([]);
  const [tiposEspacio, setTiposEspacio] = useState<any[]>([]);
  const [espacios, setEspacios] = useState<any[]>([]);

  // Filtros
  const [campusTab, setCampusTab] = useState("Todos");
  const [fecha, setFecha] = useState("");
  const [idTipoEspacio, setIdTipoEspacio] = useState("");
  const [idEspacio, setIdEspacio] = useState("");
  const [tipo, setTipo] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // Cargar catálogos
  const cargarCatalogos = async () => {
    try {
      const [c, t] = await Promise.all([
        obtenerCampus(),
        obtenerTiposEspacio(),
      ]);

      setCampusLista(
        c.map((x: any) => ({
          id: x.id_campus,
          nombre: x.nombre,
        }))
      );

      setTiposEspacio(
        t.map((x: any) => ({
          id: x.id_tipo_espacio,
          nombre: x.nombre,
        }))
      );
    } catch (err) {
      console.error("Error al cargar catálogos:", err);
    }
  };

  // Cargar agenda aplicando filtros
  const cargarAgenda = async (
    filtrosExtra: Record<string, string> = {}
  ) => {
    setLoading(true);
    setError("");

    try {
      const filtros: Record<string, string> = { ...filtrosExtra };

      if (!("campus" in filtrosExtra) && campusTab && campusTab !== "Todos") {
        filtros.campus = campusTab;
      }

      if (!("fecha" in filtrosExtra) && fecha) {
        filtros.fecha = fecha;
      }

      if (!("tipo_espacio" in filtrosExtra) && idTipoEspacio) {
        filtros.tipo_espacio = idTipoEspacio;
      }

      if (!("espacio" in filtrosExtra) && idEspacio) {
        filtros.espacio = idEspacio;
      }

      if (!("tipo" in filtrosExtra) && tipo) {
        filtros.tipo = tipo;
      }

      if (!("busqueda" in filtrosExtra) && busqueda.trim()) {
        filtros.busqueda = busqueda.trim();
      }

      if (filtros.campus === "") delete filtros.campus;
      if (filtros.fecha === "") delete filtros.fecha;
      if (filtros.tipo_espacio === "") delete filtros.tipo_espacio;
      if (filtros.espacio === "") delete filtros.espacio;
      if (filtros.tipo === "") delete filtros.tipo;
      if (filtros.busqueda === "") delete filtros.busqueda;

      const data = await listarAgenda(filtros);
      setReservas(data || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar la agenda."
      );
    } finally {
      setLoading(false);
    }
  };

  // Carga inicial
  useEffect(() => {
    cargarCatalogos();
    cargarAgenda();
  }, []);

  // Cargar espacios según campus y tipo de espacio
  useEffect(() => {
    const campusId = campusLista.find(
      (c) => c.nombre === campusTab
    )?.id;

    obtenerEspacios(
      campusTab !== "Todos" && campusId
        ? String(campusId)
        : undefined,
      idTipoEspacio || undefined
    )
      .then((lista) =>
        setEspacios(
          lista.map((x: any) => ({
            id: x.id_espacio,
            nombre: x.nombre,
          }))
        )
      )
      .catch(() => setEspacios([]));
  }, [idTipoEspacio, campusTab, campusLista]);

  // Aplicar filtros
  const handleAplicar = () => {
    cargarAgenda();
  };

  // Limpiar filtros
  const handleLimpiar = () => {
    setCampusTab("Todos");
    setFecha("");
    setIdTipoEspacio("");
    setIdEspacio("");
    setTipo("");
    setBusqueda("");

    cargarAgenda({
      campus: "",
      fecha: "",
      tipo_espacio: "",
      espacio: "",
      tipo: "",
      busqueda: "",
    });
  };

  // Exportar agenda a Excel o PDF
  const handleExportar = (
    tipoSeleccionado: "externas" | "internas" | "todas",
    formato: "xlsx" | "pdf"
  ) => {
    let lista = [...reservas];

    if (tipoSeleccionado === "externas") {
      lista = lista.filter(
        (r) => String(r.tipo).toLowerCase() === "externo"
      );
    }

    if (tipoSeleccionado === "internas") {
      lista = lista.filter(
        (r) => String(r.tipo).toLowerCase() === "interno"
      );
    }

    const filas = lista.map((r, index) => ({
      "N°": index + 1,
      Código: r.codigo ?? "",
      Actividad: r.actividad ?? "",
      Tipo:
        String(r.tipo).toLowerCase() === "interno"
          ? "Institucional"
          : "Externa",
      Solicitante: r.solicitante ?? "",
      Espacio: r.espacio ?? "",
      Campus: r.campus ?? "",
      "Fecha reserva": formatearFecha(r.fecha),
      Horario: `${formatearHora(r.hora_inicio)} - ${formatearHora(
        r.hora_fin
      )}`,
      Estado: r.estado ?? "",
    }));

    if (formato === "xlsx") {
      const hoja = XLSX.utils.json_to_sheet(filas);
      const libro = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(libro, hoja, "Agenda");

      XLSX.writeFile(
        libro,
        `Agenda_${tipoSeleccionado}.xlsx`
      );
    } else {
      const documento = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      documento.setFontSize(16);
      documento.text("Agenda de reservas", 14, 15);

      documento.setFontSize(10);
      documento.text(
        `Tipo de solicitudes: ${tipoSeleccionado}`,
        14,
        22
      );

      autoTable(documento, {
        startY: 28,
        head: [
          [
            "N°",
            "Código",
            "Actividad",
            "Tipo",
            "Solicitante",
            "Espacio",
            "Campus",
            "Fecha",
            "Horario",
            "Estado",
          ],
        ],
        body: filas.map((f) => [
          f["N°"],
          f.Código,
          f.Actividad,
          f.Tipo,
          f.Solicitante,
          f.Espacio,
          f.Campus,
          f["Fecha reserva"],
          f.Horario,
          f.Estado,
        ]),
        styles: {
          fontSize: 7,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [30, 58, 95],
        },
        margin: {
          left: 10,
          right: 10,
        },
      });

      documento.save(`Agenda_${tipoSeleccionado}.pdf`);
    }
  };

  const tabsCampus = ["Todos", ...campusLista.map((c) => c.nombre)];

  return (
    <AdminLayout>
      <Box sx={{ width: "100%" }}>
        {/* Encabezado */}
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
              Agenda por campus
            </Typography>

            <Typography sx={{ color: "#64748B", fontSize: "0.95rem" }}>
              Consulta y gestiona la agenda de reservas programadas por
              campus y espacio.
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              onClick={() => setModalExportar(true)}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                borderRadius: "8px",
                borderColor: "#CBD5E1",
                color: "#334155",
              }}
            >
              Exportar agenda
            </Button>

            <Button
              variant="contained"
              onClick={() => navigate("/reserva")}
              sx={{
                backgroundColor: "#E30613",
                textTransform: "none",
                fontWeight: 600,
                borderRadius: "8px",
                boxShadow: "none",
                "&:hover": {
                  backgroundColor: "#C10510",
                  boxShadow: "none",
                },
              }}
            >
              + Nueva reserva
            </Button>
          </Box>
        </Box>

        {/* Pestañas de campus */}
        <Box
          sx={{
            display: "flex",
            gap: 1,
            mb: 2.5,
            flexWrap: "wrap",
          }}
        >
          {tabsCampus.map((nombre) => (
            <Button
              key={nombre}
              onClick={() => {
                setCampusTab(nombre);

                cargarAgenda({
                  campus: nombre === "Todos" ? "" : nombre,
                });
              }}
              sx={{
                textTransform: "none",
                borderRadius: "20px",
                px: 2.5,
                py: 0.75,
                fontWeight: 600,
                backgroundColor:
                  campusTab === nombre ? "#E30613" : "#FFFFFF",
                color:
                  campusTab === nombre ? "#FFFFFF" : "#334155",
                border:
                  campusTab === nombre
                    ? "none"
                    : "1px solid #E2E8F0",
                boxShadow: "none",
                "&:hover": {
                  backgroundColor:
                    campusTab === nombre ? "#C10510" : "#F8FAFC",
                  boxShadow: "none",
                },
              }}
            >
              {nombre}
            </Button>
          ))}
        </Box>

        {/* Filtros */}
        <Box
          sx={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            p: 2,
            mb: 2,
          }}
        >
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: "0.9rem",
              mb: 1.5,
              color: "#0F172A",
            }}
          >
            Filtros de agenda
          </Typography>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
                lg: "repeat(6, 1fr)",
              },
              gap: 1.5,
              mb: 1.5,
            }}
          >
            <TextField
              size="small"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              slotProps={{
                inputLabel: {
                  shrink: true,
                },
              }}
              sx={{
                minWidth: 150,
                "& input": {
                  color: fecha ? "#0F172A" : "#94A3B8",
                },
              }}
            />

            <TextField
              select
              size="small"
              label="Tipo de espacio"
              value={idTipoEspacio}
              onChange={(e) => {
                setIdTipoEspacio(e.target.value);
                setIdEspacio("");
              }}
            >
              <MenuItem value="">Todos</MenuItem>

              {tiposEspacio.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.nombre}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Espacio"
              value={idEspacio}
              onChange={(e) => setIdEspacio(e.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>

              {espacios.map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {e.nombre}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Tipo de solicitud"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              <MenuItem value="">Todas</MenuItem>
              <MenuItem value="interno">Institucional</MenuItem>
              <MenuItem value="externo">Externa</MenuItem>
            </TextField>

            <Button
              variant="contained"
              onClick={handleAplicar}
              sx={{
                backgroundColor: "#1E3A5F",
                textTransform: "none",
                fontWeight: 600,
                borderRadius: "8px",
                boxShadow: "none",
                "&:hover": {
                  backgroundColor: "#0F2744",
                  boxShadow: "none",
                },
              }}
            >
              Aplicar
            </Button>

            <Button
              variant="outlined"
              onClick={handleLimpiar}
              sx={{
                textTransform: "none",
                borderRadius: "8px",
                borderColor: "#E2E8F0",
                color: "#64748B",
              }}
            >
              Limpiar
            </Button>
          </Box>

          <Box
            sx={{
              display: "flex",
              gap: 2,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <TextField
              size="small"
              placeholder="Buscar por actividad, solicitante, espacio o código"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAplicar();
              }}
              sx={{
                flex: 1,
                minWidth: 240,
              }}
            />

            <Typography sx={{ color: "#64748B", fontSize: "0.85rem" }}>
              {reservas.length} reservas agendadas
            </Typography>
          </Box>
        </Box>

        {/* Mensaje de error */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Tabla de agenda */}
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
              <TableRow sx={{ backgroundColor: "#1E3A5F" }}>
                {[
                  "Código",
                  "Actividad",
                  "Tipo",
                  "Solicitante",
                  "Espacio",
                  "Campus",
                  "Fecha",
                  "Horario",
                  "Estado",
                  "Acción",
                ].map((h) => (
                  <TableCell
                    key={h}
                    sx={{
                      color: "#FFFFFF",
                      fontWeight: 600,
                      fontSize: "0.78rem",
                      py: 1.5,
                      px: 1.25,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    sx={{ textAlign: "center", py: 5 }}
                  >
                    <CircularProgress size={26} />
                  </TableCell>
                </TableRow>
              ) : reservas.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    sx={{
                      textAlign: "center",
                      py: 5,
                      color: "#64748B",
                    }}
                  >
                    No hay reservas aprobadas vigentes.
                  </TableCell>
                </TableRow>
              ) : (
                reservas.map((r) => (
                  <TableRow
                    key={r.id}
                    sx={{
                      "&:hover": {
                        backgroundColor: "#F8FAFC",
                      },
                      "& td": {
                        borderBottom: "1px solid #F1F5F9",
                      },
                    }}
                  >
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: "0.8rem",
                        py: 1.25,
                        px: 1.25,
                      }}
                    >
                      {r.codigo}
                    </TableCell>

                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        py: 1.25,
                        px: 1.25,
                      }}
                    >
                      {r.actividad}
                    </TableCell>

                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        py: 1.25,
                        px: 1.25,
                      }}
                    >
                      {String(r.tipo).toLowerCase() === "interno"
                        ? "Interna"
                        : "Externa"}
                    </TableCell>

                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        py: 1.25,
                        px: 1.25,
                      }}
                    >
                      {r.solicitante}
                    </TableCell>

                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        py: 1.25,
                        px: 1.25,
                      }}
                    >
                      {r.espacio}
                    </TableCell>

                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        py: 1.25,
                        px: 1.25,
                      }}
                    >
                      {r.campus}
                    </TableCell>

                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        py: 1.25,
                        px: 1.25,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatearFecha(r.fecha)}
                    </TableCell>

                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        py: 1.25,
                        px: 1.25,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatearHora(r.hora_inicio)}–
                      {formatearHora(r.hora_fin)}
                    </TableCell>

                    <TableCell sx={{ py: 1.25, px: 1.25 }}>
                      <Chip
                        label={r.estado}
                        size="small"
                        sx={{
                          backgroundColor:
                            estadoStyles[r.estado]?.bg ?? "#F3F4F6",
                          color:
                            estadoStyles[r.estado]?.color ?? "#4B5563",
                          fontWeight: 600,
                          fontSize: "0.7rem",
                          height: 22,
                        }}
                      />
                    </TableCell>

                    <TableCell sx={{ py: 1.25, px: 1.25 }}>
                      <Button
                        size="small"
                        onClick={() =>
                          navigate(`/admin/solicitudes/${r.id}`)
                        }
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
            mt: 1.5,
            color: "#64748B",
            fontSize: "0.85rem",
          }}
        >
          Mostrando {reservas.length} reserva
          {reservas.length === 1 ? "" : "s"} agendada
          {reservas.length === 1 ? "" : "s"}
        </Typography>
      </Box>

      {/* Modal independiente de exportación de Agenda */}
      <ModalExportarAgenda
        open={modalExportar}
        onClose={() => setModalExportar(false)}
        onExportar={handleExportar}
      />
    </AdminLayout>
  );
}
