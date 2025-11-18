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

type AttachmentsRouteProp = RouteProp<PatientsStackParamList, 'Attachments'>;

interface AttachmentRecord {
  identifier: string;
  patient: string;
  encounter?: string;
  type: string;
  date: string;
  blobname: string | null;
  filetype: string | null;
  context?: string;
  status: string;
  externallink?: string | null;
}

const HEADER_TOP_PADDING = Platform.OS === 'android'
  ? (StatusBar.currentHeight || 44)
  : 52;

const ATTACHMENT_TYPES = [
  { key: 'all', label: 'Todos', icon: 'list' },
  { key: 'REQUEST', label: 'Pedidos', icon: 'file-text-o' },
  { key: 'REFERRAL', label: 'Encaminhamentos', icon: 'share' },
  { key: 'ATESTADO', label: 'Atestados', icon: 'certificate' },
  { key: 'MEDREQUEST', label: 'Med. Request', icon: 'medkit' },
  { key: 'MANUAL', label: 'Manual', icon: 'hand-o-up' },
  { key: 'EVB-PDF', label: 'EVB PDF', icon: 'file-pdf-o' },
];

export const AttachmentsScreen: React.FC = () => {
  const route = useRoute<AttachmentsRouteProp>();
  const navigation = useNavigation();
  const { patientCpf, patientName } = route.params;

  const [records, setRecords] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedType, setSelectedType] = useState<string>('all');

  const loadAttachments = async (pageNum: number = 1, append: boolean = false, type?: string) => {
    try {
      const ITEMS_PER_PAGE = 10;

      const options: any = {
        page: pageNum,
        limit: ITEMS_PER_PAGE,
      };

      const response = await api.getPatientAttachments(patientCpf, options);

      if (!response?.data || !Array.isArray(response.data)) {
        setRecords(append ? records : []);
        setHasMore(false);
        setTotalRecords(0);
        return;
      }

      // Filter by type if specified
      let filteredRecords = response.data;
      if (type && type !== 'all') {
        filteredRecords = response.data.filter((record: AttachmentRecord) => record.type === type);
      }

      // Sort records by date (most recent first)
      const sortedRecords = [...filteredRecords].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
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
      console.error('[Attachments] Error loading attachments:', error);

      // Stop pagination on error to prevent infinite loops
      setHasMore(false);
      setLoadingMore(false);

      // Only show error on initial load, not on pagination
      if (!append) {
        Alert.alert('Erro', 'Não foi possível carregar os anexos');
      }
    }
  };

  const loadData = async () => {
    setLoading(true);
    await loadAttachments(1, false, selectedType);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadAttachments(1, false, selectedType);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || loading) return;

    setLoadingMore(true);
    try {
      await loadAttachments(page + 1, true, selectedType);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTypeFilter = async (type: string) => {
    setSelectedType(type);
    setPage(1);
    setLoading(true);
    await loadAttachments(1, false, type);
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

  const getFileIcon = (filetype: string): string => {
    if (!filetype) return 'file-o';
    if (filetype.includes('pdf')) return 'file-pdf-o';
    if (filetype.includes('image')) return 'file-image-o';
    if (filetype.includes('word') || filetype.includes('document')) return 'file-word-o';
    if (filetype.includes('excel') || filetype.includes('spreadsheet')) return 'file-excel-o';
    return 'file-o';
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'REQUEST': return theme.colors.primary;
      case 'REFERRAL': return theme.colors.info;
      case 'ATESTADO': return theme.colors.success;
      case 'MEDREQUEST': return theme.colors.warning;
      case 'MANUAL': return theme.colors.textSecondary;
      case 'EVB-PDF': return theme.colors.error;
      default: return theme.colors.textSecondary;
    }
  };

  const getTypeLabel = (type: string): string => {
    const typeObj = ATTACHMENT_TYPES.find(t => t.key === type);
    return typeObj?.label || type;
  };

  const renderAttachmentCard = ({ item: record }: { item: AttachmentRecord }) => {
    const fileIcon = getFileIcon(record.filetype);
    const typeColor = getTypeColor(record.type);

    return (
      <View style={styles.recordCard}>
        {/* Record Header */}
        <View style={styles.recordHeader}>
          <View style={styles.recordHeaderLeft}>
            <View style={[styles.recordIconContainer, { backgroundColor: typeColor }]}>
              <FontAwesome name={fileIcon} size={16} color={theme.colors.white} />
            </View>
            <View style={styles.recordMainInfo}>
              <Text style={styles.recordTitle}>Anexo #{record.identifier}</Text>
            </View>
          </View>

          <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
            <Text style={styles.typeBadgeText}>{getTypeLabel(record.type)}</Text>
          </View>
        </View>

        {/* Record Details */}
        <View style={styles.recordDetails}>
          <View style={styles.recordDetailRow}>
            <FontAwesome name="calendar" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.recordDetailText}>{formatDateTime(record.date)}</Text>
          </View>

          <View style={styles.recordDetailRow}>
            <FontAwesome name="file" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.recordDetailText}>{record.filetype || 'Tipo desconhecido'}</Text>
          </View>

          {record.encounter && (
            <View style={styles.recordDetailRow}>
              <FontAwesome name="user-md" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.recordDetailText}>Encontro: {record.encounter}</Text>
            </View>
          )}

          {record.context && (
            <View style={styles.recordDetailRow}>
              <FontAwesome name="info-circle" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.recordDetailText}>Contexto: {record.context}</Text>
            </View>
          )}

          {record.externallink && (
            <View style={styles.recordDetailRow}>
              <FontAwesome name="link" size={12} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.recordDetailText, { color: theme.colors.primary }]} numberOfLines={1}>
                {record.externallink}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    let icon = 'paperclip';
    let iconColor = theme.colors.textSecondary;
    let title = 'Nenhum Anexo Encontrado';
    let description = 'Não há anexos disponíveis para este paciente.';

    switch (selectedType) {
      case 'REQUEST':
        icon = 'file-text-o';
        iconColor = theme.colors.primary;
        title = 'Nenhum Pedido';
        description = 'Este paciente não possui pedidos anexados.';
        break;
      case 'REFERRAL':
        icon = 'share';
        iconColor = theme.colors.info;
        title = 'Nenhum Encaminhamento';
        description = 'Não há encaminhamentos registrados para este paciente.';
        break;
      case 'ATESTADO':
        icon = 'certificate';
        iconColor = theme.colors.success;
        title = 'Nenhum Atestado';
        description = 'Este paciente não possui atestados anexados.';
        break;
      case 'MEDREQUEST':
        icon = 'medkit';
        iconColor = theme.colors.warning;
        title = 'Nenhuma Med. Request';
        description = 'Não há solicitações médicas anexadas.';
        break;
      case 'MANUAL':
        icon = 'hand-o-up';
        iconColor = theme.colors.textSecondary;
        title = 'Nenhum Anexo Manual';
        description = 'Não há anexos manuais registrados.';
        break;
      case 'EVB-PDF':
        icon = 'file-pdf-o';
        iconColor = theme.colors.error;
        title = 'Nenhum EVB PDF';
        description = 'Não há arquivos EVB PDF anexados.';
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
            <Text style={styles.emptyStateButtonText}>Ver Todos os Anexos</Text>
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
        <Text style={styles.loadingText}>Carregando anexos...</Text>
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
              <Text style={styles.headerTitle}>Anexos</Text>
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
            {ATTACHMENT_TYPES.map((type) => (
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
          renderItem={renderAttachmentCard}
          keyExtractor={(item) => item.identifier}
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
    paddingBottom: 20,
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
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
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
    alignItems: 'flex-end',
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 40,
    alignItems: 'center',
  },
  countBadgeText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  filterContainer: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundSecondary,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
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
  recordCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recordHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
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
  recordTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  recordId: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  recordDetails: {
    marginTop: 8,
  },
  recordDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  recordDetailText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyStateIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  emptyStateButtonText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
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
