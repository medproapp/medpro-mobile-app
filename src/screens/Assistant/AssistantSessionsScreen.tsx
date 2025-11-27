import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  StatusBar,
  Image,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme } from '../../theme';
import { useAssistantStore } from '../../store/assistantStore';
import { Session } from '../../types/assistant';
import { AssistantStackParamList } from '../../types/navigation';
import { logger } from '@/utils/logger';

type NavigationProp = NativeStackNavigationProp<AssistantStackParamList, 'AssistantSessions'>;

// Format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export const AssistantSessionsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const {
    sessions,
    sessionsLoading,
    activeSessionId,
    lastError,
    initializeAssistant,
    loadSessions,
    selectSession,
    createNewSession,
    deleteSession,
    renameSession,
  } = useAssistantStore();

  const [refreshing, setRefreshing] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [sessionToRename, setSessionToRename] = useState<Session | null>(null);
  const [newTitle, setNewTitle] = useState('');

  // Initialize on mount
  useEffect(() => {
    initializeAssistant();
  }, [initializeAssistant]);

  // Handle pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  }, [loadSessions]);

  // Handle session tap
  const handleSessionPress = useCallback(async (session: Session) => {
    await selectSession(session.id);
    navigation.navigate('AssistantChat', { sessionId: session.id });
  }, [selectSession, navigation]);

  // Handle create new session
  const handleCreateSession = useCallback(async () => {
    const session = await createNewSession();
    if (session) {
      navigation.navigate('AssistantChat', { sessionId: session.id });
    }
  }, [createNewSession, navigation]);

  // Handle delete session
  const handleDeleteSession = useCallback((session: Session) => {
    Alert.alert(
      'Excluir Conversa',
      `Tem certeza que deseja excluir "${session.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteSession(session.id),
        },
      ]
    );
  }, [deleteSession]);

  // Handle rename session
  const handleRenamePress = useCallback((session: Session) => {
    setSessionToRename(session);
    setNewTitle(session.title);
    setRenameModalVisible(true);
  }, []);

  const handleRenameConfirm = useCallback(async () => {
    if (sessionToRename && newTitle.trim()) {
      await renameSession(sessionToRename.id, newTitle.trim());
    }
    setRenameModalVisible(false);
    setSessionToRename(null);
    setNewTitle('');
  }, [sessionToRename, newTitle, renameSession]);

  // Render swipeable delete action
  const renderRightActions = useCallback((session: Session) => {
    return (
      <View style={styles.swipeActionsContainer}>
        <TouchableOpacity
          style={styles.renameAction}
          onPress={() => handleRenamePress(session)}
        >
          <Feather name="edit-2" size={20} color={theme.colors.white} />
          <Text style={styles.actionText}>Renomear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteAction}
          onPress={() => handleDeleteSession(session)}
        >
          <Feather name="trash-2" size={20} color={theme.colors.white} />
          <Text style={styles.actionText}>Excluir</Text>
        </TouchableOpacity>
      </View>
    );
  }, [handleDeleteSession, handleRenamePress]);

  // Render session item
  const renderSessionItem = useCallback(({ item }: { item: Session }) => {
    const isActive = item.id === activeSessionId;

    return (
      <Swipeable
        renderRightActions={() => renderRightActions(item)}
        overshootRight={false}
      >
        <TouchableOpacity
          style={[styles.sessionItem, isActive && styles.sessionItemActive]}
          onPress={() => handleSessionPress(item)}
          onLongPress={() => handleRenamePress(item)}
          activeOpacity={0.7}
        >
          <View style={styles.sessionIcon}>
            <Feather
              name="message-circle"
              size={20}
              color={isActive ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>
          <View style={styles.sessionContent}>
            <Text
              style={[styles.sessionTitle, isActive && styles.sessionTitleActive]}
              numberOfLines={1}
            >
              {item.title || 'Nova conversa'}
            </Text>
            <Text style={styles.sessionTime}>
              {formatRelativeTime(item.updatedAt || item.createdAt)}
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </Swipeable>
    );
  }, [activeSessionId, handleSessionPress, handleRenamePress, renderRightActions]);

  // Render empty state
  const renderEmptyState = () => {
    if (sessionsLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Feather name="message-circle" size={64} color={theme.colors.textSecondary} />
        <Text style={styles.emptyTitle}>Nenhuma conversa</Text>
        <Text style={styles.emptyText}>
          Comece uma nova conversa com o assistente MedPro
        </Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={handleCreateSession}
        >
          <Feather name="plus" size={20} color={theme.colors.white} />
          <Text style={styles.emptyButtonText}>Nova Conversa</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md }]}>
          <Image
            source={require('../../assets/medpro-logo.png')}
            style={styles.backgroundLogo}
            resizeMode="contain"
          />
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Assistente MedPro</Text>
              <Text style={styles.headerSubtitle}>
                {sessions.length} {sessions.length === 1 ? 'conversa' : 'conversas'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.newButton}
              onPress={handleCreateSession}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Error Banner */}
        {lastError && (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={16} color={theme.colors.error} />
            <Text style={styles.errorText}>{lastError}</Text>
          </View>
        )}

        {/* Loading State */}
        {sessionsLoading && sessions.length === 0 && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Carregando conversas...</Text>
          </View>
        )}

        {/* Session List */}
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={renderSessionItem}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[
            styles.listContent,
            sessions.length === 0 && styles.listContentEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />

        {/* Rename Modal */}
        <Modal
          visible={renameModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setRenameModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Renomear Conversa</Text>
              <TextInput
                style={styles.modalInput}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Título da conversa"
                placeholderTextColor={theme.colors.textSecondary}
                autoFocus
                selectTextOnFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setRenameModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmButton}
                  onPress={handleRenameConfirm}
                >
                  <Text style={styles.modalConfirmText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...theme.shadows.large,
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundLogo: {
    position: 'absolute',
    right: -32,
    top: '30%',
    width: 140,
    height: 140,
    opacity: 0.08,
    tintColor: theme.colors.white,
    transform: [{ translateY: -70 }],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.white + 'CC',
    marginTop: 4,
  },
  newButton: {
    backgroundColor: theme.colors.white + '1F',
    borderRadius: 24,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.error + '15',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.error,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  listContent: {
    padding: theme.spacing.md,
  },
  listContentEmpty: {
    flex: 1,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.small,
  },
  sessionItemActive: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight + '10',
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  sessionContent: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  sessionTitleActive: {
    color: theme.colors.primary,
  },
  sessionTime: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  renameAction: {
    backgroundColor: theme.colors.info,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  deleteAction: {
    backgroundColor: theme.colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  actionText: {
    color: theme.colors.white,
    fontSize: 12,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: 24,
    gap: theme.spacing.sm,
  },
  emptyButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  modalInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
  },
  modalCancelButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  modalCancelText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  modalConfirmButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
  },
  modalConfirmText: {
    fontSize: 16,
    color: theme.colors.white,
    fontWeight: '600',
  },
});

export default AssistantSessionsScreen;
