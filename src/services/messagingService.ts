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
  MessagingApiResponse 
} from '../types/messaging';

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
      console.log('[MessagingService] Loading threads with params:', params);
      
      // Use cache if available and not forcing refresh
      if (!forceRefresh && !this.shouldRefreshCache() && this.cache.threads.length > 0 && !params.filter && !params.search) {
        console.log('[MessagingService] Using cached threads');
        return this.cache.threads;
      }

      const response = await api.getMessageThreads(params);
      
      if (response.data) {
        // Update cache only for unfiltered, unsearched requests
        if (!params.filter && !params.search && (!params.offset || params.offset === 0)) {
          this.cache.threads = response.data;
          this.updateCacheTimestamp();
        }
        
        console.log('[MessagingService] Loaded threads:', response.data.length);
        return response.data;
      }
      
      throw new Error(response.error || 'Failed to load threads');
    } catch (error) {
      console.error('[MessagingService] Error loading threads:', error);
      throw error;
    }
  }

  /**
   * Load messages for a specific thread
   */
  async loadMessages(threadId: string, params: PaginationParams = {}, forceRefresh = false): Promise<{ messages: Message[]; thread_info: MessageThread }> {
    try {
      console.log('[MessagingService] Loading messages for thread:', threadId);
      
      // Use cache if available and not forcing refresh
      const cachedMessages = this.cache.messages[threadId];
      if (!forceRefresh && cachedMessages && (!params.offset || params.offset === 0)) {
        console.log('[MessagingService] Using cached messages for thread:', threadId);
        // Find thread info from cached threads
        const threadInfo = this.cache.threads.find(t => t.thread_id === threadId);
        if (threadInfo) {
          return { messages: cachedMessages, thread_info: threadInfo };
        }
      }

      const response = await api.getThreadMessages(threadId, params);
      
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
        
        console.log('[MessagingService] Loaded messages:', mappedData.messages.length);
        return mappedData;
      }
      
      throw new Error(response.error || 'Failed to load messages');
    } catch (error) {
      console.error('[MessagingService] Error loading messages:', error);
      throw error;
    }
  }

  /**
   * Load available contacts
   */
  async loadContacts(params: ContactsFilter & PaginationParams = {}, forceRefresh = false): Promise<Contact[]> {
    try {
      console.log('[MessagingService] Loading contacts with params:', params);
      
      // Use cache if available and not forcing refresh
      if (!forceRefresh && !this.shouldRefreshCache() && this.cache.contacts.length > 0 && !params.search) {
        console.log('[MessagingService] Using cached contacts');
        return this.cache.contacts;
      }

      const response = await api.getContacts(params);
      
      if (response.data) {
        // Update cache only for unfiltered requests
        if (!params.search && (!params.offset || params.offset === 0)) {
          this.cache.contacts = response.data;
          this.updateCacheTimestamp();
        }
        
        console.log('[MessagingService] Loaded contacts:', response.data.length);
        return response.data;
      }
      
      throw new Error(response.error || 'Failed to load contacts');
    } catch (error) {
      console.error('[MessagingService] Error loading contacts:', error);
      throw error;
    }
  }

  /**
   * Load messaging statistics
   */
  async loadStats(forceRefresh = false): Promise<MessageStats> {
    try {
      console.log('[MessagingService] Loading messaging stats');
      
      // Use cache if available and not forcing refresh
      if (!forceRefresh && !this.shouldRefreshCache() && this.cache.stats) {
        console.log('[MessagingService] Using cached stats');
        return this.cache.stats;
      }

      const response = await api.getMessagingStats();
      
      if (response.data) {
        this.cache.stats = response.data;
        this.updateCacheTimestamp();
        
        console.log('[MessagingService] Loaded stats:', response.data);
        return response.data;
      }
      
      throw new Error(response.error || 'Failed to load stats');
    } catch (error) {
      console.error('[MessagingService] Error loading stats:', error);
      throw error;
    }
  }

  /**
   * Send a new message or reply
   */
  async sendMessage(data: NewMessageData): Promise<{ message_id: string; thread_id: string }> {
    try {
      console.log('[MessagingService] Sending message:', { 
        recipients: data.recipients, 
        subject: data.subject,
        hasContent: !!data.content,
        threadId: data.thread_id 
      });

      const response = await api.sendMessage(data);
      
      if (response.data) {
        // Invalidate relevant caches after sending
        this.invalidateCache(['threads', 'messages']);
        
        console.log('[MessagingService] Message sent successfully:', response.data);
        return response.data;
      }
      
      throw new Error(response.error || 'Failed to send message');
    } catch (error) {
      console.error('[MessagingService] Error sending message:', error);
      throw error;
    }
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    if (!messageId) {
      console.warn('[MessagingService] Cannot mark message as read: messageId is undefined or empty');
      return;
    }

    try {
      console.log('[MessagingService] Marking message as read:', messageId);

      const response = await api.markMessageAsRead(messageId);
      
      if (response.success !== false) {
        // Update cache to reflect read status
        this.updateMessageReadStatus(messageId, true);
        
        console.log('[MessagingService] Message marked as read');
        return;
      }
      
      throw new Error(response.error || 'Failed to mark message as read');
    } catch (error) {
      console.error('[MessagingService] Error marking message as read:', error);
      throw error;
    }
  }

  /**
   * Search messages and users
   */
  async search(query: string, type: 'all' | 'messages' | 'users' = 'all', limit = 20): Promise<any[]> {
    try {
      console.log('[MessagingService] Searching:', { query, type, limit });

      const response = await api.searchMessages(query, type, limit);
      
      if (response.data) {
        console.log('[MessagingService] Search results:', response.data.length);
        return response.data;
      }
      
      throw new Error(response.error || 'Search failed');
    } catch (error) {
      console.error('[MessagingService] Error searching:', error);
      throw error;
    }
  }

  /**
   * Upload attachment for messages
   */
  async uploadAttachment(file: FormData): Promise<{ attachment_id: string; attachment_url: string }> {
    try {
      console.log('[MessagingService] Uploading attachment');

      const response = await api.uploadMessageAttachment(file);
      
      if (response.data) {
        console.log('[MessagingService] Attachment uploaded:', response.data.attachment_id);
        return response.data;
      }
      
      throw new Error(response.error || 'Failed to upload attachment');
    } catch (error) {
      console.error('[MessagingService] Error uploading attachment:', error);
      throw error;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    try {
      console.log('[MessagingService] Deleting message:', messageId);

      const response = await api.deleteMessage(messageId);
      
      if (response.success !== false) {
        // Invalidate caches after deletion
        this.invalidateCache(['threads', 'messages']);
        
        console.log('[MessagingService] Message deleted');
        return;
      }
      
      throw new Error(response.error || 'Failed to delete message');
    } catch (error) {
      console.error('[MessagingService] Error deleting message:', error);
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
      console.log('[MessagingService] Refreshing all data');
      
      this.invalidateCache();
      
      // Load core data in parallel
      await Promise.all([
        this.loadThreads({}, true),
        this.loadContacts({}, true),
        this.loadStats(true),
      ]);
      
      console.log('[MessagingService] Refresh completed');
    } catch (error) {
      console.error('[MessagingService] Error during refresh:', error);
      throw error;
    }
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