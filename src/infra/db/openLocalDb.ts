import { open } from '@op-engineering/op-sqlite';
import type { LocalDb } from './LocalDb';
import { migrate } from './migrations/migrate';
import { SqliteLocalDb } from './SqliteLocalDb';

export async function openLocalDb(name = 'safraviva.db'): Promise<LocalDb> {
  const db = new SqliteLocalDb(open({ name }));
  try {
    await db.execute('PRAGMA foreign_keys = ON');
    const rows = await db.query<{ foreign_keys: number }>('PRAGMA foreign_keys');
    if (rows[0]?.foreign_keys !== 1) {
      throw new Error('Não foi possível habilitar chaves estrangeiras no banco local.');
    }
    await migrate(db);
    return db;
  } catch (error) {
    try {
      await db.close();
    } catch {}
    throw error;
  }
}
