/**
 * Porta (interface) para o agendador do sistema operacional.
 * Implementada por expoScheduler.ts (expo-notifications) no app e por
 * FakeScheduler nos testes. O gerenciador nunca depende de expo diretamente.
 */
export type Platform = 'ios' | 'android';

export type NotificationKind = 'main' | 'followup' | 'snooze' | 'restock' | 'keepalive';

export interface NotificationData {
  /** Marca notificações do Cuidar (para nunca mexer em notificações de outras origens). */
  app: 'cuidar';
  kind: NotificationKind;
  doseKey?: string;
  medicationId?: string;
  scheduledLocal?: string;
  /** Instante planejado (ISO); usado na reconciliação. */
  fireAt: string;
  /** Hash do conteúdo: muda quando título/texto mudam (ex.: nome editado). */
  hash: string;
}

export interface DesiredNotification {
  id: string;
  fireAt: Date;
  title: string;
  body: string;
  data: NotificationData;
  categoryId: string | null;
  channelId: string;
  /** Android: 'alarmClock' quando houver permissão de alarme exato. */
  delivery: 'alarmClock' | 'bestEffort';
}

export interface ScheduledNotification {
  id: string;
  data: Partial<NotificationData> | undefined;
}

export interface PresentedNotification {
  id: string;
  data: Partial<NotificationData> | undefined;
}

export type NotificationPermission = 'granted' | 'provisional' | 'ephemeral' | 'denied' | 'undetermined';

export interface PermissionSnapshot {
  notifications: NotificationPermission;
  canAskAgain: boolean;
  /** Android 12+: alarmes exatos. iOS: sempre 'not-applicable'. */
  exactAlarms: 'granted' | 'denied' | 'not-applicable';
}

export interface NotificationScheduler {
  platform: Platform;
  /** Máximo de agendamentos pendentes que o app usará nesta plataforma. */
  maxPending: number;
  getPermissions(): Promise<PermissionSnapshot>;
  getScheduled(): Promise<ScheduledNotification[]>;
  schedule(n: DesiredNotification): Promise<void>;
  cancel(id: string): Promise<void>;
  getPresented(): Promise<PresentedNotification[]>;
  dismiss(id: string): Promise<void>;
}

/** Identificadores das ações (sem ":" ou "-", exigência do expo-notifications). */
export const ACTION = {
  taken: 'TOMEI',
  snooze10: 'ADIAR_10',
  snooze15: 'ADIAR_15',
  snooze30: 'ADIAR_30',
  open: 'ABRIR',
} as const;

export const CATEGORY_DOSE = 'dose_lembrete';
export const CHANNEL_DOSES = 'doses';
export const CHANNEL_GENERAL = 'avisos';

/** Limites conservadores. iOS: o sistema guarda no máximo 64 pendentes por app. */
export const MAX_PENDING: Record<Platform, number> = { ios: 60, android: 200 };
