// Internal Communication Types for MedPro Mobile App

export interface User {
  id: string;
  email: string;
  displayName: string;
  organization?: string;
  role?: string;
  isOnline?: boolean;
}

export interface Contact {
  user_id: string;
  display_name: string;
  email: string;
  organization?: string;
  role?: string;
  same_organization: boolean;
  last_seen?: string;
}

export interface MessageThread {
  thread_id: string;
  subject: string;
  last_message_preview: string;
  last_message_date: string;
  participant_count: number;
  unread_count: number;
  participants: User[];
  has_shared_records: boolean;
  priority: 'normal' | 'high' | 'urgent';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  message_id: string; // Keep this for compatibility but map from identifier
  identifier: string; // The actual field from the API
  thread_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  message_type: 'text' | 'shared_record' | 'audio' | 'file';
  priority: 'normal' | 'high' | 'urgent';
  read_status: boolean;
  created_at: string;
  attachment_data?: AttachmentData;
  shared_record_info?: SharedRecordInfo;
}

export interface AttachmentData {
  attachment_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  attachment_url: string;
  thumbnail_url?: string;
}

export interface SharedRecordInfo {
  record_type: string;
  record_id: string;
  patient_name?: string;
  permission_level: 'view' | 'edit' | 'full';
  shared_at: string;
  expires_at?: string;
}

export interface NewMessageData {
  recipients: string[];
  subject: string;
  content: string;
  message_type?: 'text' | 'shared_record';
  priority?: 'normal' | 'high' | 'urgent';
  attachment_data?: AttachmentData;
  shared_record_info?: SharedRecordInfo;
  thread_id?: string; // For replies
}

export interface MessageStats {
  unread_count: number;
  unread_messages?: number; // Backwards compatibility - backend may return this
  total_threads: number;
  shared_records_count: number;
  last_activity: string;
}

export interface MessagingApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface ThreadsFilter {
  filter?: 'all' | 'unread' | 'shared';
  search?: string;
}

export interface ContactsFilter {
  search?: string;
  organization?: string;
}

// Zustand Store State
export interface MessagingState {
  // Data
  threads: MessageThread[];
  currentThread: MessageThread | null;
  messages: Record<string, Message[]>; // threadId -> Message[]
  contacts: Contact[];
  stats: MessageStats | null;
  
  // UI State
  isLoading: boolean;
  isLoadingMessages: boolean;
  isLoadingContacts: boolean;
  isRefreshing: boolean;
  error: string | null;
  
  // Selected state
  selectedContacts: Contact[];
  
  // Actions
  loadThreads: (params?: ThreadsFilter & PaginationParams) => Promise<void>;
  loadMessages: (threadId: string, params?: PaginationParams) => Promise<void>;
  loadContacts: (params?: ContactsFilter & PaginationParams) => Promise<void>;
  loadStats: () => Promise<void>;
  sendMessage: (data: NewMessageData) => Promise<{ message_id: string; thread_id: string }>;
  markAsRead: (messageId: string) => Promise<void>;
  selectThread: (thread: MessageThread | null) => void;
  selectMessage: (messageId: string | null) => void;
  addSelectedContact: (contact: Contact) => void;
  removeSelectedContact: (contactId: string) => void;
  clearSelectedContacts: () => void;
  refresh: () => Promise<void>;
  clearError: () => void;
  handleRealtimeUpdate: (type: string, data: Record<string, unknown>) => void;
  updateBadgeCount: (count: number) => void;
}

// Component Props
export interface MessageItemProps {
  message: Message;
  isOwnMessage: boolean;
  onMarkAsRead?: () => void;
}

export interface ThreadItemProps {
  thread: MessageThread;
  onPress: () => void;
  isSelected?: boolean;
}

export interface ContactItemProps {
  contact: Contact;
  onPress: () => void;
  isSelected?: boolean;
  showOrganization?: boolean;
}

export interface MessageComposerProps {
  threadId?: string;
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}