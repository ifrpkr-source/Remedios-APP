/**
 * Interface mínima de banco usada pelos repositórios.
 * Implementada por expo-sqlite no app (expoAdapter.ts) e por better-sqlite3
 * nos testes (src/test/nodeDb.ts), para que os testes exercitem SQL real.
 */
export type SqlParam = string | number | null;

export interface SqlDatabase {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParam[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  /** Executa `fn` em uma transação; desfaz tudo se lançar erro. */
  transaction(fn: () => Promise<void>): Promise<void>;
}

export interface Deps {
  db: SqlDatabase;
  newId: () => string;
  now: () => Date;
  /** Fuso IANA atual (pode mudar durante o uso, ex.: viagem). */
  timeZone: () => string;
}

/**
 * Fila de escrita: serializa operações de escrita para que dois toques rápidos
 * em "Tomei" nunca leiam o mesmo estado antes de gravar.
 */
export class WriteQueue {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task, task);
    this.tail = next.catch(() => undefined);
    return next;
  }
}
