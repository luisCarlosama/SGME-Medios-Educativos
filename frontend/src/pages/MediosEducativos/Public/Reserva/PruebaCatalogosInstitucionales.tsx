
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import {
  obtenerCampusInstitucional,
  obtenerDependenciasInstitucionales,
  obtenerFacultadesInstitucionales,
  obtenerProgramasInstitucionales,
} from "./services/reservas.service";

type Resultado = {
  campus: any[];
  dependencias: any[];
  facultades: any[];
  programas: any[];
};

type SeleccionInstitucional = {
  campus: string;
  dependencia: string;
  facultad: string;
  programa: string;
};

export default function PruebaCatalogosInstitucionales() {
  const [datos, setDatos] = useState<Resultado>({
    campus: [],
    dependencias: [],
    facultades: [],
    programas: [],
  });

  const [seleccion, setSeleccion] =
    useState<SeleccionInstitucional>({
      campus: "",
      dependencia: "",
      facultad: "",
      programa: "",
    });

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function consultarDatos() {
      try {
        setCargando(true);

        const [campus, dependencias, facultades, programas] =
          await Promise.all([
            obtenerCampusInstitucional(),
            obtenerDependenciasInstitucionales(),
            obtenerFacultadesInstitucionales(),
            obtenerProgramasInstitucionales(),
          ]);

        if (!activo) return;

        setDatos({
          campus,
          dependencias,
          facultades,
          programas,
        });
      } catch (err) {
        if (activo) {
          setError(
            err instanceof Error
              ? err.message
              : "No fue posible consultar la información institucional."
          );
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    consultarDatos();

    return () => {
      activo = false;
    };
  }, []);

  if (cargando) {
    return (
      <Alert severity="info" icon={<CircularProgress size={18} />}>
        Consultando información de la base de datos institucional...
      </Alert>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  const facultadesActivas = datos.facultades.filter(
    (facultad) => facultad.activado === true
  );

  const programasFiltrados = datos.programas.filter(
    (programa) =>
      !seleccion.facultad ||
      programa.nombre_facultad === seleccion.facultad
  );

  return (
    <Box
      sx={{
        mt: 3,
        mb: 3,
        p: 3,
        border: "2px dashed #1976D2",
        borderRadius: 2,
        backgroundColor: "#F5F9FF",
      }}
    >
      <Typography variant="h6" fontWeight={700} color="primary">
        Prueba temporal: selección de información institucional
      </Typography>

      <Typography variant="body2" sx={{ mb: 3 }}>
        Selecciona los datos institucionales que posteriormente
        se integrarán en la solicitud de reserva.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "1fr 1fr",
          },
          gap: 2,
        }}
      >
        <TextField
          select
          fullWidth
          label="Campus institucional"
          value={seleccion.campus}
          onChange={(e) =>
            setSeleccion((prev) => ({
              ...prev,
              campus: e.target.value,
            }))
          }
        >
          {datos.campus.map((campus, index) => (
            <MenuItem
              key={`${campus.nombre}-${index}`}
              value={campus.nombre}
            >
              {campus.nombre}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          fullWidth
          label="Dependencia"
          value={seleccion.dependencia}
          onChange={(e) =>
            setSeleccion((prev) => ({
              ...prev,
              dependencia: e.target.value,
            }))
          }
        >
          {datos.dependencias.map((dependencia, index) => (
            <MenuItem
              key={`${dependencia.nombre}-${index}`}
              value={dependencia.nombre}
            >
              {dependencia.nombre}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          fullWidth
          label="Facultad"
          value={seleccion.facultad}
          onChange={(e) =>
            setSeleccion((prev) => ({
              ...prev,
              facultad: e.target.value,
              programa: "",
            }))
          }
        >
          {facultadesActivas.map((facultad, index) => (
            <MenuItem
              key={`${facultad.facultad}-${index}`}
              value={facultad.facultad}
            >
              {facultad.facultad}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          fullWidth
          label="Programa"
          value={seleccion.programa}
          disabled={!seleccion.facultad}
          onChange={(e) =>
            setSeleccion((prev) => ({
              ...prev,
              programa: e.target.value,
            }))
          }
        >
          {programasFiltrados.map((programa, index) => (
            <MenuItem
              key={`${programa.nombre_facultad}-${programa.nombre_programa}-${index}`}
              value={programa.nombre_programa}
            >
              {programa.nombre_programa}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Typography fontWeight={700} sx={{ mb: 1 }}>
          Valores seleccionados que se enviarían en la solicitud
        </Typography>

        <Box
          component="pre"
          sx={{
            p: 2,
            backgroundColor: "#FFFFFF",
            border: "1px solid #DCE4EE",
            borderRadius: 1,
            fontSize: "0.8rem",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {JSON.stringify(seleccion, null, 2)}
        </Box>
      </Box>

      <Alert severity="success" sx={{ mt: 2 }}>
        Los catálogos institucionales se consultaron correctamente.
        Las selecciones se están manejando como valores de texto,
        sin modificar los identificadores de SGME.
      </Alert>
    </Box>
  );
}
