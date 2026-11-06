import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fromExpo } from '@/data/expoAdapter';
import { migrate } from '@/data/migrations';
import { createRepositories, type Repositories } from '@/data/repositories';
import { deviceTimeZone } from '@/domain/time';
import { createAgenda, type Agenda } from '@/services/agenda';
import { DB_NAME } from './dbName';

interface AppContextValue {
  repos: Repositories;
  agenda: Agenda;
  /** Muda a cada escrita: telas recarregam. */
  version: number;
  refresh: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export { DB_NAME };

async function onInit(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await migrate(fromExpo(db));
}

function Inner({ children }: { children: ReactNode }) {
  const sqlite = useSQLiteContext();
  const [version, setVersion] = useState(0);
  const base = useMemo(() => {
    const repos = createRepositories({ db: fromExpo(sqlite), newId: randomUUID, now: () => new Date(), timeZone: deviceTimeZone });
    return { repos, agenda: createAgenda(repos) };
  }, [sqlite]);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo(() => ({ ...base, version, refresh }), [base, version, refresh]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={onInit}>
      <Inner>{children}</Inner>
    </SQLiteProvider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp fora do AppProvider');
  return ctx;
}

/**
 * Carrega dados ao focar a tela, após qualquer escrita e a cada minuto
 * (para que "Na hora" / "Não confirmada" acompanhem o relógio).
 */
export function useLoad<T>(load: (app: AppContextValue) => Promise<T>, deps: unknown[] = []) {
  const app = useApp();
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(() => {
    let alive = true;
    loadRef.current(app)
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (alive) setError(e);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, ...deps]);

  useFocusEffect(run);
  useEffect(() => {
    const t = setInterval(run, 60_000);
    return () => clearInterval(t);
  }, [run]);

  return { data, error, reload: run };
}

/** Executa uma escrita, atualiza as telas e devolve o erro (se houver) para exibição. */
export function useAction() {
  const { refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const act = useCallback(
    async (fn: () => Promise<unknown>): Promise<Error | null> => {
      setBusy(true);
      try {
        await fn();
        return null;
      } catch (e) {
        return e as Error;
      } finally {
        setBusy(false);
        refresh();
      }
    },
    [refresh],
  );
  return { act, busy };
}
