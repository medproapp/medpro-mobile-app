import { apiService } from '@services/api';
import {
  NotificationItem,
  NotificationStatus,
  NotificationsListResponse,
  NotificationsPagination,
  NotificationsQuery,
} from '@/types/notifications';
import { logger } from '@/utils/logger';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

interface NotificationsApiResponse {
  data?: NotificationItem[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
    has_more?: boolean;
  };
  affected?: number;
  success?: boolean;
}

const toPagination = (
  raw: NotificationsApiResponse['pagination'],
  fallbackPage: number,
  fallbackLimit: number,
): NotificationsPagination => {
  const page = Number(raw?.page ?? fallbackPage);
  const limit = Number(raw?.limit ?? fallbackLimit);
  const total = raw?.total !== undefined ? Number(raw.total) : undefined;
  const hasMoreRaw = raw?.hasMore ?? raw?.has_more;

  const pagination: NotificationsPagination = { page, limit };
  if (total !== undefined && !Number.isNaN(total)) {
    pagination.total = total;
  }
  if (hasMoreRaw !== undefined) {
    pagination.hasMore = Boolean(hasMoreRaw);
  }
  return pagination;
};

class NotificationsService {
  private sanitizeItems(items: unknown): NotificationItem[] {
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .map(item => {
        const typed = item as Partial<NotificationItem>;
        return {
          id: Number(typed.id ?? 0),
          source: typed.source || 'Sistema',
          title: typed.title || 'Notificação',
          body: typed.body || '',
          metadata: typed.metadata ?? null,
          status: (typed.status as NotificationStatus) || 'delivered',
          delivered_at: typed.delivered_at || new Date().toISOString(),
          read_at: typed.read_at ?? null,
          archived_at: typed.archived_at ?? null,
        } satisfies NotificationItem;
      })
      .filter(item => Number.isFinite(item.id) && item.id > 0);
  }

  async getNotifications(params: NotificationsQuery = {}): Promise<NotificationsListResponse> {
    const page = params.page ?? DEFAULT_PAGE;
    const limit = params.limit ?? DEFAULT_LIMIT;
    const status = params.status ?? 'all';

    const response: NotificationsApiResponse = await apiService.listNotifications({
      page,
      limit,
      status: status as NotificationStatus | 'all',
    });

    const items = this.sanitizeItems(response?.data);
    const pagination = toPagination(response?.pagination, page, limit);

    return { items, pagination };
  }

  async fetchUnreadCount(): Promise<number> {
    try {
      const response: NotificationsApiResponse = await apiService.listNotifications({
        status: 'delivered',
        page: 1,
        limit: 1,
      });

      const pagination = toPagination(response?.pagination, 1, 1);
      if (pagination.total !== undefined) {
        return Number(pagination.total);
      }

      const items = this.sanitizeItems(response?.data);
      return items.length;
    } catch (error) {
      logger.error('[NotificationsService] Failed to fetch unread count', error);
      return 0;
    }
  }

  async fetchAllCounts(): Promise<{ all: number; delivered: number; read: number; archived: number }> {
    const fetchCount = async (status: NotificationStatus | 'all'): Promise<number> => {
      try {
        const response: NotificationsApiResponse = await apiService.listNotifications({
          status,
          page: 1,
          limit: 1,
        });
        const pagination = toPagination(response?.pagination, 1, 1);
        return pagination.total ?? 0;
      } catch {
        return 0;
      }
    };

    const [all, delivered, read, archived] = await Promise.all([
      fetchCount('all'),
      fetchCount('delivered'),
      fetchCount('read'),
      fetchCount('archived'),
    ]);
    return { all, delivered, read, archived };
  }

  async markAsRead(ids: number[]): Promise<number> {
    if (!ids.length) {
      return 0;
    }

    try {
      const response: NotificationsApiResponse = await apiService.acknowledgeNotifications(ids);
      return Number(response?.affected ?? ids.length);
    } catch (error) {
      logger.error('[NotificationsService] Failed to acknowledge notifications', error);
      throw error;
    }
  }

  async archive(notificationId: number): Promise<boolean> {
    try {
      const response: NotificationsApiResponse = await apiService.archiveNotification(notificationId);
      return Boolean(response?.success ?? true);
    } catch (error) {
      logger.error('[NotificationsService] Failed to archive notification', error);
      throw error;
    }
  }
}

export const notificationsService = new NotificationsService();
