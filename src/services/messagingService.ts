import { api } from './api';
import {
  NewMessageData,
  MessageThread,
  Message,
  Contact,
  MessageStats,
  PaginationParams,
  ThreadsFilter,
  ContactsFilter,
  MessagingApiResponse,
  MessagingContactsResponse
} from '../types/messaging';
import { logger } from '@/utils/logger';

/**
 * MessagingService - High-level service for internal communication
 * Provides business logic layer on top of API endpoints
 */
class MessagingService {
  private cache: {
    threads: MessageThread[];
    messages: Record<string, Message[]>;
    contacts: Contact[];
    stats: MessageStats | null;
    lastRefresh: number;
  } = {
    threads: [],
    messages: {},
    contacts: [],
    stats: null,
    lastRefresh: 0,
  };

  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private shouldRefreshCache(): boolean {
    return Date.now() - this.cache.lastRefresh > this.CACHE_DURATION;
  }

  private updateCacheTimestamp(): void {
    this.cache.lastRefresh = Date.now();
  }

  /**
   * Load message threads with filtering and pagination
   */
  async loadThreads(params: ThreadsFilter & PaginationParams = {}, forceRefresh = false): Promise<MessageThread[]> {
    try {
      //logger.debug('[MessagingService] Loading threads with params:', params);
      
      // Use cache if available and not forcing refresh
      if (!forceRefresh && !this.shouldRefreshCache() && this.cache.threads.length > 0 && !params.filter && !params.search) {
        //logger.debug('[MessagingService] Using cached threads');
        return this.cache.threads;
      }

      const response = await api.getMessageThreads(params);
      
      if (response.data) {
        // Update cache only for unfiltered, unsearched requests
        if (!params.filter && !params.search && (!params.offset || params.offset === 0)) {
          this.cache.threads = response.data;
          this.updateCacheTimestamp();
        }
        
        //logger.debug('[MessagingService] Loaded threads:', response.data.length);
        return response.data;
      }
      
      throw new Error(response.error || 'Failed to load threads');
    } catch (error) {
      logger.error('[MessagingService] Error loading threads:', error);
      throw error;
    }
  }

  /**
   * Load messages for a specific thread
   */
  async loadMessages(threadId: string, params: PaginationParams = {}, forceRefresh = false): Promise<{ messages: Message[]; thread_info: MessageThread }> {
    try {
      //logger.debug('[MessagingService] Loading messages for thread:', threadId);
      
      // Use cache if available and not forcing refresh
      const cachedMessages = this.cache.messages[threadId];
      if (!forceRefresh && cachedMessages && (!params.offset || params.offset === 0)) {
        //logger.debug('[MessagingService] Using cached messages for thread:', threadId);
        // Find thread info from cached threads
        const threadInfo = this.cache.threads.find(t => t.thread_id === threadId);
        if (threadInfo) {
          return { messages: cachedMessages, thread_info: threadInfo };
        }
      }

      logger.debug('[MessagingService] loadMessages -> calling API', {
        threadId,
        params,
      });

      const response = await api.getThreadMessages(threadId, params);

      logger.debug('[MessagingService] loadMessages <- API response', {
        hasData: !!response?.data,
        messageCount: response?.data?.messages?.length,
        hasThreadInfo: !!response?.data?.thread_info,
      });
      
      if (response.data) {
        // Map identifier to message_id for compatibility
        const mappedData = {
          ...response.data,
          messages: response.data.messages.map((message: any) => ({
            ...message,
            message_id: message.identifier || message.message_id, // Use identifier as message_id
          }))
        };

        // Update cache only for first page
        if (!params.offset || params.offset === 0) {
          this.cache.messages[threadId] = mappedData.messages;
        }
        
        //logger.debug('[MessagingService] Loaded messages:', mappedData.messages.length);
        return mappedData;
      }
      
      throw new Error(response.error || 'Failed to load messages');
    } catch (error) {
      logger.error('[MessagingService] Error loading messages:', error);
      throw error;
    }
  }

  async loadThreadParticipants(threadId: string): Promise<Array<{ email: string; name: string; participantType: string; photo?: string | null }>> {
    if (!threadId) {
      logger.warn('[MessagingService] loadThreadParticipants called without threadId');
      return [];
    }

    try {
      logger.debug('[MessagingService] loadThreadParticipants -> calling API', { threadId });
      const response = await api.getThreadParticipants(threadId);
      const data = Array.isArray(response?.data) ? response.data : [];
      logger.debug('[MessagingService] loadThreadParticipants <- API response', { count: data.length });
      return data;
    } catch (error) {
      logger.error('[MessagingService] Error loading thread participants:', { threadId, error });
      return [];
    }
  }

  /**
   * Load available contacts
   */
  async loadContacts(params: ContactsFilter & PaginationParams = {}, forceRefresh = false): Promise<Contact[]> {
    try {
      //logger.debug('[MessagingService] Loading contacts with params:', params);

      // Skip cache when type is specified (staff vs patients) or searching
      const skipCache = !!params.type || !!params.search;

      // Use cache if available and not forcing refresh
      if (!forceRefresh && !skipCache && !this.shouldRefreshCache() && this.cache.contacts.length > 0) {
        //logger.debug('[MessagingService] Using cached contacts');
        return this.cache.contacts;
      }

      logger.debug('[MessagingService] loadContacts -> calling API', { params });

      const response = await api.getContacts(params);

      logger.debug('[MessagingService] loadContacts <- API response', {
        hasData: !!response?.data,
        count: response?.data?.length,
      });

      if (response.data) {
        // Update cache only for unfiltered requests (no type, no search, no offset)
        if (!params.type && !params.search && (!params.offset || params.offset === 0)) {
          this.cache.contacts = response.data;
          this.updateCacheTimestamp();
        }

        //logger.debug('[MessagingService] Loaded contacts:', response.data.length);
        return response.data;
      }

      throw new Error(response.error || 'Failed to load contacts');
    } catch (error) {
      logger.error('[MessagingService] Error loading contacts:', error);
      throw error;
    }
  }

  /**
   * Load messaging contacts (org members + connected practitioners via groups)
   * This is the new filtered endpoint for the new message screen
   */
  async loadMessagingContacts(search?: string): Promise<MessagingContactsResponse> {
    try {
      logger.debug('[MessagingService] loadMessagingContacts -> calling API', { search });

      const response = await api.getMessagingContacts(search);

      logger.debug('[MessagingService] loadMessagingContacts <- API response', {
        hasData: !!response?.data,
        orgMembersCount: response?.data?.organization_members?.length,
        connectedCount: response?.data?.connected_practitioners?.length,
      });

      if (response.data) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to load messaging contacts');
    } catch (error) {
      logger.error('[MessagingService] Error loading messaging contacts:', error);
      throw error;
    }
  }

  /**
   * Load messaging statistics
   */
  async loadStats(forceRefresh = false): Promise<MessageStats> {
    try {
      //logger.debug('[MessagingService] Loading messaging stats');
      
      // Use cache if available and not forcing refresh
      if (!forceRefresh && !this.shouldRefreshCache() && this.cache.stats) {
        //logger.debug('[MessagingService] Using cached stats');
        return this.cache.stats;
      }

      const response = await api.getMessagingStats();
      
      if (response.data) {
        this.cache.stats = response.data;
        this.updateCacheTimestamp();
        
        //logger.debug('[MessagingService] Loaded stats:', response.data);
        return response.data;
      }
      
      throw new Error(response.error || 'Failed to load stats');
    } catch (error) {
      logger.error('[MessagingService] Error loading stats:', error);
      throw error;
    }
  }

  /**
   * Send a new message or reply
   */
  async sendMessage(data: NewMessageData): Promise<{ message_id: string; thread_id: string }> {
    try {
      // logger.debug('[MessagingService] Sending message:', {
      //   recipients: data.recipients,
      //   subject: data.subject,
      //   hasContent: !!data.content,
      //   threadId: data.thread_id
      // });

      const response = await api.sendMessage(data);

      // Backend returns { success, message_id, thread_id } at root level (not wrapped in data)
      if (response.success && response.message_id) {
        // Invalidate relevant caches after sending
        this.invalidateCache(['threads', 'messages']);

        //logger.debug('[MessagingService] Message sent successfully:', response.message_id);
        return { message_id: response.message_id, thread_id: response.thread_id };
      }

      // Fallback for wrapped response format
      if (response.data) {
        this.invalidateCache(['threads', 'messages']);
        return response.data;
      }

      throw new Error(response.error || 'Failed to send message');
    } catch (error) {
      logger.error('[MessagingService] Error sending message:', error);
      throw error;
    }
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    if (!messageId) {
      logger.warn('[MessagingService] Cannot mark message as read: messageId is undefined or empty');
      return;
    }

    try {
      //logger.debug('[MessagingService] Marking message as read:', messageId);

      const response = await api.markMessageAsRead(messageId);
      
      if (response.success !== false) {
        // Update cache to reflect read status
        this.updateMessageReadStatus(messageId, true);
        
        //logger.debug('[MessagingService] Message marked as read');
        return;
      }
      
      throw new Error(response.error || 'Failed to mark message as read');
    } catch (error) {
      logger.error('[MessagingService] Error marking message as read:', error);
      throw error;
    }
  }

  /**
   * Search messages and users
   */
  async search(query: string, type: 'all' | 'messages' | 'users' = 'all', limit = 20): Promise<any[]> {
    try {
      //logger.debug('[MessagingService] Searching:', { query, type, limit });

      const response = await api.searchMessages(query, type, limit);
      
      if (response.data) {
        //logger.debug('[MessagingService] Search results:', response.data.length);
        return response.data;
      }
      
      throw new Error(response.error || 'Search failed');
    } catch (error) {
      logger.error('[MessagingService] Error searching:', error);
      throw error;
    }
  }

  /**
   * Upload attachment for messages
   */
  async uploadAttachment(file: FormData): Promise<{ attachment_id: string; attachment_url: string }> {
    try {
      //logger.debug('[MessagingService] Uploading attachment');

      const response = await api.uploadMessageAttachment(file);
      
      if (response.data) {
        //logger.debug('[MessagingService] Attachment uploaded:', response.data.attachment_id);
        return response.data;
      }
      
      throw new Error(response.error || 'Failed to upload attachment');
    } catch (error) {
      logger.error('[MessagingService] Error uploading attachment:', error);
      throw error;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    try {
      //logger.debug('[MessagingService] Deleting message:', messageId);

      const response = await api.deleteMessage(messageId);
      
      if (response.success !== false) {
        // Invalidate caches after deletion
        this.invalidateCache(['threads', 'messages']);
        
        //logger.debug('[MessagingService] Message deleted');
        return;
      }
      
      throw new Error(response.error || 'Failed to delete message');
    } catch (error) {
      logger.error('[MessagingService] Error deleting message:', error);
      throw error;
    }
  }

  /**
   * Get unread message count from cache or load fresh
   */
  getUnreadCount(): number {
    if (this.cache.stats) {
      return this.cache.stats.unread_count;
    }
    
    // Calculate from cached threads
    return this.cache.threads.reduce((count, thread) => count + thread.unread_count, 0);
  }

  /**
   * Refresh all data
   */
  async refresh(): Promise<void> {
    try {
      //logger.debug('[MessagingService] Refreshing all data');
      
      this.invalidateCache();
      
      // Load core data in parallel
      await Promise.all([
        this.loadThreads({}, true),
        this.loadContacts({}, true),
        this.loadStats(true),
      ]);
      
      //logger.debug('[MessagingService] Refresh completed');
    } catch (error) {
      logger.error('[MessagingService] Error during refresh:', error);
      throw error;
    }
  }

  resetCache(): void {
    this.invalidateCache();
  }

  /**
   * Private helper methods
   */
  private invalidateCache(types?: string[]): void {
    const toInvalidate = types || ['threads', 'messages', 'contacts', 'stats'];
    
    if (toInvalidate.includes('threads')) {
      this.cache.threads = [];
    }
    if (toInvalidate.includes('messages')) {
      this.cache.messages = {};
    }
    if (toInvalidate.includes('contacts')) {
      this.cache.contacts = [];
    }
    if (toInvalidate.includes('stats')) {
      this.cache.stats = null;
    }
    
    this.cache.lastRefresh = 0;
  }

  private updateMessageReadStatus(messageId: string, isRead: boolean): void {
    // Update message read status in cache
    Object.keys(this.cache.messages).forEach(threadId => {
      const messages = this.cache.messages[threadId];
      const message = messages.find(m => m.message_id === messageId);
      if (message) {
        message.read_status = isRead;
        
        // Update thread unread count
        const thread = this.cache.threads.find(t => t.thread_id === threadId);
        if (thread && isRead) {
          thread.unread_count = Math.max(0, thread.unread_count - 1);
        }
      }
    });
  }

  /**
   * Get cached data (useful for immediate UI updates)
   */
  getCachedThreads(): MessageThread[] {
    return this.cache.threads;
  }

  getCachedMessages(threadId: string): Message[] {
    return this.cache.messages[threadId] || [];
  }

  getCachedContacts(): Contact[] {
    return this.cache.contacts;
  }

  getCachedStats(): MessageStats | null {
    return this.cache.stats;
  }
}

// Export singleton instance
export const messagingService = new MessagingService();
