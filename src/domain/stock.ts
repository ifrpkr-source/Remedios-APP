import { addDays, daysBetween, datePart, type LocalDate, type LocalDateTime } from './time';
import type { StockEntry } from './types';

/**
 * Estoque é DERIVADO, nunca decrementado em um contador:
 *
 *   estoque = última contagem (set) + entradas (add) depois dela
 *             − doses confirmadas depois dela
 *
 * Como cada dose resolvida contribui no máximo uma vez (ver doseState), uma
 * dose não pode ser descontada duas vezes, e corrigir um registro ajusta o
 * estoque automaticamente, sem lançamentos de estorno.
 */
export interface Consumption {
  quantity: number;
  /** ISO do momento da confirmação. */
  at: string;
}

export function currentStock(entries: StockEntry[], consumptions: Consumption[]): number | null {
  if (entries.length === 0) return null;
  // No mesmo instante, a contagem (set) vem antes da entrada (add): a entrada nunca é perdida.
  const kindOrder = (k: StockEntry['kind']) => (k === 'set' ? 0 : 1);
  const sorted = [...entries].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || kindOrder(a.kind) - kindOrder(b.kind));
  let baselineIdx = -1;
  sorted.forEach((e, i) => {
    if (e.kind === 'set') baselineIdx = i;
  });
  const baseline = baselineIdx >= 0 ? sorted[baselineIdx]! : null;
  const since = baseline?.recordedAt ?? '';
  let total = baseline?.amount ?? 0;
  for (const e of sorted.slice(baselineIdx + 1)) if (e.kind === 'add') total += e.amount;
  // Confirmações no mesmo instante da contagem também contam (a contagem vem antes).
  for (const c of consumptions) if (c.at >= since) total -= c.quantity;
  return round(total);
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export interface FutureDose {
  localDateTime: LocalDateTime;
  quantity: number;
}

export interface DepletionForecast {
  /** Data da primeira dose que o estoque não cobre; null se cobre todo o horizonte. */
  runsOutOn: LocalDate | null;
  /** Última data com dose totalmente coberta. */
  coveredUntil: LocalDate | null;
  dosesCovered: number;
  /** true quando não há mais doses programadas no horizonte (ex.: tratamento com data de término). */
  noFutureDoses: boolean;
}

/**
 * Simula as próximas doses programadas (já respeitando pausas, versões e
 * quantidades variáveis — quem gera a lista é a agenda) até o estoque acabar.
 */
export function forecastDepletion(stock: number, futureDoses: FutureDose[]): DepletionForecast {
  const doses = [...futureDoses].sort((a, b) => a.localDateTime.localeCompare(b.localDateTime));
  let remaining = stock;
  let covered = 0;
  let coveredUntil: LocalDate | null = null;
  for (const d of doses) {
    if (remaining + 1e-9 < d.quantity) {
      return { runsOutOn: datePart(d.localDateTime), coveredUntil, dosesCovered: covered, noFutureDoses: false };
    }
    remaining -= d.quantity;
    covered++;
    coveredUntil = datePart(d.localDateTime);
  }
  return { runsOutOn: null, coveredUntil, dosesCovered: covered, noFutureDoses: doses.length === 0 };
}

export type RestockLevel = 'ok' | 'soon' | 'out' | 'untracked';

export function restockLevel(stock: number | null, forecast: DepletionForecast | null, today: LocalDate, leadDays: number): RestockLevel {
  if (stock === null || forecast === null) return 'untracked';
  if (forecast.runsOutOn === null) return 'ok';
  const days = daysBetween(today, forecast.runsOutOn);
  if (days <= 0) return 'out';
  return days <= leadDays ? 'soon' : 'ok';
}

/** Data em que o aviso de reposição deve disparar. */
export function restockAlertDate(forecast: DepletionForecast, leadDays: number): LocalDate | null {
  return forecast.runsOutOn ? addDays(forecast.runsOutOn, -leadDays) : null;
}

export const FORECAST_HORIZON_DAYS = 180;
