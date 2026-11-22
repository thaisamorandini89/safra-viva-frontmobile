export type SqlValue = string | number | null | Uint8Array;

export interface SqlResult {
  rowsAffected: number;
  insertId?: number;
}

export interface LocalDbTransaction {
  execute(sql: string, parameters?: readonly SqlValue[]): Promise<SqlResult>;
  query<Row extends object>(
    sql: string,
    parameters?: readonly SqlValue[],
  ): Promise<Row[]>;
}

export interface LocalDb extends LocalDbTransaction {
  transaction<Result>(
    work: (transaction: LocalDbTransaction) => Promise<Result>,
  ): Promise<Result>;
  close(): Promise<void>;
}
