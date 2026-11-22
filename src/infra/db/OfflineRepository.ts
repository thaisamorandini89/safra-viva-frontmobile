import type { LocalDb, LocalDbTransaction, SqlValue } from './LocalDb';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };
export type EntityType = 'atividade_agricola' | 'movimentacao_estoque';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export interface Location {
  latitude: number;
  longitude: number;
  capturedAt: string;
}

interface MutationBase {
  localId: string;
  eventId: string;
  deviceId: string;
  timestamp: string;
  data: JsonObject;
  eventPayload: JsonObject;
}

export type OfflineMutation = MutationBase &
  (
    | { entityType: 'atividade_agricola'; location?: Location | null }
    | { entityType: 'movimentacao_estoque'; location?: never }
  );

export interface LocalRecord {
  local_id: string;
  server_id: string | null;
  data_json: string;
  created_at: string;
  updated_at: string;
  device_id: string;
  sync_status: SyncStatus;
  last_error: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_captured_at?: string | null;
}

const TABLES: Record<EntityType, string> = {
  atividade_agricola: 'atividade_agricola_local',
  movimentacao_estoque: 'movimentacao_estoque_local',
};

function validateTimestamp(value: string): void {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error('A data deve estar em formato ISO 8601 UTC.');
  }
}

function validateMutation(mutation: OfflineMutation): void {
  if (!mutation.localId.trim() || !mutation.eventId.trim() || !mutation.deviceId.trim()) {
    throw new Error('Os identificadores local, do evento e do dispositivo são obrigatórios.');
  }
  validateTimestamp(mutation.timestamp);
  if (mutation.entityType === 'atividade_agricola' && mutation.location) {
    const { latitude, longitude, capturedAt } = mutation.location;
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new Error('As coordenadas GPS são inválidas.');
    }
    validateTimestamp(capturedAt);
  }
}

async function enqueue(
  transaction: LocalDbTransaction,
  mutation: OfflineMutation,
  operation: 'create' | 'update',
  payload: string,
): Promise<void> {
  await transaction.execute(
    `INSERT INTO sync_queue
      (id, entity_type, entity_local_id, operation, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      mutation.eventId,
      mutation.entityType,
      mutation.localId,
      operation,
      payload,
      mutation.timestamp,
    ],
  );
}

export class OfflineRepository {
  private readonly db: LocalDb;

  constructor(db: LocalDb) {
    this.db = db;
  }

  async create(mutation: OfflineMutation): Promise<void> {
    validateMutation(mutation);
    const data = JSON.stringify(mutation.data);
    const payload = JSON.stringify(mutation.eventPayload);

    await this.db.transaction(async transaction => {
      const location = mutation.entityType === 'atividade_agricola' ? mutation.location : null;
      const columns = locationColumns(mutation.entityType);
      const parameters: SqlValue[] = [
        mutation.localId,
        data,
        mutation.timestamp,
        mutation.timestamp,
        mutation.deviceId,
        ...locationParameters(mutation.entityType, location),
      ];
      await transaction.execute(
        `INSERT INTO ${TABLES[mutation.entityType]}
          (local_id, data_json, created_at, updated_at, device_id${columns.names})
         VALUES (?, ?, ?, ?, ?${columns.placeholders})`,
        parameters,
      );
      await enqueue(transaction, mutation, 'create', payload);
    });
  }

  async update(mutation: OfflineMutation): Promise<void> {
    validateMutation(mutation);
    const data = JSON.stringify(mutation.data);
    const payload = JSON.stringify(mutation.eventPayload);

    await this.db.transaction(async transaction => {
      const location = mutation.entityType === 'atividade_agricola' ? mutation.location : null;
      const columns = locationColumns(mutation.entityType);
      const result = await transaction.execute(
        `UPDATE ${TABLES[mutation.entityType]}
         SET data_json = ?, updated_at = ?,
             sync_status = CASE WHEN sync_status = 'error' THEN 'error' ELSE 'pending' END
             ${columns.assignments}
         WHERE local_id = ?`,
        [
          data,
          mutation.timestamp,
          ...locationParameters(mutation.entityType, location),
          mutation.localId,
        ],
      );
      if (result.rowsAffected !== 1) {
        throw new Error('Registro local não encontrado.');
      }
      await enqueue(transaction, mutation, 'update', payload);
    });
  }

  list(entityType: EntityType): Promise<LocalRecord[]> {
    return this.db.query<LocalRecord>(
      `SELECT * FROM ${TABLES[entityType]} ORDER BY updated_at DESC, local_id`,
    );
  }
}

function locationColumns(entityType: EntityType): {
  names: string;
  placeholders: string;
  assignments: string;
} {
  if (entityType === 'atividade_agricola') {
    return {
      names: ', latitude, longitude, location_captured_at',
      placeholders: ', ?, ?, ?',
      assignments: ', latitude = ?, longitude = ?, location_captured_at = ?',
    };
  }
  return { names: '', placeholders: '', assignments: '' };
}

function locationParameters(entityType: EntityType, location?: Location | null): SqlValue[] {
  if (entityType !== 'atividade_agricola') {
    return [];
  }
  return [location?.latitude ?? null, location?.longitude ?? null, location?.capturedAt ?? null];
}
