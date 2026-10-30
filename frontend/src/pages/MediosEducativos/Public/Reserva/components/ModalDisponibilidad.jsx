
import { useEffect, useState } from "react";
import { obtenerAgendaDia } from "../services/reservas.service";

const HORARIO_INICIO = 7;
const HORARIO_FIN_SEMANA = 18;
const HORARIO_FIN_SEMANA_LABORAL = 22;

function generarHorarios(fecha) {
  const diaSemana = new Date(`${fecha}T12:00:00`).getDay();

  if (diaSemana === 0) return [];

  const horaFin =
    diaSemana === 6
      ? HORARIO_FIN_SEMANA
      : HORARIO_FIN_SEMANA_LABORAL;

  return Array.from(
    { length: horaFin - HORARIO_INICIO },
    (_, i) => {
      const inicio = HORARIO_INICIO + i;
      const fin = inicio + 1;

      return {
        inicio: `${String(inicio).padStart(2, "0")}:00:00`,
        fin: `${String(fin).padStart(2, "0")}:00:00`,
        etiqueta: `${String(inicio).padStart(2, "0")}:00 - ${String(fin).padStart(2, "0")}:00`,
      };
    }
  );
}

function horaEnMinutos(hora) {
  const [h, m] = String(hora).split(":").map(Number);
  return h * 60 + m;
}

export default function ModalDisponibilidad({
  open,
  onClose,
  fecha,
  idEspacio,
}) {
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !fecha || !idEspacio) return;

    let cancelado = false;

    async function cargarAgenda() {
      setCargando(true);
      setError("");
      setReservas([]);

      try {
        const datos = await obtenerAgendaDia(
          Number(idEspacio),
          fecha
        );

        if (!cancelado) {
          setReservas(datos.reservas ?? []);
        }
      } catch (err) {
        if (!cancelado) {
          setError(
            err.message || "No fue posible consultar la agenda."
          );
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargarAgenda();

    return () => {
      cancelado = true;
    };
  }, [open, fecha, idEspacio]);

  if (!open) return null;

  const horarios = fecha ? generarHorarios(fecha) : [];
  const domingo =
    fecha && new Date(`${fecha}T12:00:00`).getDay() === 0;

  const fechaLegible = fecha
    ? new Date(`${fecha}T12:00:00`).toLocaleDateString("es-CO", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  function estaReservado(horario) {
    const inicioSlot = horaEnMinutos(horario.inicio);
    const finSlot = horaEnMinutos(horario.fin);

    return reservas.some((reserva) => {
      const inicioReserva = horaEnMinutos(reserva.hora_inicio);
      const finReserva = horaEnMinutos(reserva.hora_fin);

      return inicioReserva < finSlot && finReserva > inicioSlot;
    });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenda-titulo"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 520,
          maxHeight: "85vh",
          overflowY: "auto",
          padding: 24,
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div>
            <h2
              id="agenda-titulo"
              style={{ margin: 0, fontSize: 22, color: "#172554" }}
            >
              Agenda del día
            </h2>
            <p style={{ margin: "8px 0 0", color: "#64748b" }}>
              {fechaLegible}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar agenda"
            style={{
              border: 0,
              background: "transparent",
              fontSize: 25,
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            ×
          </button>
        </header>

        <p style={{ color: "#475569", fontSize: 14, margin: "18px 0" }}>
          Consulta de ocupación por hora para el espacio seleccionado.
        </p>

        {cargando && <p>Consultando agenda...</p>}

        {!cargando && error && (
          <p style={{ color: "#b91c1c" }}>{error}</p>
        )}

        {!cargando && !error && domingo && (
          <p
            style={{
              background: "#f1f5f9",
              color: "#475569",
              borderRadius: 8,
              padding: 16,
            }}
          >
            No hay atención los domingos.
          </p>
        )}

        {!cargando && !error && !domingo && (
          <div style={{ display: "grid", gap: 8 }}>
            {horarios.map((horario) => {
              const reservado = estaReservado(horario);

              return (
                <div
                  key={horario.inicio}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 8,
                    background: reservado ? "#fee2e2" : "#dcfce7",
                    color: reservado ? "#991b1b" : "#166534",
                  }}
                >
                  <span>{horario.etiqueta}</span>
                  <strong>{reservado ? "Reservado" : "Disponible"}</strong>
                </div>
              );
            })}
          </div>
        )}

        <footer
          style={{
            borderTop: "1px solid #e2e8f0",
            marginTop: 20,
            paddingTop: 14,
            color: "#64748b",
            fontSize: 12,
          }}
        >
          La ocupación se consulta con las reservas aprobadas registradas en el sistema.
        </footer>
      </section>
    </div>
  );
}
