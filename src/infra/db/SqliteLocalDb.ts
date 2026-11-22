import type { DB, QueryResult, Transaction } from '@op-engineering/op-sqlite';
import type { LocalDb, LocalDbTransaction, SqlResult, SqlValue } from './LocalDb';

type Executor = Pick<DB | Transaction, 'execute'>;

function transactionAdapter(executor: Executor): LocalDbTransaction {
  async function run(sql: string, parameters: readonly SqlValue[] = []): Promise<QueryResult> {
    return executor.execute(sql, [...parameters]);
  }

  return {
    async execute(sql, parameters): Promise<SqlResult> {
      const result = await run(sql, parameters);
      return { rowsAffected: result.rowsAffected, insertId: result.insertId };
    },
    async query<Row extends object>(sql: string, parameters?: readonly SqlValue[]): Promise<Row[]> {
      const result = await run(sql, parameters);
      return result.rows as Row[];
    },
  };
}

export class SqliteLocalDb implements LocalDb {
  private readonly nativeDb: DB;
  private queue: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(nativeDb: DB) {
    this.nativeDb = nativeDb;
  }

  private enqueue<Result>(work: () => Promise<Result>): Promise<Result> {
    const next = this.queue.then(work);
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new Error('O banco local está fechado.');
    }
  }

  execute(sql: string, parameters?: readonly SqlValue[]): Promise<SqlResult> {
    return this.enqueue(async () => {
      this.ensureOpen();
      return transactionAdapter(this.nativeDb).execute(sql, parameters);
    });
  }

  query<Row extends object>(sql: string, parameters?: readonly SqlValue[]): Promise<Row[]> {
    return this.enqueue(async () => {
      this.ensureOpen();
      return transactionAdapter(this.nativeDb).query<Row>(sql, parameters);
    });
  }

  transaction<Result>(work: (transaction: LocalDbTransaction) => Promise<Result>): Promise<Result> {
    return this.enqueue(async () => {
      this.ensureOpen();
      let result: Result;
      await this.nativeDb.transaction(async transaction => {
        result = await work(transactionAdapter(transaction));
      });
      return result!;
    });
  }

  close(): Promise<void> {
    return this.enqueue(async () => {
      if (!this.closed) {
        await this.nativeDb.closeAsync();
        this.closed = true;
      }
    });
  }
}
