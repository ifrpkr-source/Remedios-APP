/** Dados sintéticos para testes. Nenhum dado real de paciente. */
import type { DoseEvent, Medication, ScheduleVersion } from '@/domain/types';

let seq = 0;
export const id = (p = 'id') => `${p}-${++seq}`;

export function med(over: Partial<Medication> = {}): Medication {
  return {
    id: 'med-a',
    name: 'Remédio Teste A',
    strength: '10 mg',
    form: 'comprimido',
    unitLabel: 'comprimido',
    notes: null,
    archivedAt: null,
    restockLeadDays: 7,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    ...over,
  };
}

export function version(over: Partial<ScheduleVersion> = {}): ScheduleVersion {
  return {
    id: id('v'),
    medicationId: 'med-a',
    effectiveFrom: '2026-11-01T00:00',
    times: [{ time: '08:00', quantity: 1 }, { time: '20:00', quantity: 1 }],
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startDate: '2026-11-01',
    endDate: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    ...over,
  };
}

export function event(over: Partial<DoseEvent> = {}): DoseEvent {
  return {
    id: id('ev'),
    doseKey: 'med-a@2026-11-06T08:00',
    medicationId: 'med-a',
    scheduleId: 'v-1',
    scheduledLocal: '2026-11-06T08:00',
    scheduledAt: '2026-11-06T11:00:00.000Z',
    type: 'taken',
    quantity: 1,
    snoozeUntil: null,
    correctsEventId: null,
    recordedAt: '2026-11-06T11:02:00.000Z',
    tzOffsetMin: -180,
    deviceId: 'device-1',
    note: null,
    ...over,
  };
}
