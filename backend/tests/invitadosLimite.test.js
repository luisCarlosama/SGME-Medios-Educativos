import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import pool from '../src/db.js';
import {
  agregarInvitado, agregarInvitadosLote, actualizarInvitado, registrarIngresoInvitado,
} from '../src/controllers/ceremoniasOperacionesController.js';

async function registrarInvitados({ limite, registrados, totalCeremonia, cantidad, autorizacion }) {
  const connectOriginal = pool.connect;
  const queryOriginal = pool.query;
  let invitadosCreados = 0;
  const client = {
    async query(sql, valores = []) {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
      if (sql.includes('FROM public.graduando') && sql.includes('FOR UPDATE')) {
        return { rows: [{ id: '13', ceremoniaId: '1' }] };
      }
      if (sql.includes('FROM public.ceremonia_grado')) {
        return { rows: [{ id: '1', maxInvitadosPorGraduando: limite, cupoInvitados: 2 }] };
      }
      if (sql.includes('AS "invitadosGraduando"')) {
        return { rows: [{ invitadosGraduando: registrados, invitadosCeremonia: totalCeremonia }] };
      }
      if (sql.includes('INSERT INTO public.invitado')) {
        assert.match(sql, /NULLIF\(\$5, ''\), TRUE\)/);
        assert.equal(valores.length, 5);
        invitadosCreados += 1;
        return { rows: [{ id: String(invitadosCreados) }] };
      }
      throw new Error(`Consulta inesperada: ${sql}`);
    },
    release() {},
  };
  const response = {
    statusCode: 200,
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
  };

  pool.connect = async () => client;
  pool.query = async (_sql, valores) => ({ rows: [{ id: valores[0], graduandoId: '13' }] });
  try {
    const invitados = Array.from({ length: cantidad }, (_, index) => ({
      nombre: `Invitado ${index + 1}`,
      documento: '',
      ...(autorizacion === undefined ? {} : { autorizacion }),
    }));
    const request = {
      params: { id: '13' },
      body: cantidad === 1 ? invitados[0] : { invitados },
    };
    await (cantidad === 1 ? agregarInvitado : agregarInvitadosLote)(request, response);
    return { status: response.statusCode, body: response.body, invitadosCreados };
  } finally {
    pool.connect = connectOriginal;
    pool.query = queryOriginal;
  }
}

test('el total de la ceremonia no impide registrar invitados', async () => {
  const resultado = await registrarInvitados({ limite: 2, registrados: 0, totalCeremonia: 50, cantidad: 1 });
  assert.equal(resultado.status, 201);
  assert.equal(resultado.invitadosCreados, 1);
});

for (const limite of [2, 3, 4]) {
  test(`respeta el máximo de ${limite} invitados por graduando`, async () => {
    const permitido = await registrarInvitados({ limite, registrados: limite - 1, totalCeremonia: 50, cantidad: 1 });
    assert.equal(permitido.status, 201);
    const rechazado = await registrarInvitados({ limite, registrados: limite, totalCeremonia: 50, cantidad: 1 });
    assert.equal(rechazado.status, 409);
    assert.match(rechazado.body.mensaje, new RegExp(`límite de ${limite} invitados`));
    assert.equal(rechazado.invitadosCreados, 0);
  });
}

test('el registro por lote respeta el límite individual y no el total de la ceremonia', async () => {
  const permitido = await registrarInvitados({ limite: 4, registrados: 0, totalCeremonia: 50, cantidad: 4 });
  assert.equal(permitido.status, 201);
  assert.equal(permitido.invitadosCreados, 4);
  const rechazado = await registrarInvitados({ limite: 2, registrados: 1, totalCeremonia: 50, cantidad: 2 });
  assert.equal(rechazado.status, 409);
  assert.equal(rechazado.invitadosCreados, 0);
});

test('no permite seleccionar pendiente ni individualmente ni en lote', async () => {
  for (const cantidad of [1, 2]) {
    const resultado = await registrarInvitados({
      limite: 4, registrados: 0, cantidad, autorizacion: 'Pendiente',
    });
    assert.equal(resultado.status, 400);
    assert.match(resultado.body.mensaje, /automáticamente/);
    assert.equal(resultado.invitadosCreados, 0);
  }
});

test('acepta solicitudes antiguas que envían Autorizado y crea el lote autorizado', async () => {
  const resultado = await registrarInvitados({
    limite: 4, registrados: 0, cantidad: 2, autorizacion: 'Autorizado',
  });
  assert.equal(resultado.status, 201);
  assert.equal(resultado.invitadosCreados, 2);
});

test('editar un invitado conserva su autorización y no admite modificarla', async () => {
  const queryOriginal = pool.query;
  const consultas = [];
  pool.query = async (sql) => {
    consultas.push(sql);
    if (sql.includes('UPDATE public.invitado')) {
      assert.doesNotMatch(sql, /autorizado/);
      return { rowCount: 1 };
    }
    if (sql.includes('FROM public.invitado i')) {
      return { rows: [{ id: '1', autorizacion: 'Pendiente' }] };
    }
    throw new Error(`Consulta inesperada: ${sql}`);
  };
  const response = () => ({
    statusCode: 200,
    status(codigo) { this.statusCode = codigo; return this; },
    json(body) { this.body = body; return this; },
  });
  try {
    const res = response();
    await actualizarInvitado({ params: { id: '1' }, body: { nombre: 'Invitado' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.autorizacion, 'Pendiente');
    const total = consultas.length;
    const rechazada = response();
    await actualizarInvitado({
      params: { id: '1' }, body: { nombre: 'Invitado', autorizacion: 'Autorizado' },
    }, rechazada);
    assert.equal(rechazada.statusCode, 400);
    assert.equal(consultas.length, total);
  } finally {
    pool.query = queryOriginal;
  }
});

test('el control de ingreso acepta al invitado autorizado y conserva el bloqueo de registros antiguos', async () => {
  const connectOriginal = pool.connect;
  const queryOriginal = pool.query;
  let autorizado = true;
  let ingresos = 0;
  pool.connect = async () => ({
    async query(sql) {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
      if (sql.includes('FROM public.invitado i')) {
        return { rows: [{ id: '1', ceremoniaId: '2', autorizado, sesionGraduando: '3' }] };
      }
      if (sql.includes('FROM public.sesion')) return { rows: [{}], rowCount: 1 };
      if (sql.includes('FROM public.control_ingreso')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO public.control_ingreso')) {
        ingresos += 1;
        return { rows: [{ horaIngreso: '09:00 AM' }], rowCount: 1 };
      }
      throw new Error(`Consulta inesperada: ${sql}`);
    },
    release() {},
  });
  pool.query = async () => ({ rows: [{ registrados: 1, ingresaron: 1 }] });
  const response = () => ({
    statusCode: 200,
    status(codigo) { this.statusCode = codigo; return this; },
    json(body) { this.body = body; return this; },
  });
  try {
    const req = { params: { id: '1' }, body: { id_sesion: '3' } };
    const res = response();
    await registrarIngresoInvitado(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.yaIngreso, false);
    assert.equal(ingresos, 1);
    autorizado = false;
    const rechazado = response();
    await registrarIngresoInvitado(req, rechazado);
    assert.equal(rechazado.statusCode, 409);
    assert.match(rechazado.body.mensaje, /no está autorizado/);
    assert.equal(ingresos, 1);
  } finally {
    pool.connect = connectOriginal;
    pool.query = queryOriginal;
  }
});

after(async () => { await pool.end(); });