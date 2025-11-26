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
  private async fetchCountByStatus(status: NotificationStatus | 'all'): Promise<number> {
    // Try to use pagination.total when available, otherwise walk pages until we exhaust results.
    const limit = 50;
    const maxPages = 200; // safety guard
    let page = 1;
    let total = 0;

    while (page <= maxPages) {
      try {
        const response: NotificationsApiResponse = await apiService.listNotifications({
          status,
          page,
          limit,
        });

        logger.debug('[NotificationsService] fetchCount response for', status, JSON.stringify(response?.pagination));

        const pagination = toPagination(response?.pagination, page, limit);
        const items = this.sanitizeItems(response?.data);

        if (pagination.total !== undefined) {
          return Number(pagination.total);
        }

        total += items.length;

        // If backend doesn't provide hasMore, assume more pages only when we filled the current one.
        const hasMore = pagination.hasMore ?? items.length === limit;
        if (!hasMore || items.length === 0) {
          break;
        }

        page += 1;
      } catch (e) {
        logger.error('[NotificationsService] fetchCount error for', status, e);
        break;
      }
    }

    return total;
  }

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
    return this.fetchCountByStatus('delivered');
  }

  async fetchAllCounts(): Promise<{ all: number; delivered: number; read: number; archived: number }> {
    const [all, delivered, read, archived] = await Promise.all([
      this.fetchCountByStatus('all'),
      this.fetchCountByStatus('delivered'),
      this.fetchCountByStatus('read'),
      this.fetchCountByStatus('archived'),
    ]);
    logger.debug('[NotificationsService] fetchAllCounts result:', { all, delivered, read, archived });
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
