import { useState } from 'react';
import { Alert, View } from 'react-native';
import { isOpen } from '@/domain/doseState';
import { timePart, toLocalDateTimeInZone } from '@/domain/time';
import type { AgendaDose } from '@/services/agenda';
import { useAction, useApp } from '@/state/AppProvider';
import { Body, Button, Card, Notice, Row, Small, StatusBadge } from './components';
import { unitPlural } from './format';
import { space } from './theme';

const qty = unitPlural;

export function DoseCard({ dose, showDate = false }: { dose: AgendaDose; showDate?: boolean }) {
  const { repos } = useApp();
  const { act, busy } = useAction();
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const { occurrence: occ, medication: med, resolved } = dose;
  const tz = repos.clock.timeZone();
  const clock = (iso: string) => timePart(toLocalDateTimeInZone(new Date(iso), tz));
  const open = isOpen(resolved.status);

  const run = async (fn: () => Promise<unknown>) => {
    const err = await act(fn);
    if (err) Alert.alert('Não foi possível registrar', err.message);
  };

  const askCorrection = () => {
    const current = resolved.status;
    const opposite = current === 'taken' ? 'skipped' : 'taken';
    Alert.alert(
      'Corrigir registro',
      'O registro anterior fica guardado no histórico. Escolha a correção:',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desfazer registro', onPress: () => run(() => repos.doses.correct(occ, 'reset', 'Registro desfeito')) },
        {
          text: opposite === 'taken' ? 'Marcar como tomada' : 'Marcar como não tomada',
          onPress: () => run(() => repos.doses.correct(occ, opposite, 'Correção do usuário')),
        },
      ],
    );
  };

  const name = [med.name, med.strength].filter(Boolean).join(' ');
  const when = showDate ? `${occ.localDateTime.slice(8, 10)}/${occ.localDateTime.slice(5, 7)} às ${timePart(occ.localDateTime)}` : timePart(occ.localDateTime);

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Body bold style={{ fontSize: 24, lineHeight: 30 }} accessibilityLabel={`Horário ${when}`}>
            {when}
          </Body>
          <Body bold>{name}</Body>
          <Small>{qty(occ.quantity, med.unitLabel)}</Small>
        </View>
        <StatusBadge status={resolved.status} />
      </Row>

      {resolved.status === 'taken' && resolved.headEvent ? <Small>Confirmada às {clock(resolved.headEvent.recordedAt)}</Small> : null}
      {resolved.status === 'skipped' && resolved.headEvent ? <Small>Registrada como não tomada às {clock(resolved.headEvent.recordedAt)}</Small> : null}
      {resolved.status === 'snoozed' && resolved.snoozeUntil ? <Small>Lembrete adiado para {clock(resolved.snoozeUntil)}. O horário da dose não muda.</Small> : null}
      {resolved.status === 'unconfirmed' ? <Small>Ainda sem confirmação. Registre se tomou ou não.</Small> : null}
      {dose.orphan ? <Small>Este horário não faz mais parte da programação, mas o registro foi mantido.</Small> : null}

      {resolved.status === 'conflict' ? (
        <>
          <Notice tone="warn" icon="warning">
            Há registros diferentes para esta dose (por exemplo, de outro aparelho). Confirme o que aconteceu.
          </Notice>
          <Row gap={space.sm}>
            <Button style={{ flex: 1 }} variant="accent" icon="checkmark" label="Tomei" loading={busy} onPress={() => run(() => repos.doses.correct(occ, 'taken', 'Conflito resolvido'))} />
            <Button style={{ flex: 1 }} variant="secondary" label="Não tomei" disabled={busy} onPress={() => run(() => repos.doses.correct(occ, 'skipped', 'Conflito resolvido'))} />
          </Row>
        </>
      ) : null}

      {open ? (
        <View style={{ gap: space.sm }}>
          <Button variant="accent" icon="checkmark-circle" label="Tomei" loading={busy} accessibilityHint={`Registra que tomou ${name}`} onPress={() => run(() => repos.doses.markTaken(occ))} />
          {snoozeOpen ? (
            <Row gap={space.sm}>
              {([10, 15, 30] as const).map((m) => (
                <Button
                  key={m}
                  style={{ flex: 1 }}
                  variant="secondary"
                  label={`${m} min`}
                  accessibilityHint={`Adia o lembrete em ${m} minutos`}
                  disabled={busy}
                  onPress={() => {
                    setSnoozeOpen(false);
                    run(() => repos.doses.snooze(occ, m));
                  }}
                />
              ))}
            </Row>
          ) : (
            <Row gap={space.sm}>
              <Button style={{ flex: 1 }} variant="secondary" icon="alarm-outline" label="Adiar" disabled={busy} onPress={() => setSnoozeOpen(true)} />
              <Button style={{ flex: 1 }} variant="secondary" icon="close" label="Não tomei" disabled={busy} onPress={() => run(() => repos.doses.markSkipped(occ))} />
            </Row>
          )}
        </View>
      ) : null}

      {resolved.status === 'taken' || resolved.status === 'skipped' ? (
        <Button variant="ghost" icon="create-outline" label="Corrigir registro" disabled={busy} onPress={askCorrection} />
      ) : null}
    </Card>
  );
}
