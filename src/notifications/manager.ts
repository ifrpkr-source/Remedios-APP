import { isOpen } from '@/domain/doseState';
import { addDays } from '@/domain/time';
import type { Repositories } from '@/data/repositories';
import type { Agenda } from '@/services/agenda';
import { assessAlarmHealth, type AlarmHealth } from './permissions';
import { planNotifications } from './planner';
import type { DesiredNotification, NotificationScheduler, PermissionSnapshot } from './types';

/** Dias à frente considerados no planejamento (o limite de pendentes pode cortar antes). */
export const HORIZON_DAYS = 14;

export interface ReconcileResult {
  reason: string;
  desired: number;
  scheduled: number;
  cancelled: number;
  kept: number;
  dismissed: number;
  truncatedAfter: string | null;
  timeZoneChanged: boolean;
  permission: PermissionSnapshot;
  health: AlarmHealth;
}

const isOurs = (id: string, data: { app?: string } | undefined) => data?.app === 'cuidar' || id.startsWith('cuidar.');

/**
 * Reconcilia o que está agendado no sistema operacional com o que o banco
 * diz que deveria estar. O banco é a fonte da verdade; o SO é um cache.
 *
 * - Idempotente: rodar duas vezes seguidas não muda nada na segunda.
 * - Identificadores estáveis por dose: nunca há alarme duplicado.
 * - Só mexe em notificações do Cuidar.
 * - Execuções concorrentes são serializadas.
 */
export function createNotificationManager(deps: { repos: Repositories; agenda: Agenda; scheduler: NotificationScheduler }) {
  const { repos, agenda, scheduler } = deps;
  let chain: Promise<unknown> = Promise.resolve();
  let last: ReconcileResult | null = null;

  async function run(reason: string): Promise<ReconcileResult> {
    const [settings, permission] = await Promise.all([repos.settings.get(), scheduler.getPermissions()]);
    const tz = repos.clock.timeZone();
    const timeZoneChanged = settings.lastScheduledTimeZone !== null && settings.lastScheduledTimeZone !== tz;
    const permitted = permission.notifications === 'granted' || permission.notifications === 'provisional' || permission.notifications === 'ephemeral';
    const active = settings.alarmsEnabled && permitted;

    let desired: DesiredNotification[] = [];
    let truncatedAfter: string | null = null;
    const openDoseKeys = new Set<string>();

    if (active) {
      const today = repos.clock.today();
      const [doses, restock] = await Promise.all([agenda.dosesForRange(addDays(today, -1), addDays(today, HORIZON_DAYS)), agenda.stockOverview()]);
      for (const d of doses) if (isOpen(d.resolved.status)) openDoseKeys.add(d.occurrence.doseKey);
      const plan = planNotifications({
        doses,
        restock,
        now: repos.clock.now(),
        timeZone: tz,
        platform: scheduler.platform,
        maxPending: scheduler.maxPending,
        exactAlarms: permission.exactAlarms !== 'denied',
        followupMinutes: settings.followupMinutes,
        showName: settings.showNameInNotification,
      });
      desired = plan.notifications;
      truncatedAfter = plan.truncatedAfter;
    }

    const want = new Map(desired.map((d) => [d.id, d]));
    const existing = (await scheduler.getScheduled()).filter((n) => isOurs(n.id, n.data));
    const keep = new Set<string>();
    let cancelled = 0;
    for (const n of existing) {
      const d = want.get(n.id);
      if (d && !keep.has(n.id) && n.data?.fireAt === d.data.fireAt && n.data?.hash === d.data.hash) {
        keep.add(n.id);
      } else {
        await scheduler.cancel(n.id);
        cancelled++;
      }
    }
    let scheduled = 0;
    for (const d of desired) {
      if (keep.has(d.id)) continue;
      await scheduler.schedule(d);
      scheduled++;
    }

    // Remove da bandeja notificações já exibidas de doses que não estão mais em aberto
    // (confirmadas, puladas, pausadas, arquivadas ou com horário alterado).
    let dismissed = 0;
    for (const p of await scheduler.getPresented()) {
      if (!isOurs(p.id, p.data) || !p.data?.doseKey) continue;
      if (!active || !openDoseKeys.has(p.data.doseKey)) {
        await scheduler.dismiss(p.id);
        dismissed++;
      }
    }

    if (active) await repos.settings.setLastScheduledTimeZone(tz);

    const result: ReconcileResult = {
      reason,
      desired: desired.length,
      scheduled,
      cancelled,
      kept: keep.size,
      dismissed,
      truncatedAfter,
      timeZoneChanged,
      permission,
      health: assessAlarmHealth({ platform: scheduler.platform, permission, alarmsEnabled: settings.alarmsEnabled, truncatedAfter }),
    };
    last = result;
    return result;
  }

  return {
    reconcile(reason: string): Promise<ReconcileResult> {
      const next = chain.then(() => run(reason), () => run(reason));
      chain = next.catch(() => undefined);
      return next;
    },
    lastResult: () => last,
  };
}

export type NotificationManager = ReturnType<typeof createNotificationManager>;
