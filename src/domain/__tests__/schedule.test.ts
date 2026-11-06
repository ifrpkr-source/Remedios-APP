import { activeVersionAt, initialEffectiveFrom, occurrencesBetween, occurrencesForDate, scheduleChanged } from '../schedule';
import { localDateTimeToDate, toLocalDateTimeInZone, normalizeTime, parseBrDate, addDays, dayOfWeek, daysBetween } from '../time';
import { med, version } from '@/test/fixtures';

describe('agenda', () => {
  it('gera as doses do dia nos horários cadastrados', () => {
    const plan = { medication: med(), versions: [version()], pauses: [] };
    const occ = occurrencesForDate(plan, '2026-11-06');
    expect(occ.map((o) => o.localDateTime)).toEqual(['2026-11-06T08:00', '2026-11-06T20:00']);
    expect(occ[0]!.doseKey).toBe('med-a@2026-11-06T08:00');
  });

  it('respeita dias da semana, início e término', () => {
    const v = version({ daysOfWeek: [1, 3, 5], startDate: '2026-11-02', endDate: '2026-11-08' });
    const plan = { medication: med(), versions: [v], pauses: [] };
    const days = new Set(occurrencesBetween(plan, '2026-10-30', '2026-11-15').map((o) => o.localDateTime.slice(0, 10)));
    // 02/11 seg, 04/11 qua, 06/11 sex
    expect([...days]).toEqual(['2026-11-02', '2026-11-04', '2026-11-06']);
  });

  it('edição no meio do dia preserva doses anteriores na versão antiga', () => {
    const v1 = version({ id: 'v1' });
    const v2 = version({
      id: 'v2',
      effectiveFrom: '2026-11-06T12:00',
      times: [{ time: '09:00', quantity: 1 }, { time: '14:00', quantity: 2 }, { time: '22:00', quantity: 1 }],
      createdAt: '2026-11-06T15:00:00.000Z',
    });
    const plan = { medication: med(), versions: [v1, v2], pauses: [] };
    const today = occurrencesForDate(plan, '2026-11-06');
    expect(today.map((o) => [o.localDateTime.slice(11), o.scheduleId, o.quantity])).toEqual([
      ['08:00', 'v1', 1], // antes da edição: programação antiga
      ['14:00', 'v2', 2],
      ['22:00', 'v2', 1],
    ]);
    const tomorrow = occurrencesForDate(plan, '2026-11-07');
    expect(tomorrow.map((o) => o.localDateTime.slice(11))).toEqual(['09:00', '14:00', '22:00']);
    expect(activeVersionAt([v1, v2], '2026-11-05T08:00')?.id).toBe('v1');
  });

  it('pausas e arquivamento interrompem a geração sem apagar o passado', () => {
    const pauses = [{ id: 'p1', medicationId: 'med-a', startAt: '2026-11-06T10:00', endAt: '2026-11-08T09:00' }];
    const plan = { medication: med(), versions: [version()], pauses };
    const list = occurrencesBetween(plan, '2026-11-06', '2026-11-08').map((o) => o.localDateTime);
    expect(list).toEqual(['2026-11-06T08:00', '2026-11-08T20:00']);

    const archived = { medication: med({ archivedAt: '2026-11-07T12:00' }), versions: [version()], pauses: [] };
    expect(occurrencesBetween(archived, '2026-11-07', '2026-11-09').map((o) => o.localDateTime)).toEqual(['2026-11-07T08:00']);
  });

  it('pausa em aberto suspende todas as doses futuras', () => {
    const plan = {
      medication: med(),
      versions: [version()],
      pauses: [{ id: 'p', medicationId: 'med-a', startAt: '2026-11-06T09:00', endAt: null }],
    };
    expect(occurrencesBetween(plan, '2026-11-06', '2026-11-30')).toHaveLength(1);
  });

  it('primeira versão nunca gera doses de dias passados', () => {
    expect(initialEffectiveFrom('2026-10-01', '2026-11-06')).toBe('2026-11-06T00:00');
    expect(initialEffectiveFrom('2026-12-01', '2026-11-06')).toBe('2026-12-01T00:00');
  });

  it('detecta mudança de programação independentemente da ordem', () => {
    const a = version();
    const b = { ...a, times: [...a.times].reverse(), daysOfWeek: [...a.daysOfWeek].reverse() };
    expect(scheduleChanged(a, b)).toBe(false);
    expect(scheduleChanged(a, { ...a, endDate: '2026-12-01' })).toBe(true);
  });
});

describe('fuso horário', () => {
  it('o mesmo horário de parede vira instantes diferentes conforme o fuso (viagem)', () => {
    const ldt = '2026-11-06T08:00';
    expect(localDateTimeToDate(ldt, 'America/Sao_Paulo').toISOString()).toBe('2026-11-06T11:00:00.000Z');
    expect(localDateTimeToDate(ldt, 'America/Manaus').toISOString()).toBe('2026-11-06T12:00:00.000Z');
    expect(localDateTimeToDate(ldt, 'America/Noronha').toISOString()).toBe('2026-11-06T10:00:00.000Z');
    expect(localDateTimeToDate(ldt, 'Europe/Lisbon').toISOString()).toBe('2026-11-06T08:00:00.000Z');
  });

  it('ida e volta entre instante e horário de parede é estável', () => {
    for (const tz of ['America/Sao_Paulo', 'America/Rio_Branco', 'Asia/Kolkata', 'Pacific/Chatham']) {
      const d = localDateTimeToDate('2026-11-06T20:30', tz);
      expect(toLocalDateTimeInZone(d, tz)).toBe('2026-11-06T20:30');
    }
  });

  it('o processo de teste roda em horário de Brasília', () => {
    expect(localDateTimeToDate('2026-11-06T08:00').toISOString()).toBe('2026-11-06T11:00:00.000Z');
  });

  it('dia da semana e soma de dias não dependem do fuso', () => {
    expect(dayOfWeek('2026-11-06')).toBe(5);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2026-11-06', '2026-12-06')).toBe(30);
  });

  it('horário inexistente (início do horário de verão) é empurrado para frente', () => {
    // 08/03/2026 02:30 não existe em Nova York.
    const d = localDateTimeToDate('2026-03-08T02:30', 'America/New_York');
    expect(toLocalDateTimeInZone(d, 'America/New_York')).toBe('2026-03-08T03:30');
  });

  it('horário ambíguo (fim do horário de verão) usa a primeira ocorrência', () => {
    const d = localDateTimeToDate('2026-11-01T01:30', 'America/New_York');
    expect(d.toISOString()).toBe('2026-11-01T05:30:00.000Z');
  });
});

describe('entrada de dados', () => {
  it('normaliza horários digitados', () => {
    expect(normalizeTime('8')).toBe('08:00');
    expect(normalizeTime('8:5')).toBe('08:05');
    expect(normalizeTime('8h30')).toBe('08:30');
    expect(normalizeTime('2130')).toBe('21:30');
    expect(normalizeTime('24:00')).toBeNull();
    expect(normalizeTime('abc')).toBeNull();
  });

  it('lê datas no formato brasileiro', () => {
    expect(parseBrDate('6/11/2026')).toBe('2026-11-06');
    expect(parseBrDate('31/02/2026')).toBeNull();
  });
});
