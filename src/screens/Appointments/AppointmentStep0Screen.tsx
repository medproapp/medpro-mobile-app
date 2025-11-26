import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { DashboardStackParamList } from '@/types/navigation';
import { theme } from '@theme/index';

const cards = [
  {
    title: 'Buscar paciente',
    subtitle: 'Digite nome, CPF ou telefone para encontrar o paciente ou lead',
    icon: <FontAwesome name="search" size={20} color={theme.colors.primary} />,
    target: 'AppointmentStep1' as const,
  },
  {
    title: 'Navegar lista',
    subtitle: 'Veja todos os pacientes e leads do profissional',
    icon: <MaterialIcons name="list-alt" size={22} color={theme.colors.primary} />,
    target: 'AppointmentBrowse' as const,
  },
];

export const AppointmentStep0Screen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<DashboardStackParamList, 'AppointmentStep0'>>();

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
          <View style={styles.headerContent}>
            <Text style={styles.greeting}>Novo Agendamento</Text>
            <Text style={styles.userName}>Passo 1 de 7</Text>
            <Text style={styles.dateText}>Como deseja selecionar o paciente?</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {cards.map(card => (
          <TouchableOpacity
            key={card.title}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => navigation.navigate(card.target)}
          >
            <View style={styles.iconContainer}>{card.icon}</View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerBackground: {
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: StatusBar.currentHeight || 48,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerContent: { flex: 1 },
  greeting: { ...theme.typography.body, color: theme.colors.white + 'CC', fontSize: 16 },
  userName: { ...theme.typography.h1, color: theme.colors.white, fontSize: 24, fontWeight: '700', marginTop: theme.spacing.xs },
  dateText: { ...theme.typography.caption, color: theme.colors.white + 'AA', fontSize: 14, marginTop: theme.spacing.xs },
  backButton: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.white + '20',
    borderRadius: 8,
    marginTop: theme.spacing.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  cardTextContainer: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  cardSubtitle: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
});

export default AppointmentStep0Screen;
