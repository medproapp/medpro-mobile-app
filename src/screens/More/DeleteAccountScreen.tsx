import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { ResponsiveContainer } from '@components/common';
import { useAuthStore } from '@store/authStore';
import { useNavigation } from '@react-navigation/native';
import { api } from '@services/api';
import { logger } from '@/utils/logger';

interface AccountNumbers {
  relatedUsers: number;
  practitioners: number;
  linkedPatients: number;
  timeslots: number;
  schedules: number;
  practServiceTypes: number;
  practServiceCategories: number;
  appointments: number;
  organization: number;
  entityGroup: number;
  groupMembers: number;
  locations: number;
}

interface DataItem {
  label: string;
  count: number;
  icon: string;
}

export const DeleteAccountScreen: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigation = useNavigation();

  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [accountNumbers, setAccountNumbers] = useState<AccountNumbers | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<string>('');
  const [checkbox1, setCheckbox1] = useState(false);
  const [checkbox2, setCheckbox2] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = checkbox1 && checkbox2 && isOwner;

  useEffect(() => {
    loadAccountData();
  }, []);

  const loadAccountData = async () => {
    if (!user?.email) {
      setError('Usuário não autenticado');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check if user is organization owner
      const userToOrg = await api.getUserToOrg(user.email, 'owner');
      const ownerStatus = Array.isArray(userToOrg) && userToOrg.length > 0;
      setIsOwner(ownerStatus);

      // Get account numbers for data preview
      if (ownerStatus) {
        const numbers = await api.getAccountNumbers(user.email);
        setAccountNumbers(numbers);
      }
    } catch (err) {
      logger.error('Failed to load account data:', err);
      setError('Erro ao carregar dados da conta');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Confirmar Exclusão',
      'Esta ação é IRREVERSÍVEL. Todos os seus dados serão permanentemente apagados. Deseja continuar?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Sim, Excluir Minha Conta',
          style: 'destructive',
          onPress: performDeletion,
        },
      ]
    );
  };

  const performDeletion = async () => {
    if (!user?.email) return;

    try {
      setDeleting(true);
      setDeleteStatus('Apagando sua conta...');

      // Show progress messages like web app
      setTimeout(() => {
        if (deleting) setDeleteStatus('Enviando email de confirmação...');
      }, 3000);

      setTimeout(() => {
        if (deleting) setDeleteStatus('Finalizando...');
      }, 5000);

      const result = await api.deleteAccount(user.email);

      if (result.success) {
        setDeleteStatus('Pronto.');

        // Wait a moment then logout
        setTimeout(async () => {
          await logout();
          // Navigation will automatically redirect to Auth screen after logout
        }, 2000);
      } else {
        throw new Error(result.message || 'Erro ao excluir conta');
      }
    } catch (err) {
      logger.error('Failed to delete account:', err);
      setDeleting(false);
      setDeleteStatus('');
      Alert.alert(
        'Erro',
        'Não foi possível excluir sua conta. Por favor, tente novamente ou entre em contato com o suporte.',
        [{ text: 'OK' }]
      );
    }
  };

  const getDataItems = (): DataItem[] => {
    if (!accountNumbers) return [];

    return [
      { label: 'Cadastro como profissional', count: accountNumbers.practitioners, icon: 'user-md' },
      { label: 'Usuários dependentes', count: accountNumbers.relatedUsers, icon: 'users' },
      { label: 'Organização', count: accountNumbers.organization, icon: 'building' },
      { label: 'Grupos', count: accountNumbers.entityGroup, icon: 'object-group' },
      { label: 'Membros do grupo', count: accountNumbers.groupMembers, icon: 'user-plus' },
      { label: 'Locais de atendimento', count: accountNumbers.locations, icon: 'map-marker' },
      { label: 'Agendas', count: accountNumbers.schedules, icon: 'calendar' },
      { label: 'Horários', count: accountNumbers.timeslots, icon: 'clock-o' },
      { label: 'Tipos de serviço', count: accountNumbers.practServiceTypes, icon: 'list' },
      { label: 'Categorias de serviço', count: accountNumbers.practServiceCategories, icon: 'tags' },
      { label: 'Agendamentos', count: accountNumbers.appointments, icon: 'calendar-check-o' },
      { label: 'Pacientes vinculados', count: accountNumbers.linkedPatients, icon: 'heart' },
    ].filter(item => item.count > 0);
  };

  const renderCheckbox = (
    checked: boolean,
    onToggle: () => void,
    label: string
  ) => (
    <TouchableOpacity
      style={styles.checkboxContainer}
      onPress={onToggle}
      activeOpacity={0.7}
      disabled={deleting}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && (
          <FontAwesome name="check" size={14} color={theme.colors.white} />
        )}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.error} />
        <View style={styles.headerBackground}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
          </TouchableOpacity>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Encerrar Conta</Text>
            <Text style={styles.headerSubtitle}>Carregando...</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (deleting) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.error} />
        <View style={styles.headerBackground}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Encerrar Conta</Text>
            <Text style={styles.headerSubtitle}>Processando...</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.error} />
          <Text style={styles.deleteStatusText}>{deleteStatus}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.error} />

      {/* Header */}
      <View style={styles.headerBackground}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
        </TouchableOpacity>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Encerrar Conta</Text>
          <Text style={styles.headerSubtitle}>
            Exclusão permanente de dados
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <ResponsiveContainer>
        {/* Warning Alert */}
        <View style={styles.warningCard}>
          <View style={styles.warningIconContainer}>
            <FontAwesome name="exclamation-triangle" size={24} color={theme.colors.error} />
          </View>
          <Text style={styles.warningTitle}>Atenção: Ação Irreversível</Text>
          <Text style={styles.warningText}>
            Ao encerrar sua conta, todos os seus dados serão permanentemente apagados.
            Esta ação não pode ser desfeita.
          </Text>
        </View>

        {/* Access Control Message */}
        {isOwner === false && (
          <View style={styles.accessDeniedCard}>
            <FontAwesome name="lock" size={20} color={theme.colors.warning} />
            <Text style={styles.accessDeniedText}>
              Apenas proprietários de organização podem encerrar sua conta.
              Entre em contato com o administrador da sua organização.
            </Text>
          </View>
        )}

        {/* Data to be deleted */}
        {isOwner && accountNumbers && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dados que serão apagados:</Text>
            <View style={styles.dataList}>
              {getDataItems().map((item, index) => (
                <View key={index} style={styles.dataItem}>
                  <View style={styles.dataItemIcon}>
                    <FontAwesome
                      name={item.icon}
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                  </View>
                  <Text style={styles.dataItemLabel}>{item.label}</Text>
                  <Text style={styles.dataItemCount}>{item.count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Confirmation Checkboxes */}
        {isOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confirmação:</Text>

            {renderCheckbox(
              checkbox1,
              () => setCheckbox1(!checkbox1),
              'Confirmo que quero encerrar minha conta e apagar todos os dados.'
            )}

            {renderCheckbox(
              checkbox2,
              () => setCheckbox2(!checkbox2),
              'Eu quero realmente encerrar minha conta. Estou ciente que meus dados serão apagados permanentemente.'
            )}
          </View>
        )}

        {/* Delete Button */}
        {isOwner && (
          <TouchableOpacity
            style={[
              styles.deleteButton,
              !canDelete && styles.deleteButtonDisabled,
            ]}
            onPress={handleDeleteAccount}
            disabled={!canDelete}
            activeOpacity={0.7}
          >
            <FontAwesome
              name="trash"
              size={18}
              color={canDelete ? theme.colors.white : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.deleteButtonText,
                !canDelete && styles.deleteButtonTextDisabled,
              ]}
            >
              Encerrar Minha Conta
            </Text>
          </TouchableOpacity>
        )}

        {/* Error Message */}
        {error && (
          <View style={styles.errorCard}>
            <FontAwesome name="exclamation-circle" size={16} color={theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        </ResponsiveContainer>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerBackground: {
    backgroundColor: theme.colors.error,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: theme.spacing.lg,
    shadowColor: theme.colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backButton: {
    position: 'absolute',
    top: (StatusBar.currentHeight || 44) + 12,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  headerTitle: {
    ...theme.typography.h1,
    color: theme.colors.white,
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.white + 'AA',
    fontSize: 14,
    marginTop: theme.spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteStatusText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
  },
  warningCard: {
    backgroundColor: theme.colors.error + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.error + '30',
    alignItems: 'center',
  },
  warningIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.error + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.error,
    marginBottom: 8,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 14,
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: 20,
  },
  accessDeniedCard: {
    backgroundColor: theme.colors.warning + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.warning + '30',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accessDeniedText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  dataList: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dataItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dataItemLabel: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
  },
  dataItemCount: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.error,
    borderColor: theme.colors.error,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 22,
  },
  deleteButton: {
    backgroundColor: theme.colors.error,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  deleteButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.white,
  },
  deleteButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  errorCard: {
    backgroundColor: theme.colors.error + '10',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.error,
  },
});
