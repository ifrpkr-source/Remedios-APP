import { addDays, datePart, dayOfWeek, type LocalDate, type LocalDateTime } from './time';
import type { DoseOccurrence, Medication, Pause, ScheduleVersion } from './types';

export function makeDoseKey(medicationId: string, ldt: LocalDateTime): string {
  return `${medicationId}@${ldt}`;
}

function sortVersions(versions: ScheduleVersion[]): ScheduleVersion[] {
  return [...versions].sort((a, b) =>
    a.effectiveFrom === b.effectiveFrom ? a.createdAt.localeCompare(b.createdAt) : a.effectiveFrom.localeCompare(b.effectiveFrom),
  );
}

/** Versão da programação vigente em um horário local (a mais recente com effectiveFrom <= ldt). */
export function activeVersionAt(versions: ScheduleVersion[], ldt: LocalDateTime): ScheduleVersion | undefined {
  let current: ScheduleVersion | undefined;
  for (const v of sortVersions(versions)) {
    if (v.effectiveFrom <= ldt) current = v;
    else break;
  }
  return current;
}

export function isPausedAt(pauses: Pause[], ldt: LocalDateTime): boolean {
  return pauses.some((p) => p.startAt <= ldt && (p.endAt === null || ldt < p.endAt));
}

export function isPausedNow(pauses: Pause[]): boolean {
  return pauses.some((p) => p.endAt === null);
}

export interface MedicationPlan {
  medication: Medication;
  versions: ScheduleVersion[];
  pauses: Pause[];
}

/**
 * Doses previstas para um dia. Cada horário é atribuído à versão vigente
 * naquele horário, então uma edição no meio do dia mantém as doses anteriores
 * na programação antiga e aplica a nova só daí em diante.
 */
export function occurrencesForDate(plan: MedicationPlan, date: LocalDate): DoseOccurrence[] {
  const { medication, versions, pauses } = plan;
  const dow = dayOfWeek(date);
  const out: DoseOccurrence[] = [];
  const seen = new Set<string>();

  for (const version of versions) {
    if (date < version.startDate) continue;
    if (version.endDate !== null && date > version.endDate) continue;
    if (!version.daysOfWeek.includes(dow)) continue;

    for (const dt of version.times) {
      const ldt = `${date}T${dt.time}`;
      if (seen.has(ldt)) continue;
      if (activeVersionAt(versions, ldt)?.id !== version.id) continue;
      if (medication.archivedAt !== null && ldt >= medication.archivedAt) continue;
      if (isPausedAt(pauses, ldt)) continue;
      seen.add(ldt);
      out.push({
        doseKey: makeDoseKey(medication.id, ldt),
        medicationId: medication.id,
        scheduleId: version.id,
        localDateTime: ldt,
        quantity: dt.quantity,
      });
    }
  }
  return out.sort((a, b) => a.localDateTime.localeCompare(b.localDateTime));
}

export function occurrencesBetween(plan: MedicationPlan, from: LocalDate, to: LocalDate): DoseOccurrence[] {
  const out: DoseOccurrence[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(...occurrencesForDate(plan, d));
  return out;
}

/** Data em que a primeira versão passa a valer: nunca gera doses de dias passados. */
export function initialEffectiveFrom(startDate: LocalDate, today: LocalDate): LocalDateTime {
  return `${startDate > today ? startDate : today}T00:00`;
}

export function scheduleChanged(
  a: Pick<ScheduleVersion, 'times' | 'daysOfWeek' | 'startDate' | 'endDate'>,
  b: Pick<ScheduleVersion, 'times' | 'daysOfWeek' | 'startDate' | 'endDate'>,
): boolean {
  const norm = (v: typeof a) =>
    JSON.stringify({
      t: [...v.times].sort((x, y) => x.time.localeCompare(y.time)),
      d: [...v.daysOfWeek].sort(),
      s: v.startDate,
      e: v.endDate,
    });
  return norm(a) !== norm(b);
}

export { datePart };
