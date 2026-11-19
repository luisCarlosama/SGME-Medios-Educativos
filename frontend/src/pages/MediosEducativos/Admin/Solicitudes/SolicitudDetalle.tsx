
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";

import AdminLayout from "../../../../components/layout/AdminLayout";

import {
  obtenerSolicitudPorId,
  actualizarEstadoSolicitud,
  actualizarSolicitud,
} from "./services/solicitudes.service";

import {
  obtenerCampus,
  obtenerTiposEspacio,
  obtenerEspacios,
  obtenerCatalogosInstitucionales,
} from "../../Public/Reserva/services/reservas.service";

// CONFIGURACIÓN

const estadoStyles: Record<string, { bg: string; color: string }> = {
  Pendiente: { bg: "#FEF3C7", color: "#B45309" },
  Aprobada: { bg: "#D1FAE5", color: "#047857" },
  "En proceso": { bg: "#DBEAFE", color: "#1D4ED8" },
  Rechazada: { bg: "#FEE2E2", color: "#B91C1C" },
  Cancelada: { bg: "#F3F4F6", color: "#4B5563" },
};

const HORAS = [
  "07:00", "08:00", "09:00", "10:00",
  "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00",
];

// FUNCIONES AUXILIARES

function formatearFecha(fecha?: string | null): string {
  if (!fecha) return "—";

  const soloFecha = fecha.split("T")[0];
  const partes = soloFecha.split("-");

  if (partes.length !== 3) return fecha;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatearHora(hora?: string | null): string {
  if (!hora) return "—";
  return hora.slice(0, 5);
}

function obtenerFechaInput(fecha?: string | null): string {
  if (!fecha) return "";
  return fecha.split("T")[0];
}

function generarOcurrencias(
  fechaInicio: string,
  fechaFin: string,
  frecuencia: string,
  diasSemana: number[],
  horaInicio: string,
  horaFin: string
) {
  const resultado = [];
  const inicio = new Date(`${fechaInicio}T12:00:00Z`);
  const fin = new Date(`${fechaFin}T12:00:00Z`);

  for (
    let fecha = new Date(inicio);
    fecha <= fin;
    fecha.setUTCDate(fecha.getUTCDate() + 1)
  ) {
    const dia = fecha.getUTCDay() || 7;

    let incluir = false;

    if (frecuencia === "diaria") {
      incluir = true;
    } else if (frecuencia === "semanal") {
      incluir = diasSemana.includes(dia);
    } else if (frecuencia === "mensual") {
      incluir = fecha.getUTCDate() === inicio.getUTCDate();
    }

    if (incluir) {
      const fechaISO = fecha.toISOString().slice(0, 10);

      resultado.push({
        fecha_inicio: fechaISO,
        fecha_fin: fechaISO,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
      });
    }
  }

  return resultado;
}

function generarFechasRecurrencia(
  inicio: string,
  fin: string,
  frecuencia: string,
  diasSemana: number[] = []
): string[] {
  if (!inicio || !fin || !frecuencia) return [];

  const fechas: string[] = [];
  const fecha = new Date(`${inicio}T12:00:00Z`);
  const fechaFinal = new Date(`${fin}T12:00:00Z`);
  const diaInicial = fecha.getUTCDate();

  while (fecha <= fechaFinal) {
    const diaSemana = fecha.getUTCDay() === 0
      ? 7
      : fecha.getUTCDay();

    let incluir = false;

    if (frecuencia === "diaria") {
      incluir = true;
    }

    if (frecuencia === "semanal") {
      incluir = diasSemana.includes(diaSemana);
    }

    if (frecuencia === "mensual") {
      incluir = fecha.getUTCDate() === diaInicial;
    }

    if (incluir) {
      fechas.push(fecha.toISOString().slice(0, 10));
    }

    fecha.setUTCDate(fecha.getUTCDate() + 1);
  }

  return fechas;
}

// COMPONENTE PRINCIPAL

export default function DetalleSolicitud() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Solicitud
  const [solicitud, setSolicitud] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Mensajes
  const [error, setError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");

  // Acciones
  const [accionando, setAccionando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Diálogo de notificación
  const [dialogoCorreo, setDialogoCorreo] = useState(false);

  const [resultadoCorreo, setResultadoCorreo] = useState<{
    enviada: boolean;
    simulado: boolean;
    correo: string | null;
  } | null>(null);

  // Edición
  const [modoEdicion, setModoEdicion] = useState(false);
  const [form, setForm] = useState<any>({});

  // Catálogos
  const [campus, setCampus] = useState<any[]>([]);
  const [tiposEspacio, setTiposEspacio] = useState<any[]>([]);
  const [espacios, setEspacios] = useState<any[]>([]);
  const [dependencias, setDependencias] = useState<any[]>([]);
  const [facultades, setFacultades] = useState<any[]>([]);
  const [programas, setProgramas] = useState<any[]>([]);

  // CARGAR SOLICITUD

  useEffect(() => {
    if (!id) {
      setError("No se recibió el identificador de la solicitud.");
      setLoading(false);
      return;
    }

    let activo = true;

    const cargarSolicitud = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await obtenerSolicitudPorId(id);

        if (activo) {
          setSolicitud(data);
        }
      } catch (err: unknown) {
        if (activo) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar la solicitud."
          );
        }
      } finally {
        if (activo) {
          setLoading(false);
        }
      }
    };

    cargarSolicitud();

    return () => {
      activo = false;
    };
  }, [id]);

  // CARGAR CATÁLOGOS AL ENTRAR EN MODO EDICIÓN

  useEffect(() => {
    if (!modoEdicion || !solicitud) return;

    let activo = true;

    const cargarCatalogos = async () => {
      try {
        // Campus y catálogos institucionales no dependen entre sí.
        const [c, catalogos] = await Promise.all([
          obtenerCampus(),
          obtenerCatalogosInstitucionales(),
        ]);

        if (!activo) return;

        const campusList = c.map((x: any) => ({
          id: x.id_campus,
          nombre: x.nombre,
        }));

        // Los tipos de espacio requieren el ID del campus seleccionado.
        const espacio = solicitud.espacio || {};
        const campusEncontrado = campusList.find(
          (x: any) => x.nombre === espacio.campus
        );
        const idCampus = espacio.id_campus ?? campusEncontrado?.id;

        const t = idCampus
          ? await obtenerTiposEspacio(Number(idCampus))
          : [];

        if (!activo) return;

        const tiposList = t.map((x: any) => ({
          id: x.id_tipo_espacio,
          nombre: x.nombre,
        }));

        const dependenciasList = (catalogos.dependencias || []).map((x: any) => ({
          id: x.id_dependencia,
          nombre: x.nombre,
        }));

        const facultadesList = (catalogos.facultades || []).map((x: any) => ({
          id: x.id_facultad,
          nombre: x.nombre,
        }));

        const programasList = (catalogos.programas || []).map((x: any) => ({
          id: x.id_programa,
          nombre: x.nombre,
          id_facultad: x.id_facultad,
        }));

        setCampus(campusList);
        setTiposEspacio(tiposList);
        setDependencias(dependenciasList);
        setFacultades(facultadesList);
        setProgramas(programasList);

        const solicitante = solicitud.solicitante || {};

        const tipoEncontrado = tiposList.find(
          (x: any) => x.nombre === espacio.tipo
        );

        const dependenciaEncontrada = dependenciasList.find(
          (x: any) => x.nombre === solicitante.dependencia
        );

        const programaEncontrado = programasList.find(
          (x: any) =>
            String(x.id) === String(solicitante.id_programa ?? "") ||
            x.nombre === solicitante.programa
        );

        const facultadEncontrada = facultadesList.find(
          (x: any) =>
            String(x.id) === String(solicitante.id_facultad ?? "") ||
            x.nombre === solicitante.facultad
        );

        setForm((prev: any) => ({
          ...prev,

          id_campus: String(
            espacio.id_campus ?? campusEncontrado?.id ?? ""
          ),

          id_tipo_espacio: String(
            espacio.id_tipo_espacio ?? tipoEncontrado?.id ?? ""
          ),

          id_espacio: String(
            espacio.id_espacio ?? espacio.id ?? prev.id_espacio ?? ""
          ),

          id_dependencia: String(
            solicitante.id_dependencia ??
            dependenciaEncontrada?.id ??
            ""
          ),

          id_facultad: String(
            solicitante.id_facultad ??
            facultadEncontrada?.id ??
            programaEncontrado?.id_facultad ??
            ""
          ),

          id_programa: String(
            solicitante.id_programa ??
            programaEncontrado?.id ??
            ""
          ),
        }));
      } catch (err) {
        console.error("Error cargando catálogos:", err);

        if (activo) {
          setError(
            "No fue posible cargar los catálogos para editar la solicitud."
          );
        }
      }
    };

    cargarCatalogos();

    return () => {
      activo = false;
    };
  }, [modoEdicion, solicitud]);

  // CARGAR ESPACIOS SEGÚN CAMPUS Y TIPO

  useEffect(() => {
    if (!modoEdicion || !form.id_campus) {
      setEspacios([]);
      return;
    }

    let activo = true;

    const cargarEspacios = async () => {
      try {
        const lista = await obtenerEspacios(
          Number(form.id_campus),
          form.id_tipo_espacio
            ? Number(form.id_tipo_espacio)
            : undefined
        );

        if (!activo) return;

        const espaciosList = lista.map((x: any) => ({
          id: x.id_espacio,
          nombre: x.nombre,
        }));

        setEspacios(espaciosList);
      } catch (err) {
        console.error("Error cargando espacios:", err);

        if (activo) {
          setEspacios([]);
        }
      }
    };

    cargarEspacios();

    return () => {
      activo = false;
    };
  }, [modoEdicion, form.id_campus, form.id_tipo_espacio]);

  // ENTRAR EN MODO EDICIÓN

  const entrarEdicion = () => {
    if (!solicitud) return;

    const solicitante = solicitud.solicitante || {};
    const espacio = solicitud.espacio || {};

    setForm({
      // Datos del evento
      nombre_actividad: solicitud.nombre_actividad || "",
      fecha_inicio: obtenerFechaInput(solicitud.fecha_inicio),
      fecha_fin: obtenerFechaInput(solicitud.fecha_fin),
      hora_inicio: formatearHora(solicitud.hora_inicio),
      hora_fin: formatearHora(solicitud.hora_fin),

      medios_requeridos: solicitud.medios_requeridos || "",
      observaciones: solicitud.observaciones || "",

      // Datos de recurrencia
      es_recurrente: solicitud.es_recurrente ?? false,
      frecuencia_recurrencia: solicitud.frecuencia_recurrencia || "",
      dias_semana: Array.isArray(solicitud.dias_semana)
        ? solicitud.dias_semana.map(Number)
        : [],

      // Solicitante
      nombre: solicitante.nombre || "",
      cargo: solicitante.cargo || "",
      correo: solicitante.correo || "",
      numero_contacto: solicitante.numero_contacto || "",
      identificacion: solicitante.identificacion || "",
      nombre_entidad: solicitante.nombre_entidad || "",
      tipo_entidad: solicitante.tipo_entidad || "",
      ciudad: solicitante.ciudad || "",

      id_dependencia: solicitante.id_dependencia != null
        ? String(solicitante.id_dependencia)
        : "",

      id_facultad: solicitante.id_facultad != null
        ? String(solicitante.id_facultad)
        : "",

      id_programa: solicitante.id_programa != null
        ? String(solicitante.id_programa)
        : "",

      // Espacio
      id_campus: espacio.id_campus != null
        ? String(espacio.id_campus)
        : "",

      id_tipo_espacio: espacio.id_tipo_espacio != null
        ? String(espacio.id_tipo_espacio)
        : "",

      id_espacio: espacio.id_espacio != null
        ? String(espacio.id_espacio)
        : espacio.id != null
          ? String(espacio.id)
          : "",
    });

    setModoEdicion(true);
    setMensajeExito("");
    setError("");
  };

  // CANCELAR EDICIÓN

  const cancelarEdicion = () => {
    setModoEdicion(false);
    setError("");
    setEspacios([]);
  };

  // CAMBIOS EN FORMULARIO

  const handleChange = (campo: string) => (e: any) => {
    const valor = e.target.value;

    setForm((prev: any) => {
      const nuevoForm = {
        ...prev,
        [campo]: valor,
      };

      // Al cambiar campus, limpiar tipo y espacio
      if (campo === "id_campus") {
        nuevoForm.id_tipo_espacio = "";
        nuevoForm.id_espacio = "";
      }

      // Al cambiar tipo, limpiar espacio
      if (campo === "id_tipo_espacio") {
        nuevoForm.id_espacio = "";
      }

      // La facultad determina los programas disponibles.
      if (campo === "id_facultad") {
        nuevoForm.id_programa = "";
      }

      return nuevoForm;
    });
  };

  // GUARDAR CAMBIOS

  const guardarCambios = async () => {
    if (!id || guardando) return;

    if (!form.nombre_actividad?.trim()) {
      setError("Debes ingresar el nombre de la actividad.");
      return;
    }

    if (!form.fecha_inicio || !form.fecha_fin) {
      setError("Debes seleccionar las fechas del evento.");
      return;
    }

    if (form.fecha_fin < form.fecha_inicio) {
      setError("La fecha final no puede ser anterior a la inicial.");
      return;
    }

    if (!form.hora_inicio || !form.hora_fin) {
      setError("Debes seleccionar el horario del evento.");
      return;
    }

    if (form.hora_fin <= form.hora_inicio) {
      setError("La hora final debe ser posterior a la inicial.");
      return;
    }

    if (!form.id_espacio) {
      setError("Debes seleccionar un espacio.");
      return;
    }

    if (esInterno && !form.id_dependencia) {
      setError("Debes seleccionar la dependencia del solicitante.");
      return;
    }

    if (esInterno && !form.id_facultad) {
      setError("Debes seleccionar la facultad del solicitante.");
      return;
    }

    if (esInterno && !form.id_programa) {
      setError("Debes seleccionar el programa del solicitante.");
      return;
    }

    const esRecurrente =
      esInterno && Boolean(form.es_recurrente);

    if (esRecurrente) {
      if (form.fecha_inicio === form.fecha_fin) {
        setError(
          "Una solicitud recurrente debe tener fechas inicial y final diferentes."
        );
        return;
      }

      if (
        !["diaria", "semanal", "mensual"].includes(
          form.frecuencia_recurrencia
        )
      ) {
        setError("Debes seleccionar una frecuencia de recurrencia válida.");
        return;
      }

      if (
        form.frecuencia_recurrencia === "semanal" &&
        (!Array.isArray(form.dias_semana) ||
          form.dias_semana.length === 0)
      ) {
        setError("Debes seleccionar los días de la semana.");
        return;
      }
      if (
        form.frecuencia_recurrencia === "semanal" &&
        (!Array.isArray(form.dias_semana) || form.dias_semana.length === 0)
      ) {
        setError("Debes seleccionar los días de la semana.");
        return;
      }
    }

    setGuardando(true);
    setError("");
    setMensajeExito("");

    try {
      const {
        id_facultad: _id_facultad,
        ...datosFormulario
      } = form;

      const ocurrenciasActualizadas = esRecurrente
        ? generarOcurrencias(
          form.fecha_inicio,
          form.fecha_fin,
          form.frecuencia_recurrencia,
          form.dias_semana || [],
          form.hora_inicio,
          form.hora_fin
        )
        : [];

      if (esRecurrente && ocurrenciasActualizadas.length === 0) {
        setError("No se pudieron generar las ocurrencias de la recurrencia.");
        setGuardando(false);
        return;
      }

      const datosActualizar = {
        ...datosFormulario,

        es_recurrente: esRecurrente,

        frecuencia_recurrencia: esRecurrente
          ? form.frecuencia_recurrencia
          : null,

        dias_semana:
          esRecurrente && form.frecuencia_recurrencia === "semanal"
            ? form.dias_semana.map(Number)
            : null,

        id_espacio: Number(form.id_espacio),

        id_dependencia: form.id_dependencia
          ? Number(form.id_dependencia)
          : null,

        id_programa: form.id_programa
          ? Number(form.id_programa)
          : null,

        ocurrencias: ocurrenciasActualizadas,
      };
      console.log(
        "Datos enviados para actualizar solicitud:",
        datosActualizar
      );

      await actualizarSolicitud(id, datosActualizar);

      const actualizada = await obtenerSolicitudPorId(id);

      setSolicitud(actualizada);
      setModoEdicion(false);
      setMensajeExito("Cambios guardados correctamente.");

    } catch (err: unknown) {
      console.error("Error actualizando solicitud:", err);

      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron guardar los cambios."
      );

    } finally {
      setGuardando(false);
    }
  };

  // APROBAR SOLICITUD

  const handleAprobar = async () => {
    if (!id || accionando) return;

    setAccionando(true);
    setError("");
    setMensajeExito("");
    setResultadoCorreo(null);

    try {
      const respuesta = await actualizarEstadoSolicitud(
        id,
        "Aprobada"
      );

      const actualizada = await obtenerSolicitudPorId(id);

      setSolicitud(actualizada);

      setResultadoCorreo(
        respuesta?.notificacion ?? null
      );

      setDialogoCorreo(true);
    } catch (err: unknown) {
      console.error("Error aprobando solicitud:", err);

      setError(
        err instanceof Error
          ? err.message
          : "No se pudo aprobar la solicitud."
      );
    } finally {
      setAccionando(false);
    }
  };

  // RECHAZAR SOLICITUD

  const handleRechazar = () => {
    navigate(`/admin/solicitudes/${id}/rechazar`);
  };

  // ESTADOS DE CARGA Y ERROR

  if (loading) {
    return (
      <AdminLayout>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            py: 10,
          }}
        >
          <CircularProgress />
        </Box>
      </AdminLayout>
    );
  }

  if (error && !solicitud) {
    return (
      <AdminLayout>
        <Box sx={{ maxWidth: 600, mx: "auto", py: 6 }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>

          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/admin/dashboard")}
          >
            Volver al Dashboard
          </Button>
        </Box>
      </AdminLayout>
    );
  }

  if (!solicitud) {
    return (
      <AdminLayout>
        <Alert severity="warning">
          No se encontró la solicitud.
        </Alert>
      </AdminLayout>
    );
  }

  // DATOS DERIVADOS

  const esInterno =
    solicitud?.solicitante?.tipo === "interno";

  const colorEstado =
    estadoStyles[solicitud.estado] || {
      bg: "#F3F4F6",
      color: "#4B5563",
    };

  // RENDERIZADO

  return (
    <AdminLayout>
      <Box sx={{ width: "100%" }}>

        {/* HEADER */}
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
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(-1)}
              sx={{
                textTransform: "none",
                color: "#64748B",
                mb: 1,
                px: 0,
              }}
            >
              Volver
            </Button>

            <Typography
              sx={{
                fontWeight: 700,
                fontSize: "1.6rem",
                color: "#0F172A",
              }}
            >
              Solicitud {solicitud.codigo}
            </Typography>
          </Box>

          <Box
            sx={{
              display: "flex",
              gap: 1.5,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Chip
              label={solicitud.estado}
              sx={{
                backgroundColor: colorEstado.bg,
                color: colorEstado.color,
                fontWeight: 700,
              }}
            />

            {!modoEdicion ? (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={entrarEdicion}
                sx={{
                  textTransform: "none",
                  borderRadius: "8px",
                }}
              >
                Editar
              </Button>
            ) : (
              <>
                <Button
                  variant="outlined"
                  startIcon={<CloseIcon />}
                  onClick={cancelarEdicion}
                  disabled={guardando}
                  sx={{
                    textTransform: "none",
                    borderRadius: "8px",
                  }}
                >
                  Cancelar
                </Button>

                <Button
                  variant="contained"
                  startIcon={
                    guardando ? (
                      <CircularProgress
                        size={16}
                        color="inherit"
                      />
                    ) : (
                      <SaveIcon />
                    )
                  }
                  onClick={guardarCambios}
                  disabled={guardando}
                  sx={{
                    textTransform: "none",
                    borderRadius: "8px",
                    backgroundColor: "#059669",
                    "&:hover": {
                      backgroundColor: "#047857",
                    },
                  }}
                >
                  Guardar cambios
                </Button>
              </>
            )}
          </Box>
        </Box>

        {/* MENSAJES */}
        {mensajeExito && (
          <Alert
            severity="success"
            sx={{ mb: 3 }}
            onClose={() => setMensajeExito("")}
          >
            {mensajeExito}
          </Alert>
        )}

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            onClose={() => setError("")}
          >
            {error}
          </Alert>
        )}

        {/* CONTENIDO PRINCIPAL */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "1fr 340px",
            },
            gap: 3,
          }}
        >

          {/* COLUMNA IZQUIERDA */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
            }}
          >

            {/* DATOS DEL EVENTO */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 2 }}>
                Datos del evento
              </Typography>

              {modoEdicion ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "1fr 1fr",
                    },
                    gap: 2,
                  }}
                >
                  <TextField
                    label="Nombre de la actividad *"
                    size="small"
                    fullWidth
                    value={form.nombre_actividad}
                    onChange={handleChange("nombre_actividad")}
                  />

                  <TextField
                    label="Fecha inicio *"
                    type="date"
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={form.fecha_inicio}
                    onChange={handleChange("fecha_inicio")}
                  />

                  <TextField
                    label="Fecha fin *"
                    type="date"
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={form.fecha_fin}
                    onChange={handleChange("fecha_fin")}
                  />

                  <TextField
                    select
                    label="Hora inicio *"
                    size="small"
                    fullWidth
                    value={form.hora_inicio}
                    onChange={handleChange("hora_inicio")}
                  >
                    {HORAS.map((h) => (
                      <MenuItem key={h} value={h}>
                        {h}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    label="Hora fin *"
                    size="small"
                    fullWidth
                    value={form.hora_fin}
                    onChange={handleChange("hora_fin")}
                  >
                    {HORAS.map((h) => (
                      <MenuItem key={h} value={h}>
                        {h}
                      </MenuItem>
                    ))}
                  </TextField>
                  {esInterno && (
                    <Box sx={{ gridColumn: "1 / -1", mt: 1 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={Boolean(form.es_recurrente)}
                            onChange={(e) =>
                              setForm((prev: any) => ({
                                ...prev,
                                es_recurrente: e.target.checked,
                                frecuencia_recurrencia: e.target.checked
                                  ? prev.frecuencia_recurrencia || "semanal"
                                  : "",
                                dias_semana: e.target.checked
                                  ? prev.dias_semana || []
                                  : [],
                              }))
                            }
                          />
                        }
                        label="La solicitud es recurrente"
                      />

                      {form.es_recurrente && (
                        <>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label="Frecuencia de recurrencia"
                            value={form.frecuencia_recurrencia}
                            onChange={handleChange("frecuencia_recurrencia")}
                            sx={{ mt: 1, mb: 2 }}
                          >
                            <MenuItem value="diaria">Diaria</MenuItem>
                            <MenuItem value="semanal">Semanal</MenuItem>
                            <MenuItem value="mensual">Mensual</MenuItem>
                          </TextField>

                          {form.frecuencia_recurrencia === "semanal" && (
                            <Box>
                              <Typography sx={{ mb: 1, fontWeight: 600 }}>
                                Días de la semana
                              </Typography>

                              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                {[
                                  { id: 1, nombre: "Lunes" },
                                  { id: 2, nombre: "Martes" },
                                  { id: 3, nombre: "Miércoles" },
                                  { id: 4, nombre: "Jueves" },
                                  { id: 5, nombre: "Viernes" },
                                  { id: 6, nombre: "Sábado" },
                                  { id: 7, nombre: "Domingo" },
                                ].map((dia) => (
                                  <FormControlLabel
                                    key={dia.id}
                                    control={
                                      <Checkbox
                                        size="small"
                                        checked={(form.dias_semana || []).includes(dia.id)}
                                        onChange={(e) => {
                                          setForm((prev: any) => ({
                                            ...prev,
                                            dias_semana: e.target.checked
                                              ? [...(prev.dias_semana || []), dia.id].sort(
                                                (a, b) => a - b
                                              )
                                              : (prev.dias_semana || []).filter(
                                                (d: number) => d !== dia.id
                                              ),
                                          }));
                                        }}
                                      />
                                    }
                                    label={dia.nombre}
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                        </>
                      )}
                    </Box>
                  )}
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "1fr 1fr",
                    },
                    gap: 2,
                  }}
                >
                  <Dato
                    label="Nombre de la actividad"
                    valor={solicitud.nombre_actividad}
                  />

                  <Dato
                    label="Fecha"
                    valor={
                      obtenerFechaInput(solicitud.fecha_inicio) ===
                        obtenerFechaInput(solicitud.fecha_fin)
                        ? formatearFecha(solicitud.fecha_inicio)
                        : `${formatearFecha(solicitud.fecha_inicio)} → ${formatearFecha(solicitud.fecha_fin)}`
                    }
                  />

                  <Dato
                    label="Horario"
                    valor={`${formatearHora(solicitud.hora_inicio)} – ${formatearHora(solicitud.hora_fin)}`}
                  />

                  <Dato
                    label="Recurrente"
                    valor={
                      solicitud.es_recurrente ? "Sí" : "No"
                    }
                  />
                </Box>
              )}
              {(modoEdicion ? form.es_recurrente : solicitud.es_recurrente) && (
                <Box
                  sx={{
                    mt: 3,
                    p: 2,
                    borderRadius: "10px",
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>
                    Fechas de las recurrencias
                  </Typography>

                  <Typography
                    sx={{
                      fontSize: "0.85rem",
                      color: "#64748B",
                      mb: 2,
                    }}
                  >
                    Estas son las fechas generadas entre la fecha inicial y la final.
                  </Typography>

                  {(() => {
                    const fechas = modoEdicion
                      ? generarFechasRecurrencia(
                        form.fecha_inicio,
                        form.fecha_fin,
                        form.frecuencia_recurrencia,
                        (form.dias_semana || []).map(Number)
                      )
                      : (solicitud.ocurrencias || []).map(
                        (o: any) => obtenerFechaInput(o.fecha_inicio)
                      );

                    return (
                      <>
                        <Chip
                          label={`${fechas.length} ocurrencias`}
                          size="small"
                          color="primary"
                          sx={{ mb: 2 }}
                        />

                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: {
                              xs: "1fr",
                              sm: "1fr 1fr",
                              md: "1fr 1fr 1fr",
                            },
                            gap: 1,
                          }}
                        >
                          {fechas.map((fecha: string, index: number) => (
                            <Box
                              key={`${fecha}-${index}`}
                              sx={{
                                p: 1.2,
                                backgroundColor: "#FFFFFF",
                                border: "1px solid #E2E8F0",
                                borderRadius: "8px",
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <Chip
                                label={index + 1}
                                size="small"
                                sx={{ fontWeight: 600 }}
                              />

                              <Typography sx={{ fontSize: "0.9rem" }}>
                                {formatearFecha(fecha)}
                              </Typography>
                            </Box>
                          ))}
                        </Box>

                        {fechas.length === 0 && (
                          <Alert severity="info">
                            Selecciona las fechas y la frecuencia para visualizar las ocurrencias.
                          </Alert>
                        )}
                      </>
                    );
                  })()}
                </Box>
              )}
            </Paper>

            {/* DATOS DEL SOLICITANTE */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 2 }}>
                Datos del solicitante
              </Typography>

              {modoEdicion ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "1fr 1fr",
                    },
                    gap: 2,
                  }}
                >
                  <TextField
                    label="Nombre completo *"
                    size="small"
                    fullWidth
                    value={form.nombre}
                    onChange={handleChange("nombre")}
                  />

                  {esInterno ? (
                    <TextField
                      label="Cargo / Rol"
                      size="small"
                      fullWidth
                      value={form.cargo}
                      onChange={handleChange("cargo")}
                    />
                  ) : (
                    <TextField
                      label="Identificación"
                      size="small"
                      fullWidth
                      value={form.identificacion}
                      onChange={handleChange("identificacion")}
                    />
                  )}

                  <TextField
                    label="Correo"
                    size="small"
                    fullWidth
                    value={form.correo}
                    onChange={handleChange("correo")}
                  />

                  <TextField
                    label="Contacto"
                    size="small"
                    fullWidth
                    value={form.numero_contacto}
                    onChange={handleChange("numero_contacto")}
                  />
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "1fr 1fr",
                    },
                    gap: 2,
                  }}
                >
                  <Dato
                    label="Nombre"
                    valor={solicitud.solicitante?.nombre}
                  />

                  <Dato
                    label="Tipo"
                    valor={esInterno ? "Institucional" : "Externo"}
                  />

                  {esInterno ? (
                    <Dato
                      label="Cargo / Rol"
                      valor={solicitud.solicitante?.cargo}
                    />
                  ) : (
                    <Dato
                      label="Identificación"
                      valor={solicitud.solicitante?.identificacion}
                    />
                  )}

                  <Dato
                    label="Correo"
                    valor={solicitud.solicitante?.correo}
                  />

                  <Dato
                    label="Contacto"
                    valor={solicitud.solicitante?.numero_contacto}
                  />
                </Box>
              )}
            </Paper>

            {/* DEPENDENCIA / ENTIDAD */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 2 }}>
                {esInterno
                  ? "Dependencia / Procedencia"
                  : "Entidad solicitante"}
              </Typography>

              {modoEdicion ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "1fr 1fr",
                    },
                    gap: 2,
                  }}
                >
                  {esInterno ? (
                    <>
                      <TextField
                        select
                        label="Dependencia"
                        size="small"
                        fullWidth
                        value={form.id_dependencia}
                        onChange={handleChange("id_dependencia")}
                      >
                        <MenuItem value="">—</MenuItem>

                        {dependencias.map((x) => (
                          <MenuItem
                            key={x.id}
                            value={String(x.id)}
                          >
                            {x.nombre}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        select
                        label="Facultad *"
                        size="small"
                        fullWidth
                        value={form.id_facultad}
                        onChange={handleChange("id_facultad")}
                      >
                        <MenuItem value="">Seleccione</MenuItem>

                        {facultades.map((x) => (
                          <MenuItem
                            key={x.id}
                            value={String(x.id)}
                          >
                            {x.nombre}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        select
                        label="Programa *"
                        size="small"
                        fullWidth
                        value={form.id_programa}
                        onChange={handleChange("id_programa")}
                        disabled={!form.id_facultad}
                      >
                        <MenuItem value="">Seleccione</MenuItem>

                        {programas
                          .filter(
                            (x) =>
                              String(x.id_facultad) === String(form.id_facultad)
                          )
                          .map((x) => (
                            <MenuItem
                              key={x.id}
                              value={String(x.id)}
                            >
                              {x.nombre}
                            </MenuItem>
                          ))}
                      </TextField>
                    </>
                  ) : (
                    <>
                      <TextField
                        label="Nombre de la entidad"
                        size="small"
                        fullWidth
                        value={form.nombre_entidad}
                        onChange={handleChange("nombre_entidad")}
                      />

                      <TextField
                        select
                        label="Tipo de entidad"
                        size="small"
                        fullWidth
                        value={form.tipo_entidad}
                        onChange={handleChange("tipo_entidad")}
                      >
                        <MenuItem value="">—</MenuItem>
                        <MenuItem value="Publica">Pública</MenuItem>
                        <MenuItem value="Privada">Privada</MenuItem>
                        <MenuItem value="Educativa">Educativa</MenuItem>
                        <MenuItem value="Otra">Otra</MenuItem>
                      </TextField>

                      <TextField
                        label="Ciudad"
                        size="small"
                        fullWidth
                        value={form.ciudad}
                        onChange={handleChange("ciudad")}
                      />
                    </>
                  )}
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "1fr 1fr",
                    },
                    gap: 2,
                  }}
                >
                  {esInterno ? (
                    <>
                      <Dato
                        label="Dependencia"
                        valor={solicitud.solicitante?.dependencia}
                      />

                      <Dato
                        label="Facultad"
                        valor={solicitud.solicitante?.facultad}
                      />

                      <Dato
                        label="Programa"
                        valor={solicitud.solicitante?.programa}
                      />
                    </>
                  ) : (
                    <>
                      <Dato
                        label="Nombre de la entidad"
                        valor={solicitud.solicitante?.nombre_entidad}
                      />

                      <Dato
                        label="Tipo de entidad"
                        valor={solicitud.solicitante?.tipo_entidad}
                      />

                      <Dato
                        label="Ciudad"
                        valor={solicitud.solicitante?.ciudad}
                      />
                    </>
                  )}
                </Box>
              )}
            </Paper>

            {/* UBICACIÓN Y ESPACIO */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 2 }}>
                Ubicación y espacio
              </Typography>

              {modoEdicion ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "1fr 1fr",
                    },
                    gap: 2,
                  }}
                >
                  <TextField
                    select
                    label="Campus"
                    size="small"
                    fullWidth
                    value={form.id_campus}
                    onChange={handleChange("id_campus")}
                  >
                    <MenuItem value="">Seleccione</MenuItem>

                    {campus.map((x) => (
                      <MenuItem
                        key={x.id}
                        value={String(x.id)}
                      >
                        {x.nombre}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    label="Tipo de espacio"
                    size="small"
                    fullWidth
                    value={form.id_tipo_espacio}
                    onChange={handleChange("id_tipo_espacio")}
                  >
                    <MenuItem value="">Seleccione</MenuItem>

                    {tiposEspacio.map((x) => (
                      <MenuItem
                        key={x.id}
                        value={String(x.id)}
                      >
                        {x.nombre}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    label="Espacio *"
                    size="small"
                    fullWidth
                    value={form.id_espacio}
                    onChange={handleChange("id_espacio")}
                  >
                    <MenuItem value="">Seleccione</MenuItem>

                    {espacios.map((x) => (
                      <MenuItem
                        key={x.id}
                        value={String(x.id)}
                      >
                        {x.nombre}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "1fr 1fr",
                    },
                    gap: 2,
                  }}
                >
                  <Dato
                    label="Campus"
                    valor={solicitud.espacio?.campus}
                  />

                  <Dato
                    label="Tipo de espacio"
                    valor={solicitud.espacio?.tipo}
                  />

                  <Dato
                    label="Espacio"
                    valor={solicitud.espacio?.nombre}
                  />

                  <Dato
                    label="Capacidad"
                    valor={
                      solicitud.espacio?.capacidad
                        ? `${solicitud.espacio.capacidad} personas`
                        : "—"
                    }
                  />
                </Box>
              )}
            </Paper>

            {/* MEDIOS Y OBSERVACIONES */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 2 }}>
                Medios y observaciones
              </Typography>

              {modoEdicion ? (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <TextField
                    label="Medios requeridos"
                    size="small"
                    fullWidth
                    value={form.medios_requeridos}
                    onChange={handleChange("medios_requeridos")}
                  />

                  <TextField
                    label="Observaciones"
                    size="small"
                    fullWidth
                    multiline
                    rows={3}
                    value={form.observaciones}
                    onChange={handleChange("observaciones")}
                  />
                </Box>
              ) : (
                <>
                  <Dato
                    label="Medios requeridos"
                    valor={
                      solicitud.medios_requeridos || "Ninguno"
                    }
                  />

                  <Box sx={{ mt: 2 }}>
                    <Dato
                      label="Observaciones del solicitante"
                      valor={
                        solicitud.observaciones ||
                        "Sin observaciones"
                      }
                    />
                  </Box>
                </>
              )}
            </Paper>
          </Box>

          {/* COLUMNA DERECHA */}
          <Box>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                position: "sticky",
                top: 24,
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 2 }}>
                Gestión de la solicitud
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    color: "#64748B",
                    mb: 0.5,
                  }}
                >
                  Estado actual
                </Typography>

                <Chip
                  label={solicitud.estado}
                  sx={{
                    backgroundColor: colorEstado.bg,
                    color: colorEstado.color,
                    fontWeight: 700,
                  }}
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    color: "#64748B",
                    mb: 0.5,
                  }}
                >
                  Fecha de registro
                </Typography>

                <Typography
                  sx={{
                    fontSize: "0.9rem",
                    fontWeight: 500,
                  }}
                >
                  {formatearFecha(solicitud.fecha_registro)}
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    color: "#64748B",
                    mb: 0.5,
                  }}
                >
                  Última actualización
                </Typography>

                <Typography
                  sx={{
                    fontSize: "0.9rem",
                    fontWeight: 500,
                  }}
                >
                  {formatearFecha(solicitud.fecha_actualizacion)}
                </Typography>
              </Box>

              {!modoEdicion &&
                solicitud.estado === "Pendiente" && (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 1.5,
                    }}
                  >
                    <Button
                      variant="contained"
                      fullWidth
                      disabled={accionando}
                      onClick={handleAprobar}
                      sx={{
                        backgroundColor: "#059669",
                        textTransform: "none",
                        fontWeight: 600,
                        borderRadius: "8px",
                        py: 1.2,
                        "&:hover": {
                          backgroundColor: "#047857",
                        },
                      }}
                    >
                      {accionando ? (
                        <CircularProgress
                          size={20}
                          color="inherit"
                        />
                      ) : (
                        "Aprobar solicitud"
                      )}
                    </Button>

                    <Button
                      variant="outlined"
                      fullWidth
                      disabled={accionando}
                      onClick={handleRechazar}
                      sx={{
                        borderColor: "#DC2626",
                        color: "#DC2626",
                        textTransform: "none",
                        fontWeight: 600,
                        borderRadius: "8px",
                        py: 1.2,
                      }}
                    >
                      Rechazar solicitud
                    </Button>
                  </Box>
                )}

              {solicitud.estado === "Rechazada" &&
                solicitud.motivo_cancelacion && (
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      sx={{
                        fontSize: "0.8rem",
                        color: "#64748B",
                        mb: 0.5,
                      }}
                    >
                      Motivo del rechazo
                    </Typography>

                    <Typography sx={{ fontSize: "0.9rem" }}>
                      {solicitud.motivo_cancelacion}
                    </Typography>
                  </Box>
                )}
            </Paper>
          </Box>
        </Box>
      </Box>

      {/* ==================================================
          DIÁLOGO DE RESULTADO DE APROBACIÓN
      ================================================== */}

      <Dialog
        open={dialogoCorreo}
        onClose={() => setDialogoCorreo(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: "16px",
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            color: "#0F172A",
            pb: 1,
          }}
        >
          Resultado de la aprobación
        </DialogTitle>

        <DialogContent>
          {/* CÓDIGO Y ESTADO */}
          <Box sx={{ mb: 2 }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: "1rem",
              }}
            >
              Solicitud {solicitud?.codigo}
            </Typography>

            <Chip
              label={solicitud?.estado}
              size="small"
              sx={{
                mt: 1,
                backgroundColor: "#D1FAE5",
                color: "#047857",
                fontWeight: 700,
              }}
            />
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* RESULTADO DEL CORREO */}
          {resultadoCorreo?.simulado ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              <strong>Correo simulado</strong>
              <br />
              La solicitud fue aprobada correctamente, pero el
              correo no se envió realmente porque está activo
              el modo de simulación.
            </Alert>
          ) : resultadoCorreo?.enviada ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              <strong>Correo enviado correctamente</strong>
              <br />
              Se notificó al solicitante sobre la aprobación
              de su reserva.
            </Alert>
          ) : resultadoCorreo?.correo ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              <strong>No se pudo enviar el correo</strong>
              <br />
              La solicitud fue aprobada, pero ocurrió un
              problema al enviar la notificación.
            </Alert>
          ) : (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <strong>Resultado de notificación no disponible</strong>
              <br />
              La solicitud fue aprobada. No se recibió
              información sobre el envío del correo.
            </Alert>
          )}

          {/* DESTINATARIO */}
          <Box sx={{ mb: 2 }}>
            <Typography
              sx={{
                fontSize: "0.75rem",
                color: "#64748B",
              }}
            >
              Destinatario
            </Typography>

            <Typography
              sx={{
                fontWeight: 500,
                fontSize: "0.9rem",
              }}
            >
              {resultadoCorreo?.correo || "No registrado"}
            </Typography>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* DATOS DEL EVENTO */}
          <Typography sx={{ fontWeight: 700, mb: 2 }}>
            Datos del evento
          </Typography>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "1fr 1fr",
              },
              gap: 2,
            }}
          >
            <Dato
              label="Nombre de la actividad"
              valor={solicitud?.nombre_actividad}
            />

            <Dato
              label="Fecha"
              valor={
                obtenerFechaInput(solicitud?.fecha_inicio) ===
                  obtenerFechaInput(solicitud?.fecha_fin)
                  ? formatearFecha(solicitud?.fecha_inicio)
                  : `${formatearFecha(solicitud?.fecha_inicio)} → ${formatearFecha(solicitud?.fecha_fin)}`
              }
            />

            <Dato
              label="Horario"
              valor={`${formatearHora(solicitud?.hora_inicio)} – ${formatearHora(solicitud?.hora_fin)}`}
            />

            <Dato
              label="Recurrente"
              valor={
                solicitud?.es_recurrente ? "Sí" : "No"
              }
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            variant="contained"
            onClick={() => setDialogoCorreo(false)}
            sx={{
              textTransform: "none",
              borderRadius: "8px",
              backgroundColor: "#1E3A5F",
              px: 3,
              "&:hover": {
                backgroundColor: "#172F4D",
              },
            }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
}

// COMPONENTE AUXILIAR PARA MOSTRAR DATOS

function Dato({
  label,
  valor,
}: {
  label: string;
  valor?: string | number | null;
}) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: "0.75rem",
          color: "#94A3B8",
          fontWeight: 500,
          mb: 0.3,
        }}
      >
        {label}
      </Typography>

      <Typography
        sx={{
          fontSize: "0.9rem",
          color: "#0F172A",
          fontWeight: 500,
          wordBreak: "break-word",
        }}
      >
        {valor || "—"}
      </Typography>
    </Box>
  );
}
