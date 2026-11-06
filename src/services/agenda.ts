import { resolveDose, type ResolvedDose } from '@/domain/doseState';
import { occurrencesBetween, type MedicationPlan } from '@/domain/schedule';
import { currentStock, forecastDepletion, FORECAST_HORIZON_DAYS, restockAlertDate, restockLevel, type DepletionForecast, type RestockLevel } from '@/domain/stock';
import { addDays, localDateTimeToDate, type LocalDate } from '@/domain/time';
import type { DoseEvent, DoseOccurrence, Medication } from '@/domain/types';
import type { Repositories } from '@/data/repositories';

export interface AgendaDose {
  occurrence: DoseOccurrence;
  medication: Medication;
  scheduledAt: Date;
  resolved: ResolvedDose;
  /** Dose que tem registro mas não está mais na programação (ex.: horário removido depois). */
  orphan: boolean;
}

export interface StockSummary {
  medication: Medication;
  stock: number | null;
  forecast: DepletionForecast | null;
  level: RestockLevel;
  alertOn: LocalDate | null;
}

function groupByKey(events: DoseEvent[]) {
  const map = new Map<string, DoseEvent[]>();
  for (const e of events) {
    const list = map.get(e.doseKey);
    if (list) list.push(e);
    else map.set(e.doseKey, [e]);
  }
  return map;
}

export function createAgenda(repos: Repositories) {
  const { clock } = repos;

  async function dosesForRange(from: LocalDate, to: LocalDate): Promise<AgendaDose[]> {
    const [plans, events, settings] = await Promise.all([
      repos.medications.plans({ includeArchived: true }),
      repos.doses.eventsBetween(`${from}T00:00`, `${addDays(to, 1)}T00:00`),
      repos.settings.get(),
    ]);
    const tz = clock.timeZone();
    const now = clock.now();
    const byKey = groupByKey(events);
    const meds = new Map(plans.map((p) => [p.medication.id, p.medication]));
    const occs = plans.flatMap((p) => occurrencesBetween(p, from, to));
    const known = new Set(occs.map((o) => o.doseKey));

    const orphans: DoseOccurrence[] = [];
    for (const [key, evs] of byKey) {
      if (known.has(key) || !meds.has(evs[0]!.medicationId)) continue;
      const e = evs[0]!;
      orphans.push({ doseKey: key, medicationId: e.medicationId, scheduleId: e.scheduleId, localDateTime: e.scheduledLocal, quantity: e.quantity || 1 });
    }

    return [...occs.map((o) => [o, false] as const), ...orphans.map((o) => [o, true] as const)]
      .map(([occurrence, orphan]) => {
        const scheduledAt = localDateTimeToDate(occurrence.localDateTime, tz);
        return {
          occurrence,
          medication: meds.get(occurrence.medicationId)!,
          scheduledAt,
          orphan,
          resolved: resolveDose(byKey.get(occurrence.doseKey) ?? [], scheduledAt, now, {
            unconfirmedAfterMinutes: settings.unconfirmedAfterMinutes,
          }),
        };
      })
      .sort((a, b) => a.occurrence.localDateTime.localeCompare(b.occurrence.localDateTime) || a.medication.name.localeCompare(b.medication.name));
  }

  async function stockFor(plan: MedicationPlan): Promise<StockSummary> {
    const medication = plan.medication;
    const [entries, events] = await Promise.all([repos.stock.entries(medication.id), repos.doses.eventsForMedication(medication.id)]);
    const now = clock.now();
    const byKey = groupByKey(events);
    const resolvedByKey = new Map<string, ResolvedDose>();
    for (const [key, evs] of byKey) {
      // O consumo independe do horário: só importa o registro vigente.
      resolvedByKey.set(key, resolveDose(evs, new Date(0), now, { unconfirmedAfterMinutes: 0 }));
    }
    const consumptions = [...resolvedByKey.values()]
      .filter((r) => r.consumedQuantity > 0)
      .map((r) => ({ quantity: r.consumedQuantity, at: r.consumedAt! }));
    const stock = currentStock(entries, consumptions);
    if (stock === null) return { medication, stock: null, forecast: null, level: 'untracked', alertOn: null };

    const today = clock.today();
    const future = occurrencesBetween(plan, today, addDays(today, FORECAST_HORIZON_DAYS)).filter((o) => {
      const r = resolvedByKey.get(o.doseKey);
      return !r || (r.status !== 'taken' && r.status !== 'skipped');
    });
    const forecast = forecastDepletion(stock, future.map((o) => ({ localDateTime: o.localDateTime, quantity: o.quantity })));
    return {
      medication,
      stock,
      forecast,
      level: restockLevel(stock, forecast, today, medication.restockLeadDays),
      alertOn: restockAlertDate(forecast, medication.restockLeadDays),
    };
  }

  return {
    dosesForRange,
    day: (date: LocalDate) => dosesForRange(date, date),
    today: () => dosesForRange(clock.today(), clock.today()),

    /** Histórico dos últimos `days` dias, mais recente primeiro, só doses cujo horário já passou ou com registro. */
    async history(days = 14, medicationId?: string): Promise<AgendaDose[]> {
      const today = clock.today();
      const now = clock.now();
      const all = await dosesForRange(addDays(today, -(days - 1)), today);
      return all
        .filter((d) => (!medicationId || d.medication.id === medicationId) && (d.scheduledAt <= now || d.resolved.events.length > 0))
        .reverse();
    },

    async stock(medicationId: string): Promise<StockSummary | null> {
      const plan = await repos.medications.plan(medicationId);
      return plan ? stockFor(plan) : null;
    },

    async stockOverview(): Promise<StockSummary[]> {
      const plans = await repos.medications.plans();
      return Promise.all(plans.map(stockFor));
    },
  };
}

export type Agenda = ReturnType<typeof createAgenda>;
