import { isOpen } from '@/domain/doseState';
import { formatBrDate, localDateTimeToDate, timePart, type LocalDate } from '@/domain/time';
import type { AgendaDose, StockSummary } from '@/services/agenda';
import { unitPlural } from '@/ui/format';
import {
  CATEGORY_DOSE,
  CHANNEL_DOSES,
  CHANNEL_GENERAL,
  type DesiredNotification,
  type NotificationData,
  type NotificationKind,
  type Platform,
} from './types';

export interface PlanInput {
  doses: AgendaDose[];
  restock: StockSummary[];
  now: Date;
  timeZone: string;
  platform: Platform;
  maxPending: number;
  exactAlarms: boolean;
  followupMinutes: number;
  showName: boolean;
}

export interface Plan {
  notifications: DesiredNotification[];
  /** Data local da última dose com lembrete, quando o limite cortou doses futuras. */
  truncatedAfter: LocalDate | null;
}

/** Identificador estável: a mesma dose sempre gera o mesmo id, então nunca há duplicata. */
export const notificationId = (kind: NotificationKind, key: string) => `cuidar.${kind}.${key}`;

/** Hash simples e estável (djb2) para detectar mudança de conteúdo. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const RESTOCK_HOUR = '09:00';
const FOLLOWUP_WINDOW_MS = 36 * 3600_000;

function make(
  kind: NotificationKind,
  key: string,
  fireAt: Date,
  title: string,
  body: string,
  extra: Partial<NotificationData>,
  opts: { category: string | null; channel: string; delivery: 'alarmClock' | 'bestEffort' },
): DesiredNotification {
  const data: NotificationData = {
    app: 'cuidar',
    kind,
    fireAt: fireAt.toISOString(),
    hash: hash(`${title}|${body}|${opts.category}|${opts.delivery}`),
    ...extra,
  };
  return { id: notificationId(kind, key), fireAt, title, body, data, categoryId: opts.category, channelId: opts.channel, delivery: opts.delivery };
}

/**
 * Calcula o conjunto DESEJADO de notificações a partir do estado do banco.
 * Função pura: o mesmo estado sempre produz o mesmo plano.
 *
 * Prioridade quando o limite de pendentes é atingido:
 *   1. lembrete principal e adiamentos, em ordem de horário
 *   2. avisos de reposição
 *   3. acompanhamentos ("ainda sem confirmação"), só nas próximas 36 h
 * Se doses ficarem de fora, um aviso final pede para abrir o app.
 */
export function planNotifications(input: PlanInput): Plan {
  const { doses, now, timeZone, platform, exactAlarms, followupMinutes, showName } = input;
  const nowMs = now.getTime();
  const primary: DesiredNotification[] = [];
  const followups: DesiredNotification[] = [];
  const restock: DesiredNotification[] = [];
  const delivery = platform === 'android' && exactAlarms ? 'alarmClock' : 'bestEffort';

  for (const d of doses) {
    if (d.orphan || !isOpen(d.resolved.status)) continue;
    const med = d.medication;
    const label = [med.name, med.strength].filter(Boolean).join(' ');
    const amount = unitPlural(d.occurrence.quantity, med.unitLabel);
    const time = timePart(d.occurrence.localDateTime);
    const title = showName ? `Hora do ${label}` : 'Hora do seu medicamento';
    const extra: Partial<NotificationData> = {
      doseKey: d.occurrence.doseKey,
      medicationId: med.id,
      scheduledLocal: d.occurrence.localDateTime,
    };
    const scheduledMs = d.scheduledAt.getTime();
    const doseOpts = { category: CATEGORY_DOSE, channel: CHANNEL_DOSES, delivery } as const;

    if (d.resolved.status === 'snoozed' && d.resolved.snoozeUntil) {
      const at = new Date(d.resolved.snoozeUntil);
      if (at.getTime() > nowMs) {
        primary.push(make('snooze', d.occurrence.doseKey, at, title, `Lembrete adiado · dose das ${time} · ${amount}`, extra, doseOpts));
      }
      continue;
    }

    if (scheduledMs > nowMs) {
      primary.push(make('main', d.occurrence.doseKey, d.scheduledAt, title, `${time} · ${amount}. Toque para registrar.`, extra, doseOpts));
    }
    if (followupMinutes > 0) {
      const at = new Date(scheduledMs + followupMinutes * 60_000);
      if (at.getTime() > nowMs && at.getTime() - nowMs <= FOLLOWUP_WINDOW_MS) {
        followups.push(
          make(
            'followup',
            d.occurrence.doseKey,
            at,
            showName ? `${label}: ainda sem confirmação` : 'Dose ainda sem confirmação',
            `Dose das ${time}. Registre se tomou ou não.`,
            extra,
            { category: CATEGORY_DOSE, channel: CHANNEL_DOSES, delivery: 'bestEffort' },
          ),
        );
      }
    }
  }

  for (const s of input.restock) {
    // Agenda para a data do aviso (antecedência configurada), sempre que houver previsão de fim.
    if (s.stock === null || !s.alertOn || !s.forecast?.runsOutOn) continue;
    const at = localDateTimeToDate(`${s.alertOn}T${RESTOCK_HOUR}`, timeZone);
    if (at.getTime() <= nowMs) continue;
    const name = showName ? s.medication.name : 'um medicamento';
    restock.push(
      make('restock', s.medication.id, at, 'Hora de repor o estoque', `O estoque de ${name} deve acabar em ${formatBrDate(s.forecast.runsOutOn)}.`, { medicationId: s.medication.id }, {
        category: null,
        channel: CHANNEL_GENERAL,
        delivery: 'bestEffort',
      }),
    );
  }

  const byTime = (a: DesiredNotification, b: DesiredNotification) => a.fireAt.getTime() - b.fireAt.getTime() || a.id.localeCompare(b.id);
  primary.sort(byTime);
  followups.sort(byTime);
  restock.sort(byTime);

  const budget = Math.max(1, input.maxPending - 1); // 1 vaga reservada ao aviso final
  const chosen = primary.slice(0, budget);
  let truncatedAfter: LocalDate | null = null;
  if (primary.length > chosen.length) {
    const last = chosen[chosen.length - 1];
    truncatedAfter = last?.data.scheduledLocal?.slice(0, 10) ?? null;
    if (last) {
      chosen.push(
        make('keepalive', 'horizonte', new Date(last.fireAt.getTime() + 5 * 60_000), 'Abra o Cuidar', 'Abra o app para continuar recebendo os lembretes dos próximos dias.', {}, {
          category: null,
          channel: CHANNEL_GENERAL,
          delivery: 'bestEffort',
        }),
      );
    }
  }
  const remaining = input.maxPending - chosen.length;
  const extras = [...restock, ...followups].slice(0, Math.max(0, remaining));

  return { notifications: [...chosen, ...extras].sort(byTime), truncatedAfter };
}
