import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { useMessagingStore } from '@store/messagingStore';
import { useAuthStore } from '@store/authStore';
import { Message, MessageThread } from '@/types/messaging';
import { MessagesStackParamList } from '@/types/navigation';

type ConversationScreenRouteProp = RouteProp<MessagesStackParamList, 'Conversation'>;

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  onMarkAsRead: () => void;
  ucUnits?: number;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwnMessage, onMarkAsRead, ucUnits }) => {
  useEffect(() => {
    // Only mark as read if message has a valid ID and user is not the sender
    if (!isOwnMessage && !message.read_status && message.message_id) {
      setTimeout(() => onMarkAsRead(), 1000); // Delay to ensure user has seen it
    }
  }, [message, isOwnMessage, onMarkAsRead]);

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Agora';
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
  };

  return (
    <View style={[
      styles.messageBubble,
      isOwnMessage ? styles.ownMessage : styles.otherMessage
    ]}>
      {!isOwnMessage && (
        <Text style={styles.senderName}>{message.sender_name}</Text>
      )}
      <Text style={[
        styles.messageText,
        isOwnMessage ? styles.ownMessageText : styles.otherMessageText
      ]}>
        {message.content}
      </Text>
      <View style={styles.messageFooter}>
        <Text style={[
          styles.messageTime,
          isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
        ]}>
          {formatMessageTime(message.created_at)}
        </Text>
        {isOwnMessage && (
          <FontAwesome 
            name="check" 
            size={12} 
            color={isOwnMessage ? theme.colors.white + '80' : theme.colors.textSecondary} 
          />
        )}
      </View>
      {isOwnMessage && typeof ucUnits === 'number' && ucUnits > 0 && (
        <View style={styles.ucChip}>
          <Text style={styles.ucChipText}>+{ucUnits} UC</Text>
        </View>
      )}
      {!message.read_status && !isOwnMessage && (
        <View style={styles.unreadIndicator} />
      )}
    </View>
  );
};

export const ConversationScreen: React.FC = () => {
  const route = useRoute<ConversationScreenRouteProp>();
  const navigation = useNavigation();
  const { threadId, threadSubject } = route.params;
  const { user } = useAuthStore();
  
  // Messaging store
  const {
    messages,
    currentThread,
    isLoadingMessages,
    error,
    loadMessages,
    sendMessage,
    markAsRead,
    selectThread,
  } = useMessagingStore();

  // Local state
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ucByMessage, setUcByMessage] = useState<Record<string, number>>({});
  const [ucTotal, setUcTotal] = useState<number>(0);
  const [ucLoaded, setUcLoaded] = useState<boolean>(false);
  
  const flatListRef = useRef<FlatList>(null);
  
  // Get messages for this thread
  const threadMessages = messages[threadId] || [];
  
  // Debug logging for messages
  useEffect(() => {
    if (threadMessages.length > 0) {
      console.log('[ConversationScreen] Thread messages loaded:', {
        count: threadMessages.length,
        firstMessage: threadMessages[0] ? {
          message_id: threadMessages[0].message_id,
          identifier: threadMessages[0].identifier,
          sender: threadMessages[0].sender_name,
          hasMessageId: !!threadMessages[0].message_id,
          hasIdentifier: !!threadMessages[0].identifier
        } : null
      });
    }
  }, [threadMessages]);

  // Load messages when component mounts
  useEffect(() => {
    console.log('[ConversationScreen] Loading messages for thread:', threadId);
    loadMessages(threadId);
    
    // Set as current thread
    const thread: MessageThread = {
      thread_id: threadId,
      subject: threadSubject,
      last_message_preview: '',
      last_message_date: '',
      participant_count: 0,
      unread_count: 0,
      participants: [],
      has_shared_records: false,
      priority: 'normal',
      created_by: '',
      created_at: '',
      updated_at: '',
    };
    selectThread(thread);

    return () => {
      selectThread(null);
    };
  }, [threadId, threadSubject]);

  // Load UC ledger for this thread (current month), best-effort
  useEffect(() => {
    const loadUc = async () => {
      try {
        setUcLoaded(false);
        const now = new Date();
        const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString();
        const to = new Date().toISOString();
        const result: any = await (await import('@services/api')).default.getCommUsageLedger({ thread_id: threadId, from, to, limit: 500 });
        const entries: any[] = (result && result.data) || result || [];
        const map: Record<string, number> = {};
        let total = 0;
        if (Array.isArray(entries)) {
          for (const row of entries) {
            const mid = row.message_id || row.messageId;
            const units = Number(row.units || 0);
            if (mid && units > 0) {
              map[mid] = units;
              total += units;
            }
          }
        }
        setUcByMessage(map);
        setUcTotal(total);
      } catch (e) {
        // Likely UC disabled or endpoint not mounted; ignore silently
      } finally {
        setUcLoaded(true);
      }
    };
    loadUc();
  }, [threadId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (threadMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [threadMessages.length]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadMessages(threadId);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    
    const content = messageText.trim();
    setMessageText('');
    setIsSending(true);

    try {
      await sendMessage({
        recipients: [], // Will be populated by backend based on thread
        subject: threadSubject,
        content,
        thread_id: threadId,
        message_type: 'text',
        priority: 'normal',
      });
      
      // Reload messages to show the new one
      await loadMessages(threadId);
    } catch (error) {
      console.error('[ConversationScreen] Error sending message:', error);
      Alert.alert('Erro', 'Não foi possível enviar a mensagem. Tente novamente.');
      setMessageText(content); // Restore message text
    } finally {
      setIsSending(false);
    }
  };

  // Handle mark as read
  const handleMarkAsRead = async (messageId: string) => {
    if (!messageId) {
      console.warn('[ConversationScreen] Cannot mark message as read: messageId is undefined');
      return;
    }
    
    try {
      await markAsRead(messageId);
    } catch (error) {
      console.error('[ConversationScreen] Error marking message as read:', error);
    }
  };

  // Render message item
  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === user?.id;
    return (
      <MessageBubble 
        message={item} 
        isOwnMessage={isOwnMessage}
        onMarkAsRead={() => handleMarkAsRead(item.message_id)}
        ucUnits={ucByMessage[item.message_id]}
      />
    );
  };

  // Loading state
  if (isLoadingMessages && threadMessages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando mensagens...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {threadSubject}
            </Text>
            <Text style={styles.headerSubtitle}>
              {threadMessages.length} mensagens{ucLoaded && ucTotal > 0 ? ` • UC mês: ${ucTotal}` : ''}
            </Text>
          </View>
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          style={styles.messagesList}
          data={threadMessages}
          renderItem={renderMessage}
          keyExtractor={(item, index) =>
            item.message_id
              ? String(item.message_id)
              : item.identifier
              ? String(item.identifier)
              : `message-${index}`
          }
          refreshControl={
            <RefreshControl 
              refreshing={isRefreshing} 
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome name="comments-o" size={64} color={theme.colors.textSecondary} />
              <Text style={styles.emptyText}>Nenhuma mensagem ainda</Text>
              <Text style={styles.emptySubtext}>Seja o primeiro a enviar uma mensagem nesta conversa</Text>
            </View>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Digite sua mensagem..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              maxLength={2000}
              editable={!isSending}
            />
            <TouchableOpacity 
              style={[
                styles.sendButton,
                (!messageText.trim() || isSending) && styles.sendButtonDisabled
              ]}
              onPress={handleSendMessage}
              disabled={!messageText.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <FontAwesome name="send" size={16} color={theme.colors.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 10,
    color: theme.colors.textSecondary,
  },
  header: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  backButton: {
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...theme.typography.h3,
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.white + 'CC',
    fontSize: 12,
    marginTop: 2,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  messageBubble: {
    maxWidth: '80%',
    marginVertical: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: 16,
    position: 'relative',
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    ...theme.typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  messageText: {
    ...theme.typography.body,
    fontSize: 16,
    lineHeight: 22,
  },
  ownMessageText: {
    color: theme.colors.white,
  },
  otherMessageText: {
    color: theme.colors.text,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.xs,
    gap: 4,
  },
  ucChip: {
    alignSelf: 'flex-end',
    backgroundColor: '#E53935',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  ucChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  messageTime: {
    ...theme.typography.caption,
    fontSize: 11,
  },
  ownMessageTime: {
    color: theme.colors.white + '80',
  },
  otherMessageTime: {
    color: theme.colors.textSecondary,
  },
  unreadIndicator: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
  },
  inputContainer: {
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.background,
    borderRadius: 24,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: 44,
  },
  textInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    maxHeight: 100,
    paddingRight: theme.spacing.sm,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.textSecondary,
    opacity: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    ...theme.typography.h3,
    color: theme.colors.textSecondary,
    marginTop: 16,
    fontSize: 18,
  },
  emptySubtext: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  errorContainer: {
    backgroundColor: theme.colors.error,
    padding: theme.spacing.sm,
    margin: theme.spacing.md,
    borderRadius: 8,
  },
  errorText: {
    color: theme.colors.white,
    textAlign: 'center',
    fontSize: 14,
  },
});
