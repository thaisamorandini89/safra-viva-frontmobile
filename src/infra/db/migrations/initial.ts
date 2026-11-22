export const initialMigration: readonly string[] = [
  `CREATE TABLE kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE atividade_agricola_local (
    local_id TEXT PRIMARY KEY NOT NULL,
    server_id TEXT,
    data_json TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    location_captured_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    device_id TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error')),
    last_error TEXT
  )`,
  `CREATE TABLE movimentacao_estoque_local (
    local_id TEXT PRIMARY KEY NOT NULL,
    server_id TEXT,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    device_id TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error')),
    last_error TEXT
  )`,
  `CREATE TABLE anexo_foto (
    local_id TEXT PRIMARY KEY NOT NULL,
    atividade_local_id TEXT NOT NULL REFERENCES atividade_agricola_local(local_id),
    local_uri TEXT NOT NULL,
    server_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    device_id TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error')),
    last_error TEXT
  )`,
  `CREATE TABLE sync_queue (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    entity_type TEXT NOT NULL,
    entity_local_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    next_retry_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'syncing', 'synced', 'error')),
    last_error TEXT
  )`,
  'CREATE INDEX sync_queue_status_sequence ON sync_queue(status, sequence)',
  'CREATE INDEX sync_queue_entity ON sync_queue(entity_type, entity_local_id, sequence)',
  'CREATE INDEX anexo_foto_atividade ON anexo_foto(atividade_local_id)',
];
