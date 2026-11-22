import type { LocalDb, LocalDbTransaction } from '../../infra/db/LocalDb';
import type { EntityType, SyncStatus } from '../../infra/db/OfflineRepository';

export interface SyncEvent {
  id: string;
  entityType: EntityType;
  entityLocalId: string;
  operation: 'create' | 'update' | 'delete';
  payload: string;
  serverId: string | null;
}

export type DeliveryResult =
  | { kind: 'success'; serverId?: string }
  | { kind: 'retry' }
  | { kind: 'rejected' }
  | { kind: 'unknown' };

export interface SyncTransport {
  send(event: SyncEvent): Promise<DeliveryResult>;
}

export type SyncStopReason = 'empty' | 'backoff' | 'blocked' | 'busy' | 'retry';

interface QueueRow {
  id: string;
  entity_type: string;
  entity_local_id: string;
  operation: 'create' | 'update' | 'delete';
  payload: string;
  retry_count: number;
  next_retry_at: string | null;
  status: SyncStatus;
}

interface EntityRow {
  server_id: string | null;
}

type Claim = { event: SyncEvent; retryCount: number } | { stop: SyncStopReason };

const TABLES: Record<EntityType, string> = {
  atividade_agricola: 'atividade_agricola_local',
  movimentacao_estoque: 'movimentacao_estoque_local',
};

const ERROR_REJECTED = 'O servidor recusou esta alteração.';
const ERROR_UNKNOWN = 'Resultado desconhecido; confira no servidor antes de reenviar.';
const ERROR_LOCAL = 'Não foi possível relacionar a alteração ao registro local.';
const ERROR_RETRY = 'Sincronização temporariamente indisponível.';

function entityTable(entityType: string): string | undefined {
  if (entityType === 'atividade_agricola' || entityType === 'movimentacao_estoque') {
    return TABLES[entityType];
  }
  return undefined;
}

async function refreshEntity(
  transaction: LocalDbTransaction,
  entityType: string,
  entityLocalId: string,
): Promise<void> {
  const table = entityTable(entityType);
  if (!table) {
    return;
  }
  const rows = await transaction.query<{ status: SyncStatus; last_error: string | null }>(
    `SELECT status, last_error FROM sync_queue
     WHERE entity_type = ? AND entity_local_id = ? AND status != 'synced'
     ORDER BY CASE status WHEN 'error' THEN 0 WHEN 'syncing' THEN 1 ELSE 2 END, sequence
     LIMIT 1`,
    [entityType, entityLocalId],
  );
  await transaction.execute(
    `UPDATE ${table} SET sync_status = ?, last_error = ? WHERE local_id = ?`,
    [rows[0]?.status ?? 'synced', rows[0]?.last_error ?? null, entityLocalId],
  );
}

async function markError(transaction: LocalDbTransaction, row: QueueRow, message: string): Promise<void> {
  await transaction.execute(
    "UPDATE sync_queue SET status = 'error', last_error = ?, next_retry_at = NULL WHERE id = ?",
    [message, row.id],
  );
  await refreshEntity(transaction, row.entity_type, row.entity_local_id);
}

export class SyncService {
  private readonly db: LocalDb;
  private readonly transport: SyncTransport;
  private readonly now: () => Date;

  constructor(db: LocalDb, transport: SyncTransport, now: () => Date = () => new Date()) {
    this.db = db;
    this.transport = transport;
    this.now = now;
  }

  async processQueue(): Promise<SyncStopReason> {
    while (true) {
      const claim = await this.claimNext();
      if ('stop' in claim) {
        return claim.stop;
      }

      let result: DeliveryResult;
      try {
        result = await this.transport.send(claim.event);
      } catch {
        result = { kind: 'unknown' };
      }

      const stop = await this.finish(claim, result);
      if (stop) {
        return stop;
      }
    }
  }

  private claimNext(): Promise<Claim> {
    const now = this.now().toISOString();
    return this.db.transaction(async transaction => {
      const rows = await transaction.query<QueueRow>(
        "SELECT * FROM sync_queue WHERE status != 'synced' ORDER BY sequence LIMIT 1",
      );
      const row = rows[0];
      if (!row) {
        return { stop: 'empty' };
      }
      if (row.status === 'syncing') {
        return { stop: 'busy' };
      }
      if (row.status === 'error') {
        return { stop: 'blocked' };
      }
      if (row.next_retry_at && row.next_retry_at > now) {
        return { stop: 'backoff' };
      }

      const table = entityTable(row.entity_type);
      if (!table) {
        await markError(transaction, row, ERROR_LOCAL);
        return { stop: 'blocked' };
      }
      const entities = await transaction.query<EntityRow>(
        `SELECT server_id FROM ${table} WHERE local_id = ?`,
        [row.entity_local_id],
      );
      const entity = entities[0];
      if (
        !entity ||
        (row.operation === 'create' && entity.server_id !== null) ||
        (row.operation !== 'create' && !entity.server_id)
      ) {
        await markError(transaction, row, ERROR_LOCAL);
        return { stop: 'blocked' };
      }
      const updated = await transaction.execute(
        "UPDATE sync_queue SET status = 'syncing', last_error = NULL WHERE id = ? AND status = 'pending'",
        [row.id],
      );
      if (updated.rowsAffected !== 1) {
        return { stop: 'busy' };
      }
      await refreshEntity(transaction, row.entity_type, row.entity_local_id);
      return {
        event: {
          id: row.id,
          entityType: row.entity_type as EntityType,
          entityLocalId: row.entity_local_id,
          operation: row.operation,
          payload: row.payload,
          serverId: entity.server_id,
        },
        retryCount: row.retry_count,
      };
    });
  }

  private finish(claim: { event: SyncEvent; retryCount: number }, result: DeliveryResult): Promise<SyncStopReason | null> {
    const { event } = claim;
    const now = this.now();
    return this.db.transaction(async transaction => {
      const rows = await transaction.query<QueueRow>(
        'SELECT * FROM sync_queue WHERE id = ?',
        [event.id],
      );
      const row = rows[0];
      if (!row || row.status !== 'syncing') {
        throw new Error('O estado do evento de sincronização foi alterado inesperadamente.');
      }

      if (result.kind === 'success') {
        if (event.operation === 'create') {
          if (typeof result.serverId !== 'string' || !result.serverId.trim()) {
            await markError(transaction, row, ERROR_UNKNOWN);
            return 'blocked';
          }
          const updated = await transaction.execute(
            `UPDATE ${TABLES[event.entityType]} SET server_id = ? WHERE local_id = ? AND server_id IS NULL`,
            [result.serverId, event.entityLocalId],
          );
          if (updated.rowsAffected !== 1) {
            await markError(transaction, row, ERROR_UNKNOWN);
            return 'blocked';
          }
        }
        await transaction.execute(
          "UPDATE sync_queue SET status = 'synced', last_error = NULL, next_retry_at = NULL WHERE id = ?",
          [event.id],
        );
        await refreshEntity(transaction, event.entityType, event.entityLocalId);
        return null;
      }

      if (result.kind === 'retry') {
        const delay = Math.min(1000 * 2 ** Math.min(claim.retryCount, 10), 15 * 60 * 1000);
        const nextRetry = new Date(now.getTime() + delay).toISOString();
        await transaction.execute(
          "UPDATE sync_queue SET status = 'pending', retry_count = retry_count + 1, next_retry_at = ?, last_error = ? WHERE id = ?",
          [nextRetry, ERROR_RETRY, event.id],
        );
        await refreshEntity(transaction, event.entityType, event.entityLocalId);
        return 'retry';
      }

      await markError(transaction, row, result.kind === 'rejected' ? ERROR_REJECTED : ERROR_UNKNOWN);
      return 'blocked';
    });
  }

  async markInterruptedAsUncertain(): Promise<void> {
    await this.db.transaction(async transaction => {
      const rows = await transaction.query<QueueRow>("SELECT * FROM sync_queue WHERE status = 'syncing'");
      for (const row of rows) {
        await markError(transaction, row, ERROR_UNKNOWN);
      }
    });
  }
}
