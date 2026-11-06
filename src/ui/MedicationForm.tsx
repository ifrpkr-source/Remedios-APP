import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatBrDate, normalizeTime, parseBrDate, type LocalDate } from '@/domain/time';
import type { MedicationInput } from '@/domain/types';
import { parseQuantity, validateMedicationInput, type FieldErrors } from '@/domain/validation';
import { Body, Button, Card, Chip, DayPicker, Field, Heading, Notice, Row, Small, Stepper } from './components';
import { FORMS } from './format';
import { colors, space, type } from './theme';

interface TimeRow {
  key: number;
  text: string;
  quantity: number;
}

let rowKey = 0;

export function MedicationForm({
  initial,
  today,
  mode,
  onSubmit,
}: {
  initial?: MedicationInput;
  today: LocalDate;
  mode: 'create' | 'edit';
  onSubmit: (input: MedicationInput) => Promise<Error | null>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [strength, setStrength] = useState(initial?.strength ?? '');
  const [form, setForm] = useState<string>(initial?.form ?? 'comprimido');
  const [unitLabel, setUnitLabel] = useState(initial?.unitLabel ?? 'comprimido');
  const [times, setTimes] = useState<TimeRow[]>(
    (initial?.times ?? [{ time: '08:00', quantity: 1 }]).map((t) => ({ key: ++rowKey, text: t.time, quantity: t.quantity })),
  );
  const [days, setDays] = useState<number[]>(initial?.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6]);
  const [startText, setStartText] = useState(formatBrDate(initial?.startDate ?? today));
  const [endText, setEndText] = useState(initial?.endDate ? formatBrDate(initial.endDate) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [stockText, setStockText] = useState('');
  const [leadText, setLeadText] = useState(String(initial?.restockLeadDays ?? 7));
  const [more, setMore] = useState(mode === 'edit');
  const [errors, setErrors] = useState<FieldErrors & { form?: string }>({});
  const [saving, setSaving] = useState(false);

  const updateTime = (key: number, patch: Partial<TimeRow>) => setTimes((ts) => ts.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  const build = (): MedicationInput | null => {
    const errs: FieldErrors = {};
    const normTimes = times.map((t) => ({ time: normalizeTime(t.text) ?? t.text, quantity: t.quantity }));
    const startDate = parseBrDate(startText);
    const endDate = endText.trim() ? parseBrDate(endText) : null;
    if (!startDate) errs.startDate = 'Data de início inválida (use dd/mm/aaaa).';
    if (endText.trim() && !endDate) errs.endDate = 'Data de término inválida (use dd/mm/aaaa).';
    const stock = stockText.trim() ? parseQuantity(stockText) : null;
    if (stockText.trim() && stock === null) errs.initialStock = 'Informe um número.';
    const lead = Number(leadText);
    const input: MedicationInput = {
      name,
      strength: strength.trim() || null,
      form,
      unitLabel,
      notes: notes.trim() || null,
      times: normTimes,
      daysOfWeek: days,
      startDate: startDate ?? '',
      endDate,
      restockLeadDays: Number.isFinite(lead) ? lead : -1,
      initialStock: mode === 'create' ? stock : null,
    };
    const all = { ...validateMedicationInput(input), ...errs };
    setErrors(all);
    if (Object.keys(all).length > 0) {
      if (all.endDate || all.initialStock || all.restockLeadDays) setMore(true);
      return null;
    }
    return input;
  };

  const submit = async () => {
    const input = build();
    if (!input) return;
    setSaving(true);
    const err = await onSubmit(input);
    setSaving(false);
    if (err) setErrors({ form: err.message });
  };

  return (
    <View style={{ gap: space.lg }}>
      <Field label="Nome do medicamento" value={name} onChangeText={setName} autoCapitalize="sentences" returnKeyType="next" error={errors.name} />
      <Field
        label="Concentração (opcional)"
        hint="Como está na embalagem ou receita, ex.: 500 mg"
        value={strength}
        onChangeText={setStrength}
      />

      <View style={{ gap: space.sm }}>
        <Text style={[type.bodyBold, { color: colors.foreground }]}>Apresentação</Text>
        <Row wrap>
          {FORMS.map((f) => (
            <Chip
              key={f.form}
              label={f.label}
              selected={form === f.form}
              onPress={() => {
                setForm(f.form);
                setUnitLabel(f.unit);
              }}
            />
          ))}
        </Row>
      </View>

      <Card>
        <Heading>Horários</Heading>
        <Small>Quantidade de {unitLabel === 'ml' ? 'ml' : unitLabel} em cada horário, conforme sua orientação médica.</Small>
        {times.map((t, i) => (
          <View key={t.key} style={{ gap: space.sm, paddingTop: i > 0 ? space.md : 0, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.divider }}>
            <Row gap={space.md} style={{ alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Field
                  label={`Horário ${i + 1}`}
                  value={t.text}
                  placeholder="08:00"
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  onChangeText={(text) => updateTime(t.key, { text })}
                  onBlur={() => {
                    const n = normalizeTime(t.text);
                    if (n) updateTime(t.key, { text: n });
                  }}
                />
              </View>
              <Stepper label={`quantidade do horário ${i + 1}`} value={t.quantity} onChange={(quantity) => updateTime(t.key, { quantity })} />
            </Row>
            {times.length > 1 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Remover horário ${i + 1}`} onPress={() => setTimes((ts) => ts.filter((x) => x.key !== t.key))} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={[type.bodyBold, { color: colors.danger }]}>Remover horário</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {errors.times ? <Text style={[type.small, { color: colors.danger }]}>{errors.times}</Text> : null}
        <Button variant="secondary" icon="add" label="Adicionar horário" onPress={() => setTimes((ts) => [...ts, { key: ++rowKey, text: '', quantity: ts[ts.length - 1]?.quantity ?? 1 }])} />
      </Card>

      <DayPicker value={days} onChange={setDays} error={errors.daysOfWeek} />

      <Field label="Início" hint="dd/mm/aaaa" value={startText} onChangeText={setStartText} keyboardType="numbers-and-punctuation" maxLength={10} error={errors.startDate} />

      {mode === 'edit' ? (
        <Notice>Mudanças de horário valem a partir de agora. Os registros anteriores continuam no histórico.</Notice>
      ) : null}

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: more }} onPress={() => setMore((m) => !m)} style={{ minHeight: 48, justifyContent: 'center' }}>
        <Text style={[type.bodyBold, { color: colors.primary }]}>{more ? '▾ Menos opções' : '▸ Mais opções (término, estoque, observações)'}</Text>
      </Pressable>

      {more ? (
        <View style={{ gap: space.lg }}>
          <Field label="Término (opcional)" hint="Deixe em branco para uso contínuo" value={endText} onChangeText={setEndText} keyboardType="numbers-and-punctuation" maxLength={10} error={errors.endDate} />
          {mode === 'create' ? (
            <Field
              label={`Estoque atual (opcional)`}
              hint={`Quantos ${unitLabel === 'ml' ? 'ml' : unitLabel + 's'} você tem agora`}
              value={stockText}
              onChangeText={setStockText}
              keyboardType="decimal-pad"
              error={errors.initialStock}
            />
          ) : null}
          <Field label="Avisar reposição com antecedência de (dias)" value={leadText} onChangeText={setLeadText} keyboardType="number-pad" maxLength={2} error={errors.restockLeadDays} />
          <Field label="Observações (opcional)" hint="Ex.: tomar após o café" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 96, textAlignVertical: 'top' }} />
        </View>
      ) : null}

      {errors.form ? <Notice tone="warn">{errors.form}</Notice> : null}
      {Object.keys(errors).length > 0 && !errors.form ? <Body style={{ color: colors.danger }}>Revise os campos destacados.</Body> : null}
      <Button icon="checkmark" label={mode === 'create' ? 'Salvar medicamento' : 'Salvar alterações'} loading={saving} onPress={submit} />
    </View>
  );
}
