import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { DesiredNotification, NotificationScheduler, PermissionSnapshot } from './types';
import { MAX_PENDING } from './types';

/** Adaptador real: expo-notifications agenda no sistema operacional (funciona offline e com o app fechado). */
export function createExpoScheduler(): NotificationScheduler {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  return {
    platform,
    maxPending: MAX_PENDING[platform],

    async getPermissions(): Promise<PermissionSnapshot> {
      const s = await Notifications.getPermissionsAsync();
      let notifications: PermissionSnapshot['notifications'];
      if (platform === 'ios' && s.ios) {
        const st = s.ios.status;
        notifications =
          st === Notifications.IosAuthorizationStatus.AUTHORIZED
            ? 'granted'
            : st === Notifications.IosAuthorizationStatus.PROVISIONAL
              ? 'provisional'
              : st === Notifications.IosAuthorizationStatus.EPHEMERAL
                ? 'ephemeral'
                : st === Notifications.IosAuthorizationStatus.DENIED
                  ? 'denied'
                  : 'undetermined';
      } else {
        notifications = s.granted ? 'granted' : s.status === 'denied' ? 'denied' : 'undetermined';
      }
      let exactAlarms: PermissionSnapshot['exactAlarms'] = 'not-applicable';
      if (platform === 'android') {
        try {
          exactAlarms = (await Notifications.getExactAlarmPermissionsAsync()).granted ? 'granted' : 'denied';
        } catch {
          exactAlarms = 'denied';
        }
      }
      return { notifications, canAskAgain: s.canAskAgain, exactAlarms };
    },

    async getScheduled() {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      return all.map((r) => ({ id: r.identifier, data: r.content.data as DesiredNotification['data'] | undefined }));
    },

    async schedule(n: DesiredNotification) {
      await Notifications.scheduleNotificationAsync({
        identifier: n.id,
        content: {
          title: n.title,
          body: n.body,
          data: n.data as unknown as Record<string, unknown>,
          sound: 'default',
          ...(n.categoryId ? { categoryIdentifier: n.categoryId } : {}),
          ...(platform === 'android' ? { priority: Notifications.AndroidNotificationPriority.MAX, color: '#0E7490' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: n.fireAt,
          channelId: n.channelId,
          delivery: n.delivery,
        },
      });
    },

    cancel: (id) => Notifications.cancelScheduledNotificationAsync(id),

    async getPresented() {
      const all = await Notifications.getPresentedNotificationsAsync();
      return all.map((n) => ({ id: n.request.identifier, data: n.request.content.data as DesiredNotification['data'] | undefined }));
    },

    dismiss: (id) => Notifications.dismissNotificationAsync(id),
  };
}

/** Identidade única de um toque: mesma notificação + mesma ação + mesma entrega. */
export function responseIdOf(r: Notifications.NotificationResponse): string {
  return `${r.notification.request.identifier}|${r.actionIdentifier}|${r.notification.date}`;
}
