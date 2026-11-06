import { Platform, View } from 'react-native';
import { useAlarms } from '@/state/AlarmsProvider';
import { Button, Notice, Small } from './components';
import { space } from './theme';

/**
 * Status dos lembretes. Compacto na tela Hoje e completo no Perfil.
 * Sempre com texto + ícone (nunca só cor).
 */
export function AlarmStatus({ detailed = false }: { detailed?: boolean }) {
  const { status, requestPermission, requestExactAlarms, openSystemSettings } = useAlarms();
  if (!status) return detailed ? <Small>Verificando lembretes…</Small> : null;
  const h = status.health;

  const tone = h.level === 'ok' ? 'ok' : 'warn';
  const icon = h.level === 'ok' ? 'notifications' : h.level === 'off' ? 'notifications-off' : 'alert-circle';

  if (!detailed && h.level === 'ok') {
    return (
      <Notice tone="ok" icon="notifications">
        {h.title}.
      </Notice>
    );
  }

  return (
    <View style={{ gap: space.sm }} accessibilityLiveRegion="polite">
      <Notice tone={tone} icon={icon}>
        {`${h.title}. ${h.message}`}
      </Notice>
      {h.issues.includes('permission-undetermined') || (h.issues.includes('permission-denied') && h.canRequest) ? (
        <Button icon="notifications" label="Permitir notificações" onPress={requestPermission} />
      ) : null}
      {h.issues.includes('permission-denied-settings') ? (
        <Button variant="secondary" icon="settings-outline" label="Abrir configurações do celular" onPress={openSystemSettings} />
      ) : null}
      {h.issues.includes('exact-alarm-denied') && Platform.OS === 'android' ? (
        <Button variant="secondary" icon="alarm-outline" label="Permitir alarmes no horário exato" onPress={requestExactAlarms} />
      ) : null}
      {h.issues.includes('provisional') ? (
        <Button variant="secondary" icon="settings-outline" label="Ajustar nas configurações" onPress={openSystemSettings} />
      ) : null}
      {detailed && h.level !== 'off' ? <Small>{status.desired} lembretes programados neste aparelho.</Small> : null}
    </View>
  );
}
