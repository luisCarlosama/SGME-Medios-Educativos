import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, test } from 'node:test';
import pool from '../src/db.js';

test('la migración solo autoriza invitados de ceremonias activas', {
  skip: process.env.INVITADOS_TEST_POSTGRES !== 'true',
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'La prueba solo admite PostgreSQL local.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE ceremonia_grado (id_ceremonia integer, estado text) ON COMMIT DROP');
    await client.query('CREATE TEMP TABLE graduando (id_graduando integer, id_ceremonia integer) ON COMMIT DROP');
    await client.query('CREATE TEMP TABLE invitado (id_invitado integer, id_graduando integer, autorizado boolean) ON COMMIT DROP');
    await client.query(`INSERT INTO pg_temp.ceremonia_grado VALUES
      (1, 'Programada'), (2, 'En curso'), (3, 'Finalizada'), (4, 'Cancelada')`);
    await client.query('INSERT INTO pg_temp.graduando VALUES (1, 1), (2, 2), (3, 3), (4, 4)');
    await client.query(`INSERT INTO pg_temp.invitado VALUES
      (1, 1, FALSE), (2, 2, NULL), (3, 3, FALSE), (4, 4, FALSE), (5, 1, TRUE)`);
    const sql = (await readFile(new URL('../migrations/009_autorizar_invitados_ceremonias_activas.sql', import.meta.url), 'utf8'))
      .replaceAll('public.', 'pg_temp.');
    assert.equal((await client.query(sql)).rowCount, 2);
    assert.equal((await client.query(sql)).rowCount, 0);
    const resultado = await client.query('SELECT autorizado FROM pg_temp.invitado ORDER BY id_invitado');
    assert.deepEqual(resultado.rows.map((row) => row.autorizado), [true, true, false, false, true]);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

after(async () => { await pool.end(); });
