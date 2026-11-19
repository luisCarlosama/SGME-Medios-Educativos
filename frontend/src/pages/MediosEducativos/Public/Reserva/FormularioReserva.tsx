import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
  Tabs,
  Tab,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useNavigate } from "react-router-dom";
import {
  obtenerCampus,
  obtenerEspacios,
  obtenerTiposEspacio,
  obtenerCatalogosInstitucionales,
  crearSolicitud,
} from "./services/reservas.service";

const HORAS = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
];

const DRAFT_KEY = "borrador_solicitud_reserva";
const PERSONAL_KEY = "datos_personales_reserva";
const DIAS_SEMANA = [
  { valor: 1, nombre: "Lunes" },
  { valor: 2, nombre: "Martes" },
  { valor: 3, nombre: "Miércoles" },
  { valor: 4, nombre: "Jueves" },
  { valor: 5, nombre: "Viernes" },
  { valor: 6, nombre: "Sábado" },
  { valor: 7, nombre: "Domingo" },
];

type Opcion = { id: number; nombre: string };
type TipoSolicitante = "interno" | "externo";

type Formulario = {
  tipo_solicitante: TipoSolicitante;
  fecha_inicio: string;
  fecha_fin: string;
  hora_inicio: string;
  hora_fin: string;
  nombre_actividad: string;
  nombre: string;
  cargo: string;
  correo: string;
  numero_contacto: string;
  identificacion: string;
  nombre_entidad: string;
  tipo_entidad: string;
  ciudad: string;
  id_dependencia: string;
  id_facultad: string;
  id_programa: string;
  id_campus: string;
  id_tipo_espacio: string;
  id_espacio: string;
  observaciones: string;
};

const FORM_INICIAL: Formulario = {
  tipo_solicitante: "externo",
  fecha_inicio: "",
  fecha_fin: "",
  hora_inicio: "",
  hora_fin: "",
  nombre_actividad: "",
  nombre: "",
  cargo: "",
  correo: "",
  numero_contacto: "",
  identificacion: "",
  nombre_entidad: "",
  tipo_entidad: "",
  ciudad: "",
  id_dependencia: "",
  id_facultad: "",
  id_programa: "",
  id_campus: "",
  id_tipo_espacio: "",
  id_espacio: "",
  observaciones: "",
};

const campoSx = {
  "& .MuiOutlinedInput-root": { borderRadius: "8px" },
};

const perfilCampos: (keyof Formulario)[] = [
  "tipo_solicitante",
  "nombre",
  "cargo",
  "correo",
  "numero_contacto",
  "identificacion",
  "nombre_entidad",
  "tipo_entidad",
  "ciudad",
  "id_dependencia",
  "id_facultad",
  "id_programa",
];

function fechaLocal(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function sumarMeses(fechaTexto: string, meses: number): Date {
  const [anio, mes, dia] = fechaTexto.split("-").map(Number);
  const resultado = new Date(anio, mes - 1, 1);
  const ultimoDiaDestino = new Date(
    resultado.getFullYear(),
    resultado.getMonth() + meses + 1,
    0
  ).getDate();

  resultado.setMonth(resultado.getMonth() + meses);
  resultado.setDate(Math.min(dia, ultimoDiaDestino));
  resultado.setHours(0, 0, 0, 0);

  return resultado;
}

function fechaValida(fechaTexto: string): Date {
  const [anio, mes, dia] = fechaTexto.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

function obtenerOcurrencias(
  inicio: string,
  fin: string,
  dias: number[],
  horaInicio: string,
  horaFin: string
) {
  if (!inicio || !fin || !dias.length || fin < inicio) return [];

  const actual = fechaValida(inicio);
  const limite = fechaValida(fin);
  const resultado: {
    fecha_inicio: string;
    fecha_fin: string;
    hora_inicio: string;
    hora_fin: string;
  }[] = [];

  while (actual <= limite && resultado.length <= 200) {
    const diaSemana = actual.getDay() === 0 ? 7 : actual.getDay();

    if (dias.includes(diaSemana)) {
      const fecha = fechaLocal(actual);
      resultado.push({
        fecha_inicio: fecha,
        fecha_fin: fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
      });
    }

    actual.setDate(actual.getDate() + 1);
  }

  return resultado;
}

function formatearFecha(fecha: string): string {
  if (!fecha) return "";
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

export default function FormularioReserva() {
  const navigate = useNavigate();

  // Pestaña activa (0 = Externa, 1 = Institucional)
  const [pestana, setPestana] = useState(0);
  const tipo: TipoSolicitante = pestana === 0 ? "externo" : "interno";
  const esInterno = tipo === "interno";

  const [cargando, setCargando] = useState(false);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [inicializado, setInicializado] = useState(false);

  const [campus, setCampus] = useState<Opcion[]>([]);
  const [tiposEspacio, setTiposEspacio] = useState<Opcion[]>([]);
  const [espacios, setEspacios] = useState<Opcion[]>([]);
  const [programas, setProgramas] = useState<(Opcion & { id_facultad: number })[]>([]);
  const [dependencias, setDependencias] = useState<Opcion[]>([]);
  const [facultades, setFacultades] = useState<Opcion[]>([]);
  const [grupos, setGrupos] = useState<Opcion[]>([]);

  const [form, setForm] = useState<Formulario>(FORM_INICIAL);
  const [medios, setMedios] = useState<Record<string, boolean>>({});

  const [esRecurrente, setEsRecurrente] = useState(false);
  const [diasSeleccionados, setDiasSeleccionados] = useState<number[]>([]);

  // Cuando cambia la pestaña, actualizamos el tipo
  useEffect(() => {
    setForm((prev) => ({ ...prev, tipo_solicitante: tipo }));
  }, [tipo]);

  // Cargar borrador + perfil
  useEffect(() => {
    try {
      const perfilRaw = localStorage.getItem(PERSONAL_KEY);
      const borradorRaw = localStorage.getItem(DRAFT_KEY);

      let perfil: Partial<Formulario> = {};
      let borrador: {
        form?: Partial<Formulario>;
        medios?: Record<string, boolean>;
        esRecurrente?: boolean;
        diasSeleccionados?: number[];
      } = {};

      if (perfilRaw) perfil = JSON.parse(perfilRaw);
      if (borradorRaw) borrador = JSON.parse(borradorRaw);

      setForm({
        ...FORM_INICIAL,
        ...perfil,
        ...borrador.form,
        tipo_solicitante: tipo,
      });

      if (borrador.medios) setMedios(borrador.medios);
      if (typeof borrador.esRecurrente === "boolean") {
        setEsRecurrente(borrador.esRecurrente);
      }
      if (Array.isArray(borrador.diasSeleccionados)) {
        setDiasSeleccionados(borrador.diasSeleccionados);
      }
    } catch {
      // datos corruptos
    } finally {
      setInicializado(true);
    }
  }, []);

  // Guardar borrador
  useEffect(() => {
    if (!inicializado) return;

    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          form,
          medios,
          esRecurrente,
          diasSeleccionados,
        })
      );
    } catch {
      // silencioso
    }
  }, [form, medios, esRecurrente, diasSeleccionados, inicializado]);

  // Cargar catálogos generales
  useEffect(() => {
    let activo = true;
    setCargandoCatalogos(true);

    Promise.all([
      obtenerCampus(),
      obtenerCatalogosInstitucionales(),
    ])
      .then(([c, catalogos]) => {
        if (!activo) return;

        setCampus(
          (Array.isArray(c) ? c : []).map((x: any) => ({
            id: Number(x.id_campus),
            nombre: x.nombre,
          }))
        );

        setDependencias(
          (Array.isArray(catalogos.dependencias) ? catalogos.dependencias : []).map((x: any) => ({
            id: Number(x.id_dependencia),
            nombre: x.nombre,
          }))
        );

        setFacultades(
          (Array.isArray(catalogos.facultades) ? catalogos.facultades : []).map((x: any) => ({
            id: Number(x.id_facultad),
            nombre: x.nombre,
          }))
        );

        setProgramas(
          (Array.isArray(catalogos.programas) ? catalogos.programas : []).map((x: any) => ({
            id: Number(x.id_programa),
            nombre: x.nombre,
            id_facultad: Number(x.id_facultad),
          }))
        );
      })
      .catch((err: unknown) => {
        if (activo) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar los catálogos."
          );
        }
      })
      .finally(() => {
        if (activo) setCargandoCatalogos(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  // Cargar tipos de espacio según el campus seleccionado
  useEffect(() => {
    let activo = true;

    // Si no hay campus seleccionado, limpiar tipos
    if (!form.id_campus) {
      setTiposEspacio([]);
      return;
    }

    obtenerTiposEspacio(Number(form.id_campus))
      .then((lista) => {
        if (!activo) return;

        const tipos = (Array.isArray(lista) ? lista : []).map((x: any) => ({
          id: Number(x.id_tipo_espacio),
          nombre: x.nombre,
        }));

        setTiposEspacio(tipos);

        // Verificar si el tipo seleccionado pertenece al campus
        setForm((prev) => {
          const tipoDisponible = tipos.some(
            (t) => t.id === Number(prev.id_tipo_espacio)
          );

          if (prev.id_tipo_espacio && !tipoDisponible) {
            return {
              ...prev,
              id_tipo_espacio: "",
              id_espacio: "",
            };
          }

          return prev;
        });
      })
      .catch((err: unknown) => {
        if (activo) {
          setTiposEspacio([]);
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar los tipos de espacio."
          );
        }
      });

    return () => {
      activo = false;
    };
  }, [form.id_campus]);

  // Cargar espacios según campus y tipo seleccionados
  useEffect(() => {
    let activo = true;

    if (!form.id_campus || !form.id_tipo_espacio) {
      setEspacios([]);

      setForm((prev) =>
        prev.id_espacio ? { ...prev, id_espacio: "" } : prev
      );

      return;
    }

    obtenerEspacios(
      Number(form.id_campus),
      Number(form.id_tipo_espacio)
    )
      .then((lista) => {
        if (!activo) return;

        const disponibles = Array.isArray(lista) ? lista : [];

        setEspacios(
          disponibles.map((x: any) => ({
            id: Number(x.id_espacio),
            nombre: x.nombre,
          }))
        );

        setForm((prev) => {
          const sigueDisponible = disponibles.some(
            (e: any) => Number(e.id_espacio) === Number(prev.id_espacio)
          );

          return prev.id_espacio && !sigueDisponible
            ? { ...prev, id_espacio: "" }
            : prev;
        });
      })
      .catch((err: unknown) => {
        if (activo) {
          setEspacios([]);
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar los espacios."
          );
        }
      });

    return () => {
      activo = false;
    };
  }, [form.id_campus, form.id_tipo_espacio]);

  const handleChange =
    (campo: keyof Formulario) =>
      (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const valor = e.target.value;

        setForm((prev) => {
          const actualizado = { ...prev, [campo]: valor };

          if (campo === "id_campus" || campo === "id_tipo_espacio") {
            actualizado.id_espacio = "";
          }

          if (campo === "id_facultad") {
            actualizado.id_programa = "";
          }

          return actualizado;
        });
      };

  const cambiarDia = (dia: number, seleccionado: boolean) => {
    setDiasSeleccionados((prev) =>
      seleccionado
        ? [...new Set([...prev, dia])].sort((a, b) => a - b)
        : prev.filter((x) => x !== dia)
    );
  };

  const ocurrencias = useMemo(
    () =>
      esRecurrente
        ? obtenerOcurrencias(
          form.fecha_inicio,
          form.fecha_fin,
          diasSeleccionados,
          form.hora_inicio,
          form.hora_fin
        )
        : [],
    [
      esRecurrente,
      form.fecha_inicio,
      form.fecha_fin,
      form.hora_inicio,
      form.hora_fin,
      diasSeleccionados,
    ]
  );

  const limiteSemestre = useMemo(
    () => (form.fecha_inicio ? sumarMeses(form.fecha_inicio, 6) : null),
    [form.fecha_inicio]
  );

  const periodoExcedeSemestre = Boolean(
    form.fecha_inicio &&
    form.fecha_fin &&
    limiteSemestre &&
    fechaValida(form.fecha_fin) > limiteSemestre
  );

  const guardarPerfilPersonal = () => {
    try {
      const perfil = Object.fromEntries(
        perfilCampos.map((campo) => [campo, form[campo]])
      );
      localStorage.setItem(PERSONAL_KEY, JSON.stringify(perfil));
      setAviso("Tus datos personales se guardaron para futuras solicitudes.");
      setError(null);
    } catch {
      setError("No fue posible guardar tus datos en este navegador.");
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setAviso(null);

    const camposBaseObligatorios =
      form.fecha_inicio &&
      form.fecha_fin &&
      form.hora_inicio &&
      form.hora_fin &&
      form.nombre_actividad.trim() &&
      form.nombre.trim() &&
      form.correo.trim() &&
      form.numero_contacto.trim() &&
      form.id_campus &&
      form.id_tipo_espacio &&
      form.id_espacio;

    if (!camposBaseObligatorios) {
      setError("Completa todos los campos obligatorios (*).");
      return;
    }

    if (form.fecha_fin < form.fecha_inicio) {
      setError("La fecha de finalización no puede ser anterior a la fecha de inicio.");
      return;
    }

    if (form.hora_fin <= form.hora_inicio) {
      setError("La hora de finalización debe ser posterior a la hora de inicio.");
      return;
    }

    if (esInterno && !form.correo.trim().toLowerCase().endsWith("@unicesmag.edu.co")) {
      setError("Para solicitantes institucionales, utiliza tu correo @unicesmag.edu.co.");
      return;
    }

    if (esInterno && (!form.id_dependencia || !form.id_facultad || !form.id_programa)) {
      setError("Selecciona la dependencia general, la facultad y el programa.");
      return;
    }

    if (!esInterno && !form.identificacion.trim()) {
      setError("La identificación es obligatoria para solicitantes externos.");
      return;
    }

    if (
      !esInterno &&
      (!form.nombre_entidad.trim() || !form.tipo_entidad || !form.ciudad.trim())
    ) {
      setError("Completa la entidad, el tipo de entidad y la ciudad.");
      return;
    }
    // Validar que una recurrencia tenga un rango de fechas
    if (
      esInterno &&
      esRecurrente &&
      form.fecha_inicio === form.fecha_fin
    ) {
      setError(
        "No se puede generar la recurrencia. Para realizar una reserva recurrente debes seleccionar una fecha inicial y una fecha final diferentes."
      );
      return;
    }

    const esRangoFechas =
      Boolean(form.fecha_inicio && form.fecha_fin) &&
      form.fecha_inicio !== form.fecha_fin;

    const esRecurrencia =
      esInterno && (esRecurrente || esRangoFechas);

    if (esRecurrencia) {

      if (!form.fecha_inicio || !form.fecha_fin) {
        setError("Selecciona las fechas inicial y final de la recurrencia.");
        return;
      }

      if (periodoExcedeSemestre) {
        setError("El periodo recurrente no puede superar seis meses desde la fecha inicial.");
        return;
      }

      if (diasSeleccionados.length === 0) {
        setError("Selecciona al menos un día de la semana.");
        return;
      }

      if (ocurrencias.length === 0) {
        setError("No hay fechas que coincidan con los días seleccionados en el periodo indicado.");
        return;
      }

      if (ocurrencias.length > 200) {
        setError("La recurrencia genera demasiadas fechas.");
        return;
      }
    }

    const mediosSeleccionados = Object.entries(medios)
      .filter(([, seleccionado]) => seleccionado)
      .map(([medio]) => medio);

    setCargando(true);

    try {
      const resultado = await crearSolicitud({
        tipo_solicitante: tipo,
        nombre: form.nombre.trim(),
        cargo: esInterno ? form.cargo.trim() || null : null,
        correo: form.correo.trim(),
        numero_contacto: form.numero_contacto.trim() || null,
        identificacion: esInterno ? null : form.identificacion.trim(),
        nombre_entidad: esInterno ? null : form.nombre_entidad.trim(),
        tipo_entidad: esInterno ? null : form.tipo_entidad,
        ciudad: esInterno ? null : form.ciudad.trim(),
        id_programa: esInterno && form.id_programa ? Number(form.id_programa) : null,
        id_dependencia: esInterno && form.id_dependencia ? Number(form.id_dependencia) : null,
        id_espacio: Number(form.id_espacio),
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin,
        nombre_actividad: form.nombre_actividad.trim(),
        medios_requeridos: mediosSeleccionados.join(", ") || null,
        observaciones: form.observaciones.trim() || null,

        es_recurrente: esRecurrencia,
        frecuencia_recurrencia: esRecurrencia ? "semanal" : null,
        dias_semana: esRecurrencia ? diasSeleccionados : null,
        ocurrencias: esRecurrencia ? ocurrencias : [],
      });

      try {
        const perfil = Object.fromEntries(
          perfilCampos.map((campo) => [campo, form[campo]])
        );
        localStorage.setItem(PERSONAL_KEY, JSON.stringify(perfil));
      } catch {
        // no crítico
      }

      sessionStorage.setItem("codigo_solicitud", resultado.solicitud.codigo);

      sessionStorage.setItem(
        "resumen_solicitud",
        JSON.stringify({
          codigo: resultado.solicitud.codigo,
          estado: resultado.solicitud.estado,
          espacio:
            espacios.find((e) => e.id === Number(form.id_espacio))?.nombre || "—",
          fecha: form.fecha_inicio,
          fecha_fin: form.fecha_fin,
          horario: `${form.hora_inicio} - ${form.hora_fin}`,
          solicitante: form.nombre.trim(),
          es_recurrente: esInterno && esRecurrente,
          cantidad_ocurrencias: esInterno && esRecurrente ? ocurrencias.length : 1,
        })
      );

      localStorage.removeItem(DRAFT_KEY);
      navigate("/reserva/confirmacion");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al enviar la solicitud.");
    } finally {
      setCargando(false);
    }
  };

  const pasos = esInterno
    ? ["01 Evento", "02 Solicitante", "03 Dependencia", "04 Reserva", "05 Medios"]
    : ["01 Evento", "02 Solicitante", "03 Entidad", "04 Reserva", "05 Medios"];

  return (
    <>
      {/* Hero */}
      <Box sx={{ backgroundColor: "#6B7A8A", py: 4 }}>
        <Container maxWidth="lg">
          <Typography
            sx={{
              color: "rgba(255,255,255,0.7)",
              fontSize: "0.8rem",
              fontWeight: 600,
              mb: 1,
            }}
          >
            MEDIOS EDUCATIVOS
          </Typography>
          <Typography
            sx={{
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: { xs: "1.75rem", md: "2.25rem" },
              mb: 0.5,
            }}
          >
            Solicitud de reserva
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.85)" }}>
            Completa los datos de la solicitud. No necesitas crear una cuenta.
          </Typography>
          <Box
            sx={{
              width: 40,
              height: 3,
              backgroundColor: "#E30613",
              mt: 2,
            }}
          />
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>

        {/* ========== PESTAÑAS DE FIGMA ========== */}
        <Box
          sx={{
            backgroundColor: "#FFFFFF",
            borderRadius: "12px 12px 0 0",
            border: "1px solid #E5EAF0",
            borderBottom: "none",
            overflow: "hidden",
            mb: 0,
          }}
        >
          <Tabs
            value={pestana}
            onChange={(_, nueva) => setPestana(nueva)}
            sx={{
              minHeight: 48,
              "& .MuiTabs-indicator": {
                backgroundColor: "#0B3A5C",
                height: 3,
              },
              "& .MuiTab-root": {
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.95rem",
                minHeight: 48,
                color: "#687789",
                "&.Mui-selected": {
                  color: "#0B3A5C",
                },
              },
            }}
          >
            <Tab label="Solicitud externa" />
            <Tab label="Solicitud institucional" />
          </Tabs>
        </Box>

        {/* Indicador de progreso */}
        <Box
          sx={{
            display: "flex",
            gap: 1,
            mb: 3,
            flexWrap: "wrap",
            backgroundColor: "#FFFFFF",
            borderRadius: "0 0 12px 12px",
            border: "1px solid #E5EAF0",
            borderTop: "none",
            p: 1.5,
            justifyContent: "center",
          }}
        >
          {pasos.map((s, i) => (
            <Typography
              key={s}
              sx={{
                fontSize: "0.8rem",
                fontWeight: i === 0 ? 700 : 500,
                color: i === 0 ? "#0B3A5C" : "#9AA5B5",
                px: 1.5,
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

        {aviso && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAviso(null)}>
            {aviso}
          </Alert>
        )}

        {cargandoCatalogos && (
          <Alert
            severity="info"
            sx={{ mb: 2, alignItems: "center" }}
            icon={<CircularProgress size={18} />}
          >
            Cargando opciones del formulario...
          </Alert>
        )}

        {/* ========== 01 DATOS DEL EVENTO ========== */}
        <Accordion
          defaultExpanded
          elevation={0}
          sx={{
            border: "1px solid #E5EAF0",
            borderRadius: "12px !important",
            mb: 2,
            "&:before": { display: "none" },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography sx={{ fontWeight: 700, color: "#0B1A2A" }}>
                01 Datos del evento
              </Typography>
              <Typography sx={{ color: "#5A6A7A", fontSize: "0.8rem" }}>
                Información principal de la actividad que se desea registrar.
              </Typography>
            </Box>
          </AccordionSummary>

          <AccordionDetails>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
                gap: 2,
              }}
            >
              <TextField
                size="small"
                type="date"
                label="Fecha de inicio *"
                value={form.fecha_inicio}
                onChange={handleChange("fecha_inicio")}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={campoSx}
              />

              <TextField
                size="small"
                type="date"
                label="Fecha de fin *"
                value={form.fecha_fin}
                onChange={handleChange("fecha_fin")}
                slotProps={{ inputLabel: { shrink: true } }}
                inputProps={{
                  min: form.fecha_inicio || undefined,
                  max:
                    esInterno && esRecurrente && limiteSemestre
                      ? fechaLocal(limiteSemestre)
                      : undefined,
                }}
                sx={campoSx}
              />

              <TextField
                select
                size="small"
                label="Hora de inicio *"
                value={form.hora_inicio}
                onChange={handleChange("hora_inicio")}
                sx={campoSx}
              >
                <MenuItem value="">Seleccionar hora</MenuItem>
                {HORAS.map((h) => (
                  <MenuItem key={h} value={h}>
                    {h}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                size="small"
                label="Hora de finalización *"
                value={form.hora_fin}
                onChange={handleChange("hora_fin")}
                sx={campoSx}
              >
                <MenuItem value="">Seleccionar hora</MenuItem>
                {HORAS.map((h) => (
                  <MenuItem key={h} value={h}>
                    {h}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                size="small"
                label="Nombre del evento *"
                placeholder="Ingresar nombre del evento"
                value={form.nombre_actividad}
                onChange={handleChange("nombre_actividad")}
                sx={{ gridColumn: { sm: "span 2" }, ...campoSx }}
              />
            </Box>

            {/* Recurrencia SOLO en institucional */}
            {esInterno && (
              <Box
                sx={{
                  mt: 3,
                  p: 2,
                  border: "1px solid #E5EAF0",
                  borderRadius: "10px",
                  backgroundColor: "#FAFBFC",
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={esRecurrente}
                      onChange={(e) => setEsRecurrente(e.target.checked)}
                    />
                  }
                  label={
                    <Typography sx={{ fontWeight: 700, color: "#0B1A2A" }}>
                      ¿La solicitud es recurrente?
                    </Typography>
                  }
                />

                <Typography sx={{ fontSize: "0.85rem", color: "#5A6A7A", mt: 0.5 }}>
                  Activa esta opción para repetir la actividad en días específicos de la semana.
                </Typography>

                {esRecurrente && (
                  <Box sx={{ mt: 2 }}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      La recurrencia es semanal. Se generarán todas las fechas coincidentes entre
                      la fecha inicial y la fecha final (máximo 6 meses).
                    </Alert>

                    <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", mb: 1 }}>
                      Días de repetición
                    </Typography>

                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                      {DIAS_SEMANA.map((dia) => (
                        <FormControlLabel
                          key={dia.valor}
                          control={
                            <Checkbox
                              size="small"
                              checked={diasSeleccionados.includes(dia.valor)}
                              onChange={(e) => cambiarDia(dia.valor, e.target.checked)}
                            />
                          }
                          label={dia.nombre}
                        />
                      ))}
                    </Box>

                    {periodoExcedeSemestre && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        La fecha final supera los seis meses permitidos.
                      </Alert>
                    )}

                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 2,
                        flexWrap: "wrap",
                        mb: 1,
                      }}
                    >
                      <Typography sx={{ fontWeight: 700, color: "#0B3A5C" }}>
                        Vista previa de fechas generadas
                      </Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>
                        {ocurrencias.length} {ocurrencias.length === 1 ? "fecha" : "fechas"}
                      </Typography>
                    </Box>

                    {!form.fecha_inicio || !form.fecha_fin ? (
                      <Typography sx={{ color: "#687789", fontSize: "0.85rem" }}>
                        Selecciona las fechas inicial y final para generar la vista previa.
                      </Typography>
                    ) : diasSeleccionados.length === 0 ? (
                      <Typography sx={{ color: "#687789", fontSize: "0.85rem" }}>
                        Selecciona uno o más días de la semana.
                      </Typography>
                    ) : ocurrencias.length === 0 ? (
                      <Typography sx={{ color: "#687789", fontSize: "0.85rem" }}>
                        No se encontraron fechas para los días seleccionados.
                      </Typography>
                    ) : (
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr",
                            sm: "1fr 1fr",
                            md: "1fr 1fr 1fr",
                          },
                          gap: 1,
                          maxHeight: 260,
                          overflowY: "auto",
                          pr: 0.5,
                        }}
                      >
                        {ocurrencias.map((ocurrencia, index) => {
                          const fecha = fechaValida(ocurrencia.fecha_inicio);
                          const nombreDia = fecha.toLocaleDateString("es-CO", {
                            weekday: "long",
                          });

                          return (
                            <Box
                              key={`${ocurrencia.fecha_inicio}-${index}`}
                              sx={{
                                p: 1.25,
                                border: "1px solid #E5EAF0",
                                borderRadius: "8px",
                                backgroundColor: "#FFFFFF",
                              }}
                            >
                              <Typography
                                sx={{
                                  fontSize: "0.85rem",
                                  fontWeight: 600,
                                  textTransform: "capitalize",
                                }}
                              >
                                {nombreDia}, {formatearFecha(ocurrencia.fecha_inicio)}
                              </Typography>
                              <Typography sx={{ color: "#687789", fontSize: "0.8rem" }}>
                                {form.hora_inicio} – {form.hora_fin}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    )}

                    <Typography sx={{ mt: 2, color: "#687789", fontSize: "0.8rem" }}>
                      Todas las fechas se enviarán como una única solicitud y compartirán el
                      mismo código y proceso de aprobación.
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* ========== 02 DATOS DEL SOLICITANTE ========== */}
        <Accordion
          defaultExpanded
          elevation={0}
          sx={{
            border: "1px solid #E5EAF0",
            borderRadius: "12px !important",
            mb: 2,
            "&:before": { display: "none" },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography sx={{ fontWeight: 700, color: "#0B1A2A" }}>
                02 Datos del solicitante
              </Typography>
              <Typography sx={{ color: "#5A6A7A", fontSize: "0.8rem" }}>
                Información personal y de contacto de quien solicita el espacio.
              </Typography>
            </Box>
          </AccordionSummary>

          <AccordionDetails>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
                gap: 2,
              }}
            >
              <TextField
                size="small"
                label="Nombre completo *"
                value={form.nombre}
                onChange={handleChange("nombre")}
                sx={campoSx}
              />

              {esInterno ? (
                <TextField
                  size="small"
                  label="Cargo / rol *"
                  value={form.cargo}
                  onChange={handleChange("cargo")}
                  sx={campoSx}
                />
              ) : (
                <TextField
                  size="small"
                  label="Identificación *"
                  value={form.identificacion}
                  onChange={handleChange("identificacion")}
                  sx={campoSx}
                />
              )}

              <TextField
                size="small"
                type="email"
                label={esInterno ? "Correo institucional *" : "Correo electrónico *"}
                value={form.correo}
                onChange={handleChange("correo")}
                sx={campoSx}
              />

              <TextField
                size="small"
                label={
                  esInterno
                    ? "Número de contacto (teléfono o extensión) *"
                    : "Número de contacto *"
                }
                value={form.numero_contacto}
                onChange={handleChange("numero_contacto")}
                sx={campoSx}
              />
            </Box>

            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                onClick={guardarPerfilPersonal}
                sx={{ textTransform: "none", borderRadius: "8px" }}
              >
                Guardar mis datos para futuras solicitudes
              </Button>
              <Typography sx={{ color: "#687789", fontSize: "0.8rem", mt: 1 }}>
                Los datos se guardan únicamente en este navegador.
              </Typography>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* ========== 03 ENTIDAD / DEPENDENCIA ========== */}
        <Accordion
          defaultExpanded
          elevation={0}
          sx={{
            border: "1px solid #E5EAF0",
            borderRadius: "12px !important",
            mb: 2,
            "&:before": { display: "none" },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography sx={{ fontWeight: 700, color: "#0B1A2A" }}>
                {esInterno ? "03 Dependencia / procedencia" : "03 Datos de la entidad solicitante"}
              </Typography>
              <Typography sx={{ color: "#5A6A7A", fontSize: "0.8rem" }}>
                {esInterno
                  ? "Identifica la procedencia institucional del solicitante."
                  : "Datos de la entidad externa que presenta la solicitud."}
              </Typography>
            </Box>
          </AccordionSummary>

          <AccordionDetails>
            {esInterno ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
                  gap: 2,
                }}
              >
                <TextField
                  select
                  size="small"
                  label="Dependencia general *"
                  value={form.id_dependencia}
                  onChange={handleChange("id_dependencia")}
                  sx={campoSx}
                >
                  <MenuItem value="">Seleccione una opción</MenuItem>
                  {dependencias.map((x) => (
                    <MenuItem key={x.id} value={x.id}>
                      {x.nombre}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  size="small"
                  label="Facultad *"
                  value={form.id_facultad}
                  onChange={handleChange("id_facultad")}
                  sx={campoSx}
                >
                  <MenuItem value="">Seleccione una facultad</MenuItem>
                  {facultades.map((x) => (
                    <MenuItem key={x.id} value={x.id}>
                      {x.nombre}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  size="small"
                  label="Programa *"
                  value={form.id_programa}
                  onChange={handleChange("id_programa")}
                  disabled={!form.id_facultad}
                  sx={campoSx}
                >
                  <MenuItem value="">Seleccione un programa</MenuItem>
                  {programas
                    .filter((x) => x.id_facultad === Number(form.id_facultad))
                    .map((x) => (
                      <MenuItem key={x.id} value={x.id}>
                        {x.nombre}
                      </MenuItem>
                    ))}
                </TextField>
              </Box>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
                  gap: 2,
                }}
              >
                <TextField
                  size="small"
                  label="Nombre de la entidad solicitante *"
                  value={form.nombre_entidad}
                  onChange={handleChange("nombre_entidad")}
                  sx={campoSx}
                />

                <TextField
                  select
                  size="small"
                  label="Tipo de entidad *"
                  value={form.tipo_entidad}
                  onChange={handleChange("tipo_entidad")}
                  sx={campoSx}
                >
                  <MenuItem value="">Seleccione tipo de entidad</MenuItem>
                  <MenuItem value="Publica">Pública</MenuItem>
                  <MenuItem value="Privada">Privada</MenuItem>
                  <MenuItem value="Educativa">Educativa</MenuItem>
                  <MenuItem value="Otra">Otra</MenuItem>
                </TextField>

                <TextField
                  size="small"
                  label="Ciudad / municipio *"
                  value={form.ciudad}
                  onChange={handleChange("ciudad")}
                  sx={campoSx}
                />
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* ========== 04 UBICACIÓN Y ESPACIO ========== */}
        <Accordion
          defaultExpanded
          elevation={0}
          sx={{
            border: "1px solid #E5EAF0",
            borderRadius: "12px !important",
            mb: 2,
            "&:before": { display: "none" },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography sx={{ fontWeight: 700, color: "#0B1A2A" }}>
                04 Ubicación y espacio
              </Typography>
              <Typography sx={{ color: "#5A6A7A", fontSize: "0.8rem" }}>
                Define el campus, tipo de espacio y espacio específico.
              </Typography>
            </Box>
          </AccordionSummary>

          <AccordionDetails>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
                gap: 2,
              }}
            >
              <TextField
                select
                size="small"
                label="Campus *"
                value={form.id_campus}
                onChange={handleChange("id_campus")}
                sx={campoSx}
              >
                <MenuItem value="">Seleccione campus</MenuItem>
                {campus.map((x) => (
                  <MenuItem key={x.id} value={x.id}>
                    {x.nombre}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                size="small"
                label="Tipo de espacio *"
                value={form.id_tipo_espacio}
                onChange={handleChange("id_tipo_espacio")}
                sx={campoSx}
              >
                <MenuItem value="">Seleccione tipo de espacio</MenuItem>
                {tiposEspacio.map((x) => (
                  <MenuItem key={x.id} value={x.id}>
                    {x.nombre}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                size="small"
                label="Espacio específico *"
                value={form.id_espacio}
                onChange={handleChange("id_espacio")}
                disabled={!form.id_campus && !form.id_tipo_espacio}
                sx={campoSx}
              >
                <MenuItem value="">Seleccione espacio</MenuItem>
                {espacios.map((x) => (
                  <MenuItem key={x.id} value={x.id}>
                    {x.nombre}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* ========== 05 MEDIOS REQUERIDOS ========== */}
        <Accordion
          defaultExpanded
          elevation={0}
          sx={{
            border: "1px solid #E5EAF0",
            borderRadius: "12px !important",
            mb: 3,
            "&:before": { display: "none" },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography sx={{ fontWeight: 700, color: "#0B1A2A" }}>
                05 Medios requeridos
              </Typography>
              <Typography sx={{ color: "#5A6A7A", fontSize: "0.8rem" }}>
                Selecciona los medios necesarios para la actividad.
              </Typography>
            </Box>
          </AccordionSummary>

          <AccordionDetails>
            <Typography sx={{ fontSize: "0.85rem", color: "#1A2A3A", mb: 1 }}>
              Seleccione los medios necesarios:
            </Typography>

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
              {["PC", "Proyector", "Sonido", "Micrófono", "Pantalla", "Internet", "Parlantes"].map((medio) => (
                <FormControlLabel
                  key={medio}
                  control={
                    <Checkbox
                      size="small"
                      checked={!!medios[medio]}
                      onChange={(e) =>
                        setMedios((prev) => ({
                          ...prev,
                          [medio]: e.target.checked,
                        }))
                      }
                    />
                  }
                  label={<Typography sx={{ fontSize: "0.875rem" }}>{medio}</Typography>}
                />
              ))}
            </Box>

            <TextField
              fullWidth
              size="small"
              label="Observaciones"
              multiline
              rows={3}
              value={form.observaciones}
              onChange={handleChange("observaciones")}
              sx={campoSx}
            />
          </AccordionDetails>
        </Accordion>

        {/* Pie de envío */}
        <Box
          sx={{
            backgroundColor: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5EAF0",
            p: 2.5,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", color: "#0B1A2A" }}>
              Revisión de la solicitud
            </Typography>
            <Typography sx={{ color: "#5A6A7A", fontSize: "0.85rem" }}>
              La solicitud será revisada por el área encargada antes de su confirmación.
              {esInterno && esRecurrente
                ? ` Se registrarán ${ocurrencias.length} fechas en una sola solicitud.`
                : ""}
            </Typography>
          </Box>

          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={cargando || cargandoCatalogos || !inicializado}
            sx={{
              backgroundColor: "#E30613",
              textTransform: "none",
              fontWeight: 700,
              borderRadius: "8px",
              px: 3,
              py: 1.2,
              boxShadow: "none",
              "&:hover": {
                backgroundColor: "#C10510",
                boxShadow: "none",
              },
              "&.Mui-disabled": {
                backgroundColor: "#E30613",
                opacity: 0.7,
                color: "#fff",
              },
            }}
          >
            {cargando ? (
              <CircularProgress size={22} color="inherit" />
            ) : (
              "Enviar solicitud →"
            )}
          </Button>
        </Box>
      </Container>
    </>
  );
}