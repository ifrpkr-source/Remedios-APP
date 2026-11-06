import type {
  DesiredNotification,
  NotificationScheduler,
  PermissionSnapshot,
  Platform,
  PresentedNotification,
  ScheduledNotification,
} from '@/notifications/types';
import { MAX_PENDING } from '@/notifications/types';

/**
 * Agendador em memória que imita o sistema operacional:
 * - mesmo identificador substitui o agendamento anterior (como iOS e Android);
 * - respeita um limite rígido de pendentes (iOS descarta além de 64);
 * - permite simular notificações já exibidas na bandeja.
 */
export class FakeScheduler implements NotificationScheduler {
  pending = new Map<string, DesiredNotification>();
  presented = new Map<string, PresentedNotification>();
  /** Agendamentos "estranhos" (restos de outra versão ou de outra origem). */
  foreign = new Map<string, ScheduledNotification>();
  log: string[] = [];
  permission: PermissionSnapshot = { notifications: 'granted', canAskAgain: true, exactAlarms: 'granted' };

  constructor(
    public platform: Platform = 'android',
    public maxPending: number = MAX_PENDING[platform],
    public hardLimit: number = platform === 'ios' ? 64 : 500,
  ) {}

  async getPermissions() {
    return this.permission;
  }
  async getScheduled(): Promise<ScheduledNotification[]> {
    return [...[...this.pending.values()].map((n) => ({ id: n.id, data: n.data })), ...this.foreign.values()];
  }
  async schedule(n: DesiredNotification) {
    if (!this.pending.has(n.id) && this.pending.size >= this.hardLimit) throw new Error('limite do sistema atingido');
    this.pending.set(n.id, n);
    this.log.push(`schedule ${n.id}`);
  }
  async cancel(id: string) {
    this.pending.delete(id);
    this.foreign.delete(id);
    this.log.push(`cancel ${id}`);
  }
  async getPresented() {
    return [...this.presented.values()];
  }
  async dismiss(id: string) {
    this.presented.delete(id);
    this.log.push(`dismiss ${id}`);
  }

  /** Simula o SO disparando a notificação: sai de pendentes e vai para a bandeja. */
  deliver(id: string) {
    const n = this.pending.get(id);
    if (!n) throw new Error(`não agendada: ${id}`);
    this.pending.delete(id);
    this.presented.set(id, { id, data: n.data });
    return n;
  }

  byKind(kind: string) {
    return [...this.pending.values()].filter((n) => n.data.kind === kind);
  }
  forDose(doseKey: string) {
    return [...this.pending.values()].filter((n) => n.data.doseKey === doseKey);
  }
}
