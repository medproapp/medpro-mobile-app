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
  StatusBar,
  Image,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import api from '../../services/api';
import { MessageThreadItem } from './MessageThreadItem';
import { useAuthStore } from '@store/authStore';

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
  const { user } = useAuthStore();
  
  // State
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'shared' | 'patients' | 'requests'>('all');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Load threads with filtering and search
  const loadThreads = async (filterType: string = 'all', searchTerm: string = '') => {
    try {
      const params: any = { filter: filterType };
      if (searchTerm) {
        params.search = searchTerm;
      }
      const response = await api.getMessageThreads(params);
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
      await Promise.all([loadThreads(filter, searchQuery), loadStats()]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Handle filter changes
  useEffect(() => {
    loadThreads(filter, searchQuery);
  }, [filter]);

  // Handle search with debouncing
  useEffect(() => {
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for search
    const timeout = setTimeout(() => {
      loadThreads(filter, searchQuery);
    }, 300); // 300ms delay

    setSearchTimeout(timeout);

    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [searchQuery]);

  // Refresh handler
  const onRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadThreads(filter, searchQuery), loadStats()]);
    setIsRefreshing(false);
  };

  // Get filtered threads (now handled server-side, so just return all)
  const getFilteredThreads = () => {
    return threads;
  };

  // Handle scroll indicators
  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtLeft = contentOffset.x <= 0;
    const isAtRight = contentOffset.x >= (contentSize.width - layoutMeasurement.width);
    
    setCanScrollLeft(!isAtLeft);
    setCanScrollRight(!isAtRight);
  };

  // Handle thread press
  const handleThreadPress = (threadId: string) => {
    console.log('Thread pressed:', threadId);
    const thread = threads.find(t => t.identifier === threadId);
    if (thread) {
      navigation.navigate('Conversation', {
        threadId: thread.identifier,
        threadSubject: thread.subject
      });
    }
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
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.container}>
        {/* Header with gradient background - same style as main page */}
        <View style={styles.headerBackground}>
          {/* Background Logo */}
          <Image
            source={require('../../assets/medpro-logo.png')}
            style={styles.backgroundLogo}
            resizeMode="contain"
          />
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.greeting}>Mensagens</Text>
              <Text style={styles.userName}>{user?.name || 'Doutor'}</Text>
              <Text style={styles.dateText}>Central de comunicação interna</Text>
            </View>
            <TouchableOpacity 
              style={styles.newButton}
              onPress={() => navigation.navigate('NewMessage')}
            >
              <FontAwesome name="plus" size={16} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content area */}
        <View style={styles.contentContainer}>
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
          <View style={styles.filtersContainer}>
            {/* Left scroll indicator */}
            {canScrollLeft && (
              <View style={[styles.scrollIndicator, styles.leftIndicator]}>
                <FontAwesome name="chevron-left" size={12} color={theme.colors.textSecondary} />
              </View>
            )}
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersContent}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {(['all', 'unread', 'shared', 'patients', 'requests'] as const).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterButton, filter === f && styles.filterActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                    {f === 'all' ? 'Todas' : 
                     f === 'unread' ? 'Não lidas' : 
                     f === 'shared' ? 'Compartilhadas' :
                     f === 'patients' ? 'Pacientes' : 
                     'Solicitações'}
                  </Text>
                  {/* Show badge for unread count or pending requests */}
                  {f === 'unread' && stats?.unread_count > 0 && (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>{stats.unread_count}</Text>
                    </View>
                  )}
                  {f === 'requests' && stats?.pending_patient_requests > 0 && (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>{stats.pending_patient_requests}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Right scroll indicator */}
            {canScrollRight && (
              <View style={[styles.scrollIndicator, styles.rightIndicator]}>
                <FontAwesome name="chevron-right" size={12} color={theme.colors.textSecondary} />
              </View>
            )}
          </View>

          {/* List */}
          <FlatList
            data={filteredThreads}
            renderItem={renderThread}
            keyExtractor={item => item.identifier}
            refreshControl={
              <RefreshControl 
                refreshing={isRefreshing} 
                onRefresh={onRefresh}
                colors={[theme.colors.primary]}
                tintColor={theme.colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FontAwesome name="inbox" size={64} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>Nenhuma mensagem</Text>
              </View>
            }
          />
        </View>
      </View>
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
  },
  loadingText: {
    marginTop: 10,
    color: theme.colors.textSecondary,
  },
  headerBackground: {
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: theme.spacing.lg,
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
    zIndex: 1,
  },
  backgroundLogo: {
    position: 'absolute',
    right: -20,
    top: '50%',
    width: 120,
    height: 120,
    opacity: 0.1,
    transform: [{ translateY: -60 }],
    tintColor: theme.colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    ...theme.typography.body,
    color: theme.colors.white + 'CC',
    fontSize: 16,
  },
  userName: {
    ...theme.typography.h1,
    color: theme.colors.white,
    fontSize: 24,
    fontWeight: '700',
    marginTop: theme.spacing.xs,
  },
  dateText: {
    ...theme.typography.caption,
    color: theme.colors.white + 'AA',
    fontSize: 14,
    marginTop: theme.spacing.xs,
  },
  newButton: {
    backgroundColor: theme.colors.white + '20',
    padding: theme.spacing.sm,
    borderRadius: 8,
    marginTop: theme.spacing.xs,
  },
  contentContainer: {
    flex: 1,
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
  filtersContainer: {
    marginBottom: 8,
    position: 'relative',
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingRight: 32, // Extra padding for last item
    flexDirection: 'row',
  },
  scrollIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    backgroundColor: theme.colors.background + 'DD', // Semi-transparent
  },
  leftIndicator: {
    left: 0,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  rightIndicator: {
    right: 0,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
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
  filterBadge: {
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.xs,
  },
  filterBadgeText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '600',
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