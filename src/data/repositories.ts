import { headEvents, isOpen, resolveDose, type ResolvedDose } from '@/domain/doseState';
import { initialEffectiveFrom, isPausedNow, scheduleChanged, type MedicationPlan } from '@/domain/schedule';
import { localDateTimeToDate, toLocalDateTimeInZone } from '@/domain/time';
import type { DoseEvent, DoseEventType, DoseOccurrence, MedicationInput, StockEntry } from '@/domain/types';
import { validateMedicationInput } from '@/domain/validation';
import { PERSONAL_TABLES } from './migrations';
import {
  toEvent,
  toMedication,
  toPause,
  toSchedule,
  toStock,
  type DoseEventRow,
  type MedicationRow,
  type PauseRow,
  type ScheduleRow,
  type StockRow,
} from './rows';
import { WriteQueue, type Deps } from './sql';

export class ValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super(Object.values(fields)[0] ?? 'Dados inválidos');
  }
}

/** Tentativa de registrar uma dose que já tem registro. Use `correct`. */
export class DoseAlreadyRecordedError extends Error {
  constructor(public status: string) {
    super('Esta dose já foi registrada. Para mudar, use "Corrigir registro".');
  }
}

export interface AppSettings {
  deviceId: string;
  unconfirmedAfterMinutes: number;
  onboardingDone: boolean;
  /** Lembretes ligados pelo usuário (independe da permissão do sistema). */
  alarmsEnabled: boolean;
  /** Minutos após o horário para o lembrete de acompanhamento; 0 = desligado. */
  followupMinutes: number;
  /** Mostrar o nome do medicamento no texto da notificação. */
  showNameInNotification: boolean;
  /** Último fuso usado para agendar (detecta viagem / troca de fuso). */
  lastScheduledTimeZone: string | null;
}

const DEFAULT_SETTINGS = { unconfirmedAfterMinutes: 60, onboardingDone: false, followupMinutes: 30 };
export const FOLLOWUP_OPTIONS = [0, 15, 30, 60] as const;

export function createRepositories(deps: Deps) {
  const { db, newId, now, timeZone } = deps;
  const queue = new WriteQueue();
  const nowIso = () => now().toISOString();
  const nowLocal = () => toLocalDateTimeInZone(now(), timeZone());
  const today = () => nowLocal().slice(0, 10);
  /** Deslocamento do fuso atual em minutos (ex.: -180 para Brasília). Guardado em cada evento para auditoria. */
  const offsetMin = (d: Date) =>
    Math.round((Date.parse(`${toLocalDateTimeInZone(d, timeZone())}:00Z`) - Math.floor(d.getTime() / 60000) * 60000) / 60000);

  // ---------------------------------------------------------------- settings
  const settings = {
    async get(): Promise<AppSettings> {
      const rows = await db.all<{ key: string; value: string }>('SELECT key, value FROM settings');
      const map = new Map(rows.map((r) => [r.key, r.value]));
      let deviceId = map.get('device_id');
      if (!deviceId) {
        deviceId = newId();
        await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['device_id', deviceId]);
        deviceId = (await db.first<{ value: string }>("SELECT value FROM settings WHERE key = 'device_id'"))!.value;
      }
      return {
        deviceId,
        unconfirmedAfterMinutes: Number(map.get('unconfirmed_after_minutes') ?? DEFAULT_SETTINGS.unconfirmedAfterMinutes),
        onboardingDone: map.get('onboarding_done') === '1',
        alarmsEnabled: map.get('alarms_enabled') !== '0',
        followupMinutes: Number(map.get('followup_minutes') ?? DEFAULT_SETTINGS.followupMinutes),
        showNameInNotification: map.get('show_name_in_notification') !== '0',
        lastScheduledTimeZone: map.get('last_scheduled_tz') ?? null,
      };
    },
    async setAlarmsEnabled(on: boolean) {
      await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['alarms_enabled', on ? '1' : '0']);
    },
    async setFollowupMinutes(minutes: number) {
      if (!(FOLLOWUP_OPTIONS as readonly number[]).includes(minutes)) throw new ValidationError({ minutes: 'Opção inválida.' });
      await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['followup_minutes', String(minutes)]);
    },
    async setShowNameInNotification(on: boolean) {
      await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['show_name_in_notification', on ? '1' : '0']);
    },
    async setLastScheduledTimeZone(tz: string) {
      await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['last_scheduled_tz', tz]);
    },
    async setUnconfirmedAfter(minutes: number) {
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 720) throw new ValidationError({ minutes: 'Use de 5 a 720 minutos.' });
      await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['unconfirmed_after_minutes', String(minutes)]);
    },
    async setOnboardingDone() {
      await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('onboarding_done', '1')");
    },
  };

  // ------------------------------------------------------------- medications
  const medications = {
    async list(opts: { includeArchived?: boolean } = {}) {
      const rows = await db.all<MedicationRow>(
        `SELECT * FROM medications ${opts.includeArchived ? '' : 'WHERE archived_at IS NULL'} ORDER BY name COLLATE NOCASE`,
      );
      return rows.map(toMedication);
    },

    async plan(id: string): Promise<MedicationPlan | null> {
      const m = await db.first<MedicationRow>('SELECT * FROM medications WHERE id = ?', [id]);
      if (!m) return null;
      const versions = await db.all<ScheduleRow>('SELECT * FROM schedule_versions WHERE medication_id = ? ORDER BY effective_from, created_at', [id]);
      const pauses = await db.all<PauseRow>('SELECT * FROM pauses WHERE medication_id = ? ORDER BY start_at', [id]);
      return { medication: toMedication(m), versions: versions.map(toSchedule), pauses: pauses.map(toPause) };
    },

    async plans(opts: { includeArchived?: boolean } = {}): Promise<MedicationPlan[]> {
      const meds = await this.list(opts);
      const versions = (await db.all<ScheduleRow>('SELECT * FROM schedule_versions ORDER BY effective_from, created_at')).map(toSchedule);
      const pauses = (await db.all<PauseRow>('SELECT * FROM pauses ORDER BY start_at')).map(toPause);
      return meds.map((medication) => ({
        medication,
        versions: versions.filter((v) => v.medicationId === medication.id),
        pauses: pauses.filter((p) => p.medicationId === medication.id),
      }));
    },

    create(input: MedicationInput): Promise<string> {
      return queue.run(async () => {
        const errors = validateMedicationInput(input);
        if (Object.keys(errors).length) throw new ValidationError(errors as Record<string, string>);
        const id = newId();
        const ts = nowIso();
        await db.transaction(async () => {
          await db.run(
            `INSERT INTO medications (id, name, strength, form, unit_label, notes, restock_lead_days, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, input.name.trim(), input.strength, input.form, input.unitLabel || 'unidade', input.notes, input.restockLeadDays, ts, ts],
          );
          await insertVersion(id, initialEffectiveFrom(input.startDate, today()), input, ts);
          if (input.initialStock !== null) await insertStock(id, 'set', input.initialStock, 'Estoque inicial', ts);
        });
        return id;
      });
    },

    /**
     * Edita dados descritivos no lugar e, se a programação mudou, cria uma NOVA
     * versão a partir de agora. Versões e eventos anteriores ficam intactos.
     */
    update(id: string, input: MedicationInput): Promise<{ newVersion: boolean }> {
      return queue.run(async () => {
        const errors = validateMedicationInput({ ...input, initialStock: null });
        if (Object.keys(errors).length) throw new ValidationError(errors as Record<string, string>);
        const plan = await medications.plan(id);
        if (!plan) throw new Error('Medicamento não encontrado');
        const latest = plan.versions[plan.versions.length - 1]!;
        const changed = scheduleChanged(latest, input);
        const ts = nowIso();
        await db.transaction(async () => {
          await db.run(
            `UPDATE medications SET name = ?, strength = ?, form = ?, unit_label = ?, notes = ?, restock_lead_days = ?,
             updated_at = ?, sync_status = 'pending' WHERE id = ?`,
            [input.name.trim(), input.strength, input.form, input.unitLabel || 'unidade', input.notes, input.restockLeadDays, ts, id],
          );
          if (changed) {
            // Versões que ainda não entraram em vigor (início futuro) e não têm
            // eventos nunca geraram doses: podem ser substituídas.
            await db.run(
              `DELETE FROM schedule_versions WHERE medication_id = ? AND effective_from > ?
               AND id NOT IN (SELECT schedule_id FROM dose_events WHERE medication_id = ?)`,
              [id, nowLocal(), id],
            );
            const from = input.startDate > today() ? `${input.startDate}T00:00` : nowLocal();
            await insertVersion(id, from, input, ts);
          }
        });
        return { newVersion: changed };
      });
    },

    pause(id: string) {
      return queue.run(async () => {
        const plan = await medications.plan(id);
        if (!plan || isPausedNow(plan.pauses)) return;
        const ts = nowIso();
        await db.run('INSERT INTO pauses (id, medication_id, start_at, end_at, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)', [
          newId(),
          id,
          nowLocal(),
          ts,
          ts,
        ]);
      });
    },

    resume(id: string) {
      return queue.run(async () => {
        await db.run("UPDATE pauses SET end_at = ?, updated_at = ?, sync_status = 'pending' WHERE medication_id = ? AND end_at IS NULL", [
          nowLocal(),
          nowIso(),
          id,
        ]);
      });
    },

    /** Arquivar não apaga nada: só interrompe doses futuras. */
    archive(id: string) {
      return queue.run(async () => {
        await db.run("UPDATE medications SET archived_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ? AND archived_at IS NULL", [
          nowLocal(),
          nowIso(),
          id,
        ]);
      });
    },

    unarchive(id: string) {
      return queue.run(async () => {
        await db.run("UPDATE medications SET archived_at = NULL, updated_at = ?, sync_status = 'pending' WHERE id = ?", [nowIso(), id]);
      });
    },
  };

  async function insertVersion(medicationId: string, effectiveFrom: string, input: MedicationInput, ts: string) {
    const times = [...input.times].sort((a, b) => a.time.localeCompare(b.time));
    const days = [...new Set(input.daysOfWeek)].sort();
    await db.run(
      `INSERT INTO schedule_versions (id, medication_id, effective_from, times_json, days_json, start_date, end_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId(), medicationId, effectiveFrom, JSON.stringify(times), JSON.stringify(days), input.startDate, input.endDate, ts],
    );
  }

  async function insertStock(medicationId: string, kind: StockEntry['kind'], amount: number, note: string | null, ts: string) {
    await db.run('INSERT INTO stock_entries (id, medication_id, kind, amount, recorded_at, note) VALUES (?, ?, ?, ?, ?, ?)', [
      newId(),
      medicationId,
      kind,
      amount,
      ts,
      note,
    ]);
  }

  // ------------------------------------------------------------------- doses
  async function eventsForKey(doseKey: string): Promise<DoseEvent[]> {
    return (await db.all<DoseEventRow>('SELECT * FROM dose_events WHERE dose_key = ? ORDER BY recorded_at, id', [doseKey])).map(toEvent);
  }

  async function resolveKey(occ: DoseOccurrence): Promise<ResolvedDose> {
    const s = await settings.get();
    return resolveDose(await eventsForKey(occ.doseKey), localDateTimeToDate(occ.localDateTime, timeZone()), now(), {
      unconfirmedAfterMinutes: s.unconfirmedAfterMinutes,
    });
  }

  async function insertEvent(
    occ: DoseOccurrence,
    type: DoseEventType,
    extra: { quantity?: number; snoozeUntil?: string | null; correctsEventId?: string | null; note?: string | null } = {},
  ): Promise<string> {
    const { deviceId } = await settings.get();
    const id = newId();
    const n = now();
    await db.run(
      `INSERT INTO dose_events (id, dose_key, medication_id, schedule_id, scheduled_local, scheduled_at, type, quantity,
        snooze_until, corrects_event_id, recorded_at, tz_offset_min, device_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        occ.doseKey,
        occ.medicationId,
        occ.scheduleId,
        occ.localDateTime,
        localDateTimeToDate(occ.localDateTime, timeZone()).toISOString(),
        type,
        type === 'taken' ? (extra.quantity ?? occ.quantity) : 0,
        extra.snoozeUntil ?? null,
        extra.correctsEventId ?? null,
        n.toISOString(),
        offsetMin(n),
        deviceId,
        extra.note ?? null,
      ],
    );
    return id;
  }

  const doses = {
    eventsForKey,
    resolve: resolveKey,

    async eventsBetween(fromLocal: string, toLocal: string): Promise<DoseEvent[]> {
      return (
        await db.all<DoseEventRow>('SELECT * FROM dose_events WHERE scheduled_local >= ? AND scheduled_local < ? ORDER BY recorded_at, id', [
          fromLocal,
          toLocal,
        ])
      ).map(toEvent);
    },

    async eventsForMedication(medicationId: string): Promise<DoseEvent[]> {
      return (await db.all<DoseEventRow>('SELECT * FROM dose_events WHERE medication_id = ? ORDER BY recorded_at, id', [medicationId])).map(toEvent);
    },

    /** "Tomei". Só é aceito uma vez por dose; nunca é chamado automaticamente. */
    markTaken(occ: DoseOccurrence, quantity?: number) {
      return queue.run(async () => {
        const r = await resolveKey(occ);
        if (!isOpen(r.status)) throw new DoseAlreadyRecordedError(r.status);
        await insertEvent(occ, 'taken', { quantity });
      });
    },

    /** "Não tomei". */
    markSkipped(occ: DoseOccurrence) {
      return queue.run(async () => {
        const r = await resolveKey(occ);
        if (!isOpen(r.status)) throw new DoseAlreadyRecordedError(r.status);
        await insertEvent(occ, 'skipped');
      });
    },

    /** Adiar: muda apenas quando o lembrete toca de novo. Horário-base e programação não mudam. */
    snooze(occ: DoseOccurrence, minutes: 10 | 15 | 30): Promise<string> {
      return queue.run(async () => {
        const r = await resolveKey(occ);
        if (!isOpen(r.status)) throw new DoseAlreadyRecordedError(r.status);
        const until = new Date(now().getTime() + minutes * 60_000).toISOString();
        await insertEvent(occ, 'snoozed', { snoozeUntil: until });
        return until;
      });
    },

    /**
     * Correção auditável: grava um novo evento que aponta para o registro
     * corrigido. O original permanece no histórico. Em conflito, corrige todos
     * os lados divergentes da escolha do usuário.
     */
    correct(occ: DoseOccurrence, to: 'taken' | 'skipped' | 'reset', note: string | null = null, quantity?: number) {
      return queue.run(async () => {
        const events = await eventsForKey(occ.doseKey);
        const heads = headEvents(events).filter((e) => e.type !== 'reset');
        if (heads.length === 0) throw new Error('Não há registro para corrigir.');
        // Corrige cada registro vigente que diverge da escolha. Se o único
        // registro já é "tomada", uma correção só é gravada para mudar a quantidade.
        const targets = heads.filter(
          (h) => h.type !== to || (heads.length === 1 && to === 'taken' && quantity !== undefined && quantity !== h.quantity),
        );
        if (targets.length === 0) return;
        await db.transaction(async () => {
          for (const head of targets) await insertEvent(occ, to, { correctsEventId: head.id, note, quantity });
        });
      });
    },
  };

  // ------------------------------------------------------------------- stock
  const stock = {
    async entries(medicationId: string): Promise<StockEntry[]> {
      return (await db.all<StockRow>('SELECT * FROM stock_entries WHERE medication_id = ? ORDER BY recorded_at, id', [medicationId])).map(toStock);
    },
    add(medicationId: string, amount: number, note: string | null = null) {
      return queue.run(async () => {
        if (!(amount > 0) || amount > 100000) throw new ValidationError({ amount: 'Informe uma quantidade maior que zero.' });
        await insertStock(medicationId, 'add', amount, note, nowIso());
      });
    },
    /** Contagem manual: define o saldo atual. */
    set(medicationId: string, amount: number, note: string | null = null) {
      return queue.run(async () => {
        if (!(amount >= 0) || amount > 100000) throw new ValidationError({ amount: 'Informe uma quantidade válida.' });
        await insertStock(medicationId, 'set', amount, note, nowIso());
      });
    },
  };

  // ----------------------------------------------------- notification audit
  /** Registro de respostas a notificações: garante que cada toque seja processado uma única vez. */
  const notificationResponses = {
    async wasProcessed(id: string): Promise<boolean> {
      return (await db.first<{ id: string }>('SELECT id FROM notification_responses WHERE id = ?', [id])) !== null;
    },
    /** Retorna false se a resposta já tinha sido registrada. */
    async record(id: string, action: string, doseKey: string | null, outcome: string): Promise<boolean> {
      const r = await db.run(
        'INSERT OR IGNORE INTO notification_responses (id, action, dose_key, outcome, processed_at) VALUES (?, ?, ?, ?, ?)',
        [id, action, doseKey, outcome, nowIso()],
      );
      return r.changes > 0;
    },
    async list(doseKey: string) {
      return db.all<{ id: string; action: string; outcome: string; processed_at: string }>(
        'SELECT id, action, outcome, processed_at FROM notification_responses WHERE dose_key = ? ORDER BY processed_at',
        [doseKey],
      );
    },
  };

  // ----------------------------------------------------------------- privacy
  const privacy = {
    /** Exclui TODOS os dados pessoais deste aparelho. Irreversível. */
    wipeAll() {
      return queue.run(async () => {
        await db.transaction(async () => {
          for (const t of PERSONAL_TABLES) await db.run(`DELETE FROM ${t}`);
        });
        await db.exec('VACUUM');
      });
    },
    /** Exportação legível dos dados do usuário (portabilidade, LGPD art. 18). */
    async exportAll() {
      const out: Record<string, unknown[]> = {};
      for (const t of PERSONAL_TABLES) out[t] = await db.all(`SELECT * FROM ${t}`);
      return { exportedAt: nowIso(), app: 'cuidar', schema: out };
    },
  };

  return { settings, medications, doses, stock, privacy, notificationResponses, clock: { now, nowLocal, today, timeZone } };
}

export type Repositories = ReturnType<typeof createRepositories>;
