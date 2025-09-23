import { create } from 'zustand';
import { NotificationItem, NotificationState, NotificationsQuery } from '@types/notifications';
import { notificationsService } from '@services/notificationsService';

const DEFAULT_QUERY: NotificationsQuery = {
  page: 1,
  limit: 20,
  status: 'all',
};

const isUnread = (notification: NotificationItem): boolean =>
  notification.status === 'delivered' && !notification.read_at;

const mergeQuery = (prev: NotificationsQuery, next?: NotificationsQuery): NotificationsQuery => ({
  ...prev,
  ...(next || {}),
});

export const useNotificationStore = create<NotificationState>((set, get) => ({
  pendingCount: 0,
  items: [],
  pagination: null,
  query: DEFAULT_QUERY,
  isLoadingCount: false,
  isLoadingList: false,
  isRefreshing: false,
  error: null,

  fetchPendingCount: async () => {
    set({ isLoadingCount: true, error: null });

    try {
      const pendingCount = await notificationsService.fetchUnreadCount();
      set({ pendingCount, isLoadingCount: false });
    } catch (error) {
      console.error('[NotificationStore] Failed to load pending count', error);
      set({
        isLoadingCount: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar notificações',
      });
    }
  },

  fetchNotifications: async (params?: NotificationsQuery) => {
    const query = mergeQuery(get().query, params);
    set({ isLoadingList: true, error: null, query });

    try {
      const { items, pagination } = await notificationsService.getNotifications(query);

      set(state => {
        const shouldAppend = (query.page ?? DEFAULT_QUERY.page ?? 1) > 1;
        let mergedItems: NotificationItem[];

        if (shouldAppend) {
          const existingIds = new Set(state.items.map(item => item.id));
          const newItems = items.filter(item => !existingIds.has(item.id));
          mergedItems = [...state.items, ...newItems];
        } else {
          mergedItems = items;
        }
        return {
          items: mergedItems,
          pagination,
          isLoadingList: false,
        };
      });

      // Refresh unread count after list fetch to keep badge accurate
      const latestPendingCount = await notificationsService.fetchUnreadCount();
      set({ pendingCount: latestPendingCount });
    } catch (error) {
      console.error('[NotificationStore] Failed to load notifications', error);
      set({
        isLoadingList: false,
        error: error instanceof Error ? error.message : 'Erro ao carregar notificações',
      });
    }
  },

  refreshNotifications: async () => {
    const { fetchNotifications, query } = get();
    set({ isRefreshing: true });
    try {
      await fetchNotifications({ ...query, page: 1 });
    } finally {
      set({ isRefreshing: false });
    }
  },

  markAsRead: async (notificationId: number) => {
    try {
      const affected = await notificationsService.markAsRead([notificationId]);
      if (!affected) {
        return;
      }

      const now = new Date().toISOString();
      set(state => {
        const updatedItems = state.items.map(item =>
          item.id === notificationId
            ? {
                ...item,
                status: 'read',
                read_at: now,
              }
            : item
        );

        const pendingCount = Math.max(state.pendingCount - affected, 0);
        return { items: updatedItems, pendingCount };
      });

      const latestPendingCount = await notificationsService.fetchUnreadCount();
      set({ pendingCount: latestPendingCount });
    } catch (error) {
      console.error('[NotificationStore] Failed to mark notification as read', error);
    }
  },

  markAllAsRead: async () => {
    const unreadIds = get()
      .items
      .filter(isUnread)
      .map(item => item.id);

    if (!unreadIds.length) {
      set({ pendingCount: 0 });
      return;
    }

    try {
      const affected = await notificationsService.markAsRead(unreadIds);

      if (!affected) {
        return;
      }

      const now = new Date().toISOString();
      set(state => ({
        items: state.items.map(item =>
          unreadIds.includes(item.id)
            ? {
                ...item,
                status: 'read',
                read_at: now,
              }
            : item
        ),
        pendingCount: Math.max(state.pendingCount - affected, 0),
      }));

      const latestPendingCount = await notificationsService.fetchUnreadCount();
      set({ pendingCount: latestPendingCount });
    } catch (error) {
      console.error('[NotificationStore] Failed to mark all notifications as read', error);
    }
  },

  archiveNotification: async (notificationId: number) => {
    try {
      const success = await notificationsService.archive(notificationId);
      if (!success) {
        return;
      }

      set(state => {
        const remainingItems = state.items.filter(item => item.id !== notificationId);
        const pendingCount = remainingItems.filter(isUnread).length;
        return {
          items: remainingItems,
          pendingCount,
        };
      });

      const pendingCount = await notificationsService.fetchUnreadCount();
      set({ pendingCount });
    } catch (error) {
      console.error('[NotificationStore] Failed to archive notification', error);
    }
  },

  setPendingCount: (count: number) => set({ pendingCount: count }),
}));
