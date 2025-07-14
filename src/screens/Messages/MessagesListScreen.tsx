import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import api from '../../services/api';
import { MessageThreadItem } from './MessageThreadItem';

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

export const MessagesListScreen: React.FC = () => {
  const navigation = useNavigation();
  
  // State
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'shared'>('all');
  const [stats, setStats] = useState<any>(null);

  // Load threads
  const loadThreads = async () => {
    try {
      const response = await api.getMessageThreads({ filter: 'all' });
      setThreads(response.data || []);
    } catch (error) {
      console.error('Error loading threads:', error);
    }
  };

  // Load stats
  const loadStats = async () => {
    try {
      const response = await api.getMessagingStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([loadThreads(), loadStats()]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Refresh handler
  const onRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadThreads(), loadStats()]);
    setIsRefreshing(false);
  };

  // Filter threads
  const getFilteredThreads = () => {
    let filtered = threads;
    
    if (filter === 'unread') {
      filtered = filtered.filter(t => t.unread_count > 0);
    } else if (filter === 'shared') {
      filtered = filtered.filter(t => t.has_shared_records);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.subject?.toLowerCase().includes(query) ||
        t.last_message_preview?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  // Handle thread press
  const handleThreadPress = (threadId: string) => {
    console.log('Thread pressed:', threadId);
    // TODO: Navigate to conversation screen
  };

  // Render thread item
  const renderThread = ({ item }: { item: MessageThread }) => (
    <MessageThreadItem thread={item} onPress={handleThreadPress} />
  );

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando mensagens...</Text>
      </View>
    );
  }

  const filteredThreads = getFilteredThreads();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mensagens</Text>
        <TouchableOpacity 
          style={styles.newButton}
          onPress={() => console.log('New message')}
        >
          <FontAwesome name="plus" size={16} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <FontAwesome name="search" size={16} color={theme.colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar mensagens..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={theme.colors.textSecondary}
        />
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {(['all', 'unread', 'shared'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Todas' : f === 'unread' ? 'Não lidas' : 'Compartilhadas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filteredThreads}
        renderItem={renderThread}
        keyExtractor={item => item.identifier}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome name="inbox" size={64} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>Nenhuma mensagem</Text>
          </View>
        }
      />
    </View>
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
  },
  loadingText: {
    marginTop: 10,
    color: theme.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  newButton: {
    backgroundColor: theme.colors.primary,
    padding: 8,
    borderRadius: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    height: 40,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: theme.colors.text,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
  },
  filterActive: {
    backgroundColor: theme.colors.primary,
  },
  filterText: {
    color: theme.colors.text,
  },
  filterTextActive: {
    color: theme.colors.white,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
});