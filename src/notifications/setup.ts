import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ACTION, CATEGORY_DOSE, CHANNEL_DOSES, CHANNEL_GENERAL } from './types';

/**
 * Configuração única de canais (Android), categorias de ações e exibição em
 * primeiro plano. Chamada na inicialização do app e na tarefa em segundo plano.
 *
 * Por que as ações diferem entre plataformas:
 * - Android mostra no máximo 3 botões. As ações rodam sem abrir o app (a
 *   tarefa em segundo plano recebe o toque mesmo com o app encerrado).
 * - iOS não entrega ao JavaScript ações que não abrem o app quando ele está
 *   encerrado. Para nunca perder ou registrar errado, todas as ações abrem o app
 *   no iOS; o registro é feito assim que ele inicia.
 */
let configured = false;

export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_DOSES, {
      name: 'Lembretes de doses',
      description: 'Avisos no horário de cada dose',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 400, 250, 400],
      enableVibrate: true,
      // Em telas bloqueadas seguras, o Android segue a preferência do usuário para conteúdo sensível.
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      showBadge: false,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_GENERAL, {
      name: 'Avisos do Cuidar',
      description: 'Reposição de estoque e manutenção dos lembretes',
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
    await Notifications.setNotificationCategoryAsync(CATEGORY_DOSE, [
      { identifier: ACTION.taken, buttonTitle: 'Tomei', options: { opensAppToForeground: false } },
      { identifier: ACTION.snooze10, buttonTitle: 'Adiar 10 min', options: { opensAppToForeground: false } },
      { identifier: ACTION.snooze30, buttonTitle: 'Adiar 30 min', options: { opensAppToForeground: false } },
    ]);
  } else {
    await Notifications.setNotificationCategoryAsync(
      CATEGORY_DOSE,
      [
        { identifier: ACTION.taken, buttonTitle: 'Tomei', options: { opensAppToForeground: true } },
        { identifier: ACTION.snooze10, buttonTitle: 'Adiar 10 minutos', options: { opensAppToForeground: true } },
        { identifier: ACTION.snooze15, buttonTitle: 'Adiar 15 minutos', options: { opensAppToForeground: true } },
        { identifier: ACTION.snooze30, buttonTitle: 'Adiar 30 minutos', options: { opensAppToForeground: true } },
        { identifier: ACTION.open, buttonTitle: 'Abrir o Cuidar', options: { opensAppToForeground: true } },
      ],
      { previewPlaceholder: 'Lembrete de medicamento' },
    );
  }
}

/** Pede permissão de notificações. No iOS não usa modo provisório: lembrete de dose precisa de som e faixa. */
export async function requestNotificationPermission() {
  return Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
}

/** Android 12+: abre a tela do sistema “Alarmes e lembretes”. */
export async function requestExactAlarms(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}
