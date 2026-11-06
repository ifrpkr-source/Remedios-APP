/**
 * Fase B — testes obrigatórios dos alarmes, com SQLite real em memória,
 * relógio controlado, agendador falso e dados sintéticos.
 */
import { createRepositories } from '@/data/repositories';
import type { MedicationInput } from '@/domain/types';
import { createAgenda } from '@/services/agenda';
import { FakeScheduler } from '@/test/fakeScheduler';
import { testDeps } from '@/test/nodeDb';
import { handleNotificationResponse } from '../actions';
import { createNotificationManager } from '../manager';
import { assessAlarmHealth } from '../permissions';
import { notificationId } from '../planner';
import { ACTION } from '../types';

// 06/11/2026 07:00 em Brasília
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

let seq = 0;
async function setup(opts: { start?: string; platform?: 'ios' | 'android' } = {}) {
  const t = await testDeps(opts.start ?? START);
  const repos = createRepositories(t.deps);
  const agenda = createAgenda(repos);
  const scheduler = new FakeScheduler(opts.platform ?? 'android');
  const manager = createNotificationManager({ repos, agenda, scheduler });
  const tap = (doseKey: string, actionId: string, responseId = `resp-${++seq}`) =>
    handleNotificationResponse(
      { repos, agenda },
      { responseId, actionId, data: { app: 'cuidar', kind: 'main', doseKey, scheduledLocal: doseKey.split('@')[1], fireAt: '', hash: '' } },
    );
  return { ...t, repos, agenda, scheduler, manager, tap };
}

const KEY8 = (id: string) => `${id}@2026-11-06T08:00`;
const KEY20 = (id: string) => `${id}@2026-11-06T20:00`;

describe('1. cada dose gera um agendamento', () => {
  it('agenda o lembrete principal no horário exato, com identificador estável', async () => {
    const { repos, manager, scheduler } = await setup();
    const id = await repos.medications.create(input());
    const r = await manager.reconcile('teste');

    const main8 = scheduler.pending.get(notificationId('main', KEY8(id)))!;
    expect(main8.fireAt.toISOString()).toBe('2026-11-06T11:00:00.000Z');
    expect(main8.data).toMatchObject({ app: 'cuidar', kind: 'main', doseKey: KEY8(id), medicationId: id });
    expect(main8.title).toBe('Hora do Remédio Teste A 50 mg');
    expect(main8.body).toContain('1 comprimido');
    expect(main8.categoryId).toBe('dose_lembrete');
    // hoje + 14 dias = 15 dias, 2 doses por dia
    expect(scheduler.byKind('main')).toHaveLength(30);
    expect(r.health.level).toBe('ok');
  });

  it('Android com alarme exato usa entrega "alarmClock"; sem permissão, "bestEffort" e aviso', async () => {
    const { repos, manager, scheduler } = await setup();
    const id = await repos.medications.create(input());
    await manager.reconcile('teste');
    expect(scheduler.pending.get(notificationId('main', KEY8(id)))!.delivery).toBe('alarmClock');

    scheduler.permission = { ...scheduler.permission, exactAlarms: 'denied' };
    const r = await manager.reconcile('permissão mudou');
    expect(scheduler.pending.get(notificationId('main', KEY8(id)))!.delivery).toBe('bestEffort');
    expect(r.health.level).toBe('degraded');
    expect(r.health.issues).toContain('exact-alarm-denied');
  });

  it('agenda acompanhamento "ainda sem confirmação" como rede de segurança', async () => {
    const { repos, manager, scheduler } = await setup();
    const id = await repos.medications.create(input());
    await manager.reconcile('teste');
    expect(scheduler.pending.get(notificationId('followup', KEY8(id)))!.fireAt.toISOString()).toBe('2026-11-06T11:30:00.000Z');

    await repos.settings.setFollowupMinutes(0);
    await manager.reconcile('desligou acompanhamento');
    expect(scheduler.byKind('followup')).toHaveLength(0);
  });

  it('pode ocultar o nome do medicamento na notificação', async () => {
    const { repos, manager, scheduler } = await setup();
    const id = await repos.medications.create(input());
    await repos.settings.setShowNameInNotification(false);
    await manager.reconcile('privacidade');
    const n = scheduler.pending.get(notificationId('main', KEY8(id)))!;
    expect(n.title).toBe('Hora do seu medicamento');
    expect(JSON.stringify({ t: n.title, b: n.body })).not.toContain('Remédio Teste A');
  });
});

describe('2. confirmar cancela alertas pendentes', () => {
  it('Tomei pela tela Hoje remove principal e acompanhamento e limpa a bandeja', async () => {
    const { repos, agenda, manager, scheduler, clock } = await setup();
    const id = await repos.medications.create(input());
    await manager.reconcile('início');
    clock.set('2026-11-06T11:00:00.000Z');
    scheduler.deliver(notificationId('main', KEY8(id))); // apareceu na bandeja

    await repos.doses.markTaken((await agenda.today())[0]!.occurrence);
    const r = await manager.reconcile('dose registrada');

    expect(scheduler.forDose(KEY8(id))).toHaveLength(0);
    expect(scheduler.presented.size).toBe(0);
    expect(r.dismissed).toBe(1);
    expect(scheduler.forDose(KEY20(id)).map((n) => n.data.kind).sort()).toEqual(['followup', 'main']);
  });

  it('"Não tomei" também cancela os alertas da dose', async () => {
    const { repos, agenda, manager, scheduler } = await setup();
    const id = await repos.medications.create(input());
    await manager.reconcile('início');
    await repos.doses.markSkipped((await agenda.today())[0]!.occurrence);
    await manager.reconcile('dose registrada');
    expect(scheduler.forDose(KEY8(id))).toHaveLength(0);
  });
});

describe('3. adiar não desconta estoque', () => {
  it('Adiar 10 pela notificação agenda novo alerta e mantém estoque e horário-base', async () => {
    const { repos, agenda, manager, scheduler, clock, tap } = await setup();
    const id = await repos.medications.create(input());
    await manager.reconcile('início');
    clock.set('2026-11-06T11:01:00.000Z');

    const res = await tap(KEY8(id), ACTION.snooze10);
    await manager.reconcile('ação');
    expect(res.outcome).toBe('snoozed');
    expect((await agenda.stock(id))?.stock).toBe(10);
    expect(scheduler.pending.get(notificationId('snooze', KEY8(id)))!.fireAt.toISOString()).toBe('2026-11-06T11:11:00.000Z');
    expect(scheduler.pending.has(notificationId('main', KEY8(id)))).toBe(false);
    const d = (await agenda.today())[0]!;
    expect(d.occurrence.localDateTime).toBe('2026-11-06T08:00');
    expect(d.resolved.status).toBe('snoozed');
  });

  it('15 e 30 minutos também funcionam; o último adiamento vale', async () => {
    const { repos, agenda, manager, scheduler, clock, tap } = await setup();
    const id = await repos.medications.create(input());
    clock.set('2026-11-06T11:01:00.000Z');
    expect((await tap(KEY8(id), ACTION.snooze15)).outcome).toBe('snoozed');
    clock.set('2026-11-06T11:17:00.000Z');
    expect((await tap(KEY8(id), ACTION.snooze30)).outcome).toBe('snoozed');
    await manager.reconcile('ação');
    expect(scheduler.byKind('snooze')).toHaveLength(1);
    expect(scheduler.pending.get(notificationId('snooze', KEY8(id)))!.fireAt.toISOString()).toBe('2026-11-06T11:47:00.000Z');
    expect((await agenda.stock(id))?.stock).toBe(10);
  });
});

describe('4. dois toques em Tomei não descontam duas vezes', () => {
  it('mesmo toque reentregue, toque em outra notificação da dose e toques simultâneos', async () => {
    const { repos, agenda, manager, tap, clock } = await setup();
    const id = await repos.medications.create(input());
    await manager.reconcile('início');
    clock.set('2026-11-06T11:02:00.000Z');

    const a = await tap(KEY8(id), ACTION.taken, 'resp-A');
    const b = await tap(KEY8(id), ACTION.taken, 'resp-A');
    const c = await tap(KEY8(id), ACTION.taken, 'resp-B');
    const [d, e] = await Promise.all([tap(KEY8(id), ACTION.taken, 'resp-C'), tap(KEY8(id), ACTION.taken, 'resp-D')]);

    expect(a.outcome).toBe('recorded-taken');
    expect(b.outcome).toBe('duplicate');
    expect(c.outcome).toBe('already-resolved');
    expect([d.outcome, e.outcome]).toEqual(['already-resolved', 'already-resolved']);
    expect(await repos.doses.eventsForKey(KEY8(id))).toHaveLength(1);
    expect((await agenda.stock(id))?.stock).toBe(9);
  });

  it('notificação e tela Hoje usam a mesma regra: quem chega depois é recusado', async () => {
    const { repos, agenda, tap } = await setup();
    const id = await repos.medications.create(input());
    await repos.doses.markTaken((await agenda.today())[0]!.occurrence);
    expect((await tap(KEY8(id), ACTION.taken)).outcome).toBe('already-resolved');
    expect((await agenda.stock(id))?.stock).toBe(9);
  });
});

describe('5. editar horário reagenda sem duplicar', () => {
  it('troca 08:00/20:00 por 09:00/21:00', async () => {
    const { repos, manager, scheduler, clock } = await setup();
    const id = await repos.medications.create(input());
    await manager.reconcile('início');
    clock.set('2026-11-06T22:00:00.000Z'); // 19:00, antes da dose das 20:00
    await repos.medications.update(id, input({ times: [{ time: '09:00', quantity: 1 }, { time: '21:00', quantity: 2 }] }));
    const r = await manager.reconcile('edição');

    expect(scheduler.pending.has(notificationId('main', KEY20(id)))).toBe(false);
    expect(scheduler.pending.has(notificationId('main', `${id}@2026-11-06T21:00`))).toBe(true);
    expect(scheduler.pending.has(notificationId('main', `${id}@2026-11-07T08:00`))).toBe(false);
    expect(scheduler.pending.get(notificationId('main', `${id}@2026-11-07T21:00`))!.body).toContain('2 comprimidos');

    const mains = scheduler.byKind('main').map((n) => n.data.scheduledLocal!);
    expect(new Set(mains).size).toBe(mains.length);
    expect(r.cancelled).toBeGreaterThan(0);
  });

  it('renomear o medicamento atualiza o texto das notificações', async () => {
    const { repos, manager, scheduler } = await setup();
    const id = await repos.medications.create(input());
    await manager.reconcile('início');
    await repos.medications.update(id, input({ name: 'Nome Novo' }));
    await manager.reconcile('edição');
    expect(scheduler.pending.get(notificationId('main', KEY8(id)))!.title).toContain('Nome Novo');
  });
});

describe('6. pausar e arquivar cancelam alarmes futuros', () => {
  it('pausa remove tudo do medicamento; retomar devolve', async () => {
    const { repos, manager, scheduler } = await setup();
    const id = await repos.medications.create(input());
    const other = await repos.medications.create(input({ name: 'Remédio Teste B', times: [{ time: '12:00', quantity: 1 }] }));
    await manager.reconcile('início');

    await repos.medications.pause(id);
    await manager.reconcile('pausa');
    expect([...scheduler.pending.values()].some((n) => n.data.medicationId === id)).toBe(false);
    expect([...scheduler.pending.values()].some((n) => n.data.medicationId === other)).toBe(true);

    await repos.medications.resume(id);
    await manager.reconcile('retomada');
    expect(scheduler.pending.has(notificationId('main', KEY8(id)))).toBe(true);
  });

  it('arquivar remove os alarmes e preserva o histórico', async () => {
    const { repos, agenda, manager, scheduler } = await setup();
    const id = await repos.medications.create(input());
    await repos.doses.markTaken((await agenda.today())[0]!.occurrence);
    await manager.reconcile('início');
    await repos.medications.archive(id);
    await manager.reconcile('arquivado');
    expect(scheduler.pending.size).toBe(0);
    expect(await repos.doses.eventsForKey(KEY8(id))).toHaveLength(1);
  });
});

describe('7. reiniciar o app reconcilia notificações pendentes', () => {
  it('nova instância sobre o mesmo banco mantém o que está certo e corrige o resto', async () => {
    const first = await setup();
    const id = await first.repos.medications.create(input());
    await first.manager.reconcile('primeira abertura');
    const total = first.scheduler.pending.size;

    // Restos de execução anterior: dose que não existe mais e um horário errado.
    first.scheduler.foreign.set('cuidar.main.apagado@2026-11-06T09:00', {
      id: 'cuidar.main.apagado@2026-11-06T09:00',
      data: { app: 'cuidar', kind: 'main', fireAt: 'x', hash: 'x' },
    });
    const wrong = first.scheduler.pending.get(notificationId('main', KEY20(id)))!;
    first.scheduler.pending.set(wrong.id, { ...wrong, data: { ...wrong.data, fireAt: '2026-11-06T22:30:00.000Z' } });
    // Notificação de outra origem: nunca deve ser tocada.
    first.scheduler.foreign.set('outra-origem', { id: 'outra-origem', data: undefined });

    // "Reinício": novas instâncias, mesmo banco e mesmo sistema operacional.
    const repos2 = createRepositories(first.deps);
    const manager2 = createNotificationManager({ repos: repos2, agenda: createAgenda(repos2), scheduler: first.scheduler });
    const r = await manager2.reconcile('inicialização');

    expect(r.cancelled).toBe(2);
    expect(r.scheduled).toBe(1);
    expect(r.kept).toBe(total - 1);
    expect(first.scheduler.foreign.has('outra-origem')).toBe(true);
    expect(first.scheduler.pending.get(notificationId('main', KEY20(id)))!.data.fireAt).toBe('2026-11-06T23:00:00.000Z');

    const again = await manager2.reconcile('de novo');
    expect([again.scheduled, again.cancelled]).toEqual([0, 0]); // idempotente
  });

  it('chamadas simultâneas não duplicam agendamentos', async () => {
    const { repos, manager, scheduler } = await setup();
    await repos.medications.create(input());
    await Promise.all([manager.reconcile('a'), manager.reconcile('b'), manager.reconcile('c')]);
    const scheduledIds = scheduler.log.filter((l) => l.startsWith('schedule ')).map((l) => l.slice(9));
    expect(new Set(scheduledIds).size).toBe(scheduledIds.length);
  });
});

describe('8. trocar fuso recalcula os próximos lembretes', () => {
  it('ao ir de São Paulo para Manaus, 20:00 passa a ser 20:00 de Manaus', async () => {
    const { repos, manager, scheduler, setTimeZone } = await setup();
    const id = await repos.medications.create(input());
    await manager.reconcile('início');
    expect(scheduler.pending.get(notificationId('main', KEY20(id)))!.fireAt.toISOString()).toBe('2026-11-06T23:00:00.000Z');

    setTimeZone('America/Manaus');
    const r = await manager.reconcile('app voltou ao primeiro plano');
    expect(r.timeZoneChanged).toBe(true);
    expect(scheduler.pending.get(notificationId('main', KEY20(id)))!.fireAt.toISOString()).toBe('2026-11-07T00:00:00.000Z');
    expect((await repos.settings.get()).lastScheduledTimeZone).toBe('America/Manaus');
  });

  it('horário de verão: horário inexistente vai para o horário válido seguinte', async () => {
    const { repos, manager, scheduler, setTimeZone } = await setup({ start: '2026-03-07T17:00:00.000Z' });
    setTimeZone('America/New_York'); // 07/03 12:00 em Nova York
    const id = await repos.medications.create(input({ times: [{ time: '02:30', quantity: 1 }], startDate: '2026-03-07' }));
    await manager.reconcile('início');
    // 08/03/2026 02:30 não existe em Nova York → 03:30 EDT = 07:30Z
    expect(scheduler.pending.get(notificationId('main', `${id}@2026-03-08T02:30`))!.fireAt.toISOString()).toBe('2026-03-08T07:30:00.000Z');
  });
});

describe('9. permissões negadas apresentam o estado correto', () => {
  const base = { platform: 'ios' as const, alarmsEnabled: true };
  const h = (notifications: 'granted' | 'provisional' | 'ephemeral' | 'denied' | 'undetermined', canAskAgain = true) =>
    assessAlarmHealth({ ...base, permission: { notifications, canAskAgain, exactAlarms: 'not-applicable' } });

  it('mapeia cada estado de permissão para uma mensagem clara', () => {
    expect(h('undetermined')).toMatchObject({ level: 'off', canRequest: true, issues: ['permission-undetermined'] });
    expect(h('denied', true)).toMatchObject({ level: 'off', canRequest: true, issues: ['permission-denied'] });
    expect(h('denied', false)).toMatchObject({ level: 'off', canRequest: false, issues: ['permission-denied-settings'] });
    expect(h('provisional')).toMatchObject({ level: 'degraded', issues: ['provisional'] });
    expect(h('ephemeral').level).toBe('degraded');
    expect(h('granted').level).toBe('ok');
    expect(h('granted').message).not.toMatch(/100%|garantid/i);
    expect(
      assessAlarmHealth({ ...base, alarmsEnabled: false, permission: { notifications: 'granted', canAskAgain: true, exactAlarms: 'not-applicable' } }).level,
    ).toBe('off');
  });

  it('com permissão negada nada é agendado e agendamentos antigos são removidos', async () => {
    const { repos, manager, scheduler } = await setup({ platform: 'ios' });
    await repos.medications.create(input());
    await manager.reconcile('início');
    expect(scheduler.pending.size).toBeGreaterThan(0);
    scheduler.permission = { notifications: 'denied', canAskAgain: false, exactAlarms: 'not-applicable' };
    const r = await manager.reconcile('permissão revogada');
    expect(scheduler.pending.size).toBe(0);
    expect(r.health.issues).toEqual(['permission-denied-settings']);
  });

  it('permissão provisória do iOS agenda, mas avisa que chega em silêncio', async () => {
    const { repos, manager, scheduler } = await setup({ platform: 'ios' });
    await repos.medications.create(input());
    scheduler.permission = { notifications: 'provisional', canAskAgain: true, exactAlarms: 'not-applicable' };
    const r = await manager.reconcile('provisória');
    expect(scheduler.pending.size).toBeGreaterThan(0);
    expect(r.health.level).toBe('degraded');
  });

  it('desligar os lembretes no app cancela tudo; religar agenda de novo', async () => {
    const { repos, manager, scheduler } = await setup();
    await repos.medications.create(input());
    await manager.reconcile('início');
    await repos.settings.setAlarmsEnabled(false);
    expect((await manager.reconcile('desligou')).health.level).toBe('off');
    expect(scheduler.pending.size).toBe(0);
    await repos.settings.setAlarmsEnabled(true);
    await manager.reconcile('ligou');
    expect(scheduler.pending.size).toBeGreaterThan(0);
  });
});

describe('10. notificação antiga não altera dose já resolvida', () => {
  it('"Tomei" de alerta antigo de dose marcada como não tomada não muda nada', async () => {
    const { repos, agenda, tap } = await setup();
    const id = await repos.medications.create(input());
    await repos.doses.markSkipped((await agenda.today())[0]!.occurrence);
    expect((await tap(KEY8(id), ACTION.taken)).outcome).toBe('already-resolved');
    expect((await repos.doses.eventsForKey(KEY8(id))).map((e) => e.type)).toEqual(['skipped']);
    expect((await agenda.stock(id))?.stock).toBe(10);
  });

  it('alerta de medicamento pausado ou de horário removido não registra nada', async () => {
    const { repos, tap, agenda, clock } = await setup();
    const id = await repos.medications.create(input());
    await repos.medications.pause(id);
    expect((await tap(KEY20(id), ACTION.taken)).outcome).toBe('not-scheduled');

    await repos.medications.resume(id);
    clock.set('2026-11-06T10:30:00.000Z');
    await repos.medications.update(id, input({ times: [{ time: '22:00', quantity: 1 }] }));
    expect((await tap(KEY20(id), ACTION.taken)).outcome).toBe('not-scheduled');
    expect((await tap(KEY20(id), ACTION.snooze10)).outcome).toBe('not-scheduled');
    expect(await repos.doses.eventsForMedication(id)).toHaveLength(0);
    expect((await agenda.stock(id))?.stock).toBe(10);
  });

  it('toque no corpo da notificação só abre a dose, sem registrar', async () => {
    const { repos, tap } = await setup();
    const id = await repos.medications.create(input());
    const res = await tap(KEY8(id), 'expo.modules.notifications.actions.DEFAULT');
    expect(res).toMatchObject({ outcome: 'opened', route: `/dose/${encodeURIComponent(KEY8(id))}` });
    expect(await repos.doses.eventsForKey(KEY8(id))).toHaveLength(0);
  });

  it('notificações de outra origem são ignoradas', async () => {
    const { repos, agenda } = await setup();
    const res = await handleNotificationResponse({ repos, agenda }, { responseId: 'x', actionId: ACTION.taken, data: undefined });
    expect(res.outcome).toBe('ignored');
  });
});

describe('limites de plataforma e avisos', () => {
  it('iOS: respeita o limite de pendentes, prioriza as próximas doses e avisa para abrir o app', async () => {
    const { repos, manager, scheduler } = await setup({ platform: 'ios' });
    const id = await repos.medications.create(
      input({ times: ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'].map((time) => ({ time, quantity: 1 })), initialStock: null }),
    );
    const r = await manager.reconcile('início');
    expect(scheduler.pending.size).toBeLessThanOrEqual(60);
    expect(scheduler.byKind('keepalive')).toHaveLength(1);
    expect(r.truncatedAfter).not.toBeNull();
    expect(r.health.issues).toContain('horizon-truncated');
    expect(scheduler.pending.has(notificationId('main', `${id}@2026-11-06T09:00`))).toBe(true);
  });

  it('aviso de reposição é agendado para as 09:00 do dia configurado', async () => {
    const { repos, manager, scheduler } = await setup();
    const id = await repos.medications.create(input({ initialStock: 12, restockLeadDays: 3 }));
    await manager.reconcile('início');
    // 12 unidades, 2/dia desde 06/11 → falta em 12/11 → aviso 09/11 09:00 (12:00Z)
    const n = scheduler.pending.get(notificationId('restock', id))!;
    expect(n.fireAt.toISOString()).toBe('2026-11-09T12:00:00.000Z');
    expect(n.body).toContain('12/11/2026');
  });

  it('respostas processadas ficam registradas para auditoria e são apagadas com os dados', async () => {
    const { repos, tap } = await setup();
    const id = await repos.medications.create(input());
    await tap(KEY8(id), ACTION.taken, 'resp-audit');
    expect((await repos.notificationResponses.list(KEY8(id)))[0]).toMatchObject({ action: 'TOMEI', outcome: 'recorded-taken' });
    await repos.privacy.wipeAll();
    expect(await repos.notificationResponses.list(KEY8(id))).toHaveLength(0);
  });
});
