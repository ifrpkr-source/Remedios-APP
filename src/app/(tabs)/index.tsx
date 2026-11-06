import { router } from 'expo-router';
import { View } from 'react-native';
import { formatLongDate } from '@/domain/time';
import { useLoad } from '@/state/AppProvider';
import { Body, Button, Card, Heading, Loading, Notice, Screen, Small, Title } from '@/ui/components';
import { AlarmStatus } from '@/ui/AlarmStatus';
import { DoseCard } from '@/ui/DoseCard';
import { space } from '@/ui/theme';

export default function Hoje() {
  const { data, error } = useLoad(async ({ agenda, repos }) => {
    const [doses, meds] = await Promise.all([agenda.today(), repos.medications.list()]);
    return { doses, hasMeds: meds.length > 0, today: repos.clock.today() };
  });

  if (error) return <Screen><Notice tone="warn">Não foi possível carregar a agenda: {error.message}</Notice></Screen>;
  if (!data) return <Screen><Loading /></Screen>;

  const { doses, hasMeds, today } = data;
  const pending = doses.filter((d) => ['pending', 'due', 'snoozed', 'unconfirmed', 'conflict'].includes(d.resolved.status)).length;

  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <Title>Hoje</Title>
        <Body muted>{capitalize(formatLongDate(today))}</Body>
      </View>

      {!hasMeds ? (
        <Card>
          <Heading>Vamos começar</Heading>
          <Body>Cadastre seu primeiro medicamento. Os outros ajustes podem ficar para depois.</Body>
          <Button icon="add-circle" label="Cadastrar medicamento" onPress={() => router.push('/medicamento/novo')} />
          <Small>Este app ajuda a organizar sua rotina. Ele não indica, altera nem avalia tratamentos.</Small>
        </Card>
      ) : (
        <>
          <AlarmStatus />
          {doses.length === 0 ? (
            <Card>
              <Body>Nenhuma dose programada para hoje.</Body>
            </Card>
          ) : (
            <>
              <Body bold accessibilityLiveRegion="polite">
                {pending === 0 ? 'Todas as doses de hoje têm registro.' : `${pending} ${pending === 1 ? 'dose' : 'doses'} sem registro hoje`}
              </Body>
              {doses.map((d) => (
                <DoseCard key={d.occurrence.doseKey} dose={d} />
              ))}
            </>
          )}
          <Button variant="secondary" icon="time-outline" label="Ver histórico" onPress={() => router.push('/historico')} />
        </>
      )}
    </Screen>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
