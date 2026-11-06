import { useState } from 'react';
import { Alert, View } from 'react-native';
import { daysBetween, formatBrDate } from '@/domain/time';
import { parseQuantity } from '@/domain/validation';
import type { StockSummary } from '@/services/agenda';
import { useAction, useApp, useLoad } from '@/state/AppProvider';
import { Body, Button, Card, Field, Heading, Loading, Notice, Row, Screen, Small, Title } from '@/ui/components';
import { unitPlural } from '@/ui/format';
import { space } from '@/ui/theme';

export default function Estoque() {
  const { data } = useLoad(async ({ agenda, repos }) => ({ list: await agenda.stockOverview(), today: repos.clock.today() }));

  return (
    <Screen>
      <Title>Estoque</Title>
      <Small>O estoque só diminui quando você confirma uma dose. A previsão usa a programação cadastrada, incluindo pausas e quantidades diferentes por horário.</Small>
      {!data ? (
        <Loading />
      ) : data.list.length === 0 ? (
        <Card>
          <Body muted>Cadastre um medicamento para controlar o estoque.</Body>
        </Card>
      ) : (
        data.list.map((s) => <StockCard key={s.medication.id} summary={s} today={data.today} />)
      )}
    </Screen>
  );
}

function StockCard({ summary, today }: { summary: StockSummary; today: string }) {
  const { repos } = useApp();
  const { act, busy } = useAction();
  const [mode, setMode] = useState<null | 'add' | 'set'>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const { medication: med, stock, forecast, level } = summary;

  const close = () => {
    setMode(null);
    setText('');
    setError(undefined);
  };

  const save = async () => {
    const n = parseQuantity(text);
    if (n === null) {
      setError('Informe um número.');
      return;
    }
    const err = await act(() => (mode === 'add' ? repos.stock.add(med.id, n) : repos.stock.set(med.id, n)));
    if (err) setError(err.message);
    else close();
  };

  let forecastText = '';
  if (forecast?.noFutureDoses) forecastText = 'Sem doses futuras programadas.';
  else if (forecast && forecast.runsOutOn === null) forecastText = 'Cobre todas as doses dos próximos 6 meses.';
  else if (forecast?.runsOutOn) {
    const d = daysBetween(today, forecast.runsOutOn);
    forecastText = d <= 0 ? 'Não cobre a próxima dose.' : `Deve acabar em ${formatBrDate(forecast.runsOutOn)} (${d} ${d === 1 ? 'dia' : 'dias'}).`;
  }

  return (
    <Card>
      <Heading>{[med.name, med.strength].filter(Boolean).join(' ')}</Heading>
      {stock === null ? (
        <Body muted>Estoque não controlado.</Body>
      ) : (
        <>
          <Body bold style={{ fontSize: 24, lineHeight: 30 }}>
            {unitPlural(stock, med.unitLabel)}
          </Body>
          <Body>{forecastText}</Body>
          {level === 'soon' ? (
            <Notice tone="warn" icon="alert-circle">
              Hora de providenciar reposição (aviso com {med.restockLeadDays} dias de antecedência).
            </Notice>
          ) : null}
          {level === 'out' ? (
            <Notice tone="warn" icon="alert-circle">
              Estoque insuficiente para a próxima dose.
            </Notice>
          ) : null}
        </>
      )}

      {mode ? (
        <View style={{ gap: space.sm }}>
          <Field
            label={mode === 'add' ? 'Quantas unidades entraram?' : 'Quantas unidades você tem agora?'}
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            autoFocus
            error={error}
          />
          <Row>
            <Button style={{ flex: 1 }} label="Salvar" icon="checkmark" loading={busy} onPress={save} />
            <Button style={{ flex: 1 }} variant="secondary" label="Cancelar" onPress={close} />
          </Row>
        </View>
      ) : stock === null ? (
        <Button variant="secondary" icon="cube-outline" label="Informar quantidade atual" onPress={() => setMode('set')} />
      ) : (
        <Row>
          <Button style={{ flex: 1 }} icon="add" label="Entrada" accessibilityHint="Somar unidades compradas" onPress={() => setMode('add')} />
          <Button
            style={{ flex: 1 }}
            variant="secondary"
            label="Recontar"
            onPress={() =>
              Alert.alert('Recontar estoque', 'Use quando a quantidade real for diferente da mostrada. O valor informado substitui o saldo atual.', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Continuar', onPress: () => setMode('set') },
              ])
            }
          />
        </Row>
      )}
      <Small>Aviso de reposição: {med.restockLeadDays} dias antes. Altere em Medicamentos › Editar.</Small>
    </Card>
  );
}
