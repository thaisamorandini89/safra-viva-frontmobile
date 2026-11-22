import type { LocalDb } from '../LocalDb';
import { initialMigration } from './initial';

const CURRENT_VERSION = 1;

export async function migrate(db: LocalDb): Promise<void> {
  await db.transaction(async transaction => {
    const rows = await transaction.query<{ user_version: number }>('PRAGMA user_version');
    const version = rows[0]?.user_version;
    if (!Number.isInteger(version) || version < 0 || version > CURRENT_VERSION) {
      throw new Error('Versão do banco local incompatível.');
    }

    if (version === 0) {
      for (const statement of initialMigration) {
        await transaction.execute(statement);
      }
      await transaction.execute('PRAGMA user_version = 1');
    }
  });
}
