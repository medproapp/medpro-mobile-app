import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';

interface MessageThread {
  identifier: string;
  subject: string;
  thread_type: 'direct' | 'group';
  status: 'active' | 'archived';
  last_message_at: string;
  created_at: string;
  last_message_preview: string;
  last_sender_name: string;
  unread_count: number;
  participants_names: string;
  priority?: 'normal' | 'high' | 'urgent';
  has_shared_records?: boolean;
}

interface MessageThreadItemProps {
  thread: MessageThread;
  onPress: (threadId: string) => void;
}

export const MessageThreadItem: React.FC<MessageThreadItemProps> = ({ thread, onPress }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Ontem';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('pt-BR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
  };

  const getPriorityColor = () => {
    switch (thread.priority) {
      case 'urgent':
        return theme.colors.error;
      case 'high':
        return theme.colors.warning;
      default:
        return theme.colors.textSecondary;
    }
  };

  // Count participants from the names string
  const participantCount = thread.participants_names ? thread.participants_names.split(',').length : 0;

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => onPress(thread.identifier)}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            {thread.priority && thread.priority !== 'normal' && (
              <FontAwesome 
                name="exclamation-circle" 
                size={16} 
                color={getPriorityColor()} 
                style={styles.priorityIcon}
              />
            )}
            <Text style={styles.subject} numberOfLines={1}>
              {thread.subject || 'Sem assunto'}
            </Text>
          </View>
          <Text style={styles.date}>
            {formatDate(thread.last_message_at)}
          </Text>
        </View>
        
        <Text style={styles.preview} numberOfLines={2}>
          {thread.last_message_preview || 'Nenhuma mensagem'}
        </Text>
        
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Text style={styles.participants}>
              <FontAwesome name={thread.thread_type === 'direct' ? 'user' : 'users'} size={12} color={theme.colors.textSecondary} />
              {' '}{thread.participants_names || 'Sem participantes'}
            </Text>
            {thread.has_shared_records && (
              <View style={styles.sharedBadge}>
                <FontAwesome name="paperclip" size={12} color={theme.colors.primary} />
                <Text style={styles.sharedText}>Anexos</Text>
              </View>
            )}
          </View>
          
          {thread.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {thread.unread_count > 99 ? '99+' : thread.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  priorityIcon: {
    marginRight: 6,
  },
  subject: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  date: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  preview: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  participants: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  sharedText: {
    fontSize: 12,
    color: theme.colors.primary,
    marginLeft: 4,
  },
  unreadBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  unreadText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
});