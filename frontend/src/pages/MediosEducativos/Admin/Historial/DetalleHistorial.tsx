/**
 * Pantalla: Ficha histórica — Ceremonia / Reserva
 * Diseño 1:1 del prototipo (Ficha histórica detalle — Ceremonia).
 * Sirve tanto para ceremonias como para reservas históricas.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import AdminLayout from '../../../../components/layout/AdminLayout';
import type { HistorialCeremonia } from './interfaces/historial.interface';
import {
  getCeremoniaById,
  getReservaHistoricaById,
} from './services/historial.service';
import {
  contarProgramasSesiones,
  getGraduandos,
  getInvitados,
  getSesiones,
} from '../Ceremonias/services/ceremonias.service';
import ModalSesionesCeremonia from './components/ceremonias/ModalSesionesCeremonia';
import ModalParticipantesCeremonia from './components/ceremonias/ModalParticipantesCeremonia';
import ModalControlIngreso from './components/ceremonias/ModalControlIngreso';
import EvidenciasFotograficasCeremonia from './components/ceremonias/EvidenciasFotograficasCeremonia';
import ConteoProgramasCeremonia from './components/ceremonias/ConteoProgramasCeremonia';

export default function FichaHistorica() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isReserva = location.pathname.includes('/reserva/');

  const [ficha, setFicha] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalActivo, setModalActivo] = useState<'sesiones' | 'participantes' | 'ingresos' | null>(null);
  const [modalExportar, setModalExportar] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [errorExportar, setErrorExportar] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    const cargarFicha = async () => {
      if (!id) {
        setError("No se recibió el identificador del registro.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setFicha(null);

        const loader = isReserva
          ? getReservaHistoricaById
          : getCeremoniaById;

        const resultado = await loader(id);

        if (activo) {
          setFicha(resultado);
        }
      } catch (err) {
        console.error("Error al cargar el detalle histórico:", err);

        if (activo) {
          setError(
            err instanceof Error
              ? err.message
              : "No fue posible cargar el registro histórico."
          );
        }
      } finally {
        if (activo) {
          setLoading(false);
        }
      }
    };

    cargarFicha();

    return () => {
      activo = false;
    };
  }, [id, isReserva]);


  if (loading) {
    return (
      <AdminLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#0B3A5C' }} />
        </Box>
      </AdminLayout>
    );
  }


  if (!ficha) {
    return (
      <AdminLayout>
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography color="text.secondary">
            {error || "Registro no encontrado"}
          </Typography>

          <Button
            onClick={() => navigate("/admin/historial")}
            sx={{ mt: 2, textTransform: "none" }}
          >
            Volver al historial
          </Button>
        </Box>
      </AdminLayout>
    );
  }


  const titleLabel = isReserva ? 'Reserva' : 'Ceremonia';
  const breadcrumb = isReserva
    ? 'Consulta de la información y trazabilidad de la reserva.'
    : 'Consulta de la información y trazabilidad de la ceremonia de grado.';


  if (isReserva) {
    const datos = [
      ["Solicitante", ficha.solicitante?.nombre],
      ["Tipo de solicitante", ficha.solicitante?.tipo],
      ["Correo electrónico", ficha.solicitante?.correo],
      ["Número de contacto", ficha.solicitante?.numero_contacto],
      ["Identificación", ficha.solicitante?.identificacion],

      // Información institucional del solicitante interno
      ["Dependencia", ficha.solicitante?.dependencia],
      ["Facultad", ficha.solicitante?.facultad],
      ["Programa", ficha.solicitante?.programa],

      // Información del solicitante externo
      ["Entidad", ficha.solicitante?.nombre_entidad],
      ["Tipo de entidad", ficha.solicitante?.tipo_entidad],
      ["Ciudad", ficha.solicitante?.ciudad],

      // Información de la reserva
      ["Espacio", ficha.espacio],
      ["Campus", ficha.campus],
      ["Fecha inicial", ficha.fecha_inicio],
      ["Fecha final", ficha.fecha_fin],
      ["Hora de inicio", ficha.hora_inicio],
      ["Hora de finalización", ficha.hora_fin],
      ["Medios requeridos", ficha.medios_requeridos],
      ["Observaciones del solicitante", ficha.observaciones],
    ];

    return (
      <AdminLayout>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: "#0B1A2A" }}>
            Detalle de reserva
          </Typography>

          <Typography sx={{ color: "#5A6A7A", mt: 0.5 }}>
            Información general y trazabilidad de la solicitud de reserva.
          </Typography>
        </Box>

        <Typography sx={{ fontWeight: 700, fontSize: "1.15rem", mb: 2 }}>
          {ficha.codigo} · {ficha.nombre_actividad || "Reserva"}
        </Typography>

        <Box
          sx={{
            backgroundColor: "#0B3A5C",
            color: "#FFFFFF",
            borderRadius: 2,
            p: 3,
            mb: 3,
          }}
        >
          <Typography sx={{ fontWeight: 600 }}>
            {ficha.fechaLarga}
          </Typography>
          <Typography>
            {ficha.espacio} · {ficha.campus}
          </Typography>
          <Typography sx={{ mt: 1 }}>
            Estado: {ficha.estado}
          </Typography>
        </Box>

        <Card elevation={0} sx={{ border: "1px solid #E5EAF0", borderRadius: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography sx={{ fontWeight: 700, mb: 2 }}>
              Información de la solicitud
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 2,
              }}
            >
              {datos.map(([etiqueta, valor]) => (
                <Box key={etiqueta}>
                  <Typography sx={{ color: "#5A6A7A", fontSize: "0.8rem" }}>
                    {etiqueta}
                  </Typography>
                  <Typography sx={{ fontWeight: 500, color: "#1A2A3A" }}>
                    {valor || "—"}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {ficha.es_recurrente && (
          <Card
            elevation={0}
            sx={{ border: "1px solid #E5EAF0", borderRadius: 2, mt: 2 }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>
                Recurrencia de la reserva
              </Typography>

              <Typography>
                Frecuencia: {ficha.frecuencia_recurrencia || "—"}
              </Typography>

              <Typography sx={{ mt: 1 }}>
                Días: {Array.isArray(ficha.dias_semana)
                  ? ficha.dias_semana.join(", ")
                  : ficha.dias_semana || "—"}
              </Typography>

              <Typography sx={{ fontWeight: 600, mt: 2, mb: 1 }}>
                Ocurrencias registradas
              </Typography>

              {ficha.ocurrencias?.length > 0 ? (
                ficha.ocurrencias.map((oc: any, index: number) => (
                  <Box
                    key={`${oc.fecha_inicio}-${index}`}
                    sx={{
                      py: 1,
                      borderBottom: "1px solid #E5EAF0",
                    }}
                  >
                    {oc.fecha_inicio} · {oc.hora_inicio} – {oc.hora_fin}
                  </Box>
                ))
              ) : (
                <Typography color="text.secondary">
                  No hay ocurrencias registradas.
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        {(ficha.estado === "Rechazada" ||
          ficha.estado === "Cancelada") && (
            <Card
              elevation={0}
              sx={{
                border: "1px solid #E5EAF0",
                borderRadius: 2,
                mt: 2,
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>
                  Motivo de rechazo o cancelación
                </Typography>

                <Typography>
                  {ficha.motivo_cancelacion || "No se registró un motivo de gestión."}
                </Typography>
              </CardContent>
            </Card>
          )}

        <Typography sx={{ color: "#5A6A7A", fontSize: "0.85rem", mt: 3 }}>
          Registro histórico de consulta. Esta reserva no se puede editar desde
          esta ficha.
        </Typography>

        <Button
          variant="outlined"
          onClick={() => navigate("/admin/historial")}
          sx={{ mt: 2, textTransform: "none" }}
        >
          Volver al historial
        </Button>
      </AdminLayout>
    );
  }


  const handleExportar = async (formato: 'xlsx' | 'pdf') => {
    if (!id) {
      setErrorExportar('No se recibió el identificador de la ceremonia.');
      return;
    }

    setExportando(true);
    setErrorExportar(null);
    try {
      const [sesiones, graduandos, invitados] = await Promise.all([
        getSesiones(id),
        getGraduandos(id),
        getInvitados(id),
      ]);
      const ingresos = graduandos.data.filter((graduando) => graduando.estadoIngreso === 'Ingresó').length
        + invitados.filter((invitado) => invitado.estadoIngreso === 'Ingresó').length;
      const ceremonia: HistorialCeremonia = ficha;
      const filas: [string, string | number][] = [
        ['Código', ceremonia.codigo ?? '-'],
        ['Ceremonia', ceremonia.ceremonia ?? '-'],
        ['Fecha', ceremonia.fechaLarga || ceremonia.fecha || '-'],
        ['Espacio', ceremonia.espacio || '-'],
        ['Campus', ceremonia.campus || '-'],
        ['Estado', ceremonia.estado ?? '-'],
        ['Sesiones', ceremonia.sesiones ?? '-'],
        ['Programas', contarProgramasSesiones(sesiones)],
        ['Graduandos', ceremonia.graduandos ?? 0],
        ['Invitados', ceremonia.invitados ?? 0],
        ['Ingresos registrados', ingresos],
      ];
      const codigoArchivo = String(ceremonia.codigo || id).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
      const nombreArchivo = `SGME_Historial_Ceremonia_${codigoArchivo}`;

      if (formato === 'xlsx') {
        const libro = XLSX.utils.book_new();
        const hoja = XLSX.utils.aoa_to_sheet([['Campo', 'Valor'], ...filas]);
        XLSX.utils.book_append_sheet(libro, hoja, 'Ceremonia');
        XLSX.writeFile(libro, `${nombreArchivo}.xlsx`);
      } else {
        const doc = new jsPDF();
        doc.setFontSize(14);
        doc.text('SGME - Detalle histórico de ceremonia', 14, 15);
        doc.setFontSize(9);
        doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 14, 22);
        autoTable(doc, {
          startY: 28,
          head: [['Campo', 'Valor']],
          body: filas.map(([campo, valor]) => [campo, String(valor)]),
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [30, 58, 95] },
        });
        doc.save(`${nombreArchivo}.pdf`);
      }
      setModalExportar(false);
    } catch (err: unknown) {
      console.error('Error al exportar el detalle de la ceremonia:', err);
      setErrorExportar(err instanceof Error ? err.message : 'No fue posible exportar el detalle de la ceremonia.');
    } finally {
      setExportando(false);
    }
  };

  const kpis = [
    { label: 'Sesiones', value: ficha.sesiones ?? '—' },
    { label: 'Programas', value: id ? <ConteoProgramasCeremonia key={id} ceremoniaId={id} /> : '—' },
    { label: 'Graduandos', value: ficha.graduandos ?? 0, highlight: false },
    {
      label: 'Invitados',
      value: ficha.invitados ?? 0,
      highlight: true,
    },
    { label: 'Ingresos registrados', value: ficha.ingresosRegistrados ?? 0 },
  ];

  return (
    <AdminLayout>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 1.5,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: '#0B1A2A',
              fontSize: '1.75rem',
              mb: 0.5,
            }}
          >
            Detalle {titleLabel}
          </Typography>
          <Typography sx={{ color: '#5A6A7A', fontSize: '0.875rem' }}>
            {breadcrumb}
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => {
            setErrorExportar(null);
            setModalExportar(true);
          }}
          sx={{
            backgroundColor: '#0B3A5C',
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: '8px',
            px: 3,
            boxShadow: 'none',
            '&:hover': { backgroundColor: '#062A42', boxShadow: 'none' },
          }}
        >
          Exportar
        </Button>
      </Box>

      {/* Código · título */}
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: '1.15rem',
          color: '#0B1A2A',
          mb: 2,
        }}
      >
        {ficha.codigo} · {ficha.ceremonia}
      </Typography>

      {/* Banner fecha · espacio */}
      <Box
        sx={{
          backgroundColor: '#0B3A5C',
          borderRadius: '12px',
          px: 3,
          py: 2.25,
          mb: 2.5,
          color: '#FFFFFF',
        }}
      >
        <Typography sx={{ fontWeight: 600, fontSize: '1.05rem', mb: 0.4 }}>
          {ficha.fechaLarga || ficha.fecha}
          {ficha.espacio && ficha.espacio !== '—' ? ` · ${ficha.espacio}` : ''}
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', opacity: 0.9 }}>
          {ficha.campus || '—'} · Estado: {ficha.estado}
        </Typography>
      </Box>

      {/* KPI cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr 1fr',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(5, 1fr)',
          },
          gap: 1.5,
          mb: 2.5,
        }}
      >
        {kpis.map((k) => (
          <Card
            key={k.label}
            elevation={0}
            sx={{
              borderRadius: '10px',
              border: '1px solid #E5EAF0',
              backgroundColor: '#FFFFFF',
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, textAlign: 'center' }}>
              <Typography
                sx={{ color: '#5A6A7A', fontSize: '0.8rem', mb: 0.5 }}
              >
                {k.label}
              </Typography>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '1.35rem',
                  color: k.highlight ? '#1B7A3D' : '#0B1A2A',
                }}
              >
                {k.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Trazabilidad histórica */}
      <Box
        sx={{
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          border: '1px solid #E5EAF0',
          px: 2.5,
          py: 1.75,
          mb: 2.5,
        }}
      >
        <Typography
          sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#0B1A2A', mb: 0.5 }}
        >
          Trazabilidad histórica
        </Typography>
        <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem' }}>
          Ceremonia → Sesiones → Programas → Graduandos → Invitados → Control de
          ingreso
        </Typography>
      </Box>

      {/* Grid 2x2 de secciones */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          mb: 3,
        }}
      >
        {/* Sesiones */}
        <Card
          elevation={0}
          sx={{
            borderRadius: '12px',
            border: '1px solid #E5EAF0',
            backgroundColor: '#FFFFFF',
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Typography
              sx={{ fontWeight: 700, fontSize: '1rem', color: '#0B1A2A', mb: 0.5 }}
            >
              Sesiones de la ceremonia
            </Typography>
            <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem', mb: 2 }}>
              Consulta las sesiones históricas y sus programas asociados.
            </Typography>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1.5,
              }}
            >
              <Typography sx={{ color: '#5A6A7A', fontSize: '0.875rem' }}>
                Sesiones registradas
              </Typography>
              <Typography sx={{ fontWeight: 600, color: '#1A2A3A' }}>
                {ficha.sesiones ?? '—'}
              </Typography>
            </Box>
            <Button
              variant="text"
              onClick={() => setModalActivo('sesiones')}
              sx={{
                color: '#1565C0',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.875rem',
                p: 0,
                minWidth: 'auto',
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'underline',
                },
              }}
            >
              Consultar sesiones →
            </Button>
          </CardContent>
        </Card>

        {/* Graduandos e invitados */}
        <Card
          elevation={0}
          sx={{
            borderRadius: '12px',
            border: '1px solid #E5EAF0',
            backgroundColor: '#FFFFFF',
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Typography
              sx={{ fontWeight: 700, fontSize: '1rem', color: '#0B1A2A', mb: 0.5 }}
            >
              Graduandos e invitados
            </Typography>
            <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem', mb: 2 }}>
              Consulta la relación histórica de participantes dentro de la
              ceremonia.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ color: '#5A6A7A', fontSize: '0.875rem' }}>
                  Graduandos
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#0B1A2A' }}>
                  {ficha.graduandos ?? 0}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ color: '#5A6A7A', fontSize: '0.875rem' }}>
                  Invitados
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#0B1A2A' }}>
                  {ficha.invitados ?? 0}
                </Typography>
              </Box>
            </Box>
            <Button
              variant="text"
              onClick={() => setModalActivo('participantes')}
              sx={{
                color: '#1565C0',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.875rem',
                p: 0,
                minWidth: 'auto',
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'underline',
                },
              }}
            >
              Consultar participantes →
            </Button>
          </CardContent>
        </Card>

        {/* Control de ingreso */}
        <Card
          elevation={0}
          sx={{
            borderRadius: '12px',
            border: '1px solid #E5EAF0',
            backgroundColor: '#FFFFFF',
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Typography
              sx={{ fontWeight: 700, fontSize: '1rem', color: '#0B1A2A', mb: 0.5 }}
            >
              Control de ingreso
            </Typography>
            <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem', mb: 2 }}>
              Consulta el registro histórico de ingreso conservado para la
              ceremonia.
            </Typography>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1.5,
              }}
            >
              <Typography sx={{ color: '#5A6A7A', fontSize: '0.875rem' }}>
                Ingresos registrados
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#0B1A2A' }}>
                {ficha.ingresosRegistrados ?? 0}
              </Typography>
            </Box>
            <Button
              variant="text"
              onClick={() => setModalActivo('ingresos')}
              sx={{
                color: '#1565C0',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.875rem',
                p: 0,
                minWidth: 'auto',
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'underline',
                },
              }}
            >
              Consultar control →
            </Button>
          </CardContent>
        </Card>

        {/* Evidencias fotográficas */}
        <Card
          elevation={0}
          sx={{
            borderRadius: '12px',
            border: '1px solid #E5EAF0',
            backgroundColor: '#FFFFFF',
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Typography
              sx={{ fontWeight: 700, fontSize: '1rem', color: '#0B1A2A', mb: 0.5 }}
            >
              Evidencias fotográficas
            </Typography>
            <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem', mb: 2 }}>
              Registro visual conservado como parte del historial de la ceremonia.
            </Typography>
            {id && <EvidenciasFotograficasCeremonia key={id} ceremoniaId={id} />}
          </CardContent>
        </Card>
      </Box>

      <Typography sx={{ color: '#5A6A7A', fontSize: '0.85rem' }}>
        Registro histórico de consulta. La {isReserva ? 'reserva' : 'ceremonia'}{' '}
        finalizada no se edita desde esta ficha.
      </Typography>
      {id && modalActivo === 'sesiones' && (
        <ModalSesionesCeremonia ceremoniaId={id} onClose={() => setModalActivo(null)} />
      )}
      {id && modalActivo === 'participantes' && (
        <ModalParticipantesCeremonia ceremoniaId={id} onClose={() => setModalActivo(null)} />
      )}
      {id && modalActivo === 'ingresos' && (
        <ModalControlIngreso ceremoniaId={id} onClose={() => setModalActivo(null)} />
      )}
      <Dialog
        open={modalExportar}
        onClose={exportando ? undefined : () => setModalExportar(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#0F172A' }}>
          Exportar detalle de ceremonia
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#475569', mb: 1 }}>
            Se exportará el resumen de esta ceremonia.
          </Typography>
          {exportando && <Typography role="status">Preparando archivo...</Typography>}
          {errorExportar && <Alert severity="error" sx={{ mt: 2 }}>{errorExportar}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setModalExportar(false)}
            disabled={exportando}
            sx={{ textTransform: 'none', color: '#64748B' }}
          >
            Cancelar
          </Button>
          <Button
            variant="outlined"
            disabled={exportando}
            onClick={() => void handleExportar('xlsx')}
            sx={{ textTransform: 'none', borderColor: '#1E3A5F', color: '#1E3A5F' }}
          >
            Excel
          </Button>
          <Button
            variant="contained"
            disabled={exportando}
            onClick={() => void handleExportar('pdf')}
            sx={{
              textTransform: 'none',
              backgroundColor: '#1E3A5F',
              '&:hover': { backgroundColor: '#0F2744' },
            }}
          >
            PDF
          </Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
}
