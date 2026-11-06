import { Alert, Share } from 'react-native';
import { FOLLOWUP_OPTIONS } from '@/data/repositories';
import { useAlarms } from '@/state/AlarmsProvider';
import { useAction, useApp, useLoad } from '@/state/AppProvider';
import { AlarmStatus } from '@/ui/AlarmStatus';
import { Body, Button, Card, Chip, Heading, Loading, Row, Screen, Small, Title } from '@/ui/components';

const OPTIONS = [30, 60, 120, 240];

function LembretesCard() {
  const { repos } = useApp();
  const { act } = useAction();
  const { sendTestNotification } = useAlarms();
  const { data: s } = useLoad(({ repos: r }) => r.settings.get());
  if (!s) return <Loading />;

  return (
    <Card>
      <Heading>Lembretes</Heading>
      <Row wrap>
        <Chip label="Ligados" selected={s.alarmsEnabled} onPress={() => act(() => repos.settings.setAlarmsEnabled(true))} />
        <Chip label="Desligados" selected={!s.alarmsEnabled} onPress={() => act(() => repos.settings.setAlarmsEnabled(false))} />
      </Row>
      <AlarmStatus detailed />

      <Body bold>Lembrar de novo se não houver confirmação</Body>
      <Row wrap>
        {FOLLOWUP_OPTIONS.map((m) => (
          <Chip
            key={m}
            label={m === 0 ? 'Não' : m < 60 ? `${m} min` : '1 h'}
            accessibilityLabel={m === 0 ? 'Não lembrar de novo' : `Lembrar de novo após ${m < 60 ? `${m} minutos` : '1 hora'}`}
            selected={s.followupMinutes === m}
            onPress={() => act(() => repos.settings.setFollowupMinutes(m))}
          />
        ))}
      </Row>

      <Body bold>Nome do medicamento na notificação</Body>
      <Row wrap>
        <Chip label="Mostrar" selected={s.showNameInNotification} onPress={() => act(() => repos.settings.setShowNameInNotification(true))} />
        <Chip label="Ocultar" selected={!s.showNameInNotification} onPress={() => act(() => repos.settings.setShowNameInNotification(false))} />
      </Row>
      <Small>Ocultar mostra apenas “Hora do seu medicamento”, útil se outras pessoas veem a tela do seu celular.</Small>

      <Button
        variant="secondary"
        icon="notifications-outline"
        label="Enviar notificação de teste"
        accessibilityHint="Uma notificação de teste chega em cerca de 10 segundos"
        onPress={async () => {
          await sendTestNotification();
          Alert.alert('Teste agendado', 'A notificação deve chegar em cerca de 10 segundos. Você pode bloquear a tela para conferir.');
        }}
      />
    </Card>
  );
}

export default function Perfil() {
  const { repos } = useApp();
  const { act, busy } = useAction();
  const { data: settings } = useLoad(({ repos: r }) => r.settings.get());

  const exportData = async () => {
    const data = await repos.privacy.exportAll();
    await Share.share({ title: 'Meus dados – Cuidar', message: JSON.stringify(data, null, 2) });
  };

  const wipe = () =>
    Alert.alert('Excluir todos os dados?', 'Medicamentos, histórico e estoque serão apagados deste aparelho. Não é possível desfazer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Continuar',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Confirmar exclusão', 'Tem certeza? Esta é a última confirmação.', [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Excluir tudo',
              style: 'destructive',
              onPress: async () => {
                const err = await act(() => repos.privacy.wipeAll());
                Alert.alert(err ? 'Erro' : 'Dados excluídos', err ? err.message : 'Todos os dados deste aparelho foram apagados.');
              },
            },
          ]),
      },
    ]);

  return (
    <Screen>
      <Title>Perfil</Title>

      <LembretesCard />

      <Card>
        <Heading>Dose sem confirmação</Heading>
        <Body>Depois de quanto tempo do horário uma dose aparece como “não confirmada”?</Body>
        {!settings ? (
          <Loading />
        ) : (
          <Row wrap>
            {OPTIONS.map((m) => (
              <Chip
                key={m}
                label={m < 60 ? `${m} min` : `${m / 60} h`}
                accessibilityLabel={m < 60 ? `${m} minutos` : `${m / 60} ${m === 60 ? 'hora' : 'horas'}`}
                selected={settings.unconfirmedAfterMinutes === m}
                onPress={() => act(() => repos.settings.setUnconfirmedAfter(m))}
              />
            ))}
          </Row>
        )}
      </Card>

      <Card>
        <Heading>Privacidade</Heading>
        <Body>Nesta versão, seus dados ficam apenas neste aparelho. Informações de saúde nunca são enviadas a serviços de anúncios.</Body>
        <Button variant="secondary" icon="share-outline" label="Exportar meus dados" onPress={exportData} />
        <Button variant="danger" icon="trash-outline" label="Excluir todos os dados" loading={busy} onPress={wipe} />
      </Card>

      <Card>
        <Heading>Sobre</Heading>
        <Body>Cuidar é um aplicativo de organização. Ele não faz diagnósticos, não prescreve e não recomenda tratamentos. Em caso de dúvida sobre seu tratamento, fale com seu médico ou farmacêutico.</Body>
        <Small>Versão de teste 0.2 (Fase B)</Small>
      </Card>
    </Screen>
  );
}
