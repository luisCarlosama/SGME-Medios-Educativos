import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, test } from 'node:test';
import pool from '../src/db.js';
import { actualizarSesionesPorHorario } from '../src/services/estadoSesiones.js';

test('horarios reales en PostgreSQL: límites, ceremonia no iniciada y sesiones vencidas', {
  skip: process.env.SESIONES_HORARIO_TEST_INTEGRACION !== 'true',
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'La prueba solo admite PostgreSQL local.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TEMP TABLE ceremonia_grado (
      id_ceremonia integer PRIMARY KEY, fecha date NOT NULL, estado text NOT NULL
    ) ON COMMIT DROP`);
    await client.query(`CREATE TEMP TABLE sesion (
      id_sesion integer PRIMARY KEY, id_ceremonia integer NOT NULL,
      estado text NOT NULL, hora_inicio time, hora_fin time
    ) ON COMMIT DROP`);
    const migracion = await readFile(new URL('../migrations/008_sesion_estado_manual.sql', import.meta.url), 'utf8');
    await client.query(migracion.replaceAll('public.', 'pg_temp.'));
    await client.query(migracion.replaceAll('public.', 'pg_temp.'));
    await client.query(`INSERT INTO pg_temp.ceremonia_grado VALUES
      (1, '2026-01-01', 'En curso'),
      (2, '2026-01-01', 'Programada'),
      (3, '2026-01-01', 'Cancelada'),
      (4, '2026-01-01', 'Finalizada')`);
    await client.query(`INSERT INTO pg_temp.sesion (id_sesion, id_ceremonia, estado, hora_inicio, hora_fin) VALUES
      (1, 1, 'Programada', '09:00', '10:00'),
      (2, 1, 'Programada', '10:00', '11:00'),
      (3, 1, 'Programada', '12:00', '13:00'),
      (4, 1, 'Pendiente', '09:00', '10:00'),
      (5, 1, 'Programada', NULL, NULL),
      (6, 2, 'Programada', '09:00', '10:00'),
      (7, 3, 'Programada', '09:00', '10:00'),
      (8, 4, 'Programada', '09:00', '10:00')`);
    await client.query("INSERT INTO pg_temp.sesion VALUES (9, 1, 'En curso', '09:00', '10:00', TRUE)");

    async function avanzar(ceremoniaId, hora) {
      return actualizarSesionesPorHorario({
        query(sql, valores) {
          return client.query(
            sql.replaceAll('public.', 'pg_temp.').replaceAll('LOCALTIMESTAMP', '$2::timestamp'),
            [...valores, `2026-01-01 ${hora}`],
          );
        },
      }, ceremoniaId);
    }

    assert.equal((await avanzar(1, '08:59:59')).rowCount, 0);
    assert.deepEqual((await avanzar(1, '09:00:00')).rows, [{ id: '1', estado: 'En curso' }]);
    assert.deepEqual((await avanzar(1, '09:59:59')).rows, []);
    const diez = (await avanzar(1, '10:00:00')).rows.sort((a, b) => a.id.localeCompare(b.id));
    assert.deepEqual(diez, [{ id: '1', estado: 'Finalizada' }, { id: '2', estado: 'En curso' }]);
    assert.deepEqual((await avanzar(1, '11:00:00')).rows, [{ id: '2', estado: 'Finalizada' }]);
    assert.deepEqual((await avanzar(1, '13:30:00')).rows, [{ id: '3', estado: 'Finalizada' }]);
    for (const id of [2, 3, 4]) assert.equal((await avanzar(id, '13:30:00')).rowCount, 0);
    const restantes = await client.query('SELECT id_sesion, estado FROM pg_temp.sesion WHERE id_sesion >= 4 ORDER BY id_sesion');
    assert.deepEqual(restantes.rows.map((row) => row.estado), ['Pendiente', 'Programada', 'Programada', 'Programada', 'Programada', 'En curso']);
    await client.query('UPDATE pg_temp.sesion SET estado_manual = FALSE WHERE id_sesion = 9');
    assert.deepEqual((await avanzar(1, '13:30:00')).rows, [{ id: '9', estado: 'Finalizada' }]);
    await client.query("UPDATE pg_temp.ceremonia_grado SET estado = 'En curso' WHERE id_ceremonia = 2");
    assert.deepEqual((await avanzar(2, '13:30:00')).rows, [{ id: '6', estado: 'Finalizada' }]);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

after(async () => { await pool.end(); });
