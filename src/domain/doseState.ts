import type { DoseEvent } from './types';

/**
 * Estado de uma dose, derivado APENAS dos eventos registrados.
 *
 * - pending: horário ainda não chegou
 * - due: horário chegou, aguardando registro
 * - snoozed: lembrete adiado (a dose continua no horário-base)
 * - unconfirmed: passou o intervalo e não houve registro. NÃO significa que a
 *   pessoa deixou de tomar — apenas que não confirmou.
 * - taken / skipped: registro explícito do usuário
 * - conflict: registros divergentes (ex.: dois aparelhos offline) aguardando
 *   decisão do usuário. Nunca resolvido silenciosamente.
 *
 * Não existe caminho que produza `taken` sem um evento `taken` do usuário.
 */
export type DoseStatus = 'pending' | 'due' | 'snoozed' | 'unconfirmed' | 'taken' | 'skipped' | 'conflict';

export interface ResolvedDose {
  status: DoseStatus;
  /** Evento que determina o estado atual (taken/skipped), se houver. */
  headEvent: DoseEvent | null;
  /** Quantidade a descontar do estoque. Sempre 0 exceto em `taken`, e conta uma única vez. */
  consumedQuantity: number;
  /** Instante em que a dose foi confirmada (para o estoque). */
  consumedAt: string | null;
  snoozeUntil: string | null;
  conflictingEvents: DoseEvent[];
  events: DoseEvent[];
}

export interface ResolveOptions {
  /** Minutos após o horário programado para considerar "não confirmada". */
  unconfirmedAfterMinutes: number;
}

const TERMINAL = new Set(['taken', 'skipped', 'reset']);

function byRecorded(a: DoseEvent, b: DoseEvent) {
  return a.recordedAt === b.recordedAt ? a.id.localeCompare(b.id) : a.recordedAt.localeCompare(b.recordedAt);
}

/**
 * "Cabeças" = eventos terminais que nenhum outro evento corrigiu.
 * Em um único aparelho sempre há no máximo uma cabeça, porque toda alteração
 * de um registro existente é feita como correção (correctsEventId).
 */
export function headEvents(events: DoseEvent[]): DoseEvent[] {
  const superseded = new Set(events.map((e) => e.correctsEventId).filter((id): id is string => id !== null));
  return events.filter((e) => TERMINAL.has(e.type) && !superseded.has(e.id)).sort(byRecorded);
}

export function resolveDose(events: DoseEvent[], scheduledAt: Date, now: Date, opts: ResolveOptions): ResolvedDose {
  const sorted = [...events].sort(byRecorded);
  const heads = headEvents(sorted).filter((e) => e.type !== 'reset');
  const base: ResolvedDose = {
    status: 'pending',
    headEvent: null,
    consumedQuantity: 0,
    consumedAt: null,
    snoozeUntil: null,
    conflictingEvents: [],
    events: sorted,
  };

  if (heads.length > 0) {
    const types = new Set(heads.map((h) => h.type));
    if (types.size > 1) {
      // Divergência real (ex.: "tomei" em um aparelho e "não tomei" em outro).
      // Não desconta estoque até o usuário decidir.
      return { ...base, status: 'conflict', conflictingEvents: heads };
    }
    // Registros iguais duplicados (ex.: os dois aparelhos marcaram "tomei"):
    // vale o primeiro, e o consumo é contado uma única vez.
    const head = heads[0]!;
    if (head.type === 'taken') {
      return { ...base, status: 'taken', headEvent: head, consumedQuantity: head.quantity, consumedAt: head.recordedAt };
    }
    return { ...base, status: 'skipped', headEvent: head };
  }

  // Sem registro terminal vigente: considera adiamentos posteriores à última correção.
  const lastReset = [...sorted].reverse().find((e) => e.type === 'reset');
  const snoozes = sorted.filter((e) => e.type === 'snoozed' && (!lastReset || e.recordedAt >= lastReset.recordedAt));
  const lastSnooze = snoozes[snoozes.length - 1];
  if (lastSnooze?.snoozeUntil && new Date(lastSnooze.snoozeUntil) > now) {
    return { ...base, status: 'snoozed', snoozeUntil: lastSnooze.snoozeUntil };
  }

  const unconfirmedAt = scheduledAt.getTime() + opts.unconfirmedAfterMinutes * 60_000;
  if (now.getTime() >= unconfirmedAt) return { ...base, status: 'unconfirmed' };
  if (now.getTime() >= scheduledAt.getTime()) return { ...base, status: 'due' };
  return base;
}

export const STATUS_LABEL: Record<DoseStatus, string> = {
  pending: 'Programada',
  due: 'Na hora',
  snoozed: 'Adiada',
  unconfirmed: 'Não confirmada',
  taken: 'Tomada',
  skipped: 'Não tomada',
  conflict: 'Registros divergentes',
};

/** Estados em que o usuário ainda pode registrar "Tomei" / "Não tomei" sem correção. */
export function isOpen(status: DoseStatus): boolean {
  return status === 'pending' || status === 'due' || status === 'snoozed' || status === 'unconfirmed';
}
