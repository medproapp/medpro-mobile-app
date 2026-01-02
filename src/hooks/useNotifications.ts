import { useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { Subscription } from 'expo-notifications';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import notificationService from '@services/notificationService';
import { useAuthStore } from '@store/authStore';
import { useMessagingStore } from '@store/messagingStore';
import { useNotificationStore } from '@store/notificationStore';
import { logger } from '@/utils/logger';
import {
  resolveNotificationNavigation,
  pushDataToNotificationItem,
  NotificationNavigationTarget,
} from '@/utils/notificationNavigation';
import type { RootStackParamList } from '@/types/navigation';

export const useNotifications = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const user = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const loadThreads = useMessagingStore(state => state.loadThreads);
  const loadMessages = useMessagingStore(state => state.loadMessages);
  const loadStats = useMessagingStore(state => state.loadStats);
  const handleRealtimeUpdate = useMessagingStore(state => state.handleRealtimeUpdate);
  const fetchPendingCount = useNotificationStore(state => state.fetchPendingCount);

  const notificationListener = useRef<Subscription | null>(null);
  const responseListener = useRef<Subscription | null>(null);

  // Helper to navigate to target screen
  // Note: useNotifications is called at MainNavigator level, which is INSIDE the Root Stack.
  // useNavigation() here returns the Root Stack navigation, so we need full paths through 'Main'.
  const navigateToTarget = useCallback((target: NotificationNavigationTarget) => {
    if (!target) return;

    try {
      switch (target.type) {
        case 'MESSAGES_CONVERSATION':
          navigation.navigate('Main', {
            screen: 'Messages',
            params: {
              screen: 'Conversation',
              params: target.params,
            },
          } as any);
          break;
        case 'MESSAGES_TAB':
          navigation.navigate('Main', {
            screen: 'Messages',
          } as any);
          break;
        case 'DASHBOARD_APPOINTMENT_DETAILS':
          navigation.navigate('Main', {
            screen: 'Dashboard',
            params: {
              screen: 'AppointmentDetails',
              params: target.params,
            },
          } as any);
          break;
        case 'DASHBOARD_HOME':
          navigation.navigate('Main', {
            screen: 'Dashboard',
            params: { screen: 'DashboardHome' },
          } as any);
          break;
      }
    } catch (error) {
      logger.error('[useNotifications] Navigation error:', error);
    }
  }, [navigation]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    // Initialize notification service when user is authenticated
    const initializeNotifications = async () => {
      try {
        await notificationService.initialize();
        // Ensure badges are populated
        await Promise.all([
          loadStats(),
          fetchPendingCount(),
        ]);
      } catch (error) {
        logger.error('[useNotifications] Failed to initialize notifications:', error);
      }
    };

    initializeNotifications();

    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      logger.debug('[useNotifications] Notification received:', notification);

      const data = notification.request.content.data as Record<string, any> | undefined;
      const context = data?.context as Record<string, any> | undefined;

      // Check if this is an appointment notification (has appointment_id in context)
      const hasAppointmentId = context?.appointment_id || context?.appointmentId;

      // Handle message notifications (only if it's actually a message, not an appointment)
      if (data?.type === 'internal_message' && !hasAppointmentId && data?.thread_id) {
        // Use real-time update instead of full refresh for better performance
        handleRealtimeUpdate('new_message', {
          message_id: data.message_id,
          thread_id: data.thread_id,
          sender_name: notification.request.content.title,
          preview: notification.request.content.body,
          content: notification.request.content.body,
          created_at: new Date().toISOString(),
        });
      }

      // Refresh notification count for all notification types
      fetchPendingCount();
    });

    // Listen for user interactions with notifications (taps from device tray)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      logger.debug('[useNotifications] Notification response received:', response);

      const data = response.notification.request.content.data;
      logger.debug('[useNotifications] Notification data:', JSON.stringify(data, null, 2));

      // Convert push data to NotificationItem format and resolve navigation target
      const notificationItem = pushDataToNotificationItem(data as Record<string, unknown>);
      logger.debug('[useNotifications] Converted to notificationItem:', JSON.stringify(notificationItem, null, 2));
      const target = resolveNotificationNavigation(notificationItem);
      logger.debug('[useNotifications] Navigation target:', target);

      if (!target) {
        logger.debug('[useNotifications] No navigation target for notification type:', data?.type);
        return;
      }

      navigateToTarget(target);
    });

    // Cleanup function
    return () => {
      notificationService.cleanup();
      
      if (notificationListener.current && typeof notificationListener.current.remove === 'function') {
        notificationListener.current.remove();
        notificationListener.current = null;
      }
      if (responseListener.current && typeof responseListener.current.remove === 'function') {
        responseListener.current.remove();
        responseListener.current = null;
      }
    };
  }, [isAuthenticated, user, navigation, loadThreads, loadMessages, loadStats, handleRealtimeUpdate, fetchPendingCount]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (isAuthenticated && nextAppState === 'active') {
        // App came to foreground, refresh data
        loadThreads();
        loadStats();
        fetchPendingCount();
      }
    };

    // Note: AppState listener would be added here in a real implementation
    // For now, we'll rely on the real-time connection for updates
  }, [isAuthenticated, loadThreads, loadStats, fetchPendingCount]);

  return {
    // Return any notification-related state or functions that components might need
    initialized: isAuthenticated,
  };
};
