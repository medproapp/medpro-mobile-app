import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, StatusBar, TouchableOpacity, Image, Platform } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { PatientsStackParamList } from '@/types/navigation';
import { apiService, API_BASE_URL } from '@services/api';
import { logger } from '@/utils/logger';

import type { StackNavigationProp } from '@react-navigation/stack';

type LeadDetailsRouteProp = RouteProp<PatientsStackParamList, 'LeadDetails'>;
type LeadDetailsNavProp = StackNavigationProp<PatientsStackParamList, 'LeadDetails'>;

interface LeadDetails {
  id: number;
  patient_name: string;
  patient_cpf: string;
  patient_phone?: string;
  patient_email?: string;
  notes?: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
}

export const LeadDetailsScreen: React.FC = () => {
  const route = useRoute<LeadDetailsRouteProp>();
  const navigation = useNavigation<LeadDetailsNavProp>();
  const { leadId, name } = route.params;

  const [lead, setLead] = useState<LeadDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLead = async () => {
      try {
        const res = await apiService.getLeadDetails(leadId);
        const data = res?.lead || res;
        setLead({
          id: data?.id ?? leadId,
          patient_name: data?.patient_name || name,
          patient_cpf: data?.patient_cpf || '',
          patient_phone: data?.patient_phone,
          patient_email: data?.patient_email,
          notes: data?.notes,
          status: data?.status,
          metadata: data?.metadata ?? null,
          created_at: data?.created_at,
        });
      } catch (err) {
        logger.error('[LeadDetails] Failed to load lead', err);
        setError('Não foi possível carregar o lead');
      } finally {
        setLoading(false);
      }
    };

    loadLead();
  }, [leadId, name]);

  const formatDate = (value?: string) => {
    if (!value) return '-';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('pt-BR');
  };

  const detailRows = [
    { label: 'Status', value: lead?.status || 'novo', icon: 'bookmark' },
    { label: 'Criado em', value: formatDate(lead?.created_at), icon: 'calendar-o' },
    { label: 'CPF / ID', value: lead?.patient_cpf || '-', icon: 'id-card-o' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

      {/* Header with logo and back button */}
      <View style={styles.headerBackground}>
        <Image
          source={require('../../assets/medpro-logo.png')}
          style={styles.backgroundLogo}
          resizeMode="contain"
        />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={18} color={theme.colors.white} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Lead</Text>
              <View style={styles.leadPill}>
                <Text style={styles.leadPillText}>{lead?.status || 'novo'}</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{lead?.patient_name || name}</Text>
            <Text style={styles.headerMeta} numberOfLines={1}>
              {lead?.patient_cpf || 'ID não informado'}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Carregando lead...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <FontAwesome name="exclamation-triangle" size={32} color={theme.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Informações</Text>
            <View style={styles.row}>
              <FontAwesome name="user" size={14} color={theme.colors.textSecondary} />
              <Text style={styles.rowLabel}>Nome</Text>
              <Text style={styles.rowValue}>{lead?.patient_name || '-'}</Text>
            </View>
            {detailRows.map(row => (
              <View style={styles.row} key={row.label}>
                <FontAwesome name={row.icon as any} size={14} color={theme.colors.textSecondary} />
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contato</Text>
            <View style={styles.row}>
              <FontAwesome name="phone" size={14} color={theme.colors.textSecondary} />
              <Text style={styles.rowLabel}>Telefone</Text>
              <Text style={styles.rowValue}>{lead?.patient_phone || '-'}</Text>
            </View>
            <View style={styles.row}>
              <FontAwesome name="envelope" size={14} color={theme.colors.textSecondary} />
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{lead?.patient_email || '-'}</Text>
            </View>
          </View>

          {lead?.notes ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Notas</Text>
              <Text style={styles.value}>{lead.notes}</Text>
            </View>
          ) : null}

          {lead?.metadata ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Metadados</Text>
              <View style={styles.metaBox}>
                <Text style={styles.metaText}>{JSON.stringify(lead.metadata, null, 2)}</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
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
    top: '45%',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white + '20',
    marginRight: theme.spacing.md,
  },
  headerTextContainer: { flex: 1 },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerTitle: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  leadPill: {
    backgroundColor: theme.colors.white + '20',
    borderRadius: 10,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.white + '30',
  },
  leadPillText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 6,
  },
  headerMeta: {
    color: theme.colors.white + 'CC',
    fontSize: 13,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  errorText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.error,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 6,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  rowValue: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
    textAlign: 'right',
  },
  label: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  value: {
    fontSize: 14,
    color: theme.colors.text,
    marginTop: 4,
  },
  metaBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginTop: theme.spacing.sm,
  },
  metaText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});

export default LeadDetailsScreen;
