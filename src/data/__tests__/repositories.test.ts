/**
 * Testes de integração com SQLite real (em memória), relógio controlado e
 * dados sintéticos. Nenhum dado real de paciente.
 */
import { createRepositories, DoseAlreadyRecordedError, ValidationError } from '../repositories';
import { createAgenda } from '@/services/agenda';
import { testDeps } from '@/test/nodeDb';
import type { MedicationInput } from '@/domain/types';

// 06/11/2026 07:00 em Brasília (10:00Z)
const START = '2026-11-06T10:00:00.000Z';

const input = (over: Partial<MedicationInput> = {}): MedicationInput => ({
  name: 'Remédio Teste A',
  strength: '50 mg',
  form: 'comprimido',
  unitLabel: 'comprimido',
  notes: null,
  times: [{ time: '08:00', quantity: 1 }, { time: '20:00', quantity: 1 }],
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  startDate: '2026-11-06',
  endDate: null,
  restockLeadDays: 3,
  initialStock: 10,
  ...over,
});

async function setup(startIso = START) {
  const t = await testDeps(startIso);
  const repos = createRepositories(t.deps);
  const agenda = createAgenda(repos);
  return { ...t, repos, agenda };
}

describe('cadastro', () => {
  it('cadastra medicamento com programação e estoque inicial', async () => {
    const { repos, agenda } = await setup();
    const id = await repos.medications.create(input());
    const today = await agenda.today();
    expect(today.map((d) => d.occurrence.localDateTime)).toEqual(['2026-11-06T08:00', '2026-11-06T20:00']);
    expect(today.every((d) => d.medication.id === id)).toBe(true);
    expect((await agenda.stock(id))?.stock).toBe(10);
  });

  it('rejeita dados inválidos sem gravar nada', async () => {
    const { repos } = await setup();
    await expect(repos.medications.create(input({ name: ' ', times: [] }))).rejects.toBeInstanceOf(ValidationError);
    expect(await repos.medications.list()).toHaveLength(0);
  });

  it('dados persistem entre "reinícios" do app (nova instância sobre o mesmo banco)', async () => {
    const { deps, repos } = await setup();
    const id = await repos.medications.create(input());
    const deviceId = (await repos.settings.get()).deviceId;
    const reopened = createRepositories(deps);
    expect((await reopened.medications.list())[0]?.id).toBe(id);
    expect((await reopened.settings.get()).deviceId).toBe(deviceId);
  });
});

describe('edição preserva histórico', () => {
  it('mudar horários cria nova versão e não altera doses já registradas', async () => {
    const { repos, agenda, clock } = await setup('2026-11-06T11:05:00.000Z'); // 08:05
    const id = await repos.medications.create(input());
    const [d8] = await agenda.today();
    await repos.doses.markTaken(d8!.occurrence);

    clock.set('2026-11-06T13:00:00.000Z'); // 10:00 — edita
    const r = await repos.medications.update(id, input({ times: [{ time: '09:00', quantity: 2 }, { time: '21:00', quantity: 1 }] }));
    expect(r.newVersion).toBe(true);

    const today = await agenda.today();
    expect(today.map((d) => [d.occurrence.localDateTime.slice(11), d.resolved.status])).toEqual([
      ['08:00', 'taken'], // dose antiga continua registrada
      ['21:00', 'pending'], // 09:00 já passou quando a edição foi feita: não é criada retroativamente
    ]);
    const tomorrow = await agenda.day('2026-11-07');
    expect(tomorrow.map((d) => [d.occurrence.localDateTime.slice(11), d.occurrence.quantity])).toEqual([
      ['09:00', 2],
      ['21:00', 1],
    ]);
    expect((await repos.medications.plan(id))?.versions).toHaveLength(2);
  });

  it('editar só o nome não cria nova versão de programação', async () => {
    const { repos } = await setup();
    const id = await repos.medications.create(input());
    expect((await repos.medications.update(id, input({ name: 'Novo nome' }))).newVersion).toBe(false);
    expect((await repos.medications.plan(id))?.medication.name).toBe('Novo nome');
  });

  it('dose registrada em horário removido continua visível no dia', async () => {
    const { repos, agenda, clock } = await setup('2026-11-06T11:05:00.000Z');
    const id = await repos.medications.create(input());
    await repos.doses.markTaken((await agenda.today())[0]!.occurrence);
    clock.advanceMinutes(10);
    await repos.medications.update(id, input({ times: [{ time: '07:00', quantity: 1 }] }));
    const today = await agenda.today();
    expect(today.map((d) => [d.occurrence.localDateTime.slice(11), d.resolved.status])).toEqual([['08:00', 'taken']]);
  });

  it('pausar e arquivar interrompem doses futuras; o passado continua no histórico', async () => {
    const { repos, agenda, clock } = await setup('2026-11-06T11:10:00.000Z');
    const id = await repos.medications.create(input());
    await repos.doses.markTaken((await agenda.today())[0]!.occurrence);

    await repos.medications.pause(id);
    expect((await agenda.today()).map((d) => d.occurrence.localDateTime.slice(11))).toEqual(['08:00']);
    clock.set('2026-11-07T15:00:00.000Z');
    expect(await agenda.today()).toHaveLength(0);

    await repos.medications.resume(id);
    expect((await agenda.today()).map((d) => d.occurrence.localDateTime.slice(11))).toEqual(['20:00']);

    await repos.medications.archive(id);
    expect(await repos.medications.list()).toHaveLength(0);
    const history = await agenda.history(7);
    expect(history.some((d) => d.resolved.status === 'taken')).toBe(true);
  });
});

describe('confirmação única', () => {
  it('a mesma dose não pode ser marcada como tomada duas vezes', async () => {
    const { repos, agenda } = await setup();
    const id = await repos.medications.create(input());
    const occ = (await agenda.today())[0]!.occurrence;
    await repos.doses.markTaken(occ);
    await expect(repos.doses.markTaken(occ)).rejects.toBeInstanceOf(DoseAlreadyRecordedError);
    await expect(repos.doses.markSkipped(occ)).rejects.toBeInstanceOf(DoseAlreadyRecordedError);
    expect((await agenda.stock(id))?.stock).toBe(9);
  });

  it('toques simultâneos em "Tomei" gravam um único registro', async () => {
    const { repos, agenda } = await setup();
    const id = await repos.medications.create(input());
    const occ = (await agenda.today())[0]!.occurrence;
    const results = await Promise.allSettled([repos.doses.markTaken(occ), repos.doses.markTaken(occ), repos.doses.markTaken(occ)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await repos.doses.eventsForKey(occ.doseKey)).toHaveLength(1);
    expect((await agenda.stock(id))?.stock).toBe(9);
  });

  it('nenhuma dose vira "tomada" sozinha com o passar do tempo', async () => {
    const { repos, agenda, clock } = await setup();
    const id = await repos.medications.create(input());
    clock.set('2026-11-07T02:00:00.000Z'); // 23:00
    const today = await agenda.day('2026-11-06');
    expect(today.map((d) => d.resolved.status)).toEqual(['unconfirmed', 'unconfirmed']);
    expect((await agenda.stock(id))?.stock).toBe(10);
  });

  it('correção é auditável e não duplica consumo', async () => {
    const { repos, agenda, clock } = await setup('2026-11-06T11:05:00.000Z');
    const id = await repos.medications.create(input());
    const occ = (await agenda.today())[0]!.occurrence;
    await repos.doses.markTaken(occ);
    clock.advanceMinutes(30);
    await repos.doses.correct(occ, 'skipped', 'Marquei por engano');
    expect((await agenda.stock(id))?.stock).toBe(10);
    clock.advanceMinutes(30);
    await repos.doses.correct(occ, 'taken');
    expect((await agenda.stock(id))?.stock).toBe(9);
    await repos.doses.correct(occ, 'taken'); // repetir a mesma correção não muda nada
    expect((await agenda.stock(id))?.stock).toBe(9);
    const events = await repos.doses.eventsForKey(occ.doseKey);
    expect(events.map((e) => e.type)).toEqual(['taken', 'skipped', 'taken']);
    expect(events[1]!.correctsEventId).toBe(events[0]!.id);
    expect(events[1]!.note).toBe('Marquei por engano');
  });

  it('eventos de dose são imutáveis no banco', async () => {
    const { repos, agenda, deps } = await setup();
    await repos.medications.create(input());
    await repos.doses.markTaken((await agenda.today())[0]!.occurrence);
    await expect(deps.db.run("UPDATE dose_events SET type = 'skipped'")).rejects.toThrow(/somente-inclusão/);
  });
});

describe('adiamento', () => {
  it('adiar muda só o lembrete; horário-base e programação continuam', async () => {
    const { repos, agenda, clock } = await setup('2026-11-06T11:00:00.000Z'); // 08:00
    await repos.medications.create(input());
    const occ = (await agenda.today())[0]!.occurrence;
    expect(await repos.doses.snooze(occ, 15)).toBe('2026-11-06T11:15:00.000Z');

    let d = (await agenda.today())[0]!;
    expect(d.resolved.status).toBe('snoozed');
    expect(d.occurrence.localDateTime).toBe('2026-11-06T08:00');
    expect(d.scheduledAt.toISOString()).toBe('2026-11-06T11:00:00.000Z');

    clock.set('2026-11-06T11:16:00.000Z');
    d = (await agenda.today())[0]!;
    expect(d.resolved.status).toBe('due');

    await repos.doses.markTaken(occ);
    await expect(repos.doses.snooze(occ, 10)).rejects.toBeInstanceOf(DoseAlreadyRecordedError);
    expect((await agenda.day('2026-11-07'))[0]!.occurrence.localDateTime).toBe('2026-11-07T08:00');
  });
});

describe('estoque', () => {
  it('reposição soma unidades e a previsão acompanha a programação', async () => {
    const { repos, agenda } = await setup();
    const id = await repos.medications.create(input({ initialStock: 4 }));
    let s = (await agenda.stock(id))!;
    // 4 unidades, 2 por dia a partir de hoje: 06 e 07 cobertos, falta em 08/11.
    expect(s.forecast?.runsOutOn).toBe('2026-11-08');
    expect(s.level).toBe('soon');
    expect(s.alertOn).toBe('2026-11-05');

    await repos.stock.add(id, 30, 'Farmácia');
    s = (await agenda.stock(id))!;
    expect(s.stock).toBe(34);
    expect(s.forecast?.runsOutOn).toBe('2026-11-23');
    expect(s.level).toBe('ok');
    await expect(repos.stock.add(id, 0)).rejects.toBeInstanceOf(ValidationError);
  });

  it('pausa adia a previsão de esgotamento', async () => {
    const { repos, agenda, clock } = await setup();
    const id = await repos.medications.create(input({ initialStock: 4 }));
    await repos.medications.pause(id);
    expect((await agenda.stock(id))?.forecast?.runsOutOn).toBeNull();
    clock.set('2026-11-10T10:00:00.000Z');
    await repos.medications.resume(id);
    expect((await agenda.stock(id))?.forecast?.runsOutOn).toBe('2026-11-12');
  });

  it('contagem manual redefine o saldo', async () => {
    const { repos, agenda, clock } = await setup('2026-11-06T11:05:00.000Z');
    const id = await repos.medications.create(input({ initialStock: 10 }));
    await repos.doses.markTaken((await agenda.today())[0]!.occurrence);
    clock.advanceMinutes(1);
    await repos.stock.set(id, 20);
    expect((await agenda.stock(id))?.stock).toBe(20);
  });
});

describe('registros de outro aparelho (base para a sincronização da Fase C)', () => {
  type Env = Awaited<ReturnType<typeof setup>>;
  async function insertRemote(env: Env, occ: { doseKey: string; medicationId: string; scheduleId: string; localDateTime: string }, type: 'taken' | 'skipped') {
    await env.deps.db.run(
      `INSERT INTO dose_events (id, dose_key, medication_id, schedule_id, scheduled_local, scheduled_at, type, quantity,
        recorded_at, tz_offset_min, device_id, sync_status)
       VALUES (?, ?, ?, ?, ?, '2026-11-06T11:00:00.000Z', ?, ?, ?, -180, 'outro-aparelho', 'synced')`,
      [env.deps.newId(), occ.doseKey, occ.medicationId, occ.scheduleId, occ.localDateTime, type, type === 'taken' ? 1 : 0, env.clock.now().toISOString()],
    );
  }

  it('registro divergente vira conflito visível e não desconta estoque até o usuário decidir', async () => {
    const env = await setup('2026-11-06T11:05:00.000Z');
    const { repos, agenda } = env;
    const id = await repos.medications.create(input());
    const occ = (await agenda.today())[0]!.occurrence;
    await repos.doses.markTaken(occ);
    await insertRemote(env, occ, 'skipped');

    expect((await agenda.today())[0]!.resolved.status).toBe('conflict');
    expect((await agenda.stock(id))?.stock).toBe(10);

    await repos.doses.correct(occ, 'taken', 'Conferi a cartela');
    expect((await agenda.today())[0]!.resolved.status).toBe('taken');
    expect((await agenda.stock(id))?.stock).toBe(9);
    expect(await repos.doses.eventsForKey(occ.doseKey)).toHaveLength(3); // nada foi sobrescrito
  });

  it('o mesmo "tomei" vindo de dois aparelhos é descontado uma vez', async () => {
    const env = await setup('2026-11-06T11:05:00.000Z');
    const { repos, agenda } = env;
    const id = await repos.medications.create(input());
    const occ = (await agenda.today())[0]!.occurrence;
    await repos.doses.markTaken(occ);
    await insertRemote(env, occ, 'taken');
    expect((await agenda.today())[0]!.resolved.status).toBe('taken');
    expect((await agenda.stock(id))?.stock).toBe(9);
  });
});

describe('fuso horário', () => {
  it('ao viajar, as doses seguem o relógio local e eventos guardam o fuso do registro', async () => {
    const { repos, agenda, setTimeZone } = await setup('2026-11-06T12:30:00.000Z'); // 09:30 em SP
    await repos.medications.create(input());
    await repos.doses.markTaken((await agenda.today())[0]!.occurrence);

    setTimeZone('America/Manaus'); // 08:30 em Manaus
    const today = await agenda.today();
    expect(today[1]!.scheduledAt.toISOString()).toBe('2026-11-07T00:00:00.000Z'); // 20:00 em Manaus
    await repos.doses.markTaken(today[1]!.occurrence);
    expect((await repos.doses.eventsForKey(today[1]!.occurrence.doseKey))[0]!.tzOffsetMin).toBe(-240);
    expect((await repos.doses.eventsForKey(today[0]!.occurrence.doseKey))[0]!.tzOffsetMin).toBe(-180);
  });
});

describe('privacidade', () => {
  it('exporta e depois exclui todos os dados deste aparelho', async () => {
    const { repos, agenda, deps } = await setup();
    await repos.medications.create(input());
    await repos.doses.markTaken((await agenda.today())[0]!.occurrence);
    const exported = await repos.privacy.exportAll();
    expect(exported.schema.medications).toHaveLength(1);

    await repos.privacy.wipeAll();
    for (const t of ['medications', 'schedule_versions', 'pauses', 'dose_events', 'stock_entries', 'settings']) {
      expect((await deps.db.first<{ n: number }>(`SELECT COUNT(*) n FROM ${t}`))?.n).toBe(0);
    }
  });
});
