/**
 * Portal público – Formulario de solicitud de reserva
 */

import { useState, useEffect } from "react";
import {
  Box, Typography, Button, Container, TextField, MenuItem, Checkbox,
  FormControlLabel, Accordion, AccordionSummary, AccordionDetails,
  CircularProgress, Alert,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useNavigate } from "react-router-dom";
import {
  obtenerCampus,
  obtenerTiposEspacio,
  obtenerEspacios,
  obtenerProgramas,
  obtenerDependencias,
  obtenerAreas,
  obtenerGrupos,
  crearSolicitud,
} from "../../../../services/api";

const HORAS = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
];
const DRAFT_KEY = "borrador_solicitud_reserva";

type Opcion = { id: number; nombre: string };

export default function FormularioReserva() {
  const navigate = useNavigate();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Catálogos
  const [campus, setCampus] = useState<Opcion[]>([]);
  const [tiposEspacio, setTiposEspacio] = useState<Opcion[]>([]);
  const [espacios, setEspacios] = useState<Opcion[]>([]);
  const [programas, setProgramas] = useState<Opcion[]>([]);
  const [dependencias, setDependencias] = useState<Opcion[]>([]);
  const [areas, setAreas] = useState<Opcion[]>([]);
  const [grupos, setGrupos] = useState<Opcion[]>([]);

  // Formulario
  const [form, setForm] = useState({
    fecha_inicio: "",
    fecha_fin: "",
    hora_inicio: "",
    hora_fin: "",
    nombre_actividad: "",
    nombre: "",
    cargo: "",
    correo: "",
    numero_contacto: "",
    id_dependencia: "",
    id_programa: "",
    id_area: "",
    id_grupo: "",
    id_campus: "",
    id_tipo_espacio: "",
    id_espacio: "",
    observaciones: "",
  });

  const [medios, setMedios] = useState<Record<string, boolean>>({});

  // 1) Cargar borrador al entrar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.form) setForm((prev) => ({ ...prev, ...data.form }));
      if (data.medios) setMedios(data.medios);
    } catch {
      // ignorar borrador corrupto
    }
  }, []);

  // Guardar borrador cada vez que cambian form o medios
  useEffect(() => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ form, medios })
    );
  }, [form, medios]);

  // Cargar catálogos al montar
  useEffect(() => {
    Promise.all([
      obtenerCampus(),
      obtenerTiposEspacio(),
      obtenerProgramas(),
      obtenerDependencias(),
      obtenerAreas(),
      obtenerGrupos(),
    ])
      .then(([c, t, p, d, a, g]) => {
        setCampus(c.map((x: any) => ({ id: x.id_campus, nombre: x.nombre })));
        setTiposEspacio(t.map((x: any) => ({ id: x.id_tipo_espacio, nombre: x.nombre })));
        setProgramas(p.map((x: any) => ({ id: x.id_programa, nombre: x.nombre })));
        setDependencias(d.map((x: any) => ({ id: x.id_dependencia, nombre: x.nombre })));
        setAreas(a.map((x: any) => ({ id: x.id_area, nombre: x.nombre })));
        setGrupos(g.map((x: any) => ({ id: x.id_grupo, nombre: x.nombre })));
      })
      .catch((err) => setError(err.message));
  }, []);

  // Cargar espacios cuando cambian campus o tipo
  useEffect(() => {
    if (!form.id_campus && !form.id_tipo_espacio) {
      setEspacios([]);
      return;
    }
    obtenerEspacios(form.id_campus || undefined, form.id_tipo_espacio || undefined)
      .then((lista) => {
        setEspacios(lista.map((x: any) => ({ id: x.id_espacio, nombre: x.nombre })));
        // Si el espacio seleccionado ya no está en la lista, limpiarlo
        setForm((prev) => {
          if (prev.id_espacio && !lista.some((e: any) => e.id_espacio === Number(prev.id_espacio))) {
            return { ...prev, id_espacio: "" };
          }
          return prev;
        });
      })
      .catch((err) => setError(err.message));
  }, [form.id_campus, form.id_tipo_espacio]);

  const handleChange = (campo: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [campo]: e.target.value }));
  };

  const handleSubmit = async () => {
    setError(null);

    if (
      !form.fecha_inicio || !form.fecha_fin || !form.hora_inicio || !form.hora_fin ||
      !form.nombre_actividad.trim() || !form.nombre.trim() || !form.correo.trim() ||
      !form.id_espacio
    ) {
      setError("Completa todos los campos obligatorios (*).");
      return;
    }

    const mediosSeleccionados = Object.entries(medios)
      .filter(([, checked]) => checked)
      .map(([nombre]) => nombre);

    const requerimientos = [
      mediosSeleccionados.length > 0 ? `Medios: ${mediosSeleccionados.join(", ")}` : "",
      form.observaciones.trim() ? `Observaciones: ${form.observaciones.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    setCargando(true);

    try {
      const resultado = await crearSolicitud({
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin,
        nombre_actividad: form.nombre_actividad.trim(),
        nombre: form.nombre.trim(),
        cargo: form.cargo.trim() || undefined,
        correo: form.correo.trim(),
        numero_contacto: form.numero_contacto.trim() || undefined,
        id_programa: form.id_programa ? Number(form.id_programa) : null,
        id_dependencia: form.id_dependencia ? Number(form.id_dependencia) : null,
        id_area: form.id_area ? Number(form.id_area) : null,
        id_grupo: form.id_grupo ? Number(form.id_grupo) : null,
        id_espacio: Number(form.id_espacio),
        requerimientos: requerimientos || undefined,
      });

      sessionStorage.setItem("codigo_solicitud", resultado.solicitud.codigo);
      sessionStorage.setItem(
        "resumen_solicitud",
        JSON.stringify({
          codigo: resultado.solicitud.codigo,
          espacio:
            espacios.find((e) => e.id === Number(form.id_espacio))?.nombre || "—",
          fecha: form.fecha_inicio,
          horario: `${form.hora_inicio} - ${form.hora_fin}`,
          solicitante: form.nombre,
        })
      );
      //localStorage.removeItem(DRAFT_KEY);

      navigate("/reserva/confirmacion");
    } catch (err: any) {
      setError(err.message || "Error al enviar la solicitud.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <Box sx={{ backgroundColor: "#6B7A8A", py: 4 }}>
        <Container maxWidth="lg">
          <Typography sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8rem", fontWeight: 600, mb: 1 }}>
            MEDIOS EDUCATIVOS
          </Typography>
          <Typography sx={{ color: "#FFFFFF", fontWeight: 800, fontSize: { xs: "1.75rem", md: "2.25rem" }, mb: 0.5 }}>
            Solicitud de reserva
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.85)" }}>
            Completa los datos de la solicitud. No necesitas crear una cuenta.
          </Typography>
          <Box sx={{ width: 40, height: 3, backgroundColor: "#E30613", mt: 2 }} />
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box
          sx={{
            display: "flex", gap: 1, mb: 3, flexWrap: "wrap", backgroundColor: "#FFFFFF",
            borderRadius: "12px", border: "1px solid #E5EAF0", p: 1.5, justifyContent: "center",
          }}
        >
          {["01 Solicitante", "02 Evento", "03 Reserva", "04 Información", "05 Medios"].map((s, i) => (
            <Typography
              key={s}
              sx={{
                fontSize: "0.8rem", fontWeight: i === 0 ? 700 : 500,
                color: i === 0 ? "#0B3A5C" : "#9AA5B5", px: 1.5,
              }}
            >
              {s}
            </Typography>
          ))}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 01 Datos del evento */}
        <Accordion defaultExpanded elevation={0} sx={{ border: "1px solid #E5EAF0", borderRadius: "12px !important", mb: 2, "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography sx={{ fontWeight: 700, color: "#0B1A2A" }}>01 Datos del evento</Typography>
              <Typography sx={{ color: "#5A6A7A", fontSize: "0.8rem" }}>Información principal de la actividad.</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 2 }}>
              <TextField size="small" type="date" label="Fecha de inicio *" 
              value={form.fecha_inicio} onChange={handleChange("fecha_inicio")} 
              slotProps={{ inputLabel: { shrink: true } }} 
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }} />
              <TextField size="small" type="date" label="Fecha de fin *" 
              value={form.fecha_fin} onChange={handleChange("fecha_fin")} 
              slotProps={{ inputLabel: { shrink: true } }} 
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }} />
              <TextField select size="small" label="Hora de inicio *"
                value={form.hora_inicio} onChange={handleChange("hora_inicio")}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}>
                <MenuItem value="">Seleccionar hora</MenuItem>
                {HORAS.map((h) => <MenuItem key={h} value={h}>{h}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Hora de finalización *"
                value={form.hora_fin} onChange={handleChange("hora_fin")}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}>
                <MenuItem value="">Seleccionar hora</MenuItem>
                {HORAS.map((h) => <MenuItem key={h} value={h}>{h}</MenuItem>)}
              </TextField>
              <TextField size="small" label="Nombre del evento *" placeholder="Ingresar nombre del evento"
                value={form.nombre_actividad} onChange={handleChange("nombre_actividad")}
                sx={{ gridColumn: { sm: "span 2" }, "& .MuiOutlinedInput-root": { borderRadius: "8px" } }} />
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* 02 Datos del solicitante */}
        <Accordion defaultExpanded elevation={0} sx={{ border: "1px solid #E5EAF0", borderRadius: "12px !important", mb: 2, "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography sx={{ fontWeight: 700, color: "#0B1A2A" }}>02 Datos del solicitante</Typography>
              <Typography sx={{ color: "#5A6A7A", fontSize: "0.8rem" }}>Información de contacto.</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 2 }}>
              <TextField size="small" label="Nombre completo *" placeholder="Ingresar nombre completo"
                value={form.nombre} onChange={handleChange("nombre")}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }} />
              <TextField size="small" label="Cargo / rol *" placeholder="Ingresar cargo o rol"
                value={form.cargo} onChange={handleChange("cargo")}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }} />
              <TextField size="small" label="Correo electrónico *" placeholder="Ingresar correo"
                value={form.correo} onChange={handleChange("correo")}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }} />
              <TextField size="small" label="Número de contacto *" placeholder="Ingresar número"
                value={form.numero_contacto} onChange={handleChange("numero_contacto")}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }} />
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* 03 Dependencia / procedencia */}
        <Accordion defaultExpanded elevation={0} sx={{ border: "1px solid #E5EAF0", borderRadius: "12px !important", mb: 2, "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography sx={{ fontWeight: 700, color: "#0B1A2A" }}>03 Dependencia / procedencia</Typography>
              <Typography sx={{ color: "#5A6A7A", fontSize: "0.8rem" }}>Procedencia institucional del solicitante.</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 2 }}>
              <TextField select size="small" label="Dependencia"
                value={form.id_dependencia} onChange={handleChange("id_dependencia")}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}>
                <MenuItem value="">Seleccione una opción</MenuItem>
                {dependencias.map((d) => (
                  <MenuItem key={d.id} value={d.id}>{d.nombre}</MenuItem>
                ))}
              </TextField>
              <TextField select size="small" label="Programa"
                value={form.id_programa} onChange={handleChange("id_programa")}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}>
                <MenuItem value="">Seleccione una opción</MenuItem>
                {programas.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>
                ))}
              </TextField>
              <TextField select size="small" label="Área"
                value={form.id_area} onChange={handleChange("id_area")}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}>
                <MenuItem value="">Seleccione una opción</MenuItem>
                {areas.map((a) => (
                  <MenuItem key={a.id} value={a.id}>{a.nombre}</MenuItem>
                ))}
              </TextField>
              <TextField select size="small" label="Grupo"
                value={form.id_grupo} onChange={handleChange("id_grupo")}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}>
                <MenuItem value="">Seleccione una opción</MenuItem>
                {grupos.map((g) => (
                  <MenuItem key={g.id} value={g.id}>{g.nombre}</MenuItem>
                ))}
              </TextField>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* 04 Ubicación y espacio */}
        <Accordion defaultExpanded elevation={0} sx={{ border: "1px solid #E5EAF0", borderRadius: "12px !important", mb: 2, "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography sx={{ fontWeight: 700, color: "#0B1A2A" }}>04 Ubicación y espacio</Typography>
              <Typography sx={{ color: "#5A6A7A", fontSize: "0.8rem" }}>Campus, tipo de espacio y espacio específico.</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 2 }}>
              <TextField select size="small" label="Campus *"
                value={form.id_campus} onChange={handleChange("id_campus")}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}>
                <MenuItem value="">Seleccione campus</MenuItem>
                {campus.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
                ))}
              </TextField>
              <TextField select size="small" label="Tipo de espacio *"
                value={form.id_tipo_espacio} onChange={handleChange("id_tipo_espacio")}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}>
                <MenuItem value="">Seleccione tipo de espacio</MenuItem>
                {tiposEspacio.map((t) => (
                  <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>
                ))}
              </TextField>
              <TextField select size="small" label="Espacio específico *"
                value={form.id_espacio} onChange={handleChange("id_espacio")}
                disabled={!form.id_campus && !form.id_tipo_espacio}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}>
                <MenuItem value="">Seleccione espacio</MenuItem>
                {espacios.map((e) => (
                  <MenuItem key={e.id} value={e.id}>{e.nombre}</MenuItem>
                ))}
              </TextField>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* 05 Medios */}
        <Accordion defaultExpanded elevation={0} sx={{ border: "1px solid #E5EAF0", borderRadius: "12px !important", mb: 3, "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography sx={{ fontWeight: 700, color: "#0B1A2A" }}>05 Medios requeridos</Typography>
              <Typography sx={{ color: "#5A6A7A", fontSize: "0.8rem" }}>Selecciona los medios necesarios.</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography sx={{ fontSize: "0.85rem", color: "#1A2A3A", mb: 1 }}>Seleccione los medios necesarios:</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
              {["Proyector", "Sonido", "Micrófono", "Computador", "Otro"].map((m) => (
                <FormControlLabel
                  key={m}
                  control={
                    <Checkbox
                      size="small"
                      checked={!!medios[m]}
                      onChange={(e) => setMedios({ ...medios, [m]: e.target.checked })}
                    />
                  }
                  label={<Typography sx={{ fontSize: "0.875rem" }}>{m}</Typography>}
                />
              ))}
            </Box>
            <TextField fullWidth size="small" label="Observaciones" multiline rows={3}
              value={form.observaciones} onChange={handleChange("observaciones")}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }} />
          </AccordionDetails>
        </Accordion>

        {/* Footer */}
        <Box
          sx={{
            backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E5EAF0",
            p: 2.5, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2,
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", color: "#0B1A2A" }}>Revisión de la solicitud</Typography>
            <Typography sx={{ color: "#5A6A7A", fontSize: "0.85rem" }}>
              La solicitud será revisada por el área encargada antes de su confirmación.
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={cargando}
            sx={{
              backgroundColor: "#E30613", textTransform: "none", fontWeight: 700, borderRadius: "8px",
              px: 3, py: 1.2, boxShadow: "none",
              "&:hover": { backgroundColor: "#C10510", boxShadow: "none" },
              "&.Mui-disabled": { backgroundColor: "#E30613", opacity: 0.7, color: "#fff" },
            }}
          >
            {cargando ? <CircularProgress size={22} color="inherit" /> : "Enviar solicitud →"}
          </Button>
        </Box>
      </Container>
    </>
  );
}