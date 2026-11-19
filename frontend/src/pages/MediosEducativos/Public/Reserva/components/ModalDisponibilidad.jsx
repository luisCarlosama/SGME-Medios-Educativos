
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
        inicio: `${String(inicio).padStart(2, "0")}:00`,
        fin: `${String(fin).padStart(2, "0")}:00`,
        etiqueta: `${String(inicio).padStart(2, "0")}:00 - ${String(fin).padStart(2, "0")}:00`,
      };
    }
  );
}

// Convierte cualquier formato de hora PostgreSQL a minutos.
function horaEnMinutos(hora) {
  if (!hora) return null;

  const valor = String(hora).trim();
  const coincidencia = valor.match(/^(\d{1,2}):(\d{2})/);

  if (!coincidencia) return null;

  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);

  return horas * 60 + minutos;
}

function fechaNormalizada(fecha) {
  if (!fecha) return "";

  return String(fecha).slice(0, 10);
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
    if (!open || !fecha || !idEspacio) {
      setReservas([]);
      return;
    }

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
          setReservas(
            Array.isArray(datos.reservas)
              ? datos.reservas
              : []
          );
        }
      } catch (err) {
        if (!cancelado) {
          setError(
            err.message ||
            "No fue posible consultar la agenda."
          );
        }
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
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
    fecha &&
    new Date(`${fecha}T12:00:00`).getDay() === 0;

  const fechaLegible = fecha
    ? new Date(`${fecha}T12:00:00`).toLocaleDateString(
      "es-CO",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    )
    : "";

  function estaReservado(horario) {
    const inicioSlot = horaEnMinutos(horario.inicio);
    const finSlot = horaEnMinutos(horario.fin);

    return reservas.some((reserva) => {
      const fechaInicio = fechaNormalizada(
        reserva.fecha_inicio
      );

      const fechaFin = fechaNormalizada(
        reserva.fecha_fin
      );

      // Verificar que la reserva corresponda al día consultado.
      if (
        fechaInicio > fecha ||
        fechaFin < fecha
      ) {
        return false;
      }

      const inicioReserva = horaEnMinutos(
        reserva.hora_inicio
      );

      const finReserva = horaEnMinutos(
        reserva.hora_fin
      );

      if (
        inicioReserva === null ||
        finReserva === null
      ) {
        return false;
      }

      // Detectar cualquier cruce entre la reserva y la franja.
      return (
        inicioReserva < finSlot &&
        finReserva > inicioSlot
      );
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.55)",
        zIndex: 1400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          width: "100%",
          maxWidth: "650px",
          maxHeight: "85vh",
          overflowY: "auto",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "8px",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#123B6D",
              fontSize: "21px",
            }}
          >
            Disponibilidad del espacio
          </h2>

          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: "26px",
              cursor: "pointer",
              color: "#64748B",
            }}
          >
            ×
          </button>
        </div>

        <p
          style={{
            color: "#64748B",
            textTransform: "capitalize",
            marginBottom: "20px",
          }}
        >
          {fechaLegible}
        </p>

        <div
          style={{
            display: "flex",
            gap: "18px",
            flexWrap: "wrap",
            marginBottom: "20px",
          }}
        >
          <span style={{ color: "#065F46" }}>
            🟢 Disponible
          </span>

          <span style={{ color: "#991B1B" }}>
            🔴 Ocupado
          </span>
        </div>

        {cargando && (
          <p style={{ textAlign: "center", padding: "25px" }}>
            Consultando disponibilidad...
          </p>
        )}

        {error && (
          <div
            style={{
              background: "#FEE2E2",
              color: "#991B1B",
              padding: "14px",
              borderRadius: "8px",
            }}
          >
            {error}
          </div>
        )}

        {!cargando && !error && domingo && (
          <p
            style={{
              background: "#F1F5F9",
              color: "#64748B",
              padding: "18px",
              borderRadius: "10px",
              textAlign: "center",
            }}
          >
            El espacio no tiene servicio los domingos.
          </p>
        )}

        {!cargando && !error && !domingo && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(145px, 1fr))",
              gap: "10px",
            }}
          >
            {horarios.map((horario) => {
              const ocupado = estaReservado(horario);

              return (
                <div
                  key={horario.inicio}

                  style={{
                    padding: "15px 10px",
                    borderRadius: "10px",
                    textAlign: "center",
                    background: ocupado
                      ? "#FCA5A5"
                      : "#D1FAE5",
                    color: ocupado
                      ? "#7F1D1D"
                      : "#065F46",
                    border: `1px solid ${ocupado ? "#DC2626" : "#A7F3D0"
                      }`,
                    fontWeight: ocupado ? 700 : 500,
                    boxShadow: ocupado
                      ? "0 2px 5px rgba(220, 38, 38, 0.15)"
                      : "none",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      fontSize: "14px",
                      marginBottom: "5px",
                    }}
                  >
                    {horario.etiqueta}
                  </strong>

                  <span style={{ fontSize: "13px" }}>
                    {ocupado ? "Ocupado" : "Disponible"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
