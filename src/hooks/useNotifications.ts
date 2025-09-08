import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Subscription } from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import notificationService from '@services/notificationService';
import { useAuthStore } from '@store/authStore';
import { useMessagingStore } from '@store/messagingStore';

export const useNotifications = () => {
  const navigation = useNavigation();
  const { user, isAuthenticated } = useAuthStore();
  const { loadThreads, loadMessages, loadStats, handleRealtimeUpdate } = useMessagingStore();
  
  const notificationListener = useRef<Subscription>();
  const responseListener = useRef<Subscription>();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    // Initialize notification service when user is authenticated
    const initializeNotifications = async () => {
      try {
        await notificationService.initialize();
        // Ensure unread stats are available for tab badge
        await loadStats();
      } catch (error) {
        console.error('[useNotifications] Failed to initialize notifications:', error);
      }
    };

    initializeNotifications();

    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[useNotifications] Notification received:', notification);
      
      const data = notification.request.content.data;
      
      // Handle message notifications
      if (data?.type === 'internal_message') {
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
    });

    // Listen for user interactions with notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[useNotifications] Notification response received:', response);
      
      const data = response.notification.request.content.data;
      
      // Navigate to appropriate screen based on notification data
      if (data?.type === 'internal_message' && data.thread_id) {
        // Navigate to Messages tab first, then to specific conversation
        try {
          (navigation as any).navigate('Messages', {
            screen: 'Conversation',
            params: {
              threadId: data.thread_id,
              threadSubject: data.subject || 'Conversa',
            },
          });
        } catch (error) {
          console.error('[useNotifications] Navigation error:', error);
          // Fallback: just navigate to Messages tab
          (navigation as any).navigate('Messages');
        }
      }
    });

    // Cleanup function
    return () => {
      notificationService.cleanup();
      
      if (notificationListener.current && typeof notificationListener.current.remove === 'function') {
        notificationListener.current.remove();
      }
      if (responseListener.current && typeof responseListener.current.remove === 'function') {
        responseListener.current.remove();
      }
    };
  }, [isAuthenticated, user, navigation, loadThreads, loadMessages]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (isAuthenticated && nextAppState === 'active') {
        // App came to foreground, refresh data
        loadThreads();
        loadStats();
      }
    };

    // Note: AppState listener would be added here in a real implementation
    // For now, we'll rely on the real-time connection for updates
  }, [isAuthenticated, loadThreads]);

  return {
    // Return any notification-related state or functions that components might need
    initialized: isAuthenticated,
  };
};
