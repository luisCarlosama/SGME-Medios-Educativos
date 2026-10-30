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
  obtenerDependencias,
  obtenerProgramas,
  obtenerAreas,
  obtenerGrupos,
} from "../../Public/Reserva/services/reservas.service";

const estadoStyles: Record<string, { bg: string; color: string }> = {
  Pendiente: { bg: "#FEF3C7", color: "#B45309" },
  Aprobada: { bg: "#D1FAE5", color: "#047857" },
  "En proceso": { bg: "#DBEAFE", color: "#1D4ED8" },
  Rechazada: { bg: "#FEE2E2", color: "#B91C1C" },
  Cancelada: { bg: "#F3F4F6", color: "#4B5563" },
};

const HORAS = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
];

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

export default function DetalleSolicitud() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [solicitud, setSolicitud] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");
  const [accionando, setAccionando] = useState(false);

  // Modo edición
  const [modoEdicion, setModoEdicion] = useState(false);
  const [form, setForm] = useState<any>({});
  const [guardando, setGuardando] = useState(false);

  // Catálogos
  const [campus, setCampus] = useState<any[]>([]);
  const [tiposEspacio, setTiposEspacio] = useState<any[]>([]);
  const [espacios, setEspacios] = useState<any[]>([]);
  const [dependencias, setDependencias] = useState<any[]>([]);
  const [programas, setProgramas] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);

  // Cargar solicitud
  useEffect(() => {
    if (!id) return;

    setLoading(true);
    obtenerSolicitudPorId(id)
      .then((data) => {
        setSolicitud(data);
        setError("");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "No se pudo cargar la solicitud.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Cargar catálogos cuando entra en modo edición
  useEffect(() => {
    if (!modoEdicion) return;

    Promise.all([
      obtenerCampus(),
      obtenerTiposEspacio(),
      obtenerDependencias(),
      obtenerProgramas(),
      obtenerAreas(),
      obtenerGrupos(),
    ]).then(([c, t, d, p, a, g]) => {
      setCampus(c.map((x: any) => ({ id: x.id_campus, nombre: x.nombre })));
      setTiposEspacio(t.map((x: any) => ({ id: x.id_tipo_espacio, nombre: x.nombre })));
      setDependencias(d.map((x: any) => ({ id: x.id_dependencia, nombre: x.nombre })));
      setProgramas(p.map((x: any) => ({ id: x.id_programa, nombre: x.nombre })));
      setAreas(a.map((x: any) => ({ id: x.id_area, nombre: x.nombre })));
      setGrupos(g.map((x: any) => ({ id: x.id_grupo, nombre: x.nombre })));
    });
  }, [modoEdicion]);

  // Cargar espacios según campus/tipo
  useEffect(() => {
    if (!modoEdicion || !form.id_campus) return;

    obtenerEspacios(form.id_campus, form.id_tipo_espacio).then((lista) => {
      setEspacios(lista.map((x: any) => ({ id: x.id_espacio, nombre: x.nombre })));
    });
  }, [modoEdicion, form.id_campus, form.id_tipo_espacio]);

  const entrarEdicion = () => {
    if (!solicitud) return;

    setForm({
      nombre_actividad: solicitud.nombre_actividad || "",
      fecha_inicio: solicitud.fecha_inicio?.split("T")[0] || "",
      fecha_fin: solicitud.fecha_fin?.split("T")[0] || "",
      hora_inicio: formatearHora(solicitud.hora_inicio),
      hora_fin: formatearHora(solicitud.hora_fin),
      medios_requeridos: solicitud.medios_requeridos || "",
      observaciones: solicitud.observaciones || "",
      es_recurrente: solicitud.es_recurrente || false,

      // Solicitante
      nombre: solicitud.solicitante?.nombre || "",
      cargo: solicitud.solicitante?.cargo || "",
      correo: solicitud.solicitante?.correo || "",
      numero_contacto: solicitud.solicitante?.numero_contacto || "",
      identificacion: solicitud.solicitante?.identificacion || "",
      nombre_entidad: solicitud.solicitante?.nombre_entidad || "",
      tipo_entidad: solicitud.solicitante?.tipo_entidad || "",
      ciudad: solicitud.solicitante?.ciudad || "",
      id_dependencia: solicitud.solicitante?.id_dependencia || "",
      id_programa: solicitud.solicitante?.id_programa || "",
      id_area: solicitud.solicitante?.id_area || "",
      id_grupo: solicitud.solicitante?.id_grupo || "",

      // Espacio
      id_campus: "", // se llenará después
      id_tipo_espacio: "",
      id_espacio: solicitud.espacio?.id || "",
    });

    setModoEdicion(true);
    setMensajeExito("");
    setError("");
  };

  const cancelarEdicion = () => {
    setModoEdicion(false);
    setError("");
  };

  const handleChange = (campo: string) => (e: any) => {
    setForm((prev: any) => ({ ...prev, [campo]: e.target.value }));
  };

  const guardarCambios = async () => {
    if (!id) return;

    setGuardando(true);
    setError("");
    setMensajeExito("");

    try {
      await actualizarSolicitud(id, {
        ...form,
        id_espacio: Number(form.id_espacio),
        id_dependencia: form.id_dependencia ? Number(form.id_dependencia) : null,
        id_programa: form.id_programa ? Number(form.id_programa) : null,
        id_area: form.id_area ? Number(form.id_area) : null,
        id_grupo: form.id_grupo ? Number(form.id_grupo) : null,
        ocurrencias: solicitud.ocurrencias || [],
      });

      // Recargar la solicitud
      const actualizada = await obtenerSolicitudPorId(id);
      setSolicitud(actualizada);
      setModoEdicion(false);
      setMensajeExito("Cambios guardados correctamente.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  };

  const handleAprobar = async () => {
    if (!id) return;
    setAccionando(true);
    try {
      await actualizarEstadoSolicitud(id, "Aprobada");
      const actualizada = await obtenerSolicitudPorId(id);
      setSolicitud(actualizada);
      setMensajeExito("Solicitud aprobada correctamente.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo aprobar.");
    } finally {
      setAccionando(false);
    }
  };

  const handleRechazar = () => {
    navigate(`/admin/solicitudes/${id}/rechazar`);
  };

  if (loading) {
    return (
      <AdminLayout>
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress />
        </Box>
      </AdminLayout>
    );
  }

  if (error && !solicitud) {
    return (
      <AdminLayout>
        <Box sx={{ maxWidth: 600, mx: "auto", py: 6 }}>
          <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/admin/dashboard")}>
            Volver al Dashboard
          </Button>
        </Box>
      </AdminLayout>
    );
  }

  const esInterno = solicitud?.solicitante?.tipo === "interno";
  const colorEstado = estadoStyles[solicitud?.estado] || { bg: "#F3F4F6", color: "#4B5563" };

  return (
    <AdminLayout>
      <Box sx={{ width: "100%" }}>
        {/* Header */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3, flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(-1)}
              sx={{ textTransform: "none", color: "#64748B", mb: 1, px: 0 }}
            >
              Volver
            </Button>
            <Typography sx={{ fontWeight: 700, fontSize: "1.6rem", color: "#0F172A" }}>
              Solicitud {solicitud.codigo}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
            <Chip
              label={solicitud.estado}
              sx={{ backgroundColor: colorEstado.bg, color: colorEstado.color, fontWeight: 700 }}
            />

            {!modoEdicion ? (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={entrarEdicion}
                sx={{ textTransform: "none", borderRadius: "8px" }}
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
                  sx={{ textTransform: "none", borderRadius: "8px" }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="contained"
                  startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  onClick={guardarCambios}
                  disabled={guardando}
                  sx={{
                    textTransform: "none",
                    borderRadius: "8px",
                    backgroundColor: "#059669",
                    "&:hover": { backgroundColor: "#047857" },
                  }}
                >
                  Guardar cambios
                </Button>
              </>
            )}
          </Box>
        </Box>

        {mensajeExito && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setMensajeExito("")}>
            {mensajeExito}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 340px" }, gap: 3 }}>
          {/* ========== COLUMNA IZQUIERDA ========== */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>

            {/* Datos del evento */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Datos del evento</Typography>

              {modoEdicion ? (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
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
                    {HORAS.map((h) => <MenuItem key={h} value={h}>{h}</MenuItem>)}
                  </TextField>
                  <TextField
                    select
                    label="Hora fin *"
                    size="small"
                    fullWidth
                    value={form.hora_fin}
                    onChange={handleChange("hora_fin")}
                  >
                    {HORAS.map((h) => <MenuItem key={h} value={h}>{h}</MenuItem>)}
                  </TextField>
                </Box>
              ) : (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                  <Dato label="Nombre de la actividad" valor={solicitud.nombre_actividad} />
                  <Dato
                    label="Fecha"
                    valor={
                      solicitud.fecha_inicio === solicitud.fecha_fin
                        ? formatearFecha(solicitud.fecha_inicio)
                        : `${formatearFecha(solicitud.fecha_inicio)} → ${formatearFecha(solicitud.fecha_fin)}`
                    }
                  />
                  <Dato label="Horario" valor={`${formatearHora(solicitud.hora_inicio)} – ${formatearHora(solicitud.hora_fin)}`} />
                  <Dato label="Recurrente" valor={solicitud.es_recurrente ? "Sí" : "No"} />
                </Box>
              )}
            </Paper>

            {/* Datos del solicitante */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Datos del solicitante</Typography>

              {modoEdicion ? (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                  <TextField label="Nombre completo *" size="small" fullWidth value={form.nombre} onChange={handleChange("nombre")} />
                  {esInterno ? (
                    <TextField label="Cargo / Rol" size="small" fullWidth value={form.cargo} onChange={handleChange("cargo")} />
                  ) : (
                    <TextField label="Identificación" size="small" fullWidth value={form.identificacion} onChange={handleChange("identificacion")} />
                  )}
                  <TextField label="Correo" size="small" fullWidth value={form.correo} onChange={handleChange("correo")} />
                  <TextField label="Contacto" size="small" fullWidth value={form.numero_contacto} onChange={handleChange("numero_contacto")} />
                </Box>
              ) : (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                  <Dato label="Nombre" valor={solicitud.solicitante?.nombre} />
                  <Dato label="Tipo" valor={esInterno ? "Institucional" : "Externo"} />
                  {esInterno ? (
                    <Dato label="Cargo / Rol" valor={solicitud.solicitante?.cargo} />
                  ) : (
                    <Dato label="Identificación" valor={solicitud.solicitante?.identificacion} />
                  )}
                  <Dato label="Correo" valor={solicitud.solicitante?.correo} />
                  <Dato label="Contacto" valor={solicitud.solicitante?.numero_contacto} />
                </Box>
              )}
            </Paper>

            {/* Dependencia / Entidad */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>
                {esInterno ? "Dependencia / Procedencia" : "Entidad solicitante"}
              </Typography>

              {modoEdicion ? (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                  {esInterno ? (
                    <>
                      <TextField select label="Dependencia" size="small" fullWidth value={form.id_dependencia} onChange={handleChange("id_dependencia")}>
                        <MenuItem value="">—</MenuItem>
                        {dependencias.map((x) => <MenuItem key={x.id} value={x.id}>{x.nombre}</MenuItem>)}
                      </TextField>
                      <TextField select label="Programa" size="small" fullWidth value={form.id_programa} onChange={handleChange("id_programa")}>
                        <MenuItem value="">—</MenuItem>
                        {programas.map((x) => <MenuItem key={x.id} value={x.id}>{x.nombre}</MenuItem>)}
                      </TextField>
                      <TextField select label="Área" size="small" fullWidth value={form.id_area} onChange={handleChange("id_area")}>
                        <MenuItem value="">—</MenuItem>
                        {areas.map((x) => <MenuItem key={x.id} value={x.id}>{x.nombre}</MenuItem>)}
                      </TextField>
                      <TextField select label="Grupo" size="small" fullWidth value={form.id_grupo} onChange={handleChange("id_grupo")}>
                        <MenuItem value="">—</MenuItem>
                        {grupos.map((x) => <MenuItem key={x.id} value={x.id}>{x.nombre}</MenuItem>)}
                      </TextField>
                    </>
                  ) : (
                    <>
                      <TextField label="Nombre de la entidad" size="small" fullWidth value={form.nombre_entidad} onChange={handleChange("nombre_entidad")} />
                      <TextField select label="Tipo de entidad" size="small" fullWidth value={form.tipo_entidad} onChange={handleChange("tipo_entidad")}>
                        <MenuItem value="">—</MenuItem>
                        <MenuItem value="Publica">Pública</MenuItem>
                        <MenuItem value="Privada">Privada</MenuItem>
                        <MenuItem value="Educativa">Educativa</MenuItem>
                        <MenuItem value="Otra">Otra</MenuItem>
                      </TextField>
                      <TextField label="Ciudad" size="small" fullWidth value={form.ciudad} onChange={handleChange("ciudad")} />
                    </>
                  )}
                </Box>
              ) : (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                  {esInterno ? (
                    <>
                      <Dato label="Dependencia" valor={solicitud.solicitante?.dependencia} />
                      <Dato label="Programa" valor={solicitud.solicitante?.programa} />
                      <Dato label="Área" valor={solicitud.solicitante?.area} />
                      <Dato label="Grupo" valor={solicitud.solicitante?.grupo} />
                    </>
                  ) : (
                    <>
                      <Dato label="Nombre de la entidad" valor={solicitud.solicitante?.nombre_entidad} />
                      <Dato label="Tipo de entidad" valor={solicitud.solicitante?.tipo_entidad} />
                      <Dato label="Ciudad" valor={solicitud.solicitante?.ciudad} />
                    </>
                  )}
                </Box>
              )}
            </Paper>

            {/* Ubicación y espacio */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Ubicación y espacio</Typography>

              {modoEdicion ? (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                  <TextField select label="Campus" size="small" fullWidth value={form.id_campus} onChange={handleChange("id_campus")}>
                    <MenuItem value="">Seleccione</MenuItem>
                    {campus.map((x) => <MenuItem key={x.id} value={x.id}>{x.nombre}</MenuItem>)}
                  </TextField>
                  <TextField select label="Tipo de espacio" size="small" fullWidth value={form.id_tipo_espacio} onChange={handleChange("id_tipo_espacio")}>
                    <MenuItem value="">Seleccione</MenuItem>
                    {tiposEspacio.map((x) => <MenuItem key={x.id} value={x.id}>{x.nombre}</MenuItem>)}
                  </TextField>
                  <TextField select label="Espacio *" size="small" fullWidth value={form.id_espacio} onChange={handleChange("id_espacio")}>
                    <MenuItem value="">Seleccione</MenuItem>
                    {espacios.map((x) => <MenuItem key={x.id} value={x.id}>{x.nombre}</MenuItem>)}
                  </TextField>
                </Box>
              ) : (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                  <Dato label="Campus" valor={solicitud.espacio?.campus} />
                  <Dato label="Tipo de espacio" valor={solicitud.espacio?.tipo} />
                  <Dato label="Espacio" valor={solicitud.espacio?.nombre} />
                  <Dato label="Capacidad" valor={solicitud.espacio?.capacidad ? `${solicitud.espacio.capacidad} personas` : "—"} />
                </Box>
              )}
            </Paper>

            {/* Medios y observaciones */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Medios y observaciones</Typography>

              {modoEdicion ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
                  <Dato label="Medios requeridos" valor={solicitud.medios_requeridos || "Ninguno"} />
                  <Box sx={{ mt: 2 }}>
                    <Dato label="Observaciones del solicitante" valor={solicitud.observaciones || "Sin observaciones"} />
                  </Box>
                </>
              )}
            </Paper>
          </Box>

          {/* ========== COLUMNA DERECHA ========== */}
          <Box>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: "12px", border: "1px solid #E2E8F0", position: "sticky", top: 24 }}>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Gestión de la solicitud</Typography>

              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: "0.8rem", color: "#64748B", mb: 0.5 }}>Estado actual</Typography>
                <Chip label={solicitud.estado} sx={{ backgroundColor: colorEstado.bg, color: colorEstado.color, fontWeight: 700 }} />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: "0.8rem", color: "#64748B", mb: 0.5 }}>Fecha de registro</Typography>
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 500 }}>{formatearFecha(solicitud.fecha_registro)}</Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontSize: "0.8rem", color: "#64748B", mb: 0.5 }}>Última actualización</Typography>
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 500 }}>{formatearFecha(solicitud.fecha_actualizacion)}</Typography>
              </Box>

              {!modoEdicion && solicitud.estado === "Pendiente" && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    disabled={accionando}
                    onClick={handleAprobar}
                    sx={{ backgroundColor: "#059669", textTransform: "none", fontWeight: 600, borderRadius: "8px", py: 1.2 }}
                  >
                    {accionando ? <CircularProgress size={20} color="inherit" /> : "Aprobar solicitud"}
                  </Button>

                  <Button
                    variant="outlined"
                    fullWidth
                    disabled={accionando}
                    onClick={handleRechazar}
                    sx={{ borderColor: "#DC2626", color: "#DC2626", textTransform: "none", fontWeight: 600, borderRadius: "8px", py: 1.2 }}
                  >
                    Rechazar solicitud
                  </Button>
                </Box>
              )}

              {solicitud.estado === "Rechazada" && solicitud.motivo_cancelacion && (
                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ fontSize: "0.8rem", color: "#64748B", mb: 0.5 }}>Motivo del rechazo</Typography>
                  <Typography sx={{ fontSize: "0.9rem" }}>{solicitud.motivo_cancelacion}</Typography>
                </Box>
              )}
            </Paper>
          </Box>
        </Box>
      </Box>
    </AdminLayout>
  );
}

function Dato({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <Box>
      <Typography sx={{ fontSize: "0.75rem", color: "#94A3B8", fontWeight: 500, mb: 0.3 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: "0.9rem", color: "#0F172A", fontWeight: 500, wordBreak: "break-word" }}>
        {valor || "—"}
      </Typography>
    </Box>
  );
}