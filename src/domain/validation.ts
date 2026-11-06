import { isLocalDate, isLocalTime } from './time';
import type { MedicationInput } from './types';

export type FieldErrors = Partial<Record<'name' | 'times' | 'daysOfWeek' | 'startDate' | 'endDate' | 'initialStock' | 'restockLeadDays', string>>;

/**
 * Validação puramente estrutural. O app NÃO avalia se doses, horários ou
 * combinações são clinicamente adequados — apenas registra o que o usuário informou.
 */
export function validateMedicationInput(input: MedicationInput): FieldErrors {
  const errors: FieldErrors = {};
  if (input.name.trim().length === 0) errors.name = 'Informe o nome do medicamento.';
  else if (input.name.trim().length > 120) errors.name = 'Nome muito longo (máx. 120 caracteres).';

  if (input.times.length === 0) errors.times = 'Adicione pelo menos um horário.';
  else if (input.times.some((t) => !isLocalTime(t.time))) errors.times = 'Use horários no formato HH:MM.';
  else if (new Set(input.times.map((t) => t.time)).size !== input.times.length) errors.times = 'Há horários repetidos.';
  else if (input.times.some((t) => !(t.quantity > 0) || t.quantity > 1000)) errors.times = 'A quantidade por tomada deve ser maior que zero.';

  if (input.daysOfWeek.length === 0) errors.daysOfWeek = 'Escolha pelo menos um dia da semana.';
  else if (input.daysOfWeek.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) errors.daysOfWeek = 'Dia da semana inválido.';

  if (!isLocalDate(input.startDate)) errors.startDate = 'Data de início inválida (use dd/mm/aaaa).';
  if (input.endDate !== null) {
    if (!isLocalDate(input.endDate)) errors.endDate = 'Data de término inválida (use dd/mm/aaaa).';
    else if (isLocalDate(input.startDate) && input.endDate < input.startDate) errors.endDate = 'O término deve ser depois do início.';
  }

  if (input.initialStock !== null && (!(input.initialStock >= 0) || input.initialStock > 100000)) {
    errors.initialStock = 'Informe uma quantidade válida.';
  }
  if (!Number.isInteger(input.restockLeadDays) || input.restockLeadDays < 0 || input.restockLeadDays > 90) {
    errors.restockLeadDays = 'Use de 0 a 90 dias.';
  }
  return errors;
}

/** Aceita "1", "0,5", "1.5". */
export function parseQuantity(s: string): number | null {
  const v = Number(s.trim().replace(',', '.'));
  return Number.isFinite(v) && s.trim() !== '' ? v : null;
}
