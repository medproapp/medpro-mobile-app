import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { DashboardStackParamList } from '@/types/navigation';
import { theme } from '@theme/index';
import { api } from '@services/api';
import { useAuthStore } from '@store/authStore';
import { useAppointmentStore } from '@store/appointmentStore';
import { logger } from '@/utils/logger';

interface ListItem {
  type: 'patient' | 'lead';
  id: string;
  name: string;
  cpf?: string;
  phone?: string;
  email?: string;
}

type NavProp = StackNavigationProp<DashboardStackParamList, 'AppointmentBrowse'>;

export const AppointmentBrowseScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuthStore();
  const { setPatient, setPractitioner, canProceedFromStep } = useAppointmentStore();

  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      setPractitioner(user.email);
    }
  }, [user?.email, setPractitioner]);

  const normalizePatient = useCallback((p: any): ListItem => {
    return {
      type: 'patient',
      id: p.patientCpf || p.cpf || p.id || p.identifier || '',
      name: p.patientName || p.name || 'Paciente',
      cpf: p.patientCpf || p.cpf,
      phone: p.patientPhone || p.phone,
      email: p.patientEmail || p.email,
    };
  }, []);

  const normalizeLead = useCallback((lead: any): ListItem | null => {
    const id = lead.id ?? lead.lead_id;
    if (id === undefined || id === null) {
      return null; // skip leads without backend id
    }
    return {
      type: 'lead',
      id: String(id),
      name: lead.patient_name || lead.name || 'Lead',
      cpf: lead.patient_cpf || lead.cpf,
      phone: lead.patient_phone || lead.metadata?.phone,
      email: lead.patient_email || lead.metadata?.email,
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!user?.email) {
      return;
    }
    setLoading(true);
    try {
      const [patientsRes, leadsRes] = await Promise.all([
        api.getPatients(user.email, 1, 100, ''),
        api.getLeads(1, 100, ''),
      ]);

      const patients = Array.isArray(patientsRes?.data?.data)
        ? patientsRes.data.data.map((p: any) => normalizePatient(p))
        : [];

      const leadsPayload = leadsRes?.leads || leadsRes?.data?.leads || leadsRes?.data?.data || [];
      const leads = Array.isArray(leadsPayload)
        ? leadsPayload
            .map((l: any) => normalizeLead(l))
            .filter((l: ListItem | null): l is ListItem => l !== null)
        : [];

      setItems([...patients, ...leads]);
    } catch (error) {
      logger.error('[AppointmentBrowse] Failed to load lists', error);
      Alert.alert('Erro', 'Não foi possível carregar pacientes e leads');
    } finally {
      setLoading(false);
    }
  }, [normalizeLead, normalizePatient, user?.email]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelect = (item: ListItem) => {
    const identifier = item.cpf || item.id;
    if (item.type === 'lead') {
      setPatient(identifier, item.name, item.phone ?? '', 'lead', item.id ? String(item.id) : null);
    } else {
      setPatient(identifier, item.name, item.phone ?? '', 'patient', null);
    }
    navigation.navigate('AppointmentStep2');
  };

  const renderItem = ({ item }: { item: ListItem }) => (
    <TouchableOpacity style={styles.itemCard} onPress={() => handleSelect(item)} activeOpacity={0.8}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        {item.type === 'lead' ? (
          <View style={styles.leadBadge}><Text style={styles.leadBadgeText}>LEAD</Text></View>
        ) : null}
      </View>
      {item.cpf ? <Text style={styles.itemDetail}>CPF: {item.cpf}</Text> : null}
      {item.phone ? <Text style={styles.itemDetail}>Telefone: {item.phone}</Text> : null}
      {item.email ? <Text style={styles.itemDetail}>Email: {item.email}</Text> : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.headerBackground}>
        <Image source={require('../../assets/medpro-logo.png')} style={styles.backgroundLogo} resizeMode="contain" />
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.greeting}>Novo Agendamento</Text>
            <Text style={styles.userName}>Passo 2 de 7</Text>
            <Text style={styles.dateText}>Escolha o paciente ou lead</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, index) => `${item.type}-${item.id || index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
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
    top: '50%',
    width: 120,
    height: 120,
    opacity: 0.08,
    transform: [{ translateY: -60 }],
    tintColor: theme.colors.white,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerContent: { flex: 1 },
  greeting: { ...theme.typography.body, color: theme.colors.white + 'CC', fontSize: 16 },
  userName: { ...theme.typography.h1, color: theme.colors.white, fontSize: 24, fontWeight: '700', marginTop: theme.spacing.xs },
  dateText: { ...theme.typography.caption, color: theme.colors.white + 'AA', fontSize: 14, marginTop: theme.spacing.xs },
  backButton: { padding: theme.spacing.sm, backgroundColor: theme.colors.white + '20', borderRadius: 8, marginTop: theme.spacing.xs },
  listContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  itemCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemName: { fontSize: 16, fontWeight: '700', color: theme.colors.text, flex: 1, marginRight: theme.spacing.sm },
  leadBadge: {
    backgroundColor: theme.colors.warning + '20',
    borderColor: theme.colors.warning + '60',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  leadBadgeText: { color: theme.colors.warning, fontWeight: '700', fontSize: 11 },
  itemDetail: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },
  separator: { height: theme.spacing.md },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: theme.spacing.sm, color: theme.colors.textSecondary },
});

export default AppointmentBrowseScreen;
