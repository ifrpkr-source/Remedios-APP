import { currentStock, forecastDepletion, restockAlertDate, restockLevel } from '../stock';
import { occurrencesBetween } from '../schedule';
import { med, version } from '@/test/fixtures';
import type { StockEntry } from '../types';

const entry = (over: Partial<StockEntry>): StockEntry => ({
  id: Math.random().toString(36),
  medicationId: 'med-a',
  kind: 'set',
  amount: 30,
  recordedAt: '2026-11-01T10:00:00.000Z',
  note: null,
  ...over,
});

describe('estoque', () => {
  it('sem lançamentos o estoque não é controlado', () => {
    expect(currentStock([], [])).toBeNull();
  });

  it('desconta apenas consumos confirmados após a última contagem e soma entradas', () => {
    const entries = [
      entry({ amount: 30 }),
      entry({ kind: 'add', amount: 10, recordedAt: '2026-11-03T10:00:00.000Z' }),
    ];
    const consumed = [
      { quantity: 1, at: '2026-10-31T11:00:00.000Z' }, // antes da contagem: ignorado
      { quantity: 1, at: '2026-11-02T11:00:00.000Z' },
      { quantity: 0.5, at: '2026-11-04T11:00:00.000Z' },
    ];
    expect(currentStock(entries, consumed)).toBe(38.5);
  });

  it('contagem e entrada no mesmo instante: a entrada nunca é perdida, em qualquer ordem', () => {
    const at = '2026-11-06T10:00:00.000Z';
    const set = entry({ amount: 4, recordedAt: at });
    const add = entry({ kind: 'add', amount: 30, recordedAt: at });
    expect(currentStock([set, add], [])).toBe(34);
    expect(currentStock([add, set], [])).toBe(34);
  });

  it('nova contagem (set) substitui o saldo anterior', () => {
    const entries = [entry({ amount: 30 }), entry({ amount: 12, recordedAt: '2026-11-05T10:00:00.000Z' })];
    expect(currentStock(entries, [{ quantity: 1, at: '2026-11-04T11:00:00.000Z' }])).toBe(12);
  });

  it('previsão respeita quantidades variáveis', () => {
    const plan = {
      medication: med(),
      versions: [version({ times: [{ time: '08:00', quantity: 2 }, { time: '20:00', quantity: 1 }] })],
      pauses: [],
    };
    const future = occurrencesBetween(plan, '2026-11-06', '2026-12-31');
    const f = forecastDepletion(10, future);
    // 3 por dia: 06,07,08 cobertos (9), 09/11 08:00 precisa de 2 e só resta 1.
    expect(f.runsOutOn).toBe('2026-11-09');
    expect(f.coveredUntil).toBe('2026-11-08');
  });

  it('previsão respeita pausas e término', () => {
    const plan = {
      medication: med(),
      versions: [version({ endDate: '2026-11-10' })],
      pauses: [{ id: 'p', medicationId: 'med-a', startAt: '2026-11-07T00:00', endAt: '2026-11-09T00:00' }],
    };
    const future = occurrencesBetween(plan, '2026-11-06', '2026-12-31');
    // 06, 09 e 10 → 6 doses
    expect(future).toHaveLength(6);
    expect(forecastDepletion(10, future).runsOutOn).toBeNull();
    expect(forecastDepletion(0, []).noFutureDoses).toBe(true);
  });

  it('aviso de reposição com antecedência', () => {
    const f = { runsOutOn: '2026-11-12', coveredUntil: '2026-11-11', dosesCovered: 10, noFutureDoses: false };
    expect(restockLevel(10, f, '2026-11-06', 7)).toBe('soon');
    expect(restockLevel(10, f, '2026-11-06', 3)).toBe('ok');
    expect(restockLevel(0, { ...f, runsOutOn: '2026-11-06' }, '2026-11-06', 3)).toBe('out');
    expect(restockAlertDate(f, 7)).toBe('2026-11-05');
  });
});
