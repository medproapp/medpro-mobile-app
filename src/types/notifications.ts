export type NotificationStatus = 'delivered' | 'read' | 'archived';

// Notification types that the practitioner app receives from the backend
export type NotificationType =
  // Messaging
  | 'internal_message'
  // Practitioner appointment types (what backend actually sends)
  | 'appointment_created_practitioner'
  | 'appointment_cancelled_practitioner'
  | 'appointment_rescheduled_practitioner'
  // Legacy types (backwards compatibility)
  | 'appointment_created'
  | 'appointment_cancelled'
  | 'appointment_rescheduled';

// Context data included in notification metadata
export interface NotificationContext {
  // Message context
  threadId?: string;
  thread_id?: string;
  threadSubject?: string;
  thread_subject?: string;
  subject?: string;
  messageId?: string;
  message_id?: string;
  senderName?: string;
  // Appointment context
  appointmentId?: string;
  appointment_id?: string;
}

// Structure of notification metadata from backend
export interface NotificationMetadata {
  type?: NotificationType | string;
  context?: NotificationContext;
  [key: string]: unknown;
}

export interface NotificationItem {
  id: number;
  source: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
  status: NotificationStatus;
  delivered_at: string;
  read_at?: string | null;
  archived_at?: string | null;
}

export interface NotificationsPagination {
  page: number;
  limit: number;
  total?: number;
  hasMore?: boolean;
}

export interface NotificationsQuery {
  page?: number;
  limit?: number;
  status?: NotificationStatus | 'all';
}

export interface NotificationsListResponse {
  items: NotificationItem[];
  pagination: NotificationsPagination;
}

export interface NotificationState {
  pendingCount: number;
  items: NotificationItem[];
  pagination: NotificationsPagination | null;
  query: NotificationsQuery;
  isLoadingCount: boolean;
  isLoadingList: boolean;
  isRefreshing: boolean;
  error: string | null;
  fetchPendingCount: () => Promise<void>;
  fetchNotifications: (params?: NotificationsQuery) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archiveNotification: (notificationId: number) => Promise<void>;
  setPendingCount: (count: number) => void;
}
