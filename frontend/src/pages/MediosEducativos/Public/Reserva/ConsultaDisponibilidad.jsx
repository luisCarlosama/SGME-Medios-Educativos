import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Container,
    FormControl,
    InputAdornment,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";

import ModalDisponibilidad from "./components/ModalDisponibilidad";

import { useNavigate } from "react-router-dom";
import {
    obtenerCampus,
    obtenerEspacios,
    consultarDisponibilidad,
} from "./services/reservas.service";

const AZUL = "#0F2744";
const AZUL_OSCURO = "#0B1F33";
const ROJO = "#E11D48";

function obtenerId(item) {
    return item?.id_campus ?? item?.id_espacio ?? item?.id ?? item?.idCampus ?? "";
}

function obtenerNombre(item) {
    return (
        item?.nombre ??
        item?.nombre_campus ??
        item?.nombre_espacio ??
        item?.nombreCampus ??
        item?.nombreEspacio ??
        ""
    );
}
function fechaLocalActual() {
    const fecha = new Date();
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
}

export default function ConsultaDisponibilidad() {
    const navigate = useNavigate();

    const [campus, setCampus] = useState([]);
    const [espacios, setEspacios] = useState([]);

    const [idCampus, setIdCampus] = useState("");
    const [idEspacio, setIdEspacio] = useState("");
    const [fecha, setFecha] = useState(fechaLocalActual());
    const [horaInicio, setHoraInicio] = useState("08:00");
    const [horaFin, setHoraFin] = useState("09:00");

    const [cargandoCampus, setCargandoCampus] = useState(true);
    const [cargandoEspacios, setCargandoEspacios] = useState(false);
    const [error, setError] = useState("");
    const [busquedaRealizada, setBusquedaRealizada] = useState(false);
    const [consultando, setConsultando] = useState(false);
    const [resultadoDisponibilidad, setResultadoDisponibilidad] = useState(null);

    const [modalAbierto, setModalAbierto] = useState(false);
    const [fechaCalendario, setFechaCalendario] = useState("");

    useEffect(() => {
        async function cargarCampus() {
            try {
                setCargandoCampus(true);
                setError("");
                const datos = await obtenerCampus();
                setCampus(Array.isArray(datos) ? datos : []);
            } catch (err) {
                setError(err.message || "No fue posible cargar los campus.");
            } finally {
                setCargandoCampus(false);
            }
        }
        cargarCampus();
    }, []);

    useEffect(() => {
        async function cargarEspacios() {
            setEspacios([]);
            setIdEspacio("");
            setBusquedaRealizada(false);

            if (!idCampus) {
                setCargandoEspacios(false);
                return;
            }

            try {
                setCargandoEspacios(true);
                setError("");
                const datos = await obtenerEspacios(idCampus);
                setEspacios(Array.isArray(datos) ? datos : []);
            } catch (err) {
                setError(err.message || "No fue posible cargar los espacios.");
            } finally {
                setCargandoEspacios(false);
            }
        }
        cargarEspacios();
    }, [idCampus]);

    async function buscarDisponibilidad() {
        setError("");
        setBusquedaRealizada(false);
        setResultadoDisponibilidad(null);

        if (!idCampus || !idEspacio || !fecha || !horaInicio || !horaFin) {
            setError("Completa todos los campos de la consulta.");
            return;
        }
        if (fecha < fechaLocalActual()) {
            setError("La fecha no puede ser anterior al día actual.");
            return;
        }
        if (horaFin <= horaInicio) {
            setError("La hora final debe ser posterior a la hora inicial.");
            return;
        }

        try {
            setConsultando(true);
            const resultado = await consultarDisponibilidad({
                id_espacio: idEspacio,
                fecha,
                hora_inicio: horaInicio,
                hora_fin: horaFin,
            });
            setResultadoDisponibilidad(resultado);
            setBusquedaRealizada(true);
        } catch (err) {
            setError(err.message || "No fue posible consultar la disponibilidad.");
        } finally {
            setConsultando(false);
        }
    }

    function limpiarFiltros() {
        setIdCampus("");
        setIdEspacio("");
        setFecha(fechaLocalActual());
        setHoraInicio("08:00");
        setHoraFin("09:00");
        setBusquedaRealizada(false);
        setResultadoDisponibilidad(null);
        setError("");
    }


    const [mesVisible, setMesVisible] = useState(() => {
        const hoy = new Date();
        return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    });

    const diasCalendario = (() => {
        const anio = mesVisible.getFullYear();
        const mes = mesVisible.getMonth();
        const cantidadDias = new Date(anio, mes + 1, 0).getDate();

        // Ajustar para que la semana comience el lunes.
        const espaciosIniciales = (new Date(anio, mes, 1).getDay() + 6) % 7;

        return [
            ...Array.from({ length: espaciosIniciales }, (_, i) => ({
                tipo: "vacio",
                id: `vacio-${i}`,
            })),
            ...Array.from({ length: cantidadDias }, (_, i) => ({
                tipo: "dia",
                dia: i + 1,
                id: `${anio}-${mes + 1}-${i + 1}`,
            })),
        ];
    })();

    const nombreMes = mesVisible.toLocaleDateString("es-CO", {
        month: "long",
        year: "numeric",
    });

    const cambiarMes = (cantidad) => {
        setMesVisible(
            (actual) =>
                new Date(
                    actual.getFullYear(),
                    actual.getMonth() + cantidad,
                    1
                )
        );
    };


    const colorDia = (estado) => {
        if (estado === "verde") return { bg: "#D1FAE5", color: "#065F46" };
        if (estado === "rojo") return { bg: "#FEE2E2", color: "#991B1B" };
        return { bg: "#F1F5F9", color: "#64748B" };
    };

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "#F8FAFC" }}>

            {/* ========== HERO ========== */}
            <Box
                sx={{
                    background: "linear-gradient(90deg, #475569 0%, #64748B 100%)",
                    color: "#fff",
                    py: { xs: 5, md: 6 },
                }}
            >
                <Container
                    maxWidth="xl"
                    sx={{ px: { xs: 2, sm: 3, md: 6 } }}
                >
                    <Stack
                        direction={{ xs: "column", md: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", md: "center" }}
                        spacing={3}
                    >
                        <Box sx={{ maxWidth: 560 }}>
                            <Typography
                                sx={{
                                    fontSize: "0.8rem",
                                    letterSpacing: "1px",
                                    color: "rgba(255,255,255,0.75)",
                                    mb: 1,
                                }}
                            >
                                MEDIOS EDUCATIVOS
                            </Typography>

                            <Typography
                                sx={{
                                    fontWeight: 800,
                                    fontSize: { xs: "1.9rem", md: "2.5rem" },
                                    lineHeight: 1.15,
                                    mb: 1.5,
                                }}
                            >
                                Consultar disponibilidad
                            </Typography>

                            <Typography
                                sx={{
                                    color: "rgba(255,255,255,0.85)",
                                    fontSize: "1rem",
                                    mb: 2,
                                }}
                            >
                                Selecciona los criterios para consultar los espacios disponibles.
                            </Typography>

                            <Box
                                sx={{
                                    width: 48,
                                    height: 3,
                                    bgcolor: "#E11D48",
                                    borderRadius: 1,
                                }}
                            />

                        </Box>

                        <Button
                            variant="outlined"
                            onClick={() => navigate("/consulta-estado")}
                            sx={{
                                color: "#fff !important",
                                border: "1.5px solid rgba(255,255,255,0.7) !important",
                                textTransform: "none",
                                fontWeight: 500,
                                fontSize: "0.85rem",
                                borderRadius: "50px",
                                px: 2.25,
                                py: 0.75,
                                height: 40,              // altura fija
                                minHeight: 40,
                                maxHeight: 40,
                                whiteSpace: "nowrap",
                                lineHeight: 1.2,
                                flexShrink: 0,
                                boxShadow: "none",
                                bgcolor: "transparent",
                                "&:hover": {
                                    border: "1.5px solid #fff !important",
                                    bgcolor: "rgba(255,255,255,0.12)",
                                },
                            }}
                        >
                            ¿Ya tienes una solicitud? Consulta su estado →
                        </Button>
                    </Stack>
                </Container>
            </Box>

            {/* ========== FORMULARIO ========== */}
            <Container
                maxWidth="xl"
                sx={{
                    mt: { xs: -3, md: -4 },
                    position: "relative",
                    zIndex: 2,
                    px: { xs: 2, sm: 3, md: 6 },
                    pb: { xs: 4, md: 6 },
                }}
            >
                <Card
                    elevation={0}
                    sx={{
                        borderRadius: "16px",
                        border: "1px solid #E2E8F0",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
                    }}
                >
                    <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
                        <Typography
                            sx={{ fontWeight: 700, fontSize: "1.25rem", color: AZUL, mb: 0.5 }}
                        >
                            Define tu búsqueda
                        </Typography>
                        <Typography sx={{ color: "#64748B", fontSize: "0.9rem", mb: 0.5 }}>
                            Selecciona los criterios para consultar disponibilidad.
                        </Typography>
                        <Box
                            sx={{
                                width: 40,
                                height: 3,
                                bgcolor: ROJO,
                                mb: 3,
                                borderRadius: 1,
                            }}
                        />

                        {error && (
                            <Alert severity="error" sx={{ mb: 3 }}>
                                {error}
                            </Alert>
                        )}

                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "1fr 1fr",
                                    md: "1fr 1fr 1fr",
                                },
                                gap: 2.5,
                            }}
                        >
                            {/* Campus */}
                            <FormControl fullWidth size="small">
                                <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, mb: 0.75, color: "#334155" }}>
                                    Campus
                                </Typography>
                                <Select
                                    value={idCampus}
                                    displayEmpty
                                    onChange={(e) => setIdCampus(e.target.value)}
                                    disabled={cargandoCampus}
                                    startAdornment={
                                        <InputAdornment position="start">
                                            <HomeOutlinedIcon sx={{ fontSize: 18, color: "#94A3B8" }} />
                                        </InputAdornment>
                                    }
                                    sx={{ borderRadius: "10px", bgcolor: "#fff" }}
                                >
                                    <MenuItem value="" disabled>
                                        Seleccionar campus
                                    </MenuItem>
                                    {campus.map((item, index) => (
                                        <MenuItem key={obtenerId(item) || index} value={String(obtenerId(item))}>
                                            {obtenerNombre(item) || `Campus ${index + 1}`}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {/* Espacio */}
                            <FormControl fullWidth size="small">
                                <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, mb: 0.75, color: "#334155" }}>
                                    Espacio
                                </Typography>
                                <Select
                                    value={idEspacio}
                                    displayEmpty
                                    onChange={(e) => {
                                        setIdEspacio(e.target.value);
                                        setBusquedaRealizada(false);
                                    }}
                                    disabled={!idCampus || cargandoEspacios}
                                    startAdornment={
                                        <InputAdornment position="start">
                                            <GridViewOutlinedIcon sx={{ fontSize: 18, color: "#94A3B8" }} />
                                        </InputAdornment>
                                    }
                                    sx={{ borderRadius: "10px" }}
                                >
                                    <MenuItem value="" disabled>
                                        Seleccionar espacio
                                    </MenuItem>
                                    {espacios.map((item, index) => (
                                        <MenuItem
                                            key={obtenerId(item) || index}
                                            value={String(item.id_espacio ?? item.id ?? "")}
                                        >
                                            {obtenerNombre(item) || `Espacio ${index + 1}`}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {/* Fecha */}
                            <Box>
                                <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, mb: 0.75, color: "#334155" }}>
                                    Fecha
                                </Typography>
                                <TextField
                                    fullWidth
                                    size="small"
                                    type="date"
                                    value={fecha}
                                    onChange={(e) => {
                                        setFecha(e.target.value);
                                        setBusquedaRealizada(false);
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <CalendarTodayOutlinedIcon sx={{ fontSize: 18, color: "#94A3B8" }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    inputProps={{ min: fechaLocalActual() }}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
                                />
                            </Box>

                            {/* Hora inicio */}
                            <Box>
                                <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, mb: 0.75, color: "#334155" }}>
                                    Hora de inicio
                                </Typography>
                                <TextField
                                    fullWidth
                                    size="small"
                                    type="time"
                                    value={horaInicio}
                                    onChange={(e) => {
                                        setHoraInicio(e.target.value);
                                        setBusquedaRealizada(false);
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <AccessTimeOutlinedIcon sx={{ fontSize: 18, color: "#94A3B8" }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
                                />
                            </Box>

                            {/* Hora fin */}
                            <Box>
                                <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, mb: 0.75, color: "#334155" }}>
                                    Hora de finalización
                                </Typography>
                                <TextField
                                    fullWidth
                                    size="small"
                                    type="time"
                                    value={horaFin}
                                    onChange={(e) => {
                                        setHoraFin(e.target.value);
                                        setBusquedaRealizada(false);
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <AccessTimeOutlinedIcon sx={{ fontSize: 18, color: "#94A3B8" }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
                                />
                            </Box>

                            {/* Botones */}
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, justifyContent: "flex-end" }}>
                                <Button
                                    fullWidth
                                    variant="contained"
                                    startIcon={
                                        consultando ? (
                                            <CircularProgress size={18} color="inherit" />
                                        ) : (
                                            <SearchIcon />
                                        )
                                    }
                                    onClick={buscarDisponibilidad}
                                    disabled={consultando}
                                    sx={{
                                        bgcolor: ROJO,
                                        textTransform: "none",
                                        fontWeight: 600,
                                        borderRadius: "10px",
                                        py: 1.2,
                                        boxShadow: "none",
                                        "&:hover": { bgcolor: "#BE123C", boxShadow: "none" },
                                    }}
                                >
                                    {consultando ? "Consultando..." : "Consultar disponibilidad →"}
                                </Button>

                                <Button
                                    fullWidth
                                    variant="contained"
                                    onClick={() => navigate("/reserva")}
                                    sx={{
                                        bgcolor: "#1E3A5F",
                                        textTransform: "none",
                                        fontWeight: 600,
                                        borderRadius: "10px",
                                        py: 1.2,
                                        boxShadow: "none",
                                        "&:hover": { bgcolor: "#0F2744", boxShadow: "none" },
                                    }}
                                >
                                    Solicitar reserva →
                                </Button>

                                <Typography
                                    onClick={limpiarFiltros}
                                    sx={{
                                        textAlign: "center",
                                        fontSize: "0.85rem",
                                        color: "#64748B",
                                        cursor: "pointer",
                                        "&:hover": { color: AZUL },
                                    }}
                                >
                                    Limpiar filtros
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>

                {/* Resultado de la consulta real */}
                {busquedaRealizada && (
                    <Box sx={{ mt: 3 }}>
                        <Alert
                            severity={resultadoDisponibilidad?.disponible ? "success" : "warning"}
                            sx={{ borderRadius: "12px" }}
                        >
                            {resultadoDisponibilidad?.disponible
                                ? "El espacio está disponible en la fecha y horario seleccionados."
                                : "El espacio no está disponible en la fecha y horario seleccionados."}
                        </Alert>
                    </Box>
                )}


                {/* ========== CALENDARIO ========== */}

                <Box sx={{ mt: 5, mb: 6, width: "100%" }}>

                    <Box
                        sx={{
                            mt: 5,
                            mb: 6,
                            display: "flex",
                            flexDirection: { xs: "column", sm: "row" },
                            alignItems: { xs: "flex-start", sm: "center" },
                            justifyContent: "flex-start",
                            gap: { xs: 1.5, sm: 3 },
                            mb: 2,
                        }}
                    >
                        <Box sx={{ flexShrink: 0 }}>
                            <Typography
                                sx={{
                                    fontWeight: 700,
                                    fontSize: "1.25rem",
                                    color: AZUL,
                                }}
                            >
                                Disponibilidad en calendario
                            </Typography>

                            <Box
                                sx={{
                                    width: 40,
                                    height: 3,
                                    bgcolor: ROJO,
                                    mt: 0.75,
                                    borderRadius: 1,
                                }}
                            />
                        </Box>

                        <Typography
                            sx={{
                                color: "#64748B",
                                fontSize: "0.9rem",
                                textAlign: "left",
                            }}
                        >
                            Vista mensual · {nombreMes}
                        </Typography>
                    </Box>


                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", lg: "1.6fr 1fr" },
                            gap: 3,
                        }}
                    >
                        {/* Calendario */}
                        <Card
                            elevation={0}
                            sx={{
                                borderRadius: "16px",
                                border: "1px solid #E2E8F0",
                                p: 3,
                            }}
                        >
                            <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", color: AZUL, mb: 0.5 }}>
                                {nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}
                            </Typography>

                            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => cambiarMes(-1)}
                                >
                                    Mes anterior
                                </Button>

                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => cambiarMes(1)}
                                >
                                    Mes siguiente
                                </Button>
                            </Stack>

                            <Typography sx={{ color: "#64748B", fontSize: "0.85rem", mb: 2.5 }}>
                                Selecciona un día para consultar sus horarios
                            </Typography>

                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(7, 1fr)",
                                    gap: 1,
                                    mb: 1,
                                }}
                            >
                                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                                    <Typography
                                        key={d}
                                        sx={{
                                            textAlign: "center",
                                            fontSize: "0.75rem",
                                            fontWeight: 600,
                                            color: "#94A3B8",
                                            py: 0.5,
                                        }}
                                    >
                                        {d}
                                    </Typography>
                                ))}
                            </Box>

                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(7, 1fr)",
                                    gap: 1,
                                }}
                            >

                                {diasCalendario.map((item) => {
                                    if (item.tipo === "vacio") {
                                        return <Box key={item.id} />;
                                    }

                                    return (
                                        <Box
                                            key={item.id}
                                            onClick={() => {
                                                const anio = mesVisible.getFullYear();
                                                const mes = String(mesVisible.getMonth() + 1).padStart(2, "0");
                                                const dia = String(item.dia).padStart(2, "0");

                                                setFechaCalendario(`${anio}-${mes}-${dia}`);
                                                setModalAbierto(true);
                                            }}
                                            sx={{
                                                bgcolor: "#F1F5F9",
                                                color: "#64748B",
                                                borderRadius: "8px",
                                                py: 1.5,
                                                textAlign: "center",
                                                fontWeight: 600,
                                                fontSize: "0.9rem",
                                                cursor: "pointer",
                                                transition: "transform 0.15s",
                                                "&:hover": {
                                                    transform: "scale(1.05)",
                                                },
                                            }}
                                        >
                                            {item.dia}
                                        </Box>
                                    );
                                })}

                            </Box>
                        </Card>

                        {/* Card lateral */}
                        <Card
                            elevation={0}
                            sx={{
                                borderRadius: "16px",
                                border: "1px solid #E2E8F0",
                                p: 3,
                                height: "fit-content",
                            }}
                        >
                            <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", color: AZUL, mb: 1 }}>
                                ¿Ya encontraste un día libre?
                            </Typography>
                            <Typography sx={{ color: "#64748B", fontSize: "0.9rem", mb: 2.5, lineHeight: 1.6 }}>
                                Puedes iniciar tu solicitud de reserva en cualquier momento. No necesitas consultar primero.
                            </Typography>

                            <Button
                                fullWidth
                                variant="contained"
                                onClick={() => navigate("/reserva")}
                                sx={{
                                    bgcolor: "#1E3A5F",
                                    textTransform: "none",
                                    fontWeight: 600,
                                    borderRadius: "10px",
                                    py: 1.3,
                                    mb: 3,
                                    boxShadow: "none",
                                    "&:hover": { bgcolor: "#0F2744", boxShadow: "none" },
                                }}
                            >
                                Solicitar reserva →
                            </Button>

                            <Stack spacing={1.25}>
                                <Stack direction="row" alignItems="center" spacing={1.25}>
                                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#10B981" }} />
                                    <Typography sx={{ fontSize: "0.85rem", color: "#475569" }}>Disponible</Typography>
                                </Stack>
                                <Stack direction="row" alignItems="center" spacing={1.25}>
                                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#EF4444" }} />
                                    <Typography sx={{ fontSize: "0.85rem", color: "#475569" }}>Reservado</Typography>
                                </Stack>
                                <Stack direction="row" alignItems="center" spacing={1.25}>
                                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#94A3B8" }} />
                                    <Typography sx={{ fontSize: "0.85rem", color: "#475569" }}>No disponible</Typography>
                                </Stack>
                            </Stack>

                            <Typography
                                sx={{
                                    mt: 2.5,
                                    fontSize: "0.75rem",
                                    color: "#94A3B8",
                                    lineHeight: 1.5,
                                }}
                            >
                                La disponibilidad se confirma al revisar la solicitud.
                            </Typography>
                        </Card>
                    </Box>
                </Box>
                <ModalDisponibilidad
                    open={modalAbierto}
                    onClose={() => setModalAbierto(false)}
                    fecha={fechaCalendario}
                    idEspacio={idEspacio}
                />
            </Container >

        </Box >
    );
}