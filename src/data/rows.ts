import type { DoseEvent, Medication, Pause, ScheduleVersion, StockEntry } from '@/domain/types';

export interface MedicationRow {
  id: string;
  name: string;
  strength: string | null;
  form: string | null;
  unit_label: string;
  notes: string | null;
  archived_at: string | null;
  restock_lead_days: number;
  created_at: string;
  updated_at: string;
}

export const toMedication = (r: MedicationRow): Medication => ({
  id: r.id,
  name: r.name,
  strength: r.strength,
  form: r.form,
  unitLabel: r.unit_label,
  notes: r.notes,
  archivedAt: r.archived_at,
  restockLeadDays: r.restock_lead_days,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface ScheduleRow {
  id: string;
  medication_id: string;
  effective_from: string;
  times_json: string;
  days_json: string;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export const toSchedule = (r: ScheduleRow): ScheduleVersion => ({
  id: r.id,
  medicationId: r.medication_id,
  effectiveFrom: r.effective_from,
  times: JSON.parse(r.times_json),
  daysOfWeek: JSON.parse(r.days_json),
  startDate: r.start_date,
  endDate: r.end_date,
  createdAt: r.created_at,
});

export interface PauseRow {
  id: string;
  medication_id: string;
  start_at: string;
  end_at: string | null;
}

export const toPause = (r: PauseRow): Pause => ({ id: r.id, medicationId: r.medication_id, startAt: r.start_at, endAt: r.end_at });

export interface DoseEventRow {
  id: string;
  dose_key: string;
  medication_id: string;
  schedule_id: string;
  scheduled_local: string;
  scheduled_at: string;
  type: DoseEvent['type'];
  quantity: number;
  snooze_until: string | null;
  corrects_event_id: string | null;
  recorded_at: string;
  tz_offset_min: number;
  device_id: string;
  note: string | null;
}

export const toEvent = (r: DoseEventRow): DoseEvent => ({
  id: r.id,
  doseKey: r.dose_key,
  medicationId: r.medication_id,
  scheduleId: r.schedule_id,
  scheduledLocal: r.scheduled_local,
  scheduledAt: r.scheduled_at,
  type: r.type,
  quantity: r.quantity,
  snoozeUntil: r.snooze_until,
  correctsEventId: r.corrects_event_id,
  recordedAt: r.recorded_at,
  tzOffsetMin: r.tz_offset_min,
  deviceId: r.device_id,
  note: r.note,
});

export interface StockRow {
  id: string;
  medication_id: string;
  kind: StockEntry['kind'];
  amount: number;
  recorded_at: string;
  note: string | null;
}

export const toStock = (r: StockRow): StockEntry => ({
  id: r.id,
  medicationId: r.medication_id,
  kind: r.kind,
  amount: r.amount,
  recordedAt: r.recorded_at,
  note: r.note,
});
