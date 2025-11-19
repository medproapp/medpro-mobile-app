import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  FlatList,
  Image,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { api } from '@services/api';
import { PatientsStackParamList } from '@/types/navigation';
import { logger } from '@/utils/logger';

type DiagnosticsRouteProp = RouteProp<PatientsStackParamList, 'Diagnostics'>;

interface DiagnosticRecord {
  diagId: string;
  diagPatient: string;
  diagType: string;
  diagDate: string;
  diagStatus: string;
  Practitioner?: string;
  practName?: string;
  metadata?: any;
  Identifier?: string; // Encounter ID
}

const HEADER_TOP_PADDING = Platform.OS === 'android'
  ? (StatusBar.currentHeight || 44)
  : 52;

const RECORD_TYPES = [
  { key: 'all', label: 'Todos', icon: 'list' },
  { key: 'DiagnosticReport', label: 'Relatórios', icon: 'file-text-o' },
  { key: 'Observation', label: 'Observações', icon: 'stethoscope' },
];

export const DiagnosticsScreen: React.FC = () => {
  const route = useRoute<DiagnosticsRouteProp>();
  const navigation = useNavigation();
  const { patientCpf, patientName } = route.params;

  const [records, setRecords] = useState<DiagnosticRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedType, setSelectedType] = useState<string>('all');

  const loadDiagnosticRecords = async (pageNum: number = 1, append: boolean = false, type?: string) => {
    try {
      const ITEMS_PER_PAGE = 10;

      const options: any = {
        page: pageNum,
        limit: ITEMS_PER_PAGE,
      };

      // Add type filter if not "all"
      if (type && type !== 'all') {
        options.type = type;
      }

      const response = await api.getPatientDiagnosticRecords(patientCpf, options);

      if (!response?.data || !Array.isArray(response.data)) {
        setRecords(append ? records : []);
        setHasMore(false);
        setTotalRecords(0);
        return;
      }

      // Sort records by date (most recent first)
      const sortedRecords = [...response.data].sort((a, b) =>
        new Date(b.diagDate).getTime() - new Date(a.diagDate).getTime()
      );

      if (append) {
        setRecords(prev => [...prev, ...sortedRecords]);
      } else {
        setRecords(sortedRecords);
      }

      // Update total count and pagination state
      setTotalRecords(response.total || 0);
      setHasMore(response.data.length === ITEMS_PER_PAGE);
      setPage(pageNum);

    } catch (error) {
      logger.error('[Diagnostics] Error loading diagnostic records:', error);

      // Stop pagination on error to prevent infinite loops
      setHasMore(false);
      setLoadingMore(false);

      // Only show error on initial load, not on pagination
      if (!append) {
        Alert.alert('Erro', 'Não foi possível carregar os diagnósticos');
      }
    }
  };

  const loadData = async () => {
    setLoading(true);
    await loadDiagnosticRecords(1, false, selectedType);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadDiagnosticRecords(1, false, selectedType);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || loading) return;

    setLoadingMore(true);
    try {
      await loadDiagnosticRecords(page + 1, true, selectedType);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTypeFilter = async (type: string) => {
    setSelectedType(type);
    setPage(1);
    setLoading(true);
    await loadDiagnosticRecords(1, false, type);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [patientCpf]);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'signed':
      case 'active':
      case 'completed':
        return theme.colors.success;
      case 'draft':
      case 'pending':
        return theme.colors.warning;
      case 'cancelled':
      case 'expired':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'signed':
        return 'Assinado';
      case 'active':
        return 'Ativo';
      case 'completed':
        return 'Concluído';
      case 'draft':
        return 'Rascunho';
      case 'pending':
        return 'Pendente';
      case 'cancelled':
        return 'Cancelado';
      case 'expired':
        return 'Expirado';
      default:
        return status || 'Desconhecido';
    }
  };

  const getRecordTypeLabel = (type: string): string => {
    switch (type) {
      case 'DiagnosticReport':
        return 'Relatório Diagnóstico';
      case 'Observation':
        return 'Observação Clínica';
      default:
        return type || 'Diagnóstico';
    }
  };

  const renderDiagnosticCard = ({ item: record }: { item: DiagnosticRecord }) => {
    return (
      <View style={styles.recordCard}>
        {/* Record Header */}
        <View style={styles.recordHeader}>
          <View style={styles.recordHeaderLeft}>
            <View style={[styles.recordIconContainer, { backgroundColor: theme.colors.success }]}>
              <FontAwesome name="file-text" size={16} color={theme.colors.white} />
            </View>
            <View style={styles.recordMainInfo}>
              <Text style={styles.recordType}>{getRecordTypeLabel(record.diagType)}</Text>
              <Text style={styles.recordId}>#{record.diagId}</Text>
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(record.diagStatus) }]}>
            <Text style={styles.statusText}>{getStatusLabel(record.diagStatus)}</Text>
          </View>
        </View>

        {/* Record Details */}
        <View style={styles.recordDetails}>
          <View style={styles.recordDetailRow}>
            <FontAwesome name="calendar" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.recordDetailText}>{formatDateTime(record.diagDate)}</Text>
          </View>

          {record.Identifier && (
            <View style={styles.recordDetailRow}>
              <FontAwesome name="user-md" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.recordDetailText}>Encontro: {record.Identifier}</Text>
            </View>
          )}

          {record.practName && (
            <View style={styles.recordDetailRow}>
              <FontAwesome name="stethoscope" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.recordDetailText}>{record.practName}</Text>
            </View>
          )}
        </View>

        {/* Diagnostic Metadata */}
        {record.metadata && (
          <View style={styles.itemsContainer}>
            <Text style={styles.itemsTitle}>Informações adicionais:</Text>
            <Text style={styles.medicationItemText}>
              {JSON.stringify(record.metadata, null, 2)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => {
    let icon = 'folder-open';
    let iconColor = theme.colors.textSecondary;
    let title = 'Nenhum Diagnóstico Encontrado';
    let description = 'Não há diagnósticos disponíveis para este paciente.';

    switch (selectedType) {
      case 'DiagnosticReport':
        icon = 'file-text-o';
        iconColor = theme.colors.primary;
        title = 'Nenhum Relatório';
        description = 'Este paciente ainda não possui relatórios diagnósticos registrados.';
        break;
      case 'Observation':
        icon = 'stethoscope';
        iconColor = theme.colors.success;
        title = 'Nenhuma Observação';
        description = 'Não há observações clínicas registradas para este paciente.';
        break;
      case 'all':
      default:
        icon = 'stethoscope';
        iconColor = theme.colors.textSecondary;
        title = 'Nenhum Diagnóstico';
        description = 'Este paciente ainda não possui diagnósticos ou observações cadastrados.';
        break;
    }

    return (
      <View style={styles.emptyStateContainer}>
        <View style={[styles.emptyStateIconContainer, { backgroundColor: iconColor + '15' }]}>
          <FontAwesome name={icon} size={48} color={iconColor} />
        </View>
        <Text style={styles.emptyStateTitle}>{title}</Text>
        <Text style={styles.emptyStateText}>{description}</Text>
        {selectedType !== 'all' && (
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => handleTypeFilter('all')}
          >
            <FontAwesome name="list" size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.emptyStateButtonText}>Ver Todos os Diagnósticos</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={[styles.footerLoaderText, { marginLeft: 8 }]}>Carregando mais...</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando diagnósticos...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerBackground}>
          {/* Background Logo */}
          <Image
            source={require('../../assets/medpro-logo.png')}
            style={styles.backgroundLogo}
            resizeMode="contain"
          />
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Diagnósticos</Text>
              <Text style={styles.headerSubtitle}>{patientName}</Text>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{totalRecords}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Filter Chips */}
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            {RECORD_TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.filterChip,
                  selectedType === type.key && styles.filterChipActive,
                ]}
                onPress={() => handleTypeFilter(type.key)}
              >
                <FontAwesome
                  name={type.icon}
                  size={14}
                  color={selectedType === type.key ? theme.colors.white : theme.colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[
                  styles.filterChipText,
                  selectedType === type.key && styles.filterChipTextActive,
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Records List */}
        <FlatList
          data={records}
          renderItem={renderDiagnosticCard}
          keyExtractor={(item) => item.diagId}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyState}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerBackground: {
    backgroundColor: theme.colors.primary,
    paddingTop: HEADER_TOP_PADDING,
    paddingBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backgroundLogo: {
    position: 'absolute',
    top: 20,
    right: -50,
    width: 200,
    height: 200,
    opacity: 0.1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.white,
    opacity: 0.9,
  },
  headerRight: {
    marginLeft: 12,
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  filterContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundSecondary,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  listContainer: {
    padding: 16,
  },
  recordCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recordHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recordIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recordMainInfo: {
    flex: 1,
  },
  recordType: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  recordId: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    color: theme.colors.white,
    fontWeight: '600',
  },
  recordDetails: {
    marginTop: 4,
  },
  recordDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordDetailText: {
    fontSize: 13,
    color: theme.colors.text,
  },
  itemsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
  },
  itemsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  medicationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  medicationItemText: {
    fontSize: 12,
    color: theme.colors.text,
    lineHeight: 18,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyStateIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerLoaderText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
});
