import { create } from 'zustand';
import { messagingService } from '../services/messagingService';
import { 
  MessageThread, 
  Message, 
  Contact, 
  MessageStats, 
  NewMessageData,
  PaginationParams,
  ThreadsFilter,
  ContactsFilter,
  MessagingState 
} from '../types/messaging';

/**
 * Zustand store for messaging state management
 * Provides centralized state for the internal communication system
 */
export const useMessagingStore = create<MessagingState>((set, get) => ({
  // === DATA STATE ===
  threads: [],
  currentThread: null,
  messages: {},
  contacts: [],
  stats: null,
  
  // === UI STATE ===
  isLoading: false,
  isLoadingMessages: false,
  isLoadingContacts: false,
  isRefreshing: false,
  error: null,
  
  // === SELECTED STATE ===
  selectedContacts: [],

  // === ACTIONS ===

  /**
   * Load message threads with filtering and pagination
   */
  loadThreads: async (params?: ThreadsFilter & PaginationParams) => {
    const { isRefreshing } = get();
    
    // Don't start new load if already refreshing
    if (isRefreshing) return;
    
    set({ 
      isLoading: true, 
      error: null 
    });

    try {
      console.log('[MessagingStore] Loading threads with params:', params);
      
      const threads = await messagingService.loadThreads(params);
      
      set(state => ({
        threads: params?.offset && params.offset > 0 
          ? [...state.threads, ...threads] // Append for pagination
          : threads, // Replace for new search/filter
        isLoading: false,
        error: null,
      }));
      
      console.log('[MessagingStore] Threads loaded successfully:', threads.length);
    } catch (error) {
      console.error('[MessagingStore] Error loading threads:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load threads' 
      });
    }
  },

  /**
   * Load messages for a specific thread
   */
  loadMessages: async (threadId: string, params?: PaginationParams) => {
    set({ 
      isLoadingMessages: true, 
      error: null 
    });

    try {
      console.log('[MessagingStore] Loading messages for thread:', threadId);
      
      const { messages: newMessages, thread_info } = await messagingService.loadMessages(threadId, params);
      
      set(state => ({
        messages: {
          ...state.messages,
          [threadId]: params?.offset && params.offset > 0
            ? [...(state.messages[threadId] || []), ...newMessages] // Append for pagination
            : newMessages // Replace for new load
        },
        // Update current thread info if it's the one we're loading
        currentThread: state.currentThread?.thread_id === threadId ? thread_info : state.currentThread,
        isLoadingMessages: false,
        error: null,
      }));
      
      console.log('[MessagingStore] Messages loaded successfully:', newMessages.length);
    } catch (error) {
      console.error('[MessagingStore] Error loading messages:', error);
      set({ 
        isLoadingMessages: false, 
        error: error instanceof Error ? error.message : 'Failed to load messages' 
      });
    }
  },

  /**
   * Load available contacts
   */
  loadContacts: async (params?: ContactsFilter & PaginationParams) => {
    set({ 
      isLoadingContacts: true, 
      error: null 
    });

    try {
      console.log('[MessagingStore] Loading contacts with params:', params);
      
      const contacts = await messagingService.loadContacts(params);
      
      set(state => ({
        contacts: params?.offset && params.offset > 0
          ? [...state.contacts, ...contacts] // Append for pagination
          : contacts, // Replace for new search
        isLoadingContacts: false,
        error: null,
      }));
      
      console.log('[MessagingStore] Contacts loaded successfully:', contacts.length);
    } catch (error) {
      console.error('[MessagingStore] Error loading contacts:', error);
      set({ 
        isLoadingContacts: false, 
        error: error instanceof Error ? error.message : 'Failed to load contacts' 
      });
    }
  },

  /**
   * Load messaging statistics
   */
  loadStats: async () => {
    try {
      console.log('[MessagingStore] Loading messaging stats');
      
      const stats = await messagingService.loadStats();
      
      set({ 
        stats, 
        error: null 
      });
      
      console.log('[MessagingStore] Stats loaded successfully:', stats);
    } catch (error) {
      console.error('[MessagingStore] Error loading stats:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load stats' 
      });
    }
  },

  /**
   * Send a new message or reply
   */
  sendMessage: async (data: NewMessageData) => {
    set({ 
      isLoading: true, 
      error: null 
    });

    try {
      console.log('[MessagingStore] Sending message:', {
        recipients: data.recipients?.length,
        subject: data.subject,
        hasContent: !!data.content,
        isReply: !!data.thread_id
      });
      
      const result = await messagingService.sendMessage(data);
      
      // Refresh threads after sending to get updated data
      const { loadThreads, loadStats } = get();
      await Promise.all([
        loadThreads(),
        loadStats(),
      ]);
      
      // If this was a reply, refresh the thread messages
      if (data.thread_id) {
        const { loadMessages } = get();
        await loadMessages(data.thread_id);
      }
      
      set({ 
        isLoading: false, 
        error: null 
      });
      
      console.log('[MessagingStore] Message sent successfully:', result.message_id);
      return result;
    } catch (error) {
      console.error('[MessagingStore] Error sending message:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to send message' 
      });
      throw error;
    }
  },

  /**
   * Mark a message as read
   */
  markAsRead: async (messageId: string) => {
    try {
      console.log('[MessagingStore] Marking message as read:', messageId);
      
      await messagingService.markAsRead(messageId);
      
      // Update local state optimistically
      set(state => {
        const updatedMessages = { ...state.messages };
        
        // Find and update the message in the cached messages
        Object.keys(updatedMessages).forEach(threadId => {
          const threadMessages = updatedMessages[threadId];
          const messageIndex = threadMessages.findIndex(m => m.message_id === messageId);
          if (messageIndex !== -1) {
            updatedMessages[threadId] = [
              ...threadMessages.slice(0, messageIndex),
              { ...threadMessages[messageIndex], read_status: true },
              ...threadMessages.slice(messageIndex + 1),
            ];
          }
        });
        
        // Update thread unread count
        const updatedThreads = state.threads.map(thread => {
          const hasUnreadMessage = Object.values(updatedMessages).flat()
            .some(msg => msg.thread_id === thread.thread_id && !msg.read_status);
          
          if (!hasUnreadMessage && thread.unread_count > 0) {
            return { ...thread, unread_count: Math.max(0, thread.unread_count - 1) };
          }
          return thread;
        });
        
        return {
          messages: updatedMessages,
          threads: updatedThreads,
          error: null,
        };
      });
      
      // Refresh stats to get updated unread count
      const { loadStats } = get();
      await loadStats();
      
      console.log('[MessagingStore] Message marked as read successfully');
    } catch (error) {
      console.error('[MessagingStore] Error marking message as read:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to mark message as read' 
      });
    }
  },

  /**
   * Select a thread as current
   */
  selectThread: (thread: MessageThread | null) => {
    console.log('[MessagingStore] Selecting thread:', thread?.thread_id || 'none');
    set({ currentThread: thread });
  },

  /**
   * Add contact to selected contacts
   */
  addSelectedContact: (contact: Contact) => {
    set(state => {
      // Check if contact is already selected
      const isAlreadySelected = state.selectedContacts.some(c => c.user_id === contact.user_id);
      if (isAlreadySelected) {
        console.log('[MessagingStore] Contact already selected:', contact.email);
        return state;
      }
      
      console.log('[MessagingStore] Adding selected contact:', contact.email);
      return {
        selectedContacts: [...state.selectedContacts, contact],
      };
    });
  },

  /**
   * Remove contact from selected contacts
   */
  removeSelectedContact: (contactId: string) => {
    console.log('[MessagingStore] Removing selected contact:', contactId);
    set(state => ({
      selectedContacts: state.selectedContacts.filter(c => c.user_id !== contactId),
    }));
  },

  /**
   * Clear all selected contacts
   */
  clearSelectedContacts: () => {
    console.log('[MessagingStore] Clearing selected contacts');
    set({ selectedContacts: [] });
  },

  /**
   * Refresh all data
   */
  refresh: async () => {
    set({ 
      isRefreshing: true, 
      error: null 
    });

    try {
      console.log('[MessagingStore] Starting refresh');
      
      // Clear cache and reload data directly
      await messagingService.refresh();
      
      // Load fresh data without using get() to avoid circular dependencies
      const [threads, contacts, stats] = await Promise.all([
        messagingService.loadThreads(),
        messagingService.loadContacts(),
        messagingService.loadStats(),
      ]);
      
      set({ 
        threads,
        contacts,
        stats,
        isRefreshing: false, 
        error: null 
      });
      
      console.log('[MessagingStore] Refresh completed successfully');
    } catch (error) {
      console.error('[MessagingStore] Error during refresh:', error);
      set({ 
        isRefreshing: false, 
        error: error instanceof Error ? error.message : 'Refresh failed' 
      });
    }
  },

  /**
   * Clear error state
   */
  clearError: () => {
    console.log('[MessagingStore] Clearing error');
    set({ error: null });
  },
}));

// Stable selectors defined outside the hook
const selectThreads = (state: MessagingState) => state.threads;
const selectStats = (state: MessagingState) => state.stats;
const selectError = (state: MessagingState) => state.error;
const selectIsLoading = (state: MessagingState) => state.isLoading;
const selectIsRefreshing = (state: MessagingState) => state.isRefreshing;

// Use individual selectors to avoid creating new objects
export const useMessagingThreads = () => useMessagingStore(selectThreads);
export const useMessagingStats = () => useMessagingStore(selectStats);
export const useMessagingError = () => useMessagingStore(selectError);
export const useMessagingIsLoading = () => useMessagingStore(selectIsLoading);
export const useMessagingIsRefreshing = () => useMessagingStore(selectIsRefreshing);

// Computed values as separate hooks
export const useMessagingUnreadCount = () => {
  const stats = useMessagingStore(selectStats);
  const threads = useMessagingStore(selectThreads);
  
  if (stats?.unread_count !== undefined) {
    return stats.unread_count;
  }
  
  return threads.reduce((count, thread) => count + thread.unread_count, 0);
};

// Legacy hook for compatibility - DO NOT USE IN NEW CODE
export const useMessagingState = () => useMessagingStore(state => ({
  threads: state.threads,
  stats: state.stats,
  error: state.error,
  isLoading: state.isLoading,
  isRefreshing: state.isRefreshing,
  isLoadingMessages: state.isLoadingMessages,
  isLoadingContacts: state.isLoadingContacts,
  unreadCount: 0, // Computed separately
  hasMessages: state.threads.length > 0,
}));

// Separate hook for actions (stable references that don't cause re-renders)
export const useMessagingActions = () => useMessagingStore(state => ({
  loadThreads: state.loadThreads,
  loadContacts: state.loadContacts,
  loadStats: state.loadStats,
  refresh: state.refresh,
  clearError: state.clearError,
  selectThread: state.selectThread,
  selectMessage: state.selectMessage,
  addSelectedContact: state.addSelectedContact,
  removeSelectedContact: state.removeSelectedContact,
  clearSelectedContacts: state.clearSelectedContacts,
}));

// Legacy hooks for backward compatibility (will be removed)
export const useUnreadCount = (): number => {
  return useMessagingStore(state => {
    if (state.stats) {
      return state.stats.unread_count;
    }
    return state.threads.reduce((count, thread) => count + thread.unread_count, 0);
  });
};

export const useHasMessages = (): boolean => {
  return useMessagingStore(state => state.threads.length > 0);
};

export const useMessagingLoading = () => {
  return useMessagingStore(state => ({
    isLoading: state.isLoading,
    isLoadingMessages: state.isLoadingMessages,
    isLoadingContacts: state.isLoadingContacts,
    isRefreshing: state.isRefreshing,
  }));
};