import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Image,
  StatusBar,
  GestureResponderEvent,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { StackNavigationProp } from '@react-navigation/stack';
import { theme } from '@theme/index';
import { useNotificationStore } from '@store/notificationStore';
import type { NotificationItem, NotificationStatus } from '@/types/notifications';
import type { DashboardStackParamList } from '@/types/navigation';
import { resolveNotificationNavigation } from '@utils/notificationNavigation';

const formatDate = (value?: string | null): string => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const isUnread = (notification: NotificationItem) =>
  notification.status === 'delivered' && !notification.read_at;

export const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<DashboardStackParamList>>();
  const items = useNotificationStore(state => state.items);
  const isLoadingList = useNotificationStore(state => state.isLoadingList);
  const isRefreshing = useNotificationStore(state => state.isRefreshing);
  const fetchNotifications = useNotificationStore(state => state.fetchNotifications);
  const refreshNotifications = useNotificationStore(state => state.refreshNotifications);
  const markAsRead = useNotificationStore(state => state.markAsRead);
  const markAllAsRead = useNotificationStore(state => state.markAllAsRead);
  const archiveNotification = useNotificationStore(state => state.archiveNotification);
  const pagination = useNotificationStore(state => state.pagination);
  const query = useNotificationStore(state => state.query);
  const pendingCount = useNotificationStore(state => state.pendingCount);
  const error = useNotificationStore(state => state.error);

  const hasUnread = useMemo(() => items.some(isUnread), [items]);
  const markAllColor = hasUnread ? theme.colors.white : theme.colors.textSecondary;

  useFocusEffect(
    useCallback(() => {
      fetchNotifications({ page: 1 });
    }, [fetchNotifications])
  );

  const filters = useMemo(
    () => [
      { label: 'Todas', value: 'all' as NotificationStatus | 'all' },
      { label: 'Pendentes', value: 'delivered' as NotificationStatus | 'all' },
      { label: 'Lidas', value: 'read' as NotificationStatus | 'all' },
      { label: 'Arquivadas', value: 'archived' as NotificationStatus | 'all' },
    ],
    []
  );

  const handleFilterChange = (status: NotificationStatus | 'all') => {
    if (status === (query.status ?? 'all')) {
      return;
    }
    fetchNotifications({ status, page: 1 });
  };

  const handleLoadMore = () => {
    if (!pagination?.hasMore || isLoadingList) {
      return;
    }

    const nextPage = (pagination.page ?? 1) + 1;
    fetchNotifications({ page: nextPage });
  };

  const handleMarkAll = () => {
    if (!hasUnread) {
      return;
    }
    markAllAsRead();
  };

  const handleNotificationPress = useCallback(
    (item: NotificationItem) => {
      const target = resolveNotificationNavigation(item);

      if (isUnread(item)) {
        markAsRead(item.id).catch(error => {
          console.error('[NotificationsScreen] Failed to mark as read', error);
        });
      }

      if (!target) {
        return;
      }

      const tabNavigation = navigation.getParent();

      switch (target.type) {
        case 'MESSAGES_CONVERSATION':
          if (!target.params?.threadId) {
            tabNavigation?.navigate('Messages');
            return;
          }
          tabNavigation?.navigate('Messages', {
            screen: 'Conversation',
            params: target.params,
          });
          break;
        case 'MESSAGES_TAB':
          tabNavigation?.navigate('Messages');
          break;
        case 'DASHBOARD_APPOINTMENT_DETAILS':
          navigation.navigate('AppointmentDetails', target.params);
          break;
        case 'DASHBOARD_HOME':
          navigation.navigate('DashboardHome');
          break;
        default:
          break;
      }
    },
    [markAsRead, navigation]
  );

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const handleMarkReadPress = (event: GestureResponderEvent) => {
      event.stopPropagation();
      markAsRead(item.id);
    };

    const handleArchivePress = (event: GestureResponderEvent) => {
      event.stopPropagation();
      archiveNotification(item.id);
    };

    return (
      <TouchableOpacity
        style={[styles.card, isUnread(item) && styles.cardUnread]}
        activeOpacity={0.85}
        onPress={() => handleNotificationPress(item)}
        accessibilityRole="button"
      >
        <View style={styles.iconWrapper}>
          <MaterialIcons
            name={isUnread(item) ? 'notifications' : 'notifications-none'}
            size={24}
            color={isUnread(item) ? theme.colors.primary : theme.colors.textSecondary}
          />
        </View>
        <View style={styles.content}>
          <View style={styles.cardHeader}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title || 'Notificação'}
            </Text>
            <View style={styles.cardActions}>
              {isUnread(item) ? (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleMarkReadPress}
                  accessibilityLabel="Marcar como lida"
                >
                  <MaterialIcons name="done" size={18} color={theme.colors.success} />
                </TouchableOpacity>
              ) : null}
              {item.status !== 'archived' ? (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleArchivePress}
                  accessibilityLabel="Arquivar notificação"
                >
                  <MaterialIcons name="archive" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          {item.body ? <Text style={styles.message}>{item.body}</Text> : null}
          <View style={styles.metaRow}>
            <Text style={styles.source} numberOfLines={1}>
              {item.source}
            </Text>
            <Text style={styles.date}>{formatDate(item.read_at || item.delivered_at)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <MaterialIcons
        name="notifications-none"
        size={48}
        color={theme.colors.textSecondary}
      />
      <Text style={styles.emptyTitle}>Nenhuma notificação por aqui</Text>
      <Text style={styles.emptySubtitle}>
        Ajuste os filtros ou aguarde novas notificações.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.headerBackground}>
        <Image
          source={require('../../assets/medpro-logo.png')}
          style={styles.backgroundLogo}
          resizeMode="contain"
        />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Voltar"
          >
            <MaterialIcons name="arrow-back" size={22} color={theme.colors.white} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.screenTitle}>Notificações</Text>
            <Text style={styles.subtitle}>
              {pendingCount} {pendingCount === 1 ? 'pendente' : 'pendentes'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.contentWrapper}>
        <View style={styles.filterRow}>
          {filters.map(filter => {
            const isActive = (query.status ?? 'all') === filter.value;
            return (
              <TouchableOpacity
                key={filter.value}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => handleFilterChange(filter.value)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.markAllButton, !hasUnread && styles.markAllButtonDisabled, styles.markAllButtonFloating]}
          onPress={handleMarkAll}
          disabled={!hasUnread}
        >
          <MaterialIcons name="done-all" size={18} color={markAllColor} />
          <Text style={[styles.markAllButtonText, !hasUnread && styles.markAllButtonTextDisabled]}>
            Marcar todas
          </Text>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isLoadingList && items.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item, index) =>
              typeof item.id === 'number' && Number.isFinite(item.id)
                ? String(item.id)
                : `notification-${index}`
            }
            renderItem={renderItem}
            contentContainerStyle={items.length === 0 ? styles.listEmptyContainer : styles.listContainer}
            ListEmptyComponent={renderEmpty}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={refreshNotifications}
                colors={[theme.colors.primary]}
                tintColor={theme.colors.primary}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerBackground: {
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: StatusBar.currentHeight || 48,
    paddingBottom: 20,
    paddingHorizontal: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundLogo: {
    position: 'absolute',
    right: -20,
    top: '50%',
    width: 120,
    height: 120,
    opacity: 0.08,
    transform: [{ translateY: -60 }],
    tintColor: theme.colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white + '1A',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.white,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.white + 'CC',
    marginTop: 4,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  markAllButtonDisabled: {
    backgroundColor: theme.colors.borderLight,
  },
  markAllButtonText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.white,
  },
  markAllButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    marginTop: -12,
  },
  markAllButtonFloating: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 13,
    marginBottom: 12,
  },
  listContainer: {
    paddingBottom: 32,
  },
  listEmptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardUnread: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardActions: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight,
    marginLeft: 8,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight,
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  source: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginRight: 8,
  },
  date: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
