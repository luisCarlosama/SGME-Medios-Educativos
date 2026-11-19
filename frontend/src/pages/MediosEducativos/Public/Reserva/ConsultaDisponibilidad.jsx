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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
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
    obtenerAgendaDia,
    obtenerAgendaMes,
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

    const [modalConsultaAbierto, setModalConsultaAbierto] = useState(false);

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

    // Estados del calendario
    const [mesVisible, setMesVisible] = useState(() => {
        const hoy = new Date();
        return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    });

    const [reservasMes, setReservasMes] = useState([]);
    const [cargandoCalendario, setCargandoCalendario] = useState(false);
    const [errorCalendario, setErrorCalendario] = useState("");

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


    useEffect(() => {
        let cancelado = false;

        async function cargarOcupacionMensual() {
            if (!idEspacio) {
                setReservasMes([]);
                setCargandoCalendario(false);
                setErrorCalendario("");
                return;
            }

            try {
                setCargandoCalendario(true);
                setErrorCalendario("");

                const datos = await obtenerAgendaMes(
                    Number(idEspacio),
                    mesVisible.getFullYear(),
                    mesVisible.getMonth() + 1
                );
                console.log("RESPUESTA AGENDA MENSUAL:", datos);
                console.log("RESERVAS RECIBIDAS:", datos.reservas);

                console.log(
                    "DATOS COMPLETOS DE AGENDA MENSUAL:",
                    JSON.stringify(datos, null, 2)
                );

                console.log(
                    "FECHAS DE RESERVAS:",
                    datos.reservas?.map((reserva) => ({
                        id_solicitud: reserva.id_solicitud,
                        fecha_inicio: reserva.fecha_inicio,
                        fecha_fin: reserva.fecha_fin,
                        hora_inicio: reserva.hora_inicio,
                        hora_fin: reserva.hora_fin,
                        es_recurrente: reserva.es_recurrente,
                    }))
                );

                if (!cancelado) {
                    setReservasMes(
                        Array.isArray(datos.reservas)
                            ? datos.reservas
                            : []
                    );
                }
            } catch (err) {
                if (!cancelado) {
                    setReservasMes([]);
                    setErrorCalendario(
                        err.message ||
                        "No fue posible consultar la ocupación mensual."
                    );
                }
            } finally {
                if (!cancelado) {
                    setCargandoCalendario(false);
                }
            }
        }

        cargarOcupacionMensual();

        return () => {
            cancelado = true;
        };
    }, [idEspacio, mesVisible]);

    useEffect(() => {
        if (!fecha) return;

        const hoy = new Date();
        const mesActual = new Date(
            hoy.getFullYear(),
            hoy.getMonth(),
            1
        );

        const fechaSeleccionada = new Date(`${fecha}T12:00:00`);

        let mesDestino = new Date(
            fechaSeleccionada.getFullYear(),
            fechaSeleccionada.getMonth(),
            1
        );

        // Nunca mostrar un mes anterior al actual.
        if (mesDestino < mesActual) {
            mesDestino = mesActual;
        }

        setMesVisible(mesDestino);
    }, [fecha]);

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
            setModalConsultaAbierto(true);
        } catch (err) {
            setError(err.message || "No fue posible consultar la disponibilidad.");
        } finally {
            setConsultando(false);
        }
    }
    function irAlCalendario() {
        // Mostrar en el calendario el mes de la fecha consultada.
        const fechaConsultada = new Date(`${fecha}T12:00:00`);
        setMesVisible(
            new Date(
                fechaConsultada.getFullYear(),
                fechaConsultada.getMonth(),
                1
            )
        );

        // Cerrar el resultado de disponibilidad.
        setModalConsultaAbierto(false);

        // Desplazarse hasta el calendario.
        setTimeout(() => {
            document
                .getElementById("calendario-disponibilidad")
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
        }, 150);
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
        setMesVisible((actual) => {
            const siguiente = new Date(
                actual.getFullYear(),
                actual.getMonth() + cantidad,
                1
            );

            const hoy = new Date();
            const mesActual = new Date(
                hoy.getFullYear(),
                hoy.getMonth(),
                1
            );

            // Si todavía no se ha realizado una consulta exitosa,
            // no permitir avanzar más allá del mes actual.
            const fechaLimite = fechaLimiteCalendario
                ? new Date(`${fechaLimiteCalendario}T12:00:00`)
                : hoy;

            const mesLimite = new Date(
                fechaLimite.getFullYear(),
                fechaLimite.getMonth(),
                1
            );

            // No permitir navegar antes del mes actual.
            if (siguiente < mesActual) {
                return actual;
            }

            // No permitir navegar después del mes consultado.
            if (siguiente > mesLimite) {
                return actual;
            }

            return siguiente;
        });
    };

    const colorDia = (estado) => {
        if (estado === "verde") {
            return {
                bg: "#D1FAE5",
                color: "#065F46",
                border: "1px solid #A7F3D0",
            };
        }

        if (estado === "rojo") {
            return {
                bg: "#FCA5A5",
                color: "#7F1D1D",
                border: "1px solid #DC2626",
            };
        }

        return {
            bg: "#F1F5F9",
            color: "#64748B",
            border: "1px solid #E2E8F0",
        };
    };

    const obtenerEstadoDia = (dia) => {
        if (!dia || !idEspacio || cargandoCalendario) {
            return "gris";
        }

        const anio = mesVisible.getFullYear();
        const mes = String(mesVisible.getMonth() + 1).padStart(2, "0");
        const numeroDia = String(dia).padStart(2, "0");
        const fechaDia = `${anio}-${mes}-${numeroDia}`;

        // Los domingos no tienen disponibilidad.
        const fechaObjeto = new Date(`${fechaDia}T12:00:00`);

        if (fechaObjeto.getDay() === 0) {
            return "gris";
        }

        // Las fechas anteriores no están disponibles para consulta.
        if (fechaDia < fechaLocalActual()) {
            return "gris";
        }

        // Verificar si una reserva aprobada ocupa este día.
        const ocupado = reservasMes.some((reserva) => {
            const inicio = reserva.fecha_inicio
                ? String(reserva.fecha_inicio).slice(0, 10)
                : "";

            const fin = reserva.fecha_fin
                ? String(reserva.fecha_fin).slice(0, 10)
                : "";

            if (!inicio || !fin) {
                return false;
            }

            return inicio <= fechaDia && fin >= fechaDia;
        });

        return ocupado ? "rojo" : "verde";
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

                {/* ========== CALENDARIO ========== */}

                <Box
                    id="calendario-disponibilidad"
                    sx={{ mt: 5, mb: 6, width: "100%", scrollMarginTop: "90px" }}
                >
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
                                    disabled={
                                        mesVisible.getFullYear() === new Date().getFullYear() &&
                                        mesVisible.getMonth() === new Date().getMonth()
                                    }
                                >
                                    Mes anterior
                                </Button>

                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => cambiarMes(1)}
                                    disabled={
                                        (() => {
                                            const limite = fecha
                                                ? new Date(`${fecha}T12:00:00`)
                                                : new Date();

                                            return (
                                                mesVisible.getFullYear() === limite.getFullYear() &&
                                                mesVisible.getMonth() === limite.getMonth()
                                            );
                                        })()
                                    }
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
                                    const estado = item.dia
                                        ? obtenerEstadoDia(item.dia)
                                        : "gris";

                                    const estilo = colorDia(estado);

                                    const anio = mesVisible.getFullYear();
                                    const mes = String(mesVisible.getMonth() + 1).padStart(2, "0");
                                    const dia = String(item.dia).padStart(2, "0");

                                    const fechaSeleccionada = `${anio}-${mes}-${dia}`;

                                    const seleccionable =
                                        Boolean(item.dia) &&
                                        Boolean(idEspacio) &&
                                        estado !== "gris" &&
                                        !cargandoCalendario;

                                    return (
                                        <Box
                                            key={item.id}
                                            onClick={() => {
                                                if (!seleccionable) return;

                                                setFechaCalendario(fechaSeleccionada);
                                                setModalAbierto(true);
                                            }}

                                            sx={{
                                                bgcolor: estilo.bg,
                                                color: estilo.color,
                                                border: estilo.border,
                                                borderRadius: 2,
                                                minHeight: 40,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontWeight: estado === "rojo" ? 800 : 600,
                                                cursor: seleccionable ? "pointer" : "default",
                                                opacity: item.dia ? 1 : 0,
                                                pointerEvents: item.dia ? "auto" : "none",
                                                transition: "0.2s",
                                                boxShadow: estado === "rojo"
                                                    ? "0 1px 3px rgba(220, 38, 38, 0.18)"
                                                    : "none",
                                                "&:hover": seleccionable
                                                    ? {
                                                        filter: "brightness(0.94)",
                                                        transform: "scale(1.04)",
                                                    }
                                                    : {},
                                            }}

                                        >
                                            {item.dia || ""}
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
                <Dialog
                    open={modalConsultaAbierto}
                    onClose={() => setModalConsultaAbierto(false)}
                    fullWidth
                    maxWidth="xs"
                    PaperProps={{
                        sx: {
                            borderRadius: "16px",
                            p: 1,
                        },
                    }}
                >
                    <DialogTitle
                        sx={{
                            color: AZUL,
                            fontWeight: 700,
                            fontSize: "1.2rem",
                        }}
                    >
                        Resultado de disponibilidad
                    </DialogTitle>

                    <DialogContent>
                        {resultadoDisponibilidad && (
                            <Stack spacing={2}>
                                <Alert
                                    severity={
                                        resultadoDisponibilidad.disponible
                                            ? "success"
                                            : "warning"
                                    }
                                    sx={{ borderRadius: "10px" }}
                                >
                                    {resultadoDisponibilidad.disponible
                                        ? "El espacio está disponible en el horario seleccionado."
                                        : "El espacio no está disponible en el horario seleccionado."}
                                </Alert>

                                <Box>
                                    <Typography
                                        sx={{
                                            fontSize: "0.8rem",
                                            color: "#64748B",
                                            mb: 0.5,
                                        }}
                                    >
                                        Fecha consultada
                                    </Typography>

                                    <Typography sx={{ fontWeight: 600, color: AZUL }}>
                                        {fecha}
                                    </Typography>
                                </Box>

                                <Box>
                                    <Typography
                                        sx={{
                                            fontSize: "0.8rem",
                                            color: "#64748B",
                                            mb: 0.5,
                                        }}
                                    >
                                        Franja horaria
                                    </Typography>

                                    <Typography sx={{ fontWeight: 600, color: AZUL }}>
                                        {horaInicio} – {horaFin}
                                    </Typography>
                                </Box>

                                <Box>
                                    <Typography
                                        sx={{
                                            fontSize: "0.8rem",
                                            color: "#64748B",
                                            mb: 0.5,
                                        }}
                                    >
                                        Estado
                                    </Typography>

                                    <Typography
                                        sx={{
                                            fontWeight: 700,
                                            color: resultadoDisponibilidad.disponible
                                                ? "#059669"
                                                : "#DC2626",
                                        }}
                                    >
                                        {resultadoDisponibilidad.disponible
                                            ? "Disponible"
                                            : "Reservado"}
                                    </Typography>
                                    {!resultadoDisponibilidad.disponible && (
                                        <Alert
                                            severity="info"
                                            icon={<CalendarTodayOutlinedIcon />}
                                            sx={{
                                                borderRadius: "10px",
                                                alignItems: "flex-start",
                                                mt: 1,
                                            }}
                                        >
                                            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
                                                ¿Quieres encontrar otro horario?
                                            </Typography>

                                            <Typography sx={{ fontSize: "0.875rem", mb: 1.5 }}>
                                                Consulta el calendario de ocupación para visualizar
                                                los días reservados y disponibles del espacio
                                                seleccionado.
                                            </Typography>

                                            <Button
                                                onClick={irAlCalendario}
                                                variant="contained"
                                                size="small"
                                                startIcon={<CalendarTodayOutlinedIcon />}
                                                sx={{
                                                    bgcolor: AZUL,
                                                    textTransform: "none",
                                                    borderRadius: "8px",
                                                    "&:hover": {
                                                        bgcolor: AZUL_OSCURO,
                                                    },
                                                }}
                                            >
                                                Visualizar calendario
                                            </Button>
                                        </Alert>
                                    )}

                                </Box>
                            </Stack>
                        )}
                    </DialogContent>

                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button
                            onClick={() => setModalConsultaAbierto(false)}
                            variant="contained"
                            sx={{
                                bgcolor: AZUL,
                                textTransform: "none",
                                borderRadius: "8px",
                                px: 3,
                                "&:hover": {
                                    bgcolor: AZUL_OSCURO,
                                },
                            }}
                        >
                            Cerrar
                        </Button>
                    </DialogActions>
                </Dialog>
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