import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Paper,
    TextField,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AdminLayout from "../../../../components/layout/AdminLayout";
import {
    obtenerSolicitudPorId,
    actualizarEstadoSolicitud,
} from "./services/solicitudes.service";

function formatearFecha(fecha?: string | null): string {
    if (!fecha) return "—";
    const soloFecha = fecha.split("T")[0];
    const partes = soloFecha.split("-");
    if (partes.length !== 3) return fecha;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatearHora(hora?: string | null): string {
    if (!hora) return "";
    return hora.slice(0, 5);
}

export default function RechazarSolicitud() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [solicitud, setSolicitud] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [accion, setAccion] = useState<"Rechazada" | "Cancelada">("Rechazada");
    const [motivo, setMotivo] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [dialogoNotificacion, setDialogoNotificacion] = useState(false);

    const [resultadoNotificacion, setResultadoNotificacion] = useState<{
        enviada: boolean;
        simulado: boolean;
        correo: string | null;
    } | null>(null);

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


    const handleConfirmar = async () => {
        if (!id) return;

        if (!motivo.trim()) {
            setError("El motivo es obligatorio.");
            return;
        }

        setEnviando(true);
        setError("");

        try {
            const respuesta = await actualizarEstadoSolicitud(
                id,
                accion,
                motivo.trim()
            );

            // Admite tanto respuesta directa como respuesta Axios.
            const notificacion =
                respuesta?.notificacion ??
                respuesta?.data?.notificacion ??
                null;

            setResultadoNotificacion(notificacion);
            setDialogoNotificacion(true);

        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : "No se pudo procesar la solicitud."
            );
        } finally {
            setEnviando(false);
        }
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
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
                        Volver
                    </Button>
                </Box>
            </AdminLayout>
        );
    }

    const esInterno = solicitud?.solicitante?.tipo === "interno";
    const tipoTexto = esInterno ? "Solicitud institucional" : "Solicitud externa";

    return (

        <AdminLayout>
            <Box
                sx={{
                    width: "100%",
                    maxWidth: "none",
                    mx: "auto",
                    px: { xs: 2, md: 3, lg: 4 },
                    boxSizing: "border-box",
                }}
            >
                {/* Header */}
                <Typography sx={{ fontWeight: 700, fontSize: "1.5rem", color: "#0F172A", mb: 0.5 }}>
                    Resolver solicitud
                </Typography>
                <Typography sx={{ color: "#64748B", fontSize: "0.95rem", mb: 3 }}>
                    Registrar la decisión, exigir un motivo y notificar al solicitante por correo.
                </Typography>

                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 2.5, md: 3.5 },
                        borderRadius: "16px",
                        border: "1px solid #E2E8F0",
                        backgroundColor: "#FFFFFF",
                    }}
                >
                    {/* Resumen de la solicitud */}
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
                            <Typography sx={{ fontWeight: 700, fontSize: "1.15rem", color: "#0F172A" }}>
                                {tipoTexto} · {solicitud.codigo}
                            </Typography>
                            <Typography sx={{ color: "#64748B", fontSize: "0.9rem", mt: 0.5 }}>
                                {solicitud.espacio?.nombre} · {formatearFecha(solicitud.fecha_inicio)} ·{" "}
                                {formatearHora(solicitud.hora_inicio)}–{formatearHora(solicitud.hora_fin)}
                            </Typography>
                        </Box>

                        <Chip
                            label={solicitud.estado}
                            size="small"
                            sx={{
                                backgroundColor: "#D1FAE5",
                                color: "#047857",
                                fontWeight: 600,
                            }}
                        />
                    </Box>

                    {/* Acción de gestión */}
                    <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: "#0F172A", mb: 1.5 }}>
                        Acción de gestión
                    </Typography>

                    <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
                        <Button
                            variant={accion === "Rechazada" ? "contained" : "outlined"}
                            onClick={() => setAccion("Rechazada")}
                            sx={{
                                textTransform: "none",
                                borderRadius: "10px",
                                px: 2.5,
                                py: 1,
                                fontWeight: 600,
                                ...(accion === "Rechazada"
                                    ? {
                                        backgroundColor: "#FEE2E2",
                                        color: "#B91C1C",
                                        border: "1px solid #FECACA",
                                        boxShadow: "none",
                                        "&:hover": { backgroundColor: "#FECACA", boxShadow: "none" },
                                    }
                                    : {
                                        borderColor: "#E2E8F0",
                                        color: "#64748B",
                                    }),
                            }}
                        >
                            Rechazar solicitud
                        </Button>

                        <Button
                            variant={accion === "Cancelada" ? "contained" : "outlined"}
                            onClick={() => setAccion("Cancelada")}
                            sx={{
                                textTransform: "none",
                                borderRadius: "10px",
                                px: 2.5,
                                py: 1,
                                fontWeight: 600,
                                ...(accion === "Cancelada"
                                    ? {
                                        backgroundColor: "#F1F5F9",
                                        color: "#334155",
                                        border: "1px solid #CBD5E1",
                                        boxShadow: "none",
                                        "&:hover": { backgroundColor: "#E2E8F0", boxShadow: "none" },
                                    }
                                    : {
                                        borderColor: "#E2E8F0",
                                        color: "#64748B",
                                    }),
                            }}
                        >
                            Cancelar reserva
                        </Button>
                    </Box>

                    {/* Motivo */}
                    <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: "#0F172A", mb: 1 }}>
                        Motivo obligatorio
                    </Typography>

                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        placeholder="Explica la razón de la decisión. Este motivo quedará en el historial."
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        sx={{
                            mb: 3,
                            "& .MuiOutlinedInput-root": { borderRadius: "12px" },
                        }}
                    />

                    {/* Notificación */}
                    <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: "#0F172A", mb: 0.5 }}>
                        Notificación al solicitante
                    </Typography>
                    <Typography sx={{ color: "#64748B", fontSize: "0.9rem", mb: 2 }}>
                        Se enviará un correo con el nuevo estado y el motivo registrado.
                    </Typography>

                    <Box
                        sx={{
                            backgroundColor: "#F8FAFC",
                            borderRadius: "10px",
                            border: "1px solid #E2E8F0",
                            p: 2,
                            mb: 3,
                        }}
                    >
                        <Typography sx={{ color: "#64748B", fontSize: "0.85rem" }}>
                            La decisión, el administrador y la fecha quedarán registrados en el historial.
                        </Typography>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
                            {error}
                        </Alert>
                    )}

                    {/* Botones */}
                    <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
                        <Button
                            variant="outlined"
                            onClick={() => navigate(-1)}
                            disabled={enviando}
                            sx={{
                                textTransform: "none",
                                borderRadius: "8px",
                                px: 3,
                                borderColor: "#E2E8F0",
                                color: "#64748B",
                            }}
                        >
                            Volver
                        </Button>

                        <Button
                            variant="contained"
                            onClick={handleConfirmar}
                            disabled={enviando || !motivo.trim()}
                            sx={{
                                textTransform: "none",
                                borderRadius: "8px",
                                px: 3,
                                backgroundColor: "#E11D48",
                                fontWeight: 600,
                                boxShadow: "none",
                                "&:hover": { backgroundColor: "#BE123C", boxShadow: "none" },
                                "&.Mui-disabled": { backgroundColor: "#E11D48", opacity: 0.6, color: "#fff" },
                            }}
                        >
                            {enviando ? <CircularProgress size={20} color="inherit" /> : "Confirmar y notificar"}
                        </Button>
                    </Box>
                </Paper>
            </Box>

            <Dialog
                open={dialogoNotificacion}
                onClose={() => setDialogoNotificacion(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontWeight: 700, color: "#0F172A" }}>
                    Resultado de la notificación
                </DialogTitle>

                <DialogContent>
                    {resultadoNotificacion?.enviada &&
                        !resultadoNotificacion?.simulado ? (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            El correo electrónico fue enviado correctamente.
                        </Alert>
                    ) : resultadoNotificacion?.simulado ? (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            La solicitud fue procesada correctamente, pero el correo
                            solamente fue simulado. No se realizó un envío real.
                        </Alert>
                    ) : !resultadoNotificacion?.correo ? (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            La solicitud fue procesada, pero el solicitante no tiene
                            un correo electrónico registrado.
                        </Alert>
                    ) : (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            La solicitud fue procesada, pero no fue posible enviar
                            el correo electrónico.
                        </Alert>
                    )}

                    <Typography sx={{ fontSize: "0.95rem", color: "#334155", mb: 1 }}>
                        <strong>Acción realizada:</strong>{" "}
                        {accion === "Rechazada" ? "Rechazo" : "Cancelación"}
                    </Typography>

                    <Typography sx={{ fontSize: "0.95rem", color: "#334155" }}>
                        <strong>Destinatario:</strong>{" "}
                        {resultadoNotificacion?.correo || "No registrado"}
                    </Typography>
                </DialogContent>

                <DialogActions sx={{ p: 2.5 }}>
                    <Button
                        variant="contained"
                        onClick={() => {
                            setDialogoNotificacion(false);
                            navigate(`/admin/solicitudes/${id}`);
                        }}
                        sx={{
                            textTransform: "none",
                            borderRadius: "8px",
                            backgroundColor: "#1E3A5F",
                            "&:hover": {
                                backgroundColor: "#172F4D",
                            },
                        }}
                    >
                        Volver al detalle
                    </Button>
                </DialogActions>
            </Dialog>

        </AdminLayout>
    );
}