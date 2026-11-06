import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import { handleNotificationResponse, OUTCOME_MESSAGE } from '@/notifications/actions';
import { createExpoScheduler, responseIdOf } from '@/notifications/expoScheduler';
import { createNotificationManager, type ReconcileResult } from '@/notifications/manager';
import { configureNotifications, requestExactAlarms, requestNotificationPermission } from '@/notifications/setup';
import type { NotificationData } from '@/notifications/types';
import { useApp } from './AppProvider';

interface AlarmsContextValue {
  status: ReconcileResult | null;
  reconcile: (reason: string) => Promise<void>;
  requestPermission: () => Promise<void>;
  requestExactAlarms: () => Promise<void>;
  openSystemSettings: () => void;
  sendTestNotification: () => Promise<void>;
}

const AlarmsContext = createContext<AlarmsContextValue | null>(null);

export function AlarmsProvider({ children }: { children: ReactNode }) {
  const { repos, agenda, version, refresh } = useApp();
  const scheduler = useMemo(() => createExpoScheduler(), []);
  const manager = useMemo(() => createNotificationManager({ repos, agenda, scheduler }), [repos, agenda, scheduler]);
  const [status, setStatus] = useState<ReconcileResult | null>(null);
  const ready = useRef(false);

  const reconcile = useCallback(
    async (reason: string) => {
      try {
        await configureNotifications();
        setStatus(await manager.reconcile(reason));
      } catch (e) {
        // Falha de agendamento nunca derruba o app; o status anterior continua visível.
        console.warn('Falha ao reconciliar lembretes', e);
      }
    },
    [manager],
  );

  const process = useCallback(
    async (response: Notifications.NotificationResponse, fromLaunch: boolean) => {
      const res = await handleNotificationResponse(
        { repos, agenda },
        {
          responseId: responseIdOf(response),
          actionId: response.actionIdentifier,
          data: response.notification.request.content.data as Partial<NotificationData> | undefined,
        },
      );
      if (res.outcome === 'duplicate' || res.outcome === 'ignored') return;
      refresh();
      await reconcile(`resposta: ${res.outcome}`);
      if (res.route) router.push(res.route as never);
      const msg = OUTCOME_MESSAGE[res.outcome];
      if (msg && !fromLaunch) Alert.alert('Cuidar', msg);
      else if (msg && fromLaunch) setTimeout(() => Alert.alert('Cuidar', msg), 600);
    },
    [repos, agenda, refresh, reconcile],
  );

  // Inicialização: configura, processa o toque que abriu o app e reconcilia.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await configureNotifications();
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last && !cancelled) {
        await process(last, true);
        await Notifications.clearLastNotificationResponseAsync();
      }
      if (!cancelled) {
        await reconcile('inicialização');
        ready.current = true;
      }
    })();
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      process(r, false).catch((e) => console.warn('Falha ao processar notificação', e));
    });
    const appState = AppState.addEventListener('change', (s) => {
      // Voltar ao app cobre: troca de fuso, permissões alteradas nas configurações, virada do dia.
      if (s === 'active') reconcile('app em primeiro plano');
    });
    return () => {
      cancelled = true;
      sub.remove();
      appState.remove();
    };
  }, [process, reconcile]);

  // Qualquer escrita (Tomei, edição, pausa, estoque...) reagenda, com pequena espera para agrupar.
  useEffect(() => {
    if (!ready.current) return;
    const t = setTimeout(() => reconcile('dados alterados'), 400);
    return () => clearTimeout(t);
  }, [version, reconcile]);

  const value = useMemo<AlarmsContextValue>(
    () => ({
      status,
      reconcile,
      requestPermission: async () => {
        await requestNotificationPermission();
        await reconcile('permissão solicitada');
      },
      requestExactAlarms: async () => {
        await requestExactAlarms();
        await reconcile('alarmes exatos');
      },
      openSystemSettings: () => {
        Linking.openSettings().catch(() => undefined);
      },
      sendTestNotification: async () => {
        await configureNotifications();
        // Sem marca "cuidar" e sem ações: não é tocada pela reconciliação e não registra doses.
        await Notifications.scheduleNotificationAsync({
          identifier: 'teste-lembrete',
          content: { title: 'Teste do Cuidar', body: 'Se você está vendo isto, as notificações chegam neste aparelho.', sound: 'default' },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, channelId: 'doses' },
        });
      },
    }),
    [status, reconcile],
  );

  return <AlarmsContext.Provider value={value}>{children}</AlarmsContext.Provider>;
}

export function useAlarms(): AlarmsContextValue {
  const ctx = useContext(AlarmsContext);
  if (!ctx) throw new Error('useAlarms fora do AlarmsProvider');
  return ctx;
}
