import { randomUUID } from 'expo-crypto';
import { openDatabaseAsync } from 'expo-sqlite';
import { fromExpo } from '@/data/expoAdapter';
import { migrate } from '@/data/migrations';
import { createRepositories } from '@/data/repositories';
import { deviceTimeZone } from '@/domain/time';
import { createAgenda } from '@/services/agenda';
import { DB_NAME } from '@/state/dbName';
import { createExpoScheduler } from './expoScheduler';
import { createNotificationManager } from './manager';

/**
 * Monta repositórios + gerenciador fora da árvore React (tarefa em segundo
 * plano do Android). Usa o mesmo arquivo de banco e as mesmas regras do app.
 */
export async function openHeadlessRuntime() {
  const sqlite = await openDatabaseAsync(DB_NAME);
  await sqlite.execAsync('PRAGMA journal_mode = WAL;');
  const db = fromExpo(sqlite);
  await migrate(db);
  const repos = createRepositories({ db, newId: randomUUID, now: () => new Date(), timeZone: deviceTimeZone });
  const agenda = createAgenda(repos);
  const manager = createNotificationManager({ repos, agenda, scheduler: createExpoScheduler() });
  return { repos, agenda, manager };
}
