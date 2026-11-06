import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import pool from '../src/db.js';
import { agregarInvitado, agregarInvitadosLote } from '../src/controllers/ceremoniasOperacionesController.js';

async function registrarInvitados({ limite, registrados, totalCeremonia, cantidad }) {
  const connectOriginal = pool.connect;
  const queryOriginal = pool.query;
  let invitadosCreados = 0;
  const client = {
    async query(sql) {
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

after(async () => { await pool.end(); });