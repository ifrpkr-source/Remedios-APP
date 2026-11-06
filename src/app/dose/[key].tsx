import { router, Stack, useLocalSearchParams } from 'expo-router';
import { datePart } from '@/domain/time';
import { useLoad } from '@/state/AppProvider';
import { Body, Button, Loading, Notice, Screen } from '@/ui/components';
import { DoseCard } from '@/ui/DoseCard';

/** Aberta pelo toque na notificação: mostra a dose e o medicamento correspondente. */
export default function DoseDetalhe() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const doseKey = decodeURIComponent(key ?? '');
  const ldt = doseKey.split('@')[1] ?? '';
  const { data } = useLoad(
    async ({ agenda }) => (ldt ? ((await agenda.day(datePart(ldt))).find((d) => d.occurrence.doseKey === doseKey) ?? null) : null),
    [doseKey],
  );

  if (data === undefined) return <Screen edges={['bottom']}><Loading /></Screen>;
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Dose' }} />
      {data === null ? (
        <>
          <Notice tone="warn">
            Esta dose não está mais na programação (o medicamento pode ter sido pausado, arquivado ou alterado). Nada foi registrado.
          </Notice>
          <Button label="Ir para Hoje" onPress={() => router.replace('/')} />
        </>
      ) : (
        <>
          <DoseCard dose={data} showDate />
          <Body muted>Adiar muda só o lembrete. O horário da dose e a programação continuam iguais.</Body>
          <Button
            variant="secondary"
            icon="medkit-outline"
            label={`Ver ${data.medication.name}`}
            onPress={() => router.push({ pathname: '/medicamento/[id]', params: { id: data.medication.id } })}
          />
        </>
      )}
    </Screen>
  );
}
