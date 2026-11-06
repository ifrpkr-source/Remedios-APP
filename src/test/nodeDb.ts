import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { Deps, SqlDatabase } from '@/data/sql';
import { migrate } from '@/data/migrations';

/** Banco SQLite real, em memória, para testes. */
export function memoryDb(): SqlDatabase {
  const raw = new Database(':memory:');
  let depth = 0;
  return {
    exec: async (sql) => {
      raw.exec(sql);
    },
    run: async (sql, params = []) => ({ changes: raw.prepare(sql).run(...params).changes }),
    all: async <T>(sql: string, params: (string | number | null)[] = []) => raw.prepare(sql).all(...params) as T[],
    first: async <T>(sql: string, params: (string | number | null)[] = []) => {
      const stmt = raw.prepare(sql);
      if (!stmt.reader) {
        stmt.run(...params);
        return null;
      }
      return (stmt.get(...params) ?? null) as T | null;
    },
    transaction: async (fn) => {
      if (depth > 0) throw new Error('transação aninhada');
      depth++;
      raw.exec('BEGIN');
      try {
        await fn();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
  };
}

/** Relógio controlável para testes. */
export class TestClock {
  constructor(public current: Date) {}
  now = () => new Date(this.current);
  set(iso: string) {
    this.current = new Date(iso);
  }
  advanceMinutes(m: number) {
    this.current = new Date(this.current.getTime() + m * 60_000);
  }
}

export async function testDeps(startIso = '2026-11-06T10:00:00.000Z', timeZone = 'America/Sao_Paulo') {
  const db = memoryDb();
  await migrate(db);
  const clock = new TestClock(new Date(startIso));
  let tz = timeZone;
  const deps: Deps = { db, newId: randomUUID, now: clock.now, timeZone: () => tz };
  return { deps, clock, setTimeZone: (z: string) => (tz = z) };
}
