import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';
import { isPausedNow } from '@/domain/schedule';
import { formatBrDate } from '@/domain/time';
import { useAction, useApp, useLoad } from '@/state/AppProvider';
import { Body, Button, Card, Heading, Loading, Notice, Screen, Small, StatusBadge, Title } from '@/ui/components';
import { scheduleSummary, unitPlural } from '@/ui/format';
import { space } from '@/ui/theme';

export default function MedicamentoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repos } = useApp();
  const { act, busy } = useAction();
  const { data } = useLoad(
    async ({ repos, agenda }) => {
      const [plan, stock, history] = await Promise.all([repos.medications.plan(id), agenda.stock(id), agenda.history(30, id)]);
      return { plan, stock, history };
    },
    [id],
  );

  if (!data) return <Screen><Loading /></Screen>;
  const { plan, stock, history } = data;
  if (!plan) return <Screen><Body>Medicamento não encontrado.</Body></Screen>;

  const med = plan.medication;
  const paused = isPausedNow(plan.pauses);
  const archived = med.archivedAt !== null;
  const latest = plan.versions[plan.versions.length - 1];
  const run = async (fn: () => Promise<unknown>) => {
    const err = await act(fn);
    if (err) Alert.alert('Não foi possível concluir', err.message);
  };
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: med.name }} />
      <View style={{ gap: space.xs }}>
        <Title>{med.name}</Title>
        {med.strength || med.form ? <Body muted>{[med.strength, med.form].filter(Boolean).join(' · ')}</Body> : null}
      </View>

      {archived ? <Notice tone="warn" icon="archive">Arquivado. Nenhuma dose nova é programada; o histórico foi mantido.</Notice> : null}
      {paused && !archived ? <Notice tone="warn" icon="pause-circle">Pausado. As doses voltam a aparecer quando você retomar.</Notice> : null}

      <Card>
        <Heading>Programação</Heading>
        {latest ? <Body>{scheduleSummary(latest)}</Body> : null}
        {latest ? <Small>Desde {formatBrDate(latest.startDate)}</Small> : null}
        {plan.versions.length > 1 ? <Small>{plan.versions.length - 1} alteração(ões) anteriores preservadas.</Small> : null}
        {med.notes ? <Body muted>Obs.: {med.notes}</Body> : null}
        {!archived ? <Button variant="secondary" icon="create-outline" label="Editar" onPress={() => router.push({ pathname: '/medicamento/editar/[id]', params: { id } })} /> : null}
      </Card>

      <Card>
        <Heading>Estoque</Heading>
        <Body>{stock?.stock == null ? 'Estoque não controlado.' : unitPlural(stock.stock, med.unitLabel)}</Body>
        <Button variant="secondary" icon="cube-outline" label="Abrir estoque" onPress={() => router.push('/estoque')} />
      </Card>

      {!archived ? (
        <View style={{ gap: space.sm }}>
          {paused ? (
            <Button icon="play" label="Retomar" loading={busy} onPress={() => run(() => repos.medications.resume(id))} />
          ) : (
            <Button variant="secondary" icon="pause" label="Pausar" loading={busy} onPress={() => run(() => repos.medications.pause(id))} />
          )}
          <Button
            variant="secondary"
            icon="archive-outline"
            label="Arquivar"
            disabled={busy}
            onPress={() =>
              Alert.alert('Arquivar medicamento?', 'Ele sai da sua lista e não gera novas doses. O histórico continua salvo.', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Arquivar', onPress: () => run(() => repos.medications.archive(id)) },
              ])
            }
          />
        </View>
      ) : (
        <Button variant="secondary" icon="refresh" label="Voltar a usar" loading={busy} onPress={() => run(() => repos.medications.unarchive(id))} />
      )}

      <Heading>Últimos 30 dias</Heading>
      {history.length === 0 ? <Body muted>Sem doses registradas ou programadas no período.</Body> : null}
      {history.slice(0, 40).map((d) => (
        <Card key={d.occurrence.doseKey} style={{ paddingVertical: space.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
            <Body bold>
              {d.occurrence.localDateTime.slice(8, 10)}/{d.occurrence.localDateTime.slice(5, 7)} {d.occurrence.localDateTime.slice(11)}
            </Body>
            <StatusBadge status={d.resolved.status} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
