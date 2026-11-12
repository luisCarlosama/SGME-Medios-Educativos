import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import AdminLayout from '../../../../components/layout/AdminLayout';
import type { DashboardData } from './interfaces/dashboard.interface';
import { getDashboard } from './services/dashboard.service';
import { listarSolicitudes } from "../Solicitudes/services/solicitudes.service";
import ModalExportar from "./components/ModalExportar";

const estadoStyles: Record<string, { bg: string; color: string }> = {
  Pendiente: { bg: '#FEF3C7', color: '#B45309' },
  Aprobada: { bg: '#D1FAE5', color: '#047857' },
  'En proceso': { bg: '#DBEAFE', color: '#1D4ED8' },
  Rechazada: { bg: '#FEE2E2', color: '#B91C1C' },
  Cancelada: { bg: '#F3F4F6', color: '#4B5563' },
};

const kpiCards = [
  {
    key: 'solicitudesPendientes' as const,
    label: 'Solicitudes pendientes',
    subtitle: 'Externas e internas',
    color: '#EF4444',
  },
  {
    key: 'solicitudesExternas' as const,
    label: 'Solicitudes externas',
    subtitle: 'Recibidas',
    color: '#3B82F6',
  },
  {
    key: 'solicitudesInternas' as const,
    label: 'Solicitudes internas',
    subtitle: 'Recibidas',
    color: '#10B981',
  },
  {
    key: 'reservasHoy' as const,
    label: 'Reservas confirmadas hoy',
    subtitle: 'En agenda',
    color: '#EF4444',
  },
];

function formatearFecha(fecha: string): string {
  const soloFecha = fecha.split('T')[0];
  const partes = soloFecha.split('-');
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalExportar, setModalExportar] = useState(false);

  const handleExportar = async (
  tipo: "externas" | "internas" | "todas",
  formato: "xlsx" | "pdf"
) => {
  try {
    // 1. Partimos de las recientes del Dashboard
    let lista = data?.solicitudesRecientes ?? [];

    // 2. Excluir Rechazada y Cancelada
    lista = lista.filter(
      (s) => s.estado !== "Rechazada" && s.estado !== "Cancelada"
    );

    // 3. Filtrar por tipo
    if (tipo === "externas") {
      lista = lista.filter(
        (s) =>
          s.tipoSolicitud?.toLowerCase() === "externa" ||
          s.tipo === "externo"
      );
    }
    if (tipo === "internas") {
      lista = lista.filter(
        (s) =>
          s.tipoSolicitud?.toLowerCase() === "institucional" ||
          s.tipoSolicitud?.toLowerCase() === "interna" ||
          s.tipo === "interno"
      );
    }

    // 4. Máximo 15 recientes
    lista = lista.slice(0, 15);

    const kpis = {
      pendientes: data?.stats?.solicitudesPendientes ?? 0,
      externas: data?.stats?.solicitudesExternas ?? 0,
      internas: data?.stats?.solicitudesInternas ?? 0,
      hoy: data?.stats?.reservasHoy ?? 0,
    };

    const fechaGeneracion = new Date().toLocaleString("es-CO", {
      dateStyle: "long",
      timeStyle: "short",
    });

    const tipoTexto =
      tipo === "externas"
        ? "Externas"
        : tipo === "internas"
          ? "Internas"
          : "Todas";

    // ========== EXCEL ==========
    if (formato === "xlsx") {
      const workbook = XLSX.utils.book_new();

      const portada = [
        ["SGME - MEDIOS EDUCATIVOS"],
        ["Universidad CESMAG"],
        [""],
        ["REPORTE DE SOLICITUDES RECIENTES"],
        [""],
        ["Tipo de reporte:", tipoTexto],
        ["Fecha de generación:", fechaGeneracion],
        [""],
        ["RESUMEN ESTADÍSTICO"],
        ["Solicitudes pendientes", kpis.pendientes],
        ["Solicitudes externas", kpis.externas],
        ["Solicitudes internas", kpis.internas],
        ["Reservas confirmadas hoy", kpis.hoy],
      ];

      const hojaPortada = XLSX.utils.aoa_to_sheet(portada);
      hojaPortada["!cols"] = [{ wch: 35 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(workbook, hojaPortada, "Resumen");

      if (lista.length > 0) {
        const filas = lista.map((s: any, index: number) => ({
          "N°": index + 1,
          Código: s.codigo,
          Solicitante: s.solicitante,
          Tipo:
            s.tipoSolicitud ??
            (s.tipo === "interno" ? "Institucional" : "Externa"),
          Espacio: s.espacio,
          Campus: s.campus ?? "",
          "Fecha de la reserva": s.fecha
            ? String(s.fecha).split("T")[0].split("-").reverse().join("/")
            : "",
          "Hora inicio": s.hora_inicio
            ? String(s.hora_inicio).slice(0, 5)
            : "",
          "Hora fin": s.hora_fin ? String(s.hora_fin).slice(0, 5) : "",
          Horario:
            s.hora_inicio && s.hora_fin
              ? `${String(s.hora_inicio).slice(0, 5)} - ${String(s.hora_fin).slice(0, 5)}`
              : "",
          Estado: s.estado,
        }));

        const hojaDetalle = XLSX.utils.json_to_sheet(filas);
        hojaDetalle["!cols"] = [
          { wch: 5 },
          { wch: 22 },
          { wch: 25 },
          { wch: 14 },
          { wch: 25 },
          { wch: 16 },
          { wch: 16 },
          { wch: 12 },
          { wch: 12 },
          { wch: 16 },
          { wch: 12 },
        ];
        XLSX.utils.book_append_sheet(workbook, hojaDetalle, "Solicitudes");
      }

      XLSX.writeFile(
        workbook,
        `SGME_Recientes_${tipoTexto}_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    }

    // ========== PDF ==========
    if (formato === "pdf") {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(30, 58, 95);
      doc.rect(0, 0, pageWidth, 28, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("SGME - MEDIOS EDUCATIVOS", 14, 12);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Universidad CESMAG", 14, 19);

      doc.setFontSize(9);
      doc.text("Reporte de Solicitudes Recientes", pageWidth - 14, 12, {
        align: "right",
      });
      doc.text(fechaGeneracion, pageWidth - 14, 19, { align: "right" });

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`Tipo de solicitudes: ${tipoTexto}`, 14, 40);

      doc.setFontSize(11);
      doc.text("Resumen estadístico", 14, 52);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`• Solicitudes pendientes: ${kpis.pendientes}`, 18, 60);
      doc.text(`• Solicitudes externas: ${kpis.externas}`, 18, 66);
      doc.text(`• Solicitudes internas: ${kpis.internas}`, 18, 72);
      doc.text(`• Reservas confirmadas hoy: ${kpis.hoy}`, 18, 78);

      if (lista.length > 0) {
        const filas = lista.map((s: any) => [
          s.codigo,
          s.solicitante,
          s.tipoSolicitud ??
            (s.tipo === "interno" ? "Institucional" : "Externa"),
          s.espacio,
          s.fecha
            ? String(s.fecha).split("T")[0].split("-").reverse().join("/")
            : "",
          s.hora_inicio && s.hora_fin
            ? `${String(s.hora_inicio).slice(0, 5)} - ${String(s.hora_fin).slice(0, 5)}`
            : "",
          s.estado,
        ]);

        autoTable(doc, {
          startY: 88,
          head: [
            [
              "Código",
              "Solicitante",
              "Tipo",
              "Espacio",
              "Fecha reserva",
              "Horario",
              "Estado",
            ],
          ],
          body: filas,
          styles: { fontSize: 7.5, cellPadding: 2.5 },
          headStyles: {
            fillColor: [30, 58, 95],
            textColor: 255,
            fontStyle: "bold",
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: 10, right: 10 },
        });
      } else {
        doc.setFontSize(10);
        doc.text(
          "No se encontraron solicitudes recientes con los filtros seleccionados.",
          14,
          90
        );
      }

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `SGME - Medios Educativos | Página ${i} de ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }

      doc.save(
        `SGME_Recientes_${tipoTexto}_${new Date().toISOString().slice(0, 10)}.pdf`
      );
    }
  } catch (error) {
    console.error(error);
    alert("Error al exportar las solicitudes recientes.");
  }
};

  useEffect(() => {
    getDashboard()
      .then((resultado) => {
        setData(resultado);
        console.log("Solicitudes recientes:", resultado.solicitudesRecientes);
        setError('');
      })
      .catch((err: unknown) => {
        console.error('Error al cargar el Dashboard:', err);
        setError(
          'No fue posible cargar los datos. Verifica que el backend esté funcionando.'
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats;

  return (
    <AdminLayout>
      <Box sx={{ width: '100%', minWidth: 0 }}>
        {/* ========== HEADER ========== */}

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 3,
            mb: 3.5,
            flexWrap: 'wrap',
          }}
        >
          {/* Izquierda */}
          <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
            <Typography
              sx={{
                fontWeight: 700,
                color: '#0F172A',
                fontSize: '1.75rem',
                mb: 0.5,
                lineHeight: 1.2,
              }}
            >
              Dashboard
            </Typography>
            <Typography sx={{ color: '#64748B', fontSize: '0.9rem' }}>
              Resumen de solicitudes internas y externas
            </Typography>
          </Box>

          {/* Derecha - Exportar */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              flexShrink: 0,
            }}
          >
            <Button
              variant="contained"
              onClick={() => setModalExportar(true)}
              sx={{
                backgroundColor: '#EF4444',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                px: 2.5,
                py: 1,
                boxShadow: 'none',
                mb: 0.75,
                whiteSpace: 'nowrap',
                '&:hover': {
                  backgroundColor: '#DC2626',
                  boxShadow: 'none',
                },
              }}
            >
              Exportar
            </Button>
            <Typography
              sx={{
                color: '#94A3B8',
                fontSize: '0.75rem',
                maxWidth: 200,
                lineHeight: 1.4,
                textAlign: 'right',
              }}
            >
              Exporta las estadísticas y los registros filtrados en .xlsx o PDF.
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* ========== KPI CARDS ========== */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(4, minmax(0, 1fr))',
            },
            gap: 2,
            mb: 4,
          }}
        >
          {kpiCards.map((kpi) => (
            <Card
              key={kpi.key}
              elevation={0}
              sx={{
                minWidth: 0,
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                borderLeft: `4px solid ${kpi.color}`,
                backgroundColor: '#FFFFFF',
              }}
            >
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography
                  sx={{
                    color: '#64748B',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    mb: 1,
                  }}
                >
                  {kpi.label}
                </Typography>

                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: '2rem',
                    color: '#0F172A',
                    lineHeight: 1.1,
                    mb: 0.75,
                  }}
                >
                  {loading ? '—' : stats?.[kpi.key] ?? 0}
                </Typography>

                <Typography
                  sx={{
                    color: kpi.color,
                    fontSize: '0.8rem',
                    fontWeight: 500,
                  }}
                >
                  {kpi.subtitle}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* ========== SOLICITUDES RECIENTES ========== */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography
            sx={{ fontWeight: 700, fontSize: '1.15rem', color: '#0F172A' }}
          >
            Solicitudes recientes
          </Typography>

          <Button
            variant="text"
            onClick={() => navigate('/admin/solicitudes')}
            sx={{
              color: '#2563EB',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            Ver todas →
          </Button>
        </Box>

        <TableContainer
          sx={{
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',          // sin scroll horizontal
            mb: 2.5,
          }}
        >
          <Table
            sx={{
              width: '100%',
              tableLayout: 'fixed',       // anchos fijos
            }}
          >
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                {[
                  { label: 'Código', width: '18%' },
                  { label: 'Solicitante', width: '20%' },
                  { label: 'Tipo', width: '10%' },
                  { label: 'Espacio', width: '22%' },
                  { label: 'Fecha', width: '12%' },
                  { label: 'Estado', width: '12%' },
                  { label: 'Acción', width: '6%' },
                ].map((col) => (
                  <TableCell
                    key={col.label}
                    sx={{
                      fontWeight: 600,
                      color: '#334155',
                      fontSize: '0.78rem',
                      borderBottom: '1px solid #E2E8F0',
                      py: 1.25,
                      px: 1.5,
                      width: col.width,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                    <Typography sx={{ mt: 1, color: '#64748B', fontSize: '0.85rem' }}>
                      Cargando solicitudes...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : data?.solicitudesRecientes?.length ? (
                data.solicitudesRecientes.map((solicitud) => (
                  <TableRow
                    key={solicitud.id}
                    sx={{
                      '&:hover': { backgroundColor: '#F8FAFC' },
                      '& td': { borderBottom: '1px solid #F1F5F9' },
                    }}
                  >
                    {/* Código */}
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        color: '#0F172A',
                        fontSize: '0.8rem',
                        py: 1.25,
                        px: 1.5,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={solicitud.codigo}
                    >
                      {solicitud.codigo}
                    </TableCell>

                    {/* Solicitante */}
                    <TableCell
                      sx={{
                        fontSize: '0.8rem',
                        py: 1.25,
                        px: 1.5,
                        maxHeight: 48,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                      }}
                      title={solicitud.solicitante}
                    >
                      <Box
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {solicitud.solicitante}
                      </Box>
                    </TableCell>

                    {/* Tipo */}
                    <TableCell
                      sx={{
                        fontSize: '0.8rem',
                        py: 1.25,
                        px: 1.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {solicitud.tipoSolicitud}
                    </TableCell>

                    {/* Espacio */}
                    <TableCell
                      sx={{
                        fontSize: '0.8rem',
                        py: 1.25,
                        px: 1.5,
                        maxHeight: 48,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                      }}
                      title={solicitud.espacio}
                    >
                      <Box
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {solicitud.espacio}
                      </Box>
                    </TableCell>

                    {/* Fecha */}
                    <TableCell
                      sx={{
                        fontSize: '0.8rem',
                        py: 1.25,
                        px: 1.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatearFecha(solicitud.fecha)}
                    </TableCell>

                    {/* Estado */}
                    <TableCell sx={{ py: 1.25, px: 1.5 }}>
                      <Chip
                        label={solicitud.estado}
                        size="small"
                        sx={{
                          backgroundColor:
                            estadoStyles[solicitud.estado]?.bg ?? '#F3F4F6',
                          color: estadoStyles[solicitud.estado]?.color ?? '#4B5563',
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          borderRadius: '999px',
                          height: 22,
                        }}
                      />
                    </TableCell>

                    {/* Acción */}
                    <TableCell sx={{ py: 1.25, px: 1.5 }}>
                      <Button
                        size="small"
                        onClick={() => navigate(`/admin/solicitudes/${solicitud.id}`)}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 600,
                          color: '#2563EB',
                          fontSize: '0.8rem',
                          minWidth: 'auto',
                          px: 0.5,
                        }}
                      >
                        Ver →
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    sx={{ textAlign: 'center', py: 4, color: '#64748B' }}
                  >
                    No hay solicitudes registradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ========== BARRA INFERIOR (como Figma) ========== */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            px: 2.5,
            py: 1.75,
          }}
        >
          <Typography sx={{ color: '#64748B', fontSize: '0.85rem' }}>
            {loading
              ? 'Cargando resumen...'
              : `${stats?.solicitudesPendientes ?? 0} pendientes · ${stats?.solicitudesExternas ?? 0
              } externas · ${stats?.solicitudesInternas ?? 0} internas · ${stats?.reservasHoy ?? 0
              } reservas confirmadas hoy`}
          </Typography>

          <Button
            variant="contained"
            onClick={() => navigate('/admin/agenda')}
            sx={{
              backgroundColor: '#1E3A5F',
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              px: 2.5,
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: '#0F2744',
                boxShadow: 'none',
              },
            }}
          >
            Ver Agenda →
          </Button>
        </Box>
      </Box>
      <ModalExportar
        open={modalExportar}
        onClose={() => setModalExportar(false)}
        onExportar={handleExportar}
      />
    </AdminLayout>
  );
}