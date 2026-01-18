import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Card, Loading, CachedImage } from '@components/common';
import { useDeviceType } from '@/hooks/useDeviceType';
import { theme } from '@theme/index';
import { useAuthStore } from '@store/authStore';
import { apiService } from '@services/api';
import { API_BASE_URL } from '@services/api';
import { PatientsStackParamList } from '@/types/navigation';
import { logger } from '@/utils/logger';

type PatientsNavigationProp = StackNavigationProp<PatientsStackParamList, 'PatientsList'>;

type Gender = 'male' | 'female' | 'unknown';

type PatientListItem =
  | {
      type: 'patient';
      cpf: string;
      name: string;
      email: string;
      phone: string;
      gender: Gender;
    }
  | {
      type: 'lead';
      id: number;
      name: string;
      email: string;
      phone: string;
      cpf: string;
      status: string;
    };

interface PatientsData {
  patients: PatientListItem[];
  totalPatients: number;
  totalLeads: number;
  page: number;
  pages: number;
}

export const PatientsScreen: React.FC = () => {
  const { user, token } = useAuthStore();
  const navigation = useNavigation<PatientsNavigationProp>();
  const { isTablet } = useDeviceType();
  const [data, setData] = useState<PatientsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [searchLoading, setSearchLoading] = useState(false);
  const [photoCacheKey, setPhotoCacheKey] = useState<number>(Date.now());
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fetchLeadsSafe = async (pageNum: number, limit: number, search: string) => {
    if (typeof (apiService as any).getLeads === 'function') {
      return (apiService as any).getLeads(pageNum, limit, search);
    }

    // Fallback for environments that still have cached bundles without getLeads
    const params = new URLSearchParams({
      page: pageNum.toString(),
      limit: limit.toString(),
      filter: search,
    });

    // Reach into request/getOrgHeaders even though they are private in TS
    const request = (apiService as any).request?.bind(apiService);
    const getOrgHeaders = (apiService as any).getOrgHeaders?.bind(apiService);
    if (!request) {
      throw new Error('Lead fetcher unavailable');
    }

    return request(`/patient/leads?${params.toString()}`, {
      headers: getOrgHeaders ? getOrgHeaders() : undefined,
    });
  };

  const parseLeadsResponse = (res: any) => {
    const payload =
      res?.leads ||
      res?.data?.leads ||
      res?.data?.data ||
      res?.data ||
      [];

    // Filter out leads that have been converted to patients (status = 'converted')
    const items = Array.isArray(payload)
      ? payload
          .filter((lead: any) => lead?.status !== 'converted')
          .map((lead: any) => ({
            type: 'lead' as const,
            id: lead.id ?? lead.lead_id ?? 0,
            name: lead.patient_name || lead.name || 'Lead',
            email: lead.patient_email || lead.email || '',
            phone: lead.patient_phone || lead.phone || '',
            cpf: lead.patient_cpf || lead.cpf || '',
            status: lead.status || 'new',
          }))
      : [];

    const reportedTotal = res?.total ?? res?.data?.total;
    const inferredTotal = Array.isArray(payload) ? payload.length : items.length;
    const total = typeof reportedTotal === 'number' && reportedTotal > 0 ? reportedTotal : inferredTotal;

    logger.debug('[PatientsScreen] Leads parsed', {
      total,
      items: items.length,
      hasLeadsField: !!res?.leads,
      hasDataLeads: !!res?.data?.leads,
      hasDataData: !!res?.data?.data,
      rawKeys: res ? Object.keys(res) : [],
    });

    return { items, total };
  };

  const fetchPatients = async (pageNum: number = 1, search: string = '') => {
    try {
      if (!user?.email) {
        throw new Error('User email not available');
      }

      logger.debug('[PatientsScreen] Fetching patients for page:', pageNum, 'search:', search);
      const [patientsResponse, leadsResponse] = await Promise.all([
        apiService.getPatients(user.email, pageNum, 20, search),
        fetchLeadsSafe(pageNum, 20, search),
      ]);

      const patients = patientsResponse.data.data.map((patient: any) => ({
        type: 'patient' as const,
        cpf: patient.patientCpf,
        name: patient.patientName,
        email: patient.patientEmail,
        phone: patient.patientPhone,
        gender: patient.patientGender ?? 'unknown',
      }));

      const { items: leads, total: leadsTotal } = parseLeadsResponse(leadsResponse);

      const combined: PatientListItem[] = [...patients, ...leads];

      const totalPatients = patientsResponse?.data?.total ?? patients.length;
      const totalLeads = leadsTotal;

      if (!mountedRef.current) return;

      setData({
        patients: combined,
        totalPatients,
        totalLeads,
        page: pageNum,
        pages: Math.ceil((totalPatients || patients.length) / 20),
      });
    } catch (error) {
      logger.error('Error fetching patients:', error);

      if (!mountedRef.current) return;

      setData({
        patients: [],
        totalPatients: 0,
        totalLeads: 0,
        page: 1,
        pages: 1,
      });
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
        setSearchLoading(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchPatients();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPatients(page, searchText);
    }, [page, searchText])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    // Update cache key to force photo refresh
    setPhotoCacheKey(Date.now());
    fetchPatients(1, searchText);
  };

  const handleSearch = (text: string) => {
    setSearchText(text);
    setPage(1);
    setSearchLoading(true);

    // Clear previous timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    // Debounce API call - wait 500ms after user stops typing
    searchTimeout.current = setTimeout(() => {
      fetchPatients(1, text);
    }, 500);
  };

  const formatCPF = (cpf: string) => {
    if (/^\d{11}$/.test(cpf)) {
      return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cpf;
  };

  const handlePatientPress = (item: PatientListItem) => {
    if (item.type === 'lead') {
      navigation.navigate('LeadDetails', {
        leadId: item.id,
        name: item.name,
      });
      return;
    }

    navigation.navigate('PatientDashboard', {
      patientCpf: item.cpf,
      patientName: item.name,
    });
  };

  const renderPatientItem = ({ item }: { item: PatientListItem }) => (
    <TouchableOpacity 
      onPress={() => handlePatientPress(item)}
      activeOpacity={0.8}
      style={styles.patientCardContainer}
    >
      <Card style={styles.patientCard}>
        <View style={styles.patientRow}>
          {/* Enhanced Avatar Section */}
          <View style={styles.avatarSection}>
            {item.type === 'patient' ? (
              <CachedImage
                uri={`${API_BASE_URL}/patient/getpatientphoto?patientCpf=${item.cpf}`}
                headers={token ? { Authorization: `Bearer ${token}` } : undefined}
                style={[styles.patientAvatar, styles.patientPhotoImage]}
                fallbackIcon={item.gender === 'female' ? 'female' : 'male'}
                fallbackIconSize={26}
                fallbackIconColor={theme.colors.white}
                cacheKey={photoCacheKey}
              />
            ) : (
              <View style={[styles.patientAvatar, styles.leadAvatar]}>
                <FontAwesome name="user-plus" size={20} color={theme.colors.primary} />
              </View>
            )}
            {/* Online status indicator (could be dynamic in the future) */}
            <View style={styles.statusIndicator} />
          </View>
          
          {/* Enhanced Patient Info */}
          <View style={styles.patientInfo}>
            <View style={styles.patientHeader}>
              <Text style={styles.patientName} numberOfLines={1}>{item.name}</Text>
              {item.type === 'lead' ? (
                <View style={styles.leadBadge}>
                  <Text style={styles.leadBadgeText}>POTENCIAL</Text>
                </View>
              ) : (
                <View style={[styles.genderBadge, { 
                  backgroundColor: item.gender === 'female' ? theme.colors.success + '15' : theme.colors.info + '15' 
                }]}>
                  <FontAwesome 
                    name={item.gender === 'female' ? 'venus' : 'mars'} 
                    size={10} 
                    color={item.gender === 'female' ? theme.colors.success : theme.colors.info} 
                  />
                  <Text style={[styles.genderBadgeText, { 
                    color: item.gender === 'female' ? theme.colors.success : theme.colors.info 
                  }]}>
                    {item.gender === 'female' ? 'F' : 'M'}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.patientDetailsContainer}>
              <View style={styles.detailRow}>
                <FontAwesome name="id-card-o" size={11} color={theme.colors.textSecondary} />
                <Text style={styles.patientDetails}>{formatCPF(item.cpf)}</Text>
              </View>
              <View style={styles.detailRow}>
                <FontAwesome name="phone" size={11} color={theme.colors.textSecondary} />
                <Text style={styles.patientDetails}>{item.phone}</Text>
              </View>
              {item.type === 'lead' && !!item.status && (
                <View style={styles.detailRow}>
                  <FontAwesome name="bookmark" size={11} color={theme.colors.textSecondary} />
                  <Text style={styles.patientDetails}>Status: {item.status}</Text>
                </View>
              )}
            </View>
          </View>
          
          {/* Enhanced Actions Section */}
          <View style={styles.patientActions}>
            <FontAwesome name="chevron-right" size={16} color={theme.colors.primary} />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return <Loading text="Carregando pacientes..." />;
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.container}>
        {/* Header with gradient background */}
        <View style={styles.headerBackground}>
          {/* Background Logo */}
          <Image
            source={require('../../assets/medpro-logo.png')}
            style={styles.backgroundLogo}
            resizeMode="contain"
          />
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.greeting}>Pacientes</Text>
              <Text style={styles.userName}>Gerenciar Pacientes</Text>
              <Text style={styles.dateText}>
                {(data?.totalPatients ?? 0) + (data?.totalLeads ?? 0)} registros • {data?.totalPatients ?? 0} pacientes • {data?.totalLeads ?? 0} leads
              </Text>
            </View>
          </View>
        </View>

        {/* Patients List */}
        <View style={{ flex: 1 }}>
          <FlatList
            data={data?.patients || []}
            renderItem={renderPatientItem}
            keyExtractor={(item, index) => item.type === 'patient' ? item.cpf : `lead-${item.id || index}`}
            contentContainerStyle={[styles.listContent, isTablet && { maxWidth: 700, alignSelf: 'center', width: '100%' }]}
            ListHeaderComponent={
              <>
                {/* Quick Stats */}
                <View style={styles.statsContainer}>
                  <View style={styles.statCard}>
                    <FontAwesome name="users" size={24} color={theme.colors.primary} />
                    <Text style={styles.statNumber}>
                      {(data?.totalPatients ?? 0) + (data?.totalLeads ?? 0)}
                    </Text>
                    <Text style={styles.statLabel}>Total</Text>
                  </View>
                  <View style={styles.statCard}>
                    <FontAwesome name="user-md" size={24} color={theme.colors.success} />
                    <Text style={styles.statNumber}>
                      {data?.totalPatients ?? 0}
                    </Text>
                    <Text style={styles.statLabel}>Pacientes</Text>
                  </View>
                  <View style={styles.statCard}>
                    <FontAwesome name="user-plus" size={24} color={theme.colors.info} />
                    <Text style={styles.statNumber}>
                      {data?.totalLeads ?? 0}
                    </Text>
                    <Text style={styles.statLabel}>Leads</Text>
                  </View>
                </View>

                {/* Search */}
                <View style={styles.searchContainer}>
                  <FontAwesome name="search" size={16} color={theme.colors.textSecondary} style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar por nome, CPF ou telefone..."
                    value={searchText}
                    onChangeText={handleSearch}
                    autoCapitalize="none"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                  {searchLoading && (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.primary}
                      style={styles.searchSpinner}
                    />
                  )}
                  {!searchLoading && searchText.length > 0 && (
                    <TouchableOpacity
                      onPress={() => handleSearch('')}
                      style={styles.clearButton}
                    >
                      <FontAwesome name="times-circle" size={16} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              </>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[theme.colors.primary]}
                tintColor={theme.colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FontAwesome name="user-plus" size={48} color={theme.colors.textSecondary} style={styles.emptyIcon} />
                <Text style={styles.emptyText}>Nenhum paciente encontrado</Text>
                <Text style={styles.emptySubtext}>
                  {searchText ? 'Tente ajustar sua busca' : 'Adicione o primeiro paciente'}
                </Text>
                <TouchableOpacity style={styles.emptyAction} activeOpacity={0.7}>
                  <FontAwesome name="plus" size={16} color={theme.colors.primary} />
                  <Text style={styles.emptyActionText}>Adicionar novo paciente</Text>
                </TouchableOpacity>
              </View>
            }
          />

          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('LeadCreate')}
          >
            <MaterialIcons name="add" size={24} color={theme.colors.white} />
            <Text style={styles.fabLabel}>Paciente</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    textTransform: 'capitalize',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.md,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: theme.spacing.xs,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    ...theme.typography.h1,
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: theme.spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.text,
    paddingVertical: theme.spacing.md,
  },
  searchSpinner: {
    marginLeft: theme.spacing.xs,
  },
  clearButton: {
    marginLeft: theme.spacing.xs,
    padding: theme.spacing.xs,
  },
  listContent: {
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl + 80,
  },
  patientCardContainer: {
    marginBottom: theme.spacing.md,
  },
  patientCard: {
    borderRadius: 20,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight + '50',
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  avatarSection: {
    position: 'relative',
    marginRight: theme.spacing.md,
  },
  patientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  patientPhotoImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  patientInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs - 2,
  },
  patientName: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
    marginRight: theme.spacing.xs,
  },
  patientDetailsContainer: {
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  patientDetails: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  patientActions: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.success + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.success + '30',
  },
  chevronContainer: {
    padding: theme.spacing.xs,
  },
  genderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs - 2,
    borderRadius: 10,
    gap: theme.spacing.xs - 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  genderBadgeText: {
    ...theme.typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },
  leadBadge: {
    backgroundColor: theme.colors.warning + '20',
    borderWidth: 1,
    borderColor: theme.colors.warning + '50',
    borderRadius: 10,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs - 2,
  },
  leadBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.warning,
    fontWeight: '700',
    fontSize: 11,
  },
  leadAvatar: {
    backgroundColor: theme.colors.warning + '20',
    borderColor: theme.colors.warning + '60',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xl,
  },
  emptyIcon: {
    opacity: 0.5,
    marginBottom: theme.spacing.lg,
  },
  emptyText: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.xl,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
  },
  emptyActionText: {
    ...theme.typography.button,
    color: theme.colors.primary,
    fontWeight: '600',
    marginLeft: theme.spacing.sm,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 10,
  },
  fabLabel: {
    color: theme.colors.white,
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 14,
  },
});
