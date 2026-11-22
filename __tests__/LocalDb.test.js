import { OfflineRepository } from '../src/infra/db/OfflineRepository';
import { SqliteLocalDb } from '../src/infra/db/SqliteLocalDb';
import { migrate } from '../src/infra/db/migrations/migrate';
import { openLocalDb } from '../src/infra/db/openLocalDb';
import { open } from '@op-engineering/op-sqlite';
import { SyncService } from '../src/app/sync/SyncService';
import { readSyncSummary } from '../src/app/sync/readSyncSummary';
import { bindQueue } from '../src/app/sync/bindQueue';
import { BackendClient } from '../src/infra/api/BackendClient';
import { BackendSyncTransport } from '../src/infra/api/BackendSyncTransport';

jest.mock('@op-engineering/op-sqlite', () => ({ open: jest.fn() }));

const { DatabaseSync } = process.getBuiltinModule('node:sqlite');

function nativeDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  const native = {
    async execute(sql, parameters = []) {
      const statement = sqlite.prepare(sql);
      if (/^\s*(SELECT|PRAGMA\s+(user_version|foreign_keys)\s*$)/i.test(sql)) {
        return { rows: statement.all(...parameters), rowsAffected: 0 };
      }
      const result = statement.run(...parameters);
      return {
        rows: [],
        rowsAffected: result.changes,
        insertId: Number(result.lastInsertRowid),
      };
    },
    async transaction(work) {
      sqlite.exec('BEGIN');
      try {
        await work(native);
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    async closeAsync() {
      sqlite.close();
    },
  };
  return native;
}

const timestamp = '2026-11-22T00:00:00.000Z';
const activity = {
  entityType: 'atividade_agricola',
  localId: 'activity',
  eventId: 'event-1',
  deviceId: 'device',
  timestamp,
  data: { name: 'Plantio' },
  eventPayload: { name: 'Plantio' },
  location: { latitude: -23, longitude: -46, capturedAt: timestamp },
};

beforeEach(() => {
  open.mockReset();
});

test('conta eventos da fila por estado no SQLite', async () => {
  const db = new SqliteLocalDb(nativeDatabase());
  await migrate(db);
  expect(await readSyncSummary(db)).toEqual({
    pending: 0,
    syncing: 0,
    errors: 0,
  });
  for (const [index, status] of [
    'pending',
    'pending',
    'syncing',
    'error',
    'synced',
  ].entries()) {
    await db.execute(
      'INSERT INTO sync_queue(id, entity_type, entity_local_id, operation, payload, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        `event-${index}`,
        'atividade_agricola',
        'activity',
        'create',
        '{}',
        timestamp,
        status,
      ],
    );
  }
  expect(await readSyncSummary(db)).toEqual({
    pending: 2,
    syncing: 1,
    errors: 1,
  });
  await db.close();
});

test('vincula a fila à conta e ao servidor, recusando outro vínculo', async () => {
  const db = new SqliteLocalDb(nativeDatabase());
  await migrate(db);
  await bindQueue(db, 'https://example.com', '1');
  await bindQueue(db, 'https://example.com', '1');
  await expect(bindQueue(db, 'https://example.com', '2')).rejects.toThrow(
    'outra conta',
  );
  await expect(bindQueue(db, 'https://another.com', '1')).rejects.toThrow(
    'outra conta',
  );
  await db.close();
});

test('não atribui eventos antigos sem vínculo a uma conta', async () => {
  const db = new SqliteLocalDb(nativeDatabase());
  await migrate(db);
  await new OfflineRepository(db).create(activity);
  await expect(bindQueue(db, 'https://example.com', '1')).rejects.toThrow(
    'sem identificação',
  );
  await db.close();
});

test('sincroniza um evento local usando o contrato HTTP do backend', async () => {
  const db = new SqliteLocalDb(nativeDatabase());
  await migrate(db);
  await bindQueue(db, 'https://example.com', '1');
  await new OfflineRepository(db).create(activity);
  const fetchMock = jest
    .spyOn(BackendClient.prototype, 'request')
    .mockResolvedValue({ id_atividade_agricola: 42 });
  try {
    const service = new SyncService(
      db,
      new BackendSyncTransport(
        new BackendClient('https://example.com', 'token'),
      ),
    );
    expect(await service.processQueue()).toBe('empty');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      (await new OfflineRepository(db).list('atividade_agricola'))[0],
    ).toMatchObject({ server_id: '42', sync_status: 'synced' });
    expect(await readSyncSummary(db)).toEqual({
      pending: 0,
      syncing: 0,
      errors: 0,
    });
  } finally {
    fetchMock.mockRestore();
    await db.close();
  }
});

test('bloqueia a fila após resultado HTTP incerto sem duplicar envio', async () => {
  const db = new SqliteLocalDb(nativeDatabase());
  await migrate(db);
  await bindQueue(db, 'https://example.com', '1');
  await new OfflineRepository(db).create(activity);
  const fetchMock = jest
    .spyOn(BackendClient.prototype, 'request')
    .mockRejectedValue(new Error('timeout'));
  try {
    const service = new SyncService(
      db,
      new BackendSyncTransport(
        new BackendClient('https://example.com', 'token'),
      ),
    );
    expect(await service.processQueue()).toBe('blocked');
    expect(await service.processQueue()).toBe('blocked');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await readSyncSummary(db)).toEqual({
      pending: 0,
      syncing: 0,
      errors: 1,
    });
  } finally {
    fetchMock.mockRestore();
    await db.close();
  }
});

test('aplica a migração, habilita chaves estrangeiras e permite reabertura lógica', async () => {
  const native = nativeDatabase();
  open.mockReturnValue(native);
  const db = await openLocalDb();
  expect(open).toHaveBeenCalledWith({ name: 'safraviva.db' });
  expect((await db.query('PRAGMA foreign_keys'))[0].foreign_keys).toBe(1);
  expect((await db.query('PRAGMA user_version'))[0].user_version).toBe(1);
  await migrate(db);
  await expect(
    db.execute(
      'INSERT INTO anexo_foto(local_id, atividade_local_id, local_uri, created_at, updated_at, device_id) VALUES (?, ?, ?, ?, ?, ?)',
      ['foto', 'ausente', 'file:///foto', timestamp, timestamp, 'device'],
    ),
  ).rejects.toThrow();
  await db.close();
});

test('desfaz a migração inteira quando uma instrução falha', async () => {
  const db = new SqliteLocalDb(nativeDatabase());
  await db.execute('CREATE TABLE sync_queue (id TEXT)');
  await expect(migrate(db)).rejects.toThrow();
  expect((await db.query('PRAGMA user_version'))[0].user_version).toBe(0);
  expect(
    await db.query(
      "SELECT name FROM sqlite_master WHERE name = 'atividade_agricola_local'",
    ),
  ).toHaveLength(0);
  await db.close();
});

test('recusa uma versão mais recente sem alterar o banco', async () => {
  const db = new SqliteLocalDb(nativeDatabase());
  await db.execute('PRAGMA user_version = 2');
  await expect(migrate(db)).rejects.toThrow(
    'Versão do banco local incompatível.',
  );
  expect((await db.query('PRAGMA user_version'))[0].user_version).toBe(2);
  await db.close();
});

test('fecha a conexão quando a inicialização falha', async () => {
  const native = nativeDatabase();
  await native.execute('PRAGMA user_version = 2');
  const close = jest.spyOn(native, 'closeAsync');
  open.mockReturnValue(native);
  await expect(openLocalDb()).rejects.toThrow(
    'Versão do banco local incompatível.',
  );
  expect(close).toHaveBeenCalledTimes(1);
});

test('grava registros e eventos juntos e reverte alterações quando o evento falha', async () => {
  const native = nativeDatabase();
  open.mockReturnValue(native);
  const db = await openLocalDb();
  const repository = new OfflineRepository(db);
  await repository.create(activity);
  await repository.update({
    ...activity,
    eventId: 'event-2',
    data: { name: 'Colheita' },
    eventPayload: { name: 'Colheita' },
  });
  await expect(
    repository.update({ ...activity, data: { name: 'Não salvar' } }),
  ).rejects.toThrow();
  const records = await repository.list('atividade_agricola');
  expect(JSON.parse(records[0].data_json).name).toBe('Colheita');
  expect(records[0].latitude).toBe(-23);
  const events = await db.query('SELECT id FROM sync_queue ORDER BY sequence');
  expect(events.map(event => event.id)).toEqual(['event-1', 'event-2']);
  await db.close();
});

test('cria e atualiza movimentações de estoque com eventos ordenados', async () => {
  open.mockReturnValue(nativeDatabase());
  const db = await openLocalDb();
  const repository = new OfflineRepository(db);
  const movement = {
    entityType: 'movimentacao_estoque',
    localId: 'movement',
    eventId: 'event-1',
    deviceId: 'device',
    timestamp,
    data: { amount: 5 },
    eventPayload: { amount: 5 },
  };
  await repository.create(movement);
  await repository.update({
    ...movement,
    eventId: 'event-2',
    data: { amount: 10 },
    eventPayload: { amount: 10 },
  });
  expect(
    JSON.parse((await repository.list('movimentacao_estoque'))[0].data_json)
      .amount,
  ).toBe(10);
  const events = await db.query(
    'SELECT operation FROM sync_queue ORDER BY sequence',
  );
  expect(events.map(event => event.operation)).toEqual(['create', 'update']);
  await db.close();
});

test('serializa consultas externas enquanto uma transação está aberta', async () => {
  const db = new SqliteLocalDb(nativeDatabase());
  let release;
  let started;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  const ready = new Promise(resolve => {
    started = resolve;
  });
  const transaction = db.transaction(async tx => {
    await tx.execute('CREATE TABLE example (value TEXT)');
    started();
    await gate;
    await tx.execute('INSERT INTO example (value) VALUES (?)', ['confirmed']);
  });
  await ready;
  let queryFinished = false;
  const query = db.query('SELECT value FROM example').then(rows => {
    queryFinished = true;
    return rows;
  });
  await Promise.resolve();
  expect(queryFinished).toBe(false);
  release();
  await transaction;
  expect((await query)[0].value).toBe('confirmed');
  await db.close();
  await expect(db.query('SELECT 1')).rejects.toThrow(
    'O banco local está fechado.',
  );
});

test('sincroniza em ordem e preserva uma edição feita durante o envio', async () => {
  open.mockReturnValue(nativeDatabase());
  const db = await openLocalDb();
  const repository = new OfflineRepository(db);
  await repository.create(activity);
  let release;
  let started;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  const ready = new Promise(resolve => {
    started = resolve;
  });
  const transport = {
    send: jest.fn(async event => {
      if (event.operation === 'create') {
        started();
        await gate;
        return { kind: 'success', serverId: 'server-1' };
      }
      return { kind: 'success' };
    }),
  };
  const service = new SyncService(db, transport);
  const processing = service.processQueue();
  await ready;
  await repository.update({
    ...activity,
    eventId: 'event-2',
    data: { name: 'Colheita' },
    eventPayload: { name: 'Colheita' },
  });
  release();
  await expect(processing).resolves.toBe('empty');
  expect(transport.send.mock.calls.map(call => call[0].operation)).toEqual([
    'create',
    'update',
  ]);
  expect(transport.send.mock.calls[1][0].serverId).toBe('server-1');
  const [record] = await repository.list('atividade_agricola');
  expect(record.sync_status).toBe('synced');
  expect(record.server_id).toBe('server-1');
  expect(JSON.parse(record.data_json).name).toBe('Colheita');
  await db.close();
});

test('programa retry seguro com backoff e mantém a ordem da fila', async () => {
  open.mockReturnValue(nativeDatabase());
  const db = await openLocalDb();
  const repository = new OfflineRepository(db);
  await repository.create(activity);
  await repository.create({
    ...activity,
    localId: 'second',
    eventId: 'event-2',
  });
  let time = new Date(timestamp);
  const transport = {
    send: jest
      .fn()
      .mockResolvedValueOnce({ kind: 'retry' })
      .mockResolvedValueOnce({ kind: 'success', serverId: 'server-1' })
      .mockResolvedValueOnce({ kind: 'success', serverId: 'server-2' }),
  };
  const service = new SyncService(db, transport, () => time);
  await expect(service.processQueue()).resolves.toBe('retry');
  const [queued] = await db.query('SELECT * FROM sync_queue ORDER BY sequence');
  expect(queued.retry_count).toBe(1);
  expect(queued.next_retry_at).toBe('2026-11-22T00:00:01.000Z');
  await expect(service.processQueue()).resolves.toBe('backoff');
  expect(transport.send).toHaveBeenCalledTimes(1);
  time = new Date('2026-11-22T00:00:01.000Z');
  await expect(service.processQueue()).resolves.toBe('empty');
  expect(transport.send.mock.calls.map(call => call[0].id)).toEqual([
    'event-1',
    'event-1',
    'event-2',
  ]);
  await db.close();
});

test('bloqueia resultado desconhecido sem registrar erros sensíveis ou reenviar', async () => {
  open.mockReturnValue(nativeDatabase());
  const db = await openLocalDb();
  await new OfflineRepository(db).create(activity);
  const transport = {
    send: jest.fn().mockRejectedValue(new Error('segredo-do-token')),
  };
  const service = new SyncService(db, transport);
  await expect(service.processQueue()).resolves.toBe('blocked');
  await expect(service.processQueue()).resolves.toBe('blocked');
  expect(transport.send).toHaveBeenCalledTimes(1);
  const [event] = await db.query('SELECT status, last_error FROM sync_queue');
  expect(event.status).toBe('error');
  expect(event.last_error).not.toContain('segredo-do-token');
  expect(
    (await new OfflineRepository(db).list('atividade_agricola'))[0].sync_status,
  ).toBe('error');
  await db.close();
});

test('não reenvia criação bem-sucedida cujo servidor não retornou identificador', async () => {
  open.mockReturnValue(nativeDatabase());
  const db = await openLocalDb();
  await new OfflineRepository(db).create(activity);
  const transport = { send: jest.fn().mockResolvedValue({ kind: 'success' }) };
  const service = new SyncService(db, transport);
  await expect(service.processQueue()).resolves.toBe('blocked');
  await expect(service.processQueue()).resolves.toBe('blocked');
  expect(transport.send).toHaveBeenCalledTimes(1);
  expect((await db.query('SELECT status FROM sync_queue'))[0].status).toBe(
    'error',
  );
  await db.close();
});

test('bloqueia rejeição conhecida e não transmite eventos posteriores', async () => {
  open.mockReturnValue(nativeDatabase());
  const db = await openLocalDb();
  const repository = new OfflineRepository(db);
  await repository.create(activity);
  await repository.create({
    ...activity,
    localId: 'second',
    eventId: 'event-2',
  });
  const transport = { send: jest.fn().mockResolvedValue({ kind: 'rejected' }) };
  const service = new SyncService(db, transport);
  await expect(service.processQueue()).resolves.toBe('blocked');
  const events = await db.query(
    'SELECT status FROM sync_queue ORDER BY sequence',
  );
  expect(events.map(event => event.status)).toEqual(['error', 'pending']);
  expect(transport.send).toHaveBeenCalledTimes(1);
  await db.close();
});

test('não transmite atualizações sem identificação no servidor', async () => {
  open.mockReturnValue(nativeDatabase());
  const db = await openLocalDb();
  const repository = new OfflineRepository(db);
  await repository.create(activity);
  await repository.update({ ...activity, eventId: 'event-2' });
  await db.execute("UPDATE sync_queue SET status = 'synced' WHERE id = ?", [
    'event-1',
  ]);
  const transport = { send: jest.fn() };
  await expect(new SyncService(db, transport).processQueue()).resolves.toBe(
    'blocked',
  );
  expect(transport.send).not.toHaveBeenCalled();
  expect(
    (
      await db.query('SELECT status FROM sync_queue WHERE id = ?', ['event-2'])
    )[0].status,
  ).toBe('error');
  await db.close();
});

test('recupera eventos interrompidos como resultado incerto, sem reenvio automático', async () => {
  open.mockReturnValue(nativeDatabase());
  const db = await openLocalDb();
  await new OfflineRepository(db).create(activity);
  await db.execute("UPDATE sync_queue SET status = 'syncing'");
  const transport = { send: jest.fn() };
  const service = new SyncService(db, transport);
  await service.markInterruptedAsUncertain();
  await expect(service.processQueue()).resolves.toBe('blocked');
  expect(transport.send).not.toHaveBeenCalled();
  expect((await db.query('SELECT status FROM sync_queue'))[0].status).toBe(
    'error',
  );
  await db.close();
});

test('impede o envio simultâneo do mesmo evento por processadores concorrentes', async () => {
  open.mockReturnValue(nativeDatabase());
  const db = await openLocalDb();
  await new OfflineRepository(db).create(activity);
  let release;
  let started;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  const ready = new Promise(resolve => {
    started = resolve;
  });
  const transport = {
    send: jest.fn(async () => {
      started();
      await gate;
      return { kind: 'success', serverId: 'server-1' };
    }),
  };
  const first = new SyncService(db, transport).processQueue();
  await ready;
  await expect(new SyncService(db, transport).processQueue()).resolves.toBe(
    'busy',
  );
  release();
  await expect(first).resolves.toBe('empty');
  expect(transport.send).toHaveBeenCalledTimes(1);
  await db.close();
});
