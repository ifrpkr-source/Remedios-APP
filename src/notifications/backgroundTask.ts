import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { handleNotificationResponse } from './actions';
import { responseIdOf } from './expoScheduler';
import { openHeadlessRuntime } from './runtime';
import { configureNotifications } from './setup';
import type { NotificationData } from './types';

/**
 * Tarefa em segundo plano (Android): recebe toques em “Tomei” / “Adiar”
 * mesmo com o app encerrado. Precisa ser definida no escopo do módulo,
 * carregado antes do expo-router (ver index.ts).
 *
 * Se algo falhar aqui, nada é registrado: a dose continua “sem registro” e o
 * lembrete de acompanhamento ainda dispara. Nunca há registro parcial.
 */
export const NOTIFICATION_TASK = 'CUIDAR_NOTIFICATION_ACTIONS';

TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_TASK, async ({ data, error }) => {
  if (error || !data || !('actionIdentifier' in data)) return Notifications.BackgroundNotificationTaskResult.NoData;
  const response = data as Notifications.NotificationResponse;
  if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    // Toque no corpo abre o app; o app processa ao iniciar.
    return Notifications.BackgroundNotificationTaskResult.NoData;
  }
  try {
    await configureNotifications();
    const rt = await openHeadlessRuntime();
    await handleNotificationResponse(rt, {
      responseId: responseIdOf(response),
      actionId: response.actionIdentifier,
      data: response.notification.request.content.data as Partial<NotificationData> | undefined,
    });
    await rt.manager.reconcile('ação em segundo plano');
    await Notifications.dismissNotificationAsync(response.notification.request.identifier);
    return Notifications.BackgroundNotificationTaskResult.NewData;
  } catch {
    return Notifications.BackgroundNotificationTaskResult.Failed;
  }
});

Notifications.registerTaskAsync(NOTIFICATION_TASK).catch(() => {
  // Expo Go ou plataforma sem suporte: o app ainda processa toques ao abrir.
});
