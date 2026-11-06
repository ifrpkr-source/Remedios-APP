/**
 * Utilitários de data/hora "de parede" (wall clock).
 *
 * A agenda de medicamentos segue o relógio local do usuário: "08:00" significa
 * 08:00 no fuso em que o aparelho estiver. Por isso a agenda é guardada como
 * strings locais e só é convertida para um instante absoluto (Date) na hora de
 * agendar notificações ou comparar com "agora".
 *
 *   LocalDate      "2026-11-06"
 *   LocalTime      "08:00"
 *   LocalDateTime  "2026-11-06T08:00"
 *
 * Strings neste formato são ordenáveis lexicograficamente.
 */

export type LocalDate = string;
export type LocalTime = string;
export type LocalDateTime = string;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const LDT_RE = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;

const pad = (n: number) => String(n).padStart(2, '0');

function dateToUtcMs(d: LocalDate): number {
  const m = DATE_RE.exec(d);
  if (!m) throw new Error(`LocalDate inválido: ${d}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function isLocalDate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isLocalTime(s: string): boolean {
  return TIME_RE.test(s);
}

/** Normaliza entradas como "8:5", "8h", "0800", "8" para "HH:mm". Retorna null se inválido. */
export function normalizeTime(input: string): LocalTime | null {
  const s = input.trim().toLowerCase().replace('h', ':');
  let h: number;
  let m: number;
  const colon = /^(\d{1,2}):(\d{0,2})$/.exec(s);
  const compact = /^(\d{3,4})$/.exec(s);
  if (colon) {
    h = Number(colon[1]);
    m = colon[2] === '' ? 0 : Number(colon[2]);
  } else if (compact) {
    const v = compact[1]!.padStart(4, '0');
    h = Number(v.slice(0, 2));
    m = Number(v.slice(2));
  } else if (/^\d{1,2}$/.test(s)) {
    h = Number(s);
    m = 0;
  } else {
    return null;
  }
  if (h > 23 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}

/** Converte "dd/mm/aaaa" em LocalDate. */
export function parseBrDate(input: string): LocalDate | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim());
  if (!m) return null;
  const iso = `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return isLocalDate(iso) ? iso : null;
}

export function formatBrDate(d: LocalDate): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export function toLocalDate(date: Date): LocalDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toLocalDateTime(date: Date): LocalDateTime {
  return `${toLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Fuso IANA atual do dispositivo (ex.: "America/Sao_Paulo"). */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function wallClockParts(instantMs: number, timeZone: string) {
  let f = fmtCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    fmtCache.set(timeZone, f);
  }
  const parts = f.formatToParts(new Date(instantMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour') % 24, mi: get('minute') };
}

/** Horário de parede de um instante em um fuso específico. */
export function toLocalDateTimeInZone(date: Date, timeZone: string): LocalDateTime {
  if (timeZone === deviceTimeZone()) return toLocalDateTime(date);
  const p = wallClockParts(date.getTime(), timeZone);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/**
 * Converte um horário de parede no instante absoluto correspondente.
 * Sem `timeZone`, usa o fuso atual do dispositivo.
 * - Horário inexistente (início do horário de verão): empurrado para frente.
 * - Horário ambíguo (fim do horário de verão): primeira ocorrência.
 */
export function localDateTimeToDate(ldt: LocalDateTime, timeZone?: string): Date {
  const m = LDT_RE.exec(ldt);
  if (!m) throw new Error(`LocalDateTime inválido: ${ldt}`);
  const [y, mo, d, h, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
  // Fuso do próprio aparelho: usa o Date nativo (não depende de suporte a Intl/timeZone).
  if (!timeZone || timeZone === deviceTimeZone()) return new Date(y, mo - 1, d, h, mi, 0, 0);

  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offsetAt = (t: number) => {
    const p = wallClockParts(t, timeZone);
    return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - Math.floor(t / 60_000) * 60_000;
  };
  const t1 = guess - offsetAt(guess);
  const t2 = guess - offsetAt(t1);
  const candidates = [...new Set([t1, t2])];
  const valid = candidates.filter((t) => toLocalDateTimeInZone(new Date(t), timeZone) === ldt);
  return new Date(valid.length > 0 ? Math.min(...valid) : Math.max(...candidates));
}

export function addDays(d: LocalDate, days: number): LocalDate {
  const dt = new Date(dateToUtcMs(d) + days * 86_400_000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** 0 = domingo … 6 = sábado. Independe do fuso. */
export function dayOfWeek(d: LocalDate): number {
  return new Date(dateToUtcMs(d)).getUTCDay();
}

export function datePart(ldt: LocalDateTime): LocalDate {
  return ldt.slice(0, 10);
}

export function timePart(ldt: LocalDateTime): LocalTime {
  return ldt.slice(11, 16);
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((dateToUtcMs(to) - dateToUtcMs(from)) / 86_400_000);
}

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
export const WEEKDAY_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'] as const;
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function formatLongDate(d: LocalDate): string {
  const [, m, day] = d.split('-').map(Number) as [number, number, number];
  return `${WEEKDAY_LONG[dayOfWeek(d)]}, ${day} de ${MONTHS[m - 1]}`;
}
