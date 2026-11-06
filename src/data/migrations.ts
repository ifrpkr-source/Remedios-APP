import type { SqlDatabase } from './sql';

/**
 * Migrações versionadas via PRAGMA user_version. Nunca editar uma migração já
 * publicada: adicionar uma nova ao final.
 *
 * Colunas sync_status/updated_at preparam a sincronização (Fase C): toda linha
 * nasce como 'pending' e será enviada ao Supabase por uma fila de saída.
 */
const MIGRATIONS: string[] = [
  /* 1 */ `
  CREATE TABLE medications (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    strength TEXT,
    form TEXT,
    unit_label TEXT NOT NULL DEFAULT 'unidade',
    notes TEXT,
    archived_at TEXT,
    restock_lead_days INTEGER NOT NULL DEFAULT 7 CHECK (restock_lead_days BETWEEN 0 AND 90),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );

  CREATE TABLE schedule_versions (
    id TEXT PRIMARY KEY NOT NULL,
    medication_id TEXT NOT NULL REFERENCES medications(id),
    effective_from TEXT NOT NULL,
    times_json TEXT NOT NULL,
    days_json TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    created_at TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );
  CREATE INDEX idx_schedule_med ON schedule_versions(medication_id, effective_from);

  CREATE TABLE pauses (
    id TEXT PRIMARY KEY NOT NULL,
    medication_id TEXT NOT NULL REFERENCES medications(id),
    start_at TEXT NOT NULL,
    end_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );
  CREATE INDEX idx_pauses_med ON pauses(medication_id);

  CREATE TABLE dose_events (
    id TEXT PRIMARY KEY NOT NULL,
    dose_key TEXT NOT NULL,
    medication_id TEXT NOT NULL REFERENCES medications(id),
    schedule_id TEXT NOT NULL,
    scheduled_local TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('taken', 'skipped', 'snoozed', 'reset')),
    quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    snooze_until TEXT,
    corrects_event_id TEXT REFERENCES dose_events(id),
    recorded_at TEXT NOT NULL,
    tz_offset_min INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    note TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    CHECK (type = 'taken' OR quantity = 0),
    CHECK (type <> 'snoozed' OR snooze_until IS NOT NULL)
  );
  CREATE INDEX idx_events_key ON dose_events(dose_key);
  CREATE INDEX idx_events_med_local ON dose_events(medication_id, scheduled_local);

  -- Eventos de dose são somente-inclusão: o conteúdo nunca muda depois de gravado.
  CREATE TRIGGER dose_events_immutable
  BEFORE UPDATE OF dose_key, medication_id, schedule_id, scheduled_local, scheduled_at, type, quantity,
                   snooze_until, corrects_event_id, recorded_at, device_id ON dose_events
  BEGIN
    SELECT RAISE(ABORT, 'dose_events é somente-inclusão');
  END;

  CREATE TABLE stock_entries (
    id TEXT PRIMARY KEY NOT NULL,
    medication_id TEXT NOT NULL REFERENCES medications(id),
    kind TEXT NOT NULL CHECK (kind IN ('set', 'add')),
    amount REAL NOT NULL CHECK (amount >= 0),
    recorded_at TEXT NOT NULL,
    note TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );
  CREATE INDEX idx_stock_med ON stock_entries(medication_id, recorded_at);

  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
  /* 2 — Fase B: respostas a notificações processadas (idempotência + auditoria) */
  `
  CREATE TABLE notification_responses (
    id TEXT PRIMARY KEY NOT NULL,
    action TEXT NOT NULL,
    dose_key TEXT,
    outcome TEXT NOT NULL,
    processed_at TEXT NOT NULL
  );
  CREATE INDEX idx_notif_resp_dose ON notification_responses(dose_key);
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrate(db: SqlDatabase): Promise<void> {
  await db.exec('PRAGMA foreign_keys = ON;');
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current > MIGRATIONS.length) {
    throw new Error(`Banco local em versão ${current}, mais nova que o app (${MIGRATIONS.length}).`);
  }
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.transaction(async () => {
      await db.exec(MIGRATIONS[v]!);
      await db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

/** Tabelas com dados pessoais — usadas na exclusão total. Ordem respeita chaves estrangeiras. */
export const PERSONAL_TABLES = [
  'notification_responses',
  'dose_events',
  'stock_entries',
  'pauses',
  'schedule_versions',
  'medications',
  'settings',
] as const;
