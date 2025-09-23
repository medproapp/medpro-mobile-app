export type NotificationStatus = 'delivered' | 'read' | 'archived';

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
