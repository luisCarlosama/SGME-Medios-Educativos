import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import pool from '../src/db.js';
import { actualizarSesion } from '../src/controllers/ceremoniasOperacionesController.js';

const catalogo = [
  { id_programa: 1, nombre: 'Ingeniería de Sistemas' },
  { id_programa: 2, nombre: 'Derecho' },
];

async function guardar({
  programas, asignaciones = [], incompatibles = false, estadoCeremonia = 'Programada',
  estado = 'Programada', estadoManual, estadoAnterior = 'Programada', manualAnterior = false,
}) {
  const connectOriginal = pool.connect;
  const queryOriginal = pool.query;
  const consultas = [];
  const client = {
    async query(sql, valores = []) {
      consultas.push({ sql, valores });
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
      if (sql.includes('FROM public.sesion') && sql.includes('id_sesion::text')) {
        return { rows: [{ id: '10', ceremoniaId: '1', estado: 'Programada' }] };
      }
      if (sql.includes('FROM public.ceremonia_grado')) {
        assert.match(sql, /FOR UPDATE/);
        return { rows: [{ id: '1', fecha: '2099-01-01', estado: estadoCeremonia }] };
      }
      if (sql.includes('SELECT estado, estado_manual')) {
        assert.match(sql, /FOR UPDATE/);
        return { rows: [{ estado: estadoAnterior, estadoManual: manualAnterior }], rowCount: 1 };
      }
      if (sql.includes('SELECT CASE')) {
        assert.match(sql, /WHEN \$4 <> 'En curso' THEN 'Programada'/);
        assert.equal(valores[3], estadoCeremonia);
        return { rows: [{ estado: estadoCeremonia === 'En curso' ? 'En curso' : 'Programada' }] };
      }
      if (sql.includes('FROM public.programa')) return { rows: catalogo };
      if (sql.includes('FROM public.sesion_programa sp')) {
        assert.match(sql, /s\.id_ceremonia = \$1 AND s\.id_sesion <> \$2/);
        assert.match(sql, /sp\.id_programa = ANY\(\$3::integer\[\]\)/);
        const [ceremoniaId, sesionId, ids] = valores;
        const conflicto = asignaciones.find((a) =>
          a.ceremoniaId === ceremoniaId && a.sesionId !== sesionId && ids.includes(a.programaId));
        const rows = conflicto ? [{
          programa: catalogo.find((p) => p.id_programa === conflicto.programaId).nombre,
          sesion: conflicto.sesion,
        }] : [];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes('FROM public.graduando')) {
        return { rows: incompatibles ? [{}] : [], rowCount: incompatibles ? 1 : 0 };
      }
      if (sql.includes('UPDATE public.graduando')) return { rows: [], rowCount: 0 };
      if (sql.includes('UPDATE public.sesion') || sql.includes('DELETE FROM public.sesion_programa')
        || sql.includes('INSERT INTO public.sesion_programa')) return { rows: [], rowCount: 1 };
      throw new Error(`Consulta inesperada: ${sql}`);
    },
    release() {},
  };
  const res = {
    statusCode: 200,
    status(codigo) { this.statusCode = codigo; return this; },
    json(body) { this.body = body; return this; },
  };
  pool.connect = async () => client;
  pool.query = async () => ({ rows: [{ id: '10' }] });
  try {
    await actualizarSesion({
      params: { id: '10' },
      body: { nombre: 'Mañana', estado, estadoManual, horaInicio: '08:00', horaFin: '10:00', programas },
    }, res);
    return { res, consultas };
  } finally {
    pool.connect = connectOriginal;
    pool.query = queryOriginal;
  }
}

test('rechaza un programa asignado a otra sesión de la misma ceremonia', async () => {
  const { res, consultas } = await guardar({
    programas: ['Derecho', 'Ingeniería de Sistemas'],
    asignaciones: [{ ceremoniaId: '1', sesionId: '11', programaId: 1, sesion: 'Tarde' }],
  });
  assert.equal(res.statusCode, 409);
  assert.match(res.body.mensaje, /Ingeniería de Sistemas.*Tarde/);
  assert.ok(consultas.some(({ sql }) => sql === 'ROLLBACK'));
  assert.ok(!consultas.some(({ sql }) => sql.includes('DELETE FROM public.sesion_programa')));
  const bloqueoCeremonia = consultas.findIndex(({ sql }) => sql.includes('FROM public.ceremonia_grado'));
  const bloqueoSesion = consultas.findIndex(({ sql }) => sql.includes('SELECT estado, estado_manual'));
  const comprobacion = consultas.findIndex(({ sql }) => sql.includes('FROM public.sesion_programa sp'));
  assert.ok(bloqueoCeremonia < bloqueoSesion && bloqueoSesion < comprobacion);
});

test('permite conservar el programa de la sesión y usarlo en otra ceremonia', async () => {
  const { res, consultas } = await guardar({
    programas: ['Ingeniería de Sistemas', 'Derecho'],
    asignaciones: [
      { ceremoniaId: '1', sesionId: '10', programaId: 1, sesion: 'Mañana' },
      { ceremoniaId: '2', sesionId: '20', programaId: 2, sesion: 'Otra ceremonia' },
    ],
  });
  assert.equal(res.statusCode, 200);
  assert.equal(consultas.filter(({ sql }) => sql.includes('INSERT INTO public.sesion_programa')).length, 2);
  assert.ok(consultas.some(({ sql }) => sql === 'COMMIT'));
});

test('permite guardar una sesión sin programas cuando no tiene graduandos', async () => {
  const { res, consultas } = await guardar({ programas: [] });
  assert.equal(res.statusCode, 200);
  assert.ok(!consultas.some(({ sql }) => sql.includes('FROM public.sesion_programa sp')));
});

test('mantiene la validación de graduandos incompatibles', async () => {
  const { res, consultas } = await guardar({ programas: ['Derecho'], incompatibles: true });
  assert.equal(res.statusCode, 409);
  assert.match(res.body.mensaje, /graduandos de programas/);
  assert.ok(consultas.some(({ sql }) => sql === 'ROLLBACK'));
});

test('mantiene programada una sesión configurada antes de iniciar la ceremonia', async () => {
  const { res, consultas } = await guardar({ programas: [], estadoCeremonia: 'Programada' });
  assert.equal(res.statusCode, 200);
  const actualizacion = consultas.find(({ sql }) => sql.includes('UPDATE public.sesion'));
  assert.equal(actualizacion.valores[2], 'Programada');
  assert.equal(actualizacion.valores[5], false);
});

test('respeta el cambio manual de estado como excepción', async () => {
  const { res, consultas } = await guardar({ programas: [], estadoCeremonia: 'Programada', estado: 'En curso' });
  assert.equal(res.statusCode, 200);
  assert.ok(!consultas.some(({ sql }) => sql.includes('SELECT CASE')));
  const actualizacion = consultas.find(({ sql }) => sql.includes('UPDATE public.sesion'));
  assert.equal(actualizacion.valores[2], 'En curso');
  assert.equal(actualizacion.valores[5], true);
});

test('al desactivar el modo manual vuelve a calcular el estado por horario', async () => {
  const { res, consultas } = await guardar({
    programas: [], estadoCeremonia: 'En curso', estado: 'Finalizada',
    estadoManual: false, estadoAnterior: 'Finalizada', manualAnterior: true,
  });
  assert.equal(res.statusCode, 200);
  assert.ok(consultas.some(({ sql }) => sql.includes('SELECT CASE')));
  const actualizacion = consultas.find(({ sql }) => sql.includes('UPDATE public.sesion'));
  assert.equal(actualizacion.valores[2], 'En curso');
  assert.equal(actualizacion.valores[5], false);
});

test('permite fijar manualmente Programada aunque haya llegado la hora', async () => {
  const { res, consultas } = await guardar({
    programas: [], estadoCeremonia: 'En curso', estado: 'Programada', estadoManual: true,
  });
  assert.equal(res.statusCode, 200);
  assert.ok(!consultas.some(({ sql }) => sql.includes('SELECT CASE')));
  const actualizacion = consultas.find(({ sql }) => sql.includes('UPDATE public.sesion'));
  assert.equal(actualizacion.valores[2], 'Programada');
  assert.equal(actualizacion.valores[5], true);
});

after(async () => { await pool.end(); });
