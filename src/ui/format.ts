import { formatBrDate, WEEKDAY_SHORT } from '@/domain/time';
import type { ScheduleVersion } from '@/domain/types';

export function daysSummary(days: number[]): string {
  if (days.length === 7) return 'todos os dias';
  const set = [...days].sort();
  if (set.join() === '1,2,3,4,5') return 'segunda a sexta';
  if (set.join() === '0,6') return 'fins de semana';
  return set.map((d) => WEEKDAY_SHORT[d]).join(', ');
}

export const fmtQty = (n: number) => String(n).replace('.', ',');

export function scheduleSummary(v: Pick<ScheduleVersion, 'times' | 'daysOfWeek' | 'endDate'>): string {
  const times = v.times.map((t) => (t.quantity === 1 ? t.time : `${t.time} (${fmtQty(t.quantity)})`)).join(', ');
  return `${times} · ${daysSummary(v.daysOfWeek)}${v.endDate ? ` · até ${formatBrDate(v.endDate)}` : ''}`;
}

function plural(unit: string): string {
  if (unit === 'ml' || unit.endsWith('s')) return unit;
  if (unit.endsWith('ção')) return `${unit.slice(0, -3)}ções`;
  return `${unit}s`;
}

/** "1 comprimido", "0,5 comprimido", "2 comprimidos", "10 ml". */
export function unitPlural(n: number, unit: string) {
  return `${fmtQty(n)} ${Math.abs(n) <= 1 ? unit : plural(unit)}`;
}

export const FORMS = [
  { form: 'comprimido', unit: 'comprimido', label: 'Comprimido' },
  { form: 'cápsula', unit: 'cápsula', label: 'Cápsula' },
  { form: 'gotas', unit: 'gota', label: 'Gotas' },
  { form: 'líquido', unit: 'ml', label: 'Líquido (ml)' },
  { form: 'sachê', unit: 'sachê', label: 'Sachê' },
  { form: 'injetável', unit: 'aplicação', label: 'Injetável' },
  { form: 'inalatório', unit: 'jato', label: 'Inalatório' },
  { form: 'outro', unit: 'unidade', label: 'Outro' },
] as const;
