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
    // Practitioner appointment types (what backend actually sends)
    case 'appointment_created_practitioner':
    case 'appointment_cancelled_practitioner':
    case 'appointment_rescheduled_practitioner':
    // Legacy types (backwards compatibility)
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

/**
 * Convert push notification response data to NotificationItem format
 * for use with resolveNotificationNavigation()
 */
export const pushDataToNotificationItem = (
  data: Record<string, unknown> | undefined,
): NotificationItem => ({
  id: 0,
  source: 'push',
  title: '',
  body: '',
  status: 'delivered',
  delivered_at: new Date().toISOString(),
  metadata: {
    type: data?.type as string,
    context: {
      // Push data comes with context nested
      ...(data?.context as Record<string, unknown> || {}),
      // Also support flat structure for backwards compatibility
      threadId: (data?.context as any)?.threadId || data?.thread_id as string,
      thread_id: (data?.context as any)?.thread_id || data?.thread_id as string,
      appointmentId: (data?.context as any)?.appointmentId || data?.appointment_id as string,
      appointment_id: (data?.context as any)?.appointment_id || data?.appointment_id as string,
    },
  },
});
