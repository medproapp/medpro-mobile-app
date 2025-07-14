import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { useAuthStore } from '@store/authStore';

interface MoreOption {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  iconColor?: string;
  onPress: () => void;
  showChevron?: boolean;
}

export const MoreScreen: React.FC = () => {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair da aplicação?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const moreOptions: MoreOption[] = [
    {
      id: 'profile',
      title: 'Meu Perfil',
      subtitle: 'Informações pessoais e configurações',
      icon: 'user-md',
      iconColor: theme.colors.primary,
      onPress: () => Alert.alert('Perfil', 'Funcionalidade em desenvolvimento'),
      showChevron: true,
    },
    {
      id: 'settings',
      title: 'Configurações',
      subtitle: 'Preferências do aplicativo',
      icon: 'cog',
      iconColor: theme.colors.textSecondary,
      onPress: () => Alert.alert('Configurações', 'Funcionalidade em desenvolvimento'),
      showChevron: true,
    },
    {
      id: 'notifications',
      title: 'Notificações',
      subtitle: 'Gerenciar alertas e lembretes',
      icon: 'bell',
      iconColor: theme.colors.warning,
      onPress: () => Alert.alert('Notificações', 'Funcionalidade em desenvolvimento'),
      showChevron: true,
    },
    {
      id: 'reports',
      title: 'Relatórios',
      subtitle: 'Visualizar estatísticas e relatórios',
      icon: 'bar-chart',
      iconColor: theme.colors.info,
      onPress: () => Alert.alert('Relatórios', 'Funcionalidade em desenvolvimento'),
      showChevron: true,
    },
    {
      id: 'calendar',
      title: 'Agenda',
      subtitle: 'Visualizar agenda completa',
      icon: 'calendar',
      iconColor: theme.colors.success,
      onPress: () => Alert.alert('Agenda', 'Funcionalidade em desenvolvimento'),
      showChevron: true,
    },
    {
      id: 'help',
      title: 'Ajuda e Suporte',
      subtitle: 'Central de ajuda e contato',
      icon: 'question-circle',
      iconColor: theme.colors.info,
      onPress: () => Alert.alert('Ajuda', 'Entre em contato: suporte@medpro.com'),
      showChevron: true,
    },
    {
      id: 'about',
      title: 'Sobre o MedPro',
      subtitle: 'Versão 1.0.0',
      icon: 'info-circle',
      iconColor: theme.colors.textSecondary,
      onPress: () => Alert.alert('Sobre', 'MedPro Mobile v1.0.0\nDesenvolvido para profissionais de saúde'),
      showChevron: true,
    },
    {
      id: 'logout',
      title: 'Sair',
      subtitle: 'Fazer logout da aplicação',
      icon: 'sign-out',
      iconColor: theme.colors.error,
      onPress: handleLogout,
      showChevron: false,
    },
  ];

  const renderOption = (option: MoreOption) => (
    <TouchableOpacity
      key={option.id}
      style={styles.optionCard}
      onPress={option.onPress}
      activeOpacity={0.7}
    >
      <View style={styles.optionContent}>
        <View style={[styles.iconContainer, { backgroundColor: `${option.iconColor}15` }]}>
          <FontAwesome 
            name={option.icon} 
            size={20} 
            color={option.iconColor || theme.colors.textSecondary} 
          />
        </View>
        
        <View style={styles.optionText}>
          <Text style={[
            styles.optionTitle,
            option.id === 'logout' && styles.logoutTitle
          ]}>
            {option.title}
          </Text>
          {option.subtitle && (
            <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
          )}
        </View>
        
        {option.showChevron && (
          <FontAwesome 
            name="chevron-right" 
            size={14} 
            color={theme.colors.textSecondary} 
          />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mais Opções</Text>
        <Text style={styles.headerSubtitle}>
          Olá, {user?.name || 'Usuário'}
        </Text>
      </View>

      {/* Options List */}
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.optionsContainer}>
          {/* Profile Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conta</Text>
            {moreOptions.slice(0, 2).map(renderOption)}
          </View>

          {/* App Features Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recursos</Text>
            {moreOptions.slice(2, 5).map(renderOption)}
          </View>

          {/* Support Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Suporte</Text>
            {moreOptions.slice(5, 7).map(renderOption)}
          </View>

          {/* Logout Section */}
          <View style={styles.section}>
            {renderOption(moreOptions[7])}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  optionsContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  logoutTitle: {
    color: theme.colors.error,
  },
  optionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
});