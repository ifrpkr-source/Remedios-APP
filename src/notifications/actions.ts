import { isOpen } from '@/domain/doseState';
import { datePart } from '@/domain/time';
import { DoseAlreadyRecordedError, type Repositories } from '@/data/repositories';
import type { Agenda } from '@/services/agenda';
import { ACTION, type NotificationData } from './types';

export type ResponseOutcome =
  | 'recorded-taken'
  | 'snoozed'
  | 'opened'
  | 'already-resolved'
  | 'not-scheduled'
  | 'duplicate'
  | 'ignored';

export interface IncomingResponse {
  /** Identidade única do toque (notificação + ação + instante de entrega). */
  responseId: string;
  actionId: string;
  data: Partial<NotificationData> | undefined;
}

export interface ResponseResult {
  outcome: ResponseOutcome;
  doseKey?: string;
  /** Rota a abrir quando a ação trouxe o app para frente. */
  route?: string;
}

const SNOOZE: Record<string, 10 | 15 | 30> = { [ACTION.snooze10]: 10, [ACTION.snooze15]: 15, [ACTION.snooze30]: 30 };

export const doseRoute = (doseKey: string) => `/dose/${encodeURIComponent(doseKey)}`;

/**
 * Processa um toque em notificação usando EXATAMENTE as mesmas operações da
 * tela Hoje (repos.doses.markTaken / snooze). Regras de segurança:
 *
 * - Cada resposta é processada uma única vez (tabela notification_responses).
 * - A dose é localizada na programação ATUAL, nunca a partir do conteúdo da
 *   notificação: um alerta antigo de dose pausada, arquivada ou com horário
 *   alterado não registra nada.
 * - Se a dose já tem registro, o toque é ignorado (não sobrescreve, não desconta de novo).
 */
export async function handleNotificationResponse(deps: { repos: Repositories; agenda: Agenda }, r: IncomingResponse): Promise<ResponseResult> {
  const { repos, agenda } = deps;
  const data = r.data;
  const doseKey = data?.doseKey;

  if (await repos.notificationResponses.wasProcessed(r.responseId)) return { outcome: 'duplicate', doseKey };

  const finish = async (res: ResponseResult): Promise<ResponseResult> => {
    const fresh = await repos.notificationResponses.record(r.responseId, r.actionId, doseKey ?? null, res.outcome);
    return fresh ? res : { outcome: 'duplicate', doseKey };
  };

  if (data?.app !== 'cuidar') return { outcome: 'ignored' };
  if (!doseKey || !data.scheduledLocal) {
    // Reposição / aviso de horizonte: apenas abre o app.
    return finish({ outcome: 'opened', route: data.kind === 'restock' ? '/estoque' : '/' });
  }

  const day = await agenda.day(datePart(data.scheduledLocal));
  const dose = day.find((d) => d.occurrence.doseKey === doseKey && !d.orphan);
  const isSnooze = r.actionId in SNOOZE;
  const isTaken = r.actionId === ACTION.taken;

  if (!isSnooze && !isTaken) return finish({ outcome: 'opened', doseKey, route: doseRoute(doseKey) });
  if (!dose) return finish({ outcome: 'not-scheduled', doseKey, route: '/' });
  if (!isOpen(dose.resolved.status)) return finish({ outcome: 'already-resolved', doseKey, route: doseRoute(doseKey) });

  try {
    if (isTaken) {
      await repos.doses.markTaken(dose.occurrence);
      return finish({ outcome: 'recorded-taken', doseKey, route: doseRoute(doseKey) });
    }
    await repos.doses.snooze(dose.occurrence, SNOOZE[r.actionId]!);
    return finish({ outcome: 'snoozed', doseKey, route: doseRoute(doseKey) });
  } catch (e) {
    if (e instanceof DoseAlreadyRecordedError) return finish({ outcome: 'already-resolved', doseKey, route: doseRoute(doseKey) });
    throw e;
  }
}

export const OUTCOME_MESSAGE: Record<ResponseOutcome, string | null> = {
  'recorded-taken': 'Dose registrada como tomada.',
  snoozed: 'Lembrete adiado. O horário da dose não mudou.',
  opened: null,
  'already-resolved': 'Esta dose já tinha um registro. Nada foi alterado.',
  'not-scheduled': 'Este lembrete é de uma dose que não está mais programada. Nada foi registrado.',
  duplicate: null,
  ignored: null,
};
