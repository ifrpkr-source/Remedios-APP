import { resolveDose } from '../doseState';
import { event } from '@/test/fixtures';

const scheduledAt = new Date('2026-11-06T11:00:00.000Z'); // 08:00 em São Paulo
const opts = { unconfirmedAfterMinutes: 60 };
const at = (iso: string) => new Date(iso);

describe('estado da dose', () => {
  it('sem eventos: programada → na hora → não confirmada (nunca "tomada")', () => {
    expect(resolveDose([], scheduledAt, at('2026-11-06T10:00:00Z'), opts).status).toBe('pending');
    expect(resolveDose([], scheduledAt, at('2026-11-06T11:10:00Z'), opts).status).toBe('due');
    const late = resolveDose([], scheduledAt, at('2026-11-07T11:00:00Z'), opts);
    expect(late.status).toBe('unconfirmed');
    expect(late.consumedQuantity).toBe(0);
  });

  it('tomada desconta a quantidade registrada', () => {
    const r = resolveDose([event({ quantity: 2 })], scheduledAt, at('2026-11-06T12:00:00Z'), opts);
    expect(r.status).toBe('taken');
    expect(r.consumedQuantity).toBe(2);
  });

  it('adiar só muda o lembrete; depois do adiamento volta a valer o horário-base', () => {
    const snooze = event({ type: 'snoozed', quantity: 0, snoozeUntil: '2026-11-06T11:15:00.000Z', recordedAt: '2026-11-06T11:05:00.000Z' });
    expect(resolveDose([snooze], scheduledAt, at('2026-11-06T11:10:00Z'), opts).status).toBe('snoozed');
    const after = resolveDose([snooze], scheduledAt, at('2026-11-06T11:20:00Z'), opts);
    expect(after.status).toBe('due');
    // O intervalo de "não confirmada" é contado do horário-base, não do adiamento.
    expect(resolveDose([snooze], scheduledAt, at('2026-11-06T12:01:00Z'), opts).status).toBe('unconfirmed');
  });

  it('adiamento não reabre uma dose já confirmada', () => {
    const taken = event({ recordedAt: '2026-11-06T11:01:00.000Z' });
    const snooze = event({ type: 'snoozed', quantity: 0, snoozeUntil: '2026-11-06T11:30:00.000Z', recordedAt: '2026-11-06T11:02:00.000Z' });
    expect(resolveDose([taken, snooze], scheduledAt, at('2026-11-06T11:10:00Z'), opts).status).toBe('taken');
  });

  it('correção auditável: tomada → não tomada mantém os dois eventos e zera o consumo', () => {
    const taken = event({ id: 'e1' });
    const fix = event({ id: 'e2', type: 'skipped', quantity: 0, correctsEventId: 'e1', recordedAt: '2026-11-06T13:00:00.000Z' });
    const r = resolveDose([taken, fix], scheduledAt, at('2026-11-06T14:00:00Z'), opts);
    expect(r.status).toBe('skipped');
    expect(r.consumedQuantity).toBe(0);
    expect(r.events).toHaveLength(2);
  });

  it('correção para "sem registro" (reset) volta ao estado por horário', () => {
    const taken = event({ id: 'e1' });
    const reset = event({ id: 'e2', type: 'reset', quantity: 0, correctsEventId: 'e1', recordedAt: '2026-11-06T11:30:00.000Z' });
    expect(resolveDose([taken, reset], scheduledAt, at('2026-11-06T11:40:00Z'), opts).status).toBe('due');
  });

  it('dois "tomei" do mesmo horário (ex.: dois aparelhos) contam uma única vez', () => {
    const a = event({ id: 'a', deviceId: 'd1', recordedAt: '2026-11-06T11:01:00.000Z' });
    const b = event({ id: 'b', deviceId: 'd2', recordedAt: '2026-11-06T11:03:00.000Z' });
    const r = resolveDose([b, a], scheduledAt, at('2026-11-06T12:00:00Z'), opts);
    expect(r.status).toBe('taken');
    expect(r.consumedQuantity).toBe(1);
    expect(r.headEvent?.id).toBe('a');
  });

  it('registros divergentes viram conflito explícito, sem descontar estoque', () => {
    const a = event({ id: 'a', deviceId: 'd1' });
    const b = event({ id: 'b', deviceId: 'd2', type: 'skipped', quantity: 0 });
    const r = resolveDose([a, b], scheduledAt, at('2026-11-06T12:00:00Z'), opts);
    expect(r.status).toBe('conflict');
    expect(r.conflictingEvents.map((e) => e.id).sort()).toEqual(['a', 'b']);
    expect(r.consumedQuantity).toBe(0);
  });

  it('conflito resolvido por correção que referencia um dos lados', () => {
    const a = event({ id: 'a', deviceId: 'd1' });
    const b = event({ id: 'b', deviceId: 'd2', type: 'skipped', quantity: 0 });
    // O usuário escolhe "tomei": corrige o evento divergente.
    const fix = event({ id: 'c', type: 'taken', correctsEventId: 'b', recordedAt: '2026-11-06T15:00:00.000Z' });
    const r = resolveDose([a, b, fix], scheduledAt, at('2026-11-06T16:00:00Z'), opts);
    expect(r.status).toBe('taken');
    expect(r.consumedQuantity).toBe(1);
  });
});
