import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import pool from '../src/db.js';
import { actualizarEstadoCeremonia, obtenerRequisitosInicioCeremonia } from '../src/controllers/ceremoniasOperacionesController.js';
import { consultarRequisitosInicioCeremonia } from '../src/services/requisitosInicioCeremonia.js';

const completa = {
  numeroSesion: 1,
  nombre: 'Mañana',
  estado: 'Programada',
  horarioValido: true,
  tienePrograma: true,
  graduandosCount: 2,
  graduandosSinInvitados: 0,
};

async function consultar(sesiones) {
  return consultarRequisitosInicioCeremonia({
    async query(sql, valores) {
      assert.match(sql, /FROM public\.sesion s/);
      assert.match(sql, /NOT EXISTS\s*\(\s*SELECT 1 FROM public\.invitado/);
      assert.deepEqual(valores, ['1']);
      return { rows: sesiones };
    },
  }, '1');
}

test('exige al menos una sesión', async () => {
  const resultado = await consultar([]);
  assert.equal(resultado.puedeIniciar, false);
  assert.match(resultado.pendientes[0], /al menos una sesión/);
});

for (const [campo, valor, mensaje] of [
  ['estado', 'Pendiente', /configuración/],
  ['horarioValido', false, /horario válido/],
  ['tienePrograma', false, /programa/],
  ['graduandosCount', 0, /graduando/],
  ['graduandosSinInvitados', 1, /1 sin invitados/],
]) {
  test(`rechaza una sesión sin requisito: ${campo}`, async () => {
    const resultado = await consultar([{ ...completa, [campo]: valor }]);
    assert.equal(resultado.puedeIniciar, false);
    assert.match(resultado.pendientes[0], mensaje);
  });
}

test('exige los requisitos en todas las sesiones', async () => {
  const resultado = await consultar([
    completa,
    { ...completa, numeroSesion: 2, nombre: 'Tarde', graduandosSinInvitados: 1 },
  ]);
  assert.equal(resultado.puedeIniciar, false);
  assert.match(resultado.pendientes[0], /Sesión 2 \(Tarde\)/);
});

test('permite iniciar cuando todas las sesiones cumplen los requisitos', async () => {
  const resultado = await consultar([completa, { ...completa, numeroSesion: 2 }]);
  assert.deepEqual(resultado, { puedeIniciar: true, pendientes: [] });
});

async function cambiarEstado(estado, sesiones, estadoActual = 'Programada', sesionesActualizadas = []) {
  const connectOriginal = pool.connect;
  const consultas = [];
  const client = {
    async query(sql) {
      consultas.push(sql);
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
      if (sql.includes('UPDATE public.sesion')) {
        if (sql.includes('FROM public.ceremonia_grado')) {
          assert.match(sql, /c\.estado = 'En curso'/);
          assert.match(sql, /c\.fecha \+ s\.hora_inicio <= LOCALTIMESTAMP/);
          assert.match(sql, /c\.fecha \+ s\.hora_fin <= LOCALTIMESTAMP/);
          return { rows: sesionesActualizadas, rowCount: sesionesActualizadas.length };
        }
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('FROM public.ceremonia_grado')) return { rows: [{ id: '1', estado: estadoActual }] };
      if (sql.includes('FROM public.sesion s')) return { rows: sesiones };
      if (sql.includes('UPDATE public.ceremonia_grado')) return { rowCount: 1 };
      if (sql.includes('UPDATE public.proceso_grado_ceremonia')) return { rowCount: 0 };
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
  try {
    await actualizarEstadoCeremonia({ params: { id: '1' }, body: { estado } }, res);
    return { res, consultas };
  } finally {
    pool.connect = connectOriginal;
  }
}

test('el servidor rechaza el inicio incompleto sin cambiar el estado', async () => {
  const { res, consultas } = await cambiarEstado('En curso', [{ ...completa, graduandosSinInvitados: 1 }]);
  assert.equal(res.statusCode, 409);
  assert.match(res.body.mensaje, /sin invitados/);
  assert.ok(consultas.includes('ROLLBACK'));
  assert.ok(!consultas.some((sql) => sql.includes('UPDATE public.ceremonia_grado')));
});

test('el servidor permite iniciar si los requisitos están completos', async () => {
  const { res, consultas } = await cambiarEstado('En curso', [completa], 'Programada', [
    { id: '10', estado: 'En curso' },
    { id: '11', estado: 'Finalizada' },
  ]);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.estado, 'En curso');
  assert.deepEqual(res.body.sesionesIniciadas, ['10']);
  assert.deepEqual(res.body.sesionesFinalizadasPorHorario, ['11']);
  assert.ok(consultas.includes('COMMIT'));
});

test('la validación no impide finalizar una ceremonia en curso', async () => {
  const { res, consultas } = await cambiarEstado('Finalizada', [], 'En curso');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.estado, 'Finalizada');
  assert.ok(!consultas.some((sql) => sql.includes('FROM public.sesion s')));
});

test('el endpoint informa cuando la ceremonia no existe', async () => {
  const queryOriginal = pool.query;
  const res = {
    statusCode: 200,
    status(codigo) { this.statusCode = codigo; return this; },
    json(body) { this.body = body; return this; },
  };
  pool.query = async () => ({ rows: [] });
  try {
    await obtenerRequisitosInicioCeremonia({ params: { id: '1' } }, res);
    assert.equal(res.statusCode, 404);
  } finally {
    pool.query = queryOriginal;
  }
});

after(async () => { await pool.end(); });
