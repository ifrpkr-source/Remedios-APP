import { Body, Card, Heading, Notice, Screen, Small, Title } from '@/ui/components';

/**
 * Acompanhamento familiar depende de conta e sincronização (Fase C).
 * A tela descreve o funcionamento sem simular um convite que não existe.
 */
export default function Familia() {
  return (
    <Screen>
      <Title>Família</Title>
      <Notice icon="construct-outline">Disponível na próxima etapa, junto com a criação de conta. Nada é compartilhado nesta versão.</Notice>
      <Card>
        <Heading>Como vai funcionar</Heading>
        <Body>• Você convida um familiar e decide se autoriza o acompanhamento.</Body>
        <Body>• O familiar só pode ver a agenda e os registros. Ele não altera nada.</Body>
        <Body>• Você pode revogar o acesso a qualquer momento.</Body>
        <Body>• Se uma dose ficar sem confirmação por um tempo que você escolher, o familiar recebe um aviso.</Body>
      </Card>
      <Small>
        O aviso dirá que a dose “não foi confirmada”. O app nunca afirma que alguém deixou de tomar um medicamento sem esse registro.
      </Small>
    </Screen>
  );
}
