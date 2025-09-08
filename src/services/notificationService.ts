import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import api from './api';
import { useAuthStore } from '@store/authStore';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationPermissions {
  status: Notifications.PermissionStatus;
  canAskAgain: boolean;
  granted: boolean;
}

export interface PushToken {
  data: string;
  type: 'expo';
}

class NotificationService {
  private pushToken: string | null = null;
  private eventSource: any | null = null; // RN: no EventSource; keep type loose
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<NotificationPermissions> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      return {
        status: finalStatus,
        canAskAgain: finalStatus === 'denied',
        granted: finalStatus === 'granted',
      };
    } catch (error) {
      console.error('[NotificationService] Error requesting permissions:', error);
      return {
        status: 'denied' as Notifications.PermissionStatus,
        canAskAgain: false,
        granted: false,
      };
    }
  }

  /**
   * Get push notification token
   */
  async getPushToken(): Promise<string | null> {
    try {
      if (this.pushToken) {
        return this.pushToken;
      }

      // Check permissions first
      const permissions = await this.requestPermissions();
      if (!permissions.granted) {
        console.warn('[NotificationService] Push notifications permission denied');
        return null;
      }

      // Get push token
      const tokenData = await Notifications.getExpoPushTokenAsync();
      this.pushToken = tokenData.data;

      console.log('[NotificationService] Push token obtained:', this.pushToken.substring(0, 20) + '...');
      return this.pushToken;
    } catch (error) {
      console.error('[NotificationService] Error getting push token:', error);
      return null;
    }
  }

  /**
   * Register device token with backend
   */
  async registerDeviceToken(): Promise<boolean> {
    try {
      const token = await this.getPushToken();
      if (!token) {
        console.warn('[NotificationService] No push token available for registration');
        return false;
      }

      const { user } = useAuthStore.getState();
      if (!user?.email) {
        console.warn('[NotificationService] No user email available for token registration');
        return false;
      }

      // Register token with backend
      await api.registerPushToken({
        token,
        platform: Platform.OS as 'ios' | 'android',
        app: 'practitioner',
        device_name: Platform.OS === 'ios' ? 'iPhone' : 'Android Device',
      });

      console.log('[NotificationService] Device token registered successfully');
      return true;
    } catch (error) {
      console.error('[NotificationService] Error registering device token:', error);
      return false;
    }
  }

  /**
   * Unregister device token from backend
   */
  async unregisterDeviceToken(): Promise<boolean> {
    try {
      const token = this.pushToken;
      if (!token) {
        return true; // Nothing to unregister
      }

      const { user } = useAuthStore.getState();
      if (!user?.email) {
        return true; // Can't unregister without user
      }

      await api.unregisterPushToken({
        token,
        app: 'practitioner',
      });

      console.log('[NotificationService] Device token unregistered successfully');
      this.pushToken = null;
      return true;
    } catch (error) {
      console.error('[NotificationService] Error unregistering device token:', error);
      return false;
    }
  }

  /**
   * Start real-time connection for live updates
   */
  startRealTimeConnection(): void {
    // RN mobile app: SSE/EventSource not used. No-op for parity with patient app.
    return;
  }

  /**
   * Stop real-time connection
   */
  stopRealTimeConnection(): void {
    // Ensure any stale state is cleared; otherwise no-op
    this.eventSource = null;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = 0;
    return;
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[NotificationService] Max reconnect attempts reached');
      return;
    }

    const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
    this.reconnectAttempts++;

    console.log(`[NotificationService] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      console.log(`[NotificationService] Reconnect attempt ${this.reconnectAttempts}`);
      this.startRealTimeConnection();
    }, delay);
  }

  /**
   * Handle real-time messages from backend
   */
  private handleRealTimeMessage(data: any): void {
    console.log('[NotificationService] Received real-time message:', data);

    switch (data.type) {
      case 'new_message':
        this.handleNewMessageNotification(data);
        break;
      case 'message_read':
        this.handleMessageReadNotification(data);
        break;
      case 'thread_updated':
        this.handleThreadUpdateNotification(data);
        break;
      default:
        console.log('[NotificationService] Unknown real-time message type:', data.type);
    }
  }

  /**
   * Handle new message notifications
   */
  private handleNewMessageNotification(data: any): void {
    // Show local notification if app is in foreground
    this.showLocalNotification({
      title: data.sender_name || 'Nova Mensagem',
      body: data.preview || 'Você recebeu uma nova mensagem',
      data: {
        type: 'internal_message',
        thread_id: data.thread_id,
        message_id: data.message_id,
      },
    });

    // Trigger store updates (will be implemented when integrating with store)
    this.notifyMessageStoreUpdate('new_message', data);
  }

  /**
   * Handle message read notifications
   */
  private handleMessageReadNotification(data: any): void {
    this.notifyMessageStoreUpdate('message_read', data);
  }

  /**
   * Handle thread update notifications
   */
  private handleThreadUpdateNotification(data: any): void {
    this.notifyMessageStoreUpdate('thread_updated', data);
  }

  /**
   * Show local notification
   */
  async showLocalNotification(notification: {
    title: string;
    body: string;
    data?: any;
  }): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: 'default',
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('[NotificationService] Error showing local notification:', error);
    }
  }

  /**
   * Handle notification tap when app is opened from notification
   */
  handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const data = response.notification.request.content.data;
    console.log('[NotificationService] Notification tapped:', data);

    if (data?.type === 'internal_message' && data.thread_id) {
      // Navigate to conversation screen (will be implemented with navigation integration)
      this.navigateToConversation(String(data.thread_id), String(data.subject));
    }
  }

  /**
   * Navigate to conversation (placeholder for navigation integration)
   */
  private navigateToConversation(threadId: string, subject?: string): void {
    // This will be implemented when integrating with navigation
    console.log('[NotificationService] Should navigate to conversation:', threadId, subject);
  }

  /**
   * Notify message store of updates
   */
  private notifyMessageStoreUpdate(type: string, data: any): void {
    try {
      // Import dynamically to avoid circular dependencies
      const { useMessagingStore } = require('@store/messagingStore');
      const store = useMessagingStore.getState();
      
      if (store.handleRealtimeUpdate) {
        store.handleRealtimeUpdate(type, data);
      } else {
        console.warn('[NotificationService] Message store handleRealtimeUpdate not available');
      }
    } catch (error) {
      console.error('[NotificationService] Error notifying message store:', error);
    }
  }

  /**
   * Initialize notification service
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('[NotificationService] Initializing...');

      // Register device token
      const registered = await this.registerDeviceToken();
      if (!registered) {
        console.warn('[NotificationService] Failed to register device token');
      }

      // Start real-time connection
      this.startRealTimeConnection();

      console.log('[NotificationService] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[NotificationService] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Cleanup notification service
   */
  cleanup(): void {
    console.log('[NotificationService] Cleaning up...');
    this.stopRealTimeConnection();
    this.unregisterDeviceToken();
  }
}

export default new NotificationService();
