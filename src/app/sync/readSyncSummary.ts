import type { LocalDb } from '../../infra/db/LocalDb';

export interface SyncSummary {
  pending: number;
  syncing: number;
  errors: number;
}

export async function readSyncSummary(db: LocalDb): Promise<SyncSummary> {
  const rows = await db.query<SyncSummary>(
    `SELECT
       COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending,
       COUNT(CASE WHEN status = 'syncing' THEN 1 END) AS syncing,
       COUNT(CASE WHEN status = 'error' THEN 1 END) AS errors
     FROM sync_queue`,
  );
  return rows[0];
}
