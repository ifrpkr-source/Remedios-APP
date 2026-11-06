import { View } from 'react-native';
import { STATUS_LABEL, type DoseStatus } from '@/domain/doseState';
import { datePart, formatLongDate, timePart, toLocalDateTimeInZone } from '@/domain/time';
import type { AgendaDose } from '@/services/agenda';
import { useApp, useLoad } from '@/state/AppProvider';
import { Body, Card, Heading, Loading, Row, Screen, Small, StatusBadge } from '@/ui/components';
import { unitPlural } from '@/ui/format';
import { space } from '@/ui/theme';

const DAYS = 14;

export default function Historico() {
  const { repos } = useApp();
  const { data } = useLoad(({ agenda }) => agenda.history(DAYS));
  const tz = repos.clock.timeZone();

  if (!data) return <Screen edges={['bottom']}><Loading /></Screen>;

  const byDay = new Map<string, AgendaDose[]>();
  for (const d of data) {
    const day = datePart(d.occurrence.localDateTime);
    byDay.set(day, [...(byDay.get(day) ?? []), d]);
  }

  const counts = data.reduce<Partial<Record<DoseStatus, number>>>((acc, d) => {
    acc[d.resolved.status] = (acc[d.resolved.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Screen edges={['bottom']}>
      <Card>
        <Heading>Últimos {DAYS} dias</Heading>
        {(['taken', 'skipped', 'unconfirmed', 'snoozed', 'due', 'conflict'] as DoseStatus[])
          .filter((s) => counts[s])
          .map((s) => (
            <Body key={s}>
              {STATUS_LABEL[s]}: {counts[s]}
            </Body>
          ))}
        {data.length === 0 ? <Body muted>Nada registrado ainda.</Body> : null}
      </Card>

      {[...byDay.entries()].map(([day, doses]) => (
        <View key={day} style={{ gap: space.sm }}>
          <Heading>{formatLongDate(day)}</Heading>
          {doses.map((d) => {
            const head = d.resolved.headEvent;
            const corrected = d.resolved.events.some((e) => e.correctsEventId !== null);
            const snoozes = d.resolved.events.filter((e) => e.type === 'snoozed').length;
            return (
              <Card key={d.occurrence.doseKey} style={{ gap: space.xs }}>
                <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <Body bold>
                    {timePart(d.occurrence.localDateTime)} · {d.medication.name}
                  </Body>
                  <StatusBadge status={d.resolved.status} />
                </Row>
                <Small>
                  Programado: {timePart(d.occurrence.localDateTime)} · {unitPlural(d.occurrence.quantity, d.medication.unitLabel)}
                </Small>
                {head ? <Small>Registrado às {timePart(toLocalDateTimeInZone(new Date(head.recordedAt), tz))}</Small> : null}
                {snoozes > 0 ? <Small>Lembrete adiado {snoozes}×</Small> : null}
                {corrected ? <Small>Registro corrigido ({d.resolved.events.length} eventos guardados)</Small> : null}
              </Card>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}
