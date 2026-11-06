import type { LocalDate, LocalDateTime, LocalTime } from './time';

/** Horário de tomada com quantidade própria (permite quantidades variáveis ao longo do dia). */
export interface DoseTime {
  time: LocalTime;
  /** Quantidade por tomada, conforme informado pelo usuário (ex.: 1, 0.5, 2). */
  quantity: number;
}

export interface Medication {
  id: string;
  name: string;
  /** Concentração exatamente como informada pelo usuário (ex.: "500 mg"). Nunca interpretada. */
  strength: string | null;
  /** Apresentação (ex.: "comprimido", "cápsula", "gotas"). */
  form: string | null;
  /** Rótulo da unidade de estoque (ex.: "comprimido"). */
  unitLabel: string;
  notes: string | null;
  /** Momento local a partir do qual o medicamento foi arquivado. */
  archivedAt: LocalDateTime | null;
  /** Dias de antecedência para avisar sobre reposição. */
  restockLeadDays: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Versão da programação. Editar horários/dias/datas NUNCA altera uma versão
 * existente: cria uma nova com `effectiveFrom` = momento da edição. Assim o
 * histórico continua apontando para a programação que valia na época.
 */
export interface ScheduleVersion {
  id: string;
  medicationId: string;
  effectiveFrom: LocalDateTime;
  times: DoseTime[];
  /** 0 = domingo … 6 = sábado. */
  daysOfWeek: number[];
  startDate: LocalDate;
  endDate: LocalDate | null;
  createdAt: string;
}

export interface Pause {
  id: string;
  medicationId: string;
  startAt: LocalDateTime;
  endAt: LocalDateTime | null;
}

/** Uma dose prevista pela programação (ainda não é um evento). */
export interface DoseOccurrence {
  /** Identidade estável da dose: medicamento + horário local programado. */
  doseKey: string;
  medicationId: string;
  scheduleId: string;
  localDateTime: LocalDateTime;
  quantity: number;
}

/**
 * Eventos de dose são somente-inclusão (append-only).
 * - taken / skipped: registro do usuário
 * - snoozed: adiamento do lembrete (não altera a programação)
 * - reset: correção que devolve a dose para "sem registro"
 * Correções apontam para o evento corrigido via `correctsEventId`.
 */
export type DoseEventType = 'taken' | 'skipped' | 'snoozed' | 'reset';

export interface DoseEvent {
  id: string;
  doseKey: string;
  medicationId: string;
  scheduleId: string;
  scheduledLocal: LocalDateTime;
  /** Instante absoluto (ISO) do horário programado no fuso do momento do registro. */
  scheduledAt: string;
  type: DoseEventType;
  /** Quantidade efetivamente tomada (apenas para `taken`). */
  quantity: number;
  snoozeUntil: string | null;
  correctsEventId: string | null;
  /** Instante absoluto (ISO) em que o usuário registrou. */
  recordedAt: string;
  tzOffsetMin: number;
  deviceId: string;
  note: string | null;
}

export type StockEntryKind = 'set' | 'add';

export interface StockEntry {
  id: string;
  medicationId: string;
  /** set = contagem absoluta; add = entrada de novas unidades. */
  kind: StockEntryKind;
  amount: number;
  recordedAt: string;
  note: string | null;
}

export interface MedicationInput {
  name: string;
  strength: string | null;
  form: string | null;
  unitLabel: string;
  notes: string | null;
  times: DoseTime[];
  daysOfWeek: number[];
  startDate: LocalDate;
  endDate: LocalDate | null;
  restockLeadDays: number;
  /** Estoque inicial opcional. */
  initialStock: number | null;
}
