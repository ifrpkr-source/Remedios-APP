import { formatBrDate } from '@/domain/time';
import type { PermissionSnapshot, Platform } from './types';

/**
 * Estado dos lembretes para exibir ao usuário. Nunca afirma confiabilidade
 * total: mesmo no melhor caso, a mensagem lembra que o sistema operacional
 * pode atrasar ou suprimir notificações.
 */
export type AlarmLevel = 'ok' | 'degraded' | 'off';

export type AlarmIssue =
  | 'disabled-in-app'
  | 'permission-undetermined'
  | 'permission-denied'
  | 'permission-denied-settings'
  | 'provisional'
  | 'ephemeral'
  | 'exact-alarm-denied'
  | 'horizon-truncated';

export interface AlarmHealth {
  level: AlarmLevel;
  issues: AlarmIssue[];
  /** Pode-se mostrar o pedido de permissão do sistema? */
  canRequest: boolean;
  title: string;
  message: string;
}

export interface HealthInput {
  platform: Platform;
  permission: PermissionSnapshot;
  alarmsEnabled: boolean;
  /** Última data coberta por lembretes quando o limite de agendamentos foi atingido. */
  truncatedAfter?: string | null;
}

export function assessAlarmHealth({ platform, permission, alarmsEnabled, truncatedAfter }: HealthInput): AlarmHealth {
  if (!alarmsEnabled) {
    return {
      level: 'off',
      issues: ['disabled-in-app'],
      canRequest: false,
      title: 'Lembretes desligados',
      message: 'Você desligou os lembretes no Perfil. Nenhum alarme será exibido.',
    };
  }
  const p = permission.notifications;
  if (p === 'undetermined') {
    return {
      level: 'off',
      issues: ['permission-undetermined'],
      canRequest: true,
      title: 'Ative os lembretes',
      message: 'Para avisar no horário das doses, o Cuidar precisa da sua permissão para enviar notificações.',
    };
  }
  if (p === 'denied') {
    return {
      level: 'off',
      issues: [permission.canAskAgain ? 'permission-denied' : 'permission-denied-settings'],
      canRequest: permission.canAskAgain,
      title: 'Notificações bloqueadas',
      message: permission.canAskAgain
        ? 'Sem permissão, os lembretes não aparecem. Toque em “Permitir” para tentar de novo.'
        : 'As notificações do Cuidar estão bloqueadas nas configurações do celular. Abra as configurações e permita as notificações.',
    };
  }

  const issues: AlarmIssue[] = [];
  const notes: string[] = [];
  if (p === 'provisional') {
    issues.push('provisional');
    notes.push('No iPhone, os lembretes chegam em silêncio na Central de Notificações, sem som nem faixa na tela.');
  }
  if (p === 'ephemeral') {
    issues.push('ephemeral');
    notes.push('A permissão de notificações é temporária neste aparelho.');
  }
  if (platform === 'android' && permission.exactAlarms === 'denied') {
    issues.push('exact-alarm-denied');
    notes.push('O Android pode atrasar os lembretes em alguns minutos. Permita “Alarmes e lembretes” para mais precisão.');
  }
  if (truncatedAfter) {
    issues.push('horizon-truncated');
    notes.push(`Há lembretes programados até ${formatBrDate(truncatedAfter)}. Abra o app antes disso para programar os próximos.`);
  }

  if (issues.length > 0) {
    return { level: 'degraded', issues, canRequest: false, title: 'Lembretes ativos com limitações', message: notes.join(' ') };
  }
  return {
    level: 'ok',
    issues: [],
    canRequest: false,
    title: 'Lembretes ativos',
    message: 'Os lembretes estão programados neste aparelho. Modo economia de bateria ou “Não perturbe” podem atrasá-los ou silenciá-los.',
  };
}
