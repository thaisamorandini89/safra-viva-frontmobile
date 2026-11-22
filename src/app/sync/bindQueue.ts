import type { LocalDb } from '../../infra/db/LocalDb';

export async function bindQueue(
  db: LocalDb,
  server: string,
  userId: string,
): Promise<void> {
  const binding = JSON.stringify([server, userId]);
  await db.transaction(async transaction => {
    const rows = await transaction.query<{ value: string }>(
      'SELECT value FROM kv WHERE key = ?',
      ['sync_binding'],
    );
    if (rows[0] && rows[0].value !== binding) {
      throw new Error(
        'Este aparelho contém dados de outra conta ou servidor. A sincronização foi bloqueada.',
      );
    }
    if (!rows[0]) {
      const existing = await transaction.query<{ count: number }>(
        'SELECT (SELECT COUNT(*) FROM sync_queue) + (SELECT COUNT(*) FROM atividade_agricola_local) + (SELECT COUNT(*) FROM movimentacao_estoque_local) + (SELECT COUNT(*) FROM anexo_foto) AS count',
      );
      if (existing[0].count > 0) {
        throw new Error(
          'Há eventos antigos sem identificação de conta. A sincronização foi bloqueada.',
        );
      }
      await transaction.execute('INSERT INTO kv(key, value) VALUES (?, ?)', [
        'sync_binding',
        binding,
      ]);
    }
  });
}
