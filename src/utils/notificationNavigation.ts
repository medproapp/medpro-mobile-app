import type { NotificationItem } from '@/types/notifications';
import type { DashboardStackParamList, MessagesStackParamList } from '@/types/navigation';

export type NotificationNavigationTarget =
  | {
      type: 'MESSAGES_CONVERSATION';
      params: MessagesStackParamList['Conversation'];
    }
  | {
      type: 'MESSAGES_TAB';
    }
  | {
      type: 'DASHBOARD_APPOINTMENT_DETAILS';
      params: DashboardStackParamList['AppointmentDetails'];
    }
  | {
      type: 'DASHBOARD_HOME';
    }
  | null;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const getString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

export const resolveNotificationNavigation = (
  notification: NotificationItem,
): NotificationNavigationTarget => {
  const metadata = notification.metadata;
  if (!isObject(metadata)) {
    return null;
  }

  const { type, context } = metadata as { type?: string; context?: unknown };
  const normalizedType = typeof type === 'string' ? type.toLowerCase() : undefined;
  const contextData = isObject(context) ? context : {};

  switch (normalizedType) {
    case 'internal_message': {
      const threadId =
        getString((contextData as any).threadId) ||
        getString((contextData as any).thread_id);
      const threadSubject =
        getString((contextData as any).threadSubject) ||
        getString((contextData as any).thread_subject) ||
        getString((contextData as any).subject);
      if (threadId) {
        return {
          type: 'MESSAGES_CONVERSATION',
          params: {
            threadId,
            threadSubject: threadSubject || 'Conversa',
          },
        };
      }
      return { type: 'MESSAGES_TAB' };
    }
    case 'appointment_created':
    case 'appointment_cancelled':
    case 'appointment_rescheduled': {
      const appointmentId =
        getString((contextData as any).appointmentId) ||
        getString((contextData as any).appointment_id);
      if (appointmentId) {
        return {
          type: 'DASHBOARD_APPOINTMENT_DETAILS',
          params: {
            appointmentId,
          },
        };
      }
      return { type: 'DASHBOARD_HOME' };
    }
    default:
      return null;
  }
};
