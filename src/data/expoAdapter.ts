import type { SQLiteDatabase } from 'expo-sqlite';
import type { SqlDatabase, SqlParam } from './sql';

export function fromExpo(db: SQLiteDatabase): SqlDatabase {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: SqlParam[] = []) => {
      const r = await db.runAsync(sql, params);
      return { changes: r.changes };
    },
    all: <T>(sql: string, params: SqlParam[] = []) => db.getAllAsync<T>(sql, params),
    first: <T>(sql: string, params: SqlParam[] = []) => db.getFirstAsync<T>(sql, params),
    // withTransactionAsync mantém a mesma conexão (foreign_keys continua ativo).
    // A exclusividade entre escritas é garantida pela WriteQueue dos repositórios.
    transaction: (fn) => db.withTransactionAsync(fn),
  };
}
