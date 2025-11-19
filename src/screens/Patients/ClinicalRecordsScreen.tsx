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
  Linking,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { api } from '@services/api';
import { PatientsStackParamList } from '@/types/navigation';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { logger } from '@/utils/logger';

type ClinicalRecordsRouteProp = RouteProp<PatientsStackParamList, 'ClinicalRecords'>;

interface ClinicalRecord {
  clinicalId: string;
  clinicalType: 'REQUEST' | 'REFERRAL' | 'ATESTADO' | string;
  clinicalPatient: string;
  clinicalStatus: string;
  clinicalDate: string;
  clinicalMetadata?: any;
  Identifier?: string; // Encounter ID
  Status?: string;
  Practitioner?: string;
  practName?: string;
}

const HEADER_TOP_PADDING = Platform.OS === 'android'
  ? (StatusBar.currentHeight || 44)
  : 52;

const ANDROID_READ_PERMISSION_FLAG = 0x00000001; // FLAG_GRANT_READ_URI_PERMISSION

const RECORD_TYPES = [
  { key: 'all', label: 'Todos', icon: 'list' },
  { key: 'REQUEST', label: 'Pedidos', icon: 'file-text-o' },
  { key: 'ATESTADO', label: 'Atestados', icon: 'certificate' },
  { key: 'REFERRAL', label: 'Encaminhamentos', icon: 'share' },
];

export const ClinicalRecordsScreen: React.FC = () => {
  const route = useRoute<ClinicalRecordsRouteProp>();
  const navigation = useNavigation();
  const { patientCpf, patientName } = route.params;

  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, any[]>>({});
  const [loadingAttachments, setLoadingAttachments] = useState<Record<string, boolean>>({});

  const loadClinicalRecords = async (pageNum: number = 1, append: boolean = false, type?: string) => {
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

      const response = await api.getPatientClinicalRecords(patientCpf, options);

      if (!response?.data || !Array.isArray(response.data)) {
        setRecords(append ? records : []);
        setHasMore(false);
        setTotalRecords(0);
        return;
      }

      // Sort records by date (most recent first)
      const sortedRecords = [...response.data].sort((a, b) =>
        new Date(b.clinicalDate).getTime() - new Date(a.clinicalDate).getTime()
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
      logger.error('[ClinicalRecords] Error loading clinical records:', error);

      // Stop pagination on error to prevent infinite loops
      setHasMore(false);
      setLoadingMore(false);

      // Only show error on initial load, not on pagination
      if (!append) {
        Alert.alert('Erro', 'Não foi possível carregar os registros clínicos');
      }
    }
  };

  const loadData = async () => {
    setLoading(true);
    await loadClinicalRecords(1, false, selectedType);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadClinicalRecords(1, false, selectedType);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || loading) return;

    setLoadingMore(true);
    try {
      await loadClinicalRecords(page + 1, true, selectedType);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTypeFilter = async (type: string) => {
    setSelectedType(type);
    setPage(1);
    setLoading(true);
    await loadClinicalRecords(1, false, type);
    setLoading(false);
  };

  const loadAttachments = async (clinicalId: string) => {
    if (loadingAttachments[clinicalId] || attachmentsMap[clinicalId]) {
      return; // Already loading or loaded
    }

    setLoadingAttachments(prev => ({ ...prev, [clinicalId]: true }));
    try {
      const response = await api.getClinicalRecordAttachments(clinicalId);
      const payload = response?.attachments ?? response?.data?.attachments ?? [];
      const normalized = Array.isArray(payload) ? payload : [];

      logger.debug('[ClinicalRecords] Normalized attachments count:', normalized.length);
      normalized.forEach((att, idx) => {
        logger.debug(`[ClinicalRecords] Attachment ${idx} fields:`, Object.keys(att));
      });

      setAttachmentsMap(prev => ({ ...prev, [clinicalId]: normalized }));
    } catch (error) {
      logger.error('[ClinicalRecords] Error loading attachments:', error);
      setAttachmentsMap(prev => ({ ...prev, [clinicalId]: [] }));
    } finally {
      setLoadingAttachments(prev => ({ ...prev, [clinicalId]: false }));
    }
  };

  const handleAttachmentPress = async (attachment: any) => {
    logger.debug('[ClinicalRecords] Attachment pressed:', {
      identifier: attachment?.identifier,
      hasExternalLink: !!attachment?.externallink,
      externalLink: attachment?.externallink,
      hasBlob: !!attachment?.blob,
      contentType: attachment?.contentType,
    });

    try {
      // Handle external links
      if (attachment?.externallink) {
        logger.debug('[ClinicalRecords] Opening external link:', attachment.externallink);
        await Linking.openURL(attachment.externallink);
        return;
      }

      // Handle blob attachments
      if (attachment?.blob && attachment?.contentType) {
        logger.debug('[ClinicalRecords] Processing blob attachment');

        const base64Data = attachment.blob;
        const filename = attachment.suggestedFilename || attachment.blobname || attachment.identifier || 'attachment';
        const fileUri = `${FileSystem.documentDirectory}${filename}`;

        logger.debug('[ClinicalRecords] Writing file to:', fileUri);
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        logger.debug('[ClinicalRecords] File written successfully');

        if (Platform.OS === 'android') {
          logger.debug('[ClinicalRecords] Opening file on Android');
          const contentUri = await FileSystem.getContentUriAsync(fileUri);
          logger.debug('[ClinicalRecords] Content URI:', contentUri);

          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: ANDROID_READ_PERMISSION_FLAG,
            type: attachment.contentType,
          });
          logger.debug('[ClinicalRecords] File opened successfully on Android');
        } else {
          logger.debug('[ClinicalRecords] Opening file on iOS');
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(fileUri, {
              mimeType: attachment.contentType,
              dialogTitle: filename,
            });
            logger.debug('[ClinicalRecords] File shared successfully on iOS');
          } else {
            Alert.alert('Erro', 'Compartilhamento não disponível neste dispositivo');
          }
        }
      } else {
        Alert.alert('Erro', 'Anexo não disponível ou inválido');
      }
    } catch (error) {
      logger.error('[ClinicalRecords] Error opening attachment:', error);
      Alert.alert('Erro', 'Não foi possível abrir o anexo');
    }
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
      case 'completed':
      case 'active':
        return theme.colors.success;
      case 'draft':
      case 'pending':
        return theme.colors.warning;
      case 'cancelled':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'Concluído';
      case 'active':
        return 'Ativo';
      case 'draft':
        return 'Rascunho';
      case 'pending':
        return 'Pendente';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status || 'Desconhecido';
    }
  };

  const getRecordTypeLabel = (type: string): string => {
    switch (type) {
      case 'REQUEST':
        return 'Pedido Médico';
      case 'ATESTADO':
        return 'Atestado';
      case 'REFERRAL':
        return 'Encaminhamento';
      default:
        return type;
    }
  };

  const getRecordTypeIcon = (type: string): string => {
    switch (type) {
      case 'REQUEST':
        return 'file-text-o';
      case 'ATESTADO':
        return 'certificate';
      case 'REFERRAL':
        return 'share';
      default:
        return 'file';
    }
  };

  const getRecordTypeColor = (type: string): string => {
    switch (type) {
      case 'REQUEST':
        return theme.colors.primary;
      case 'ATESTADO':
        return theme.colors.success;
      case 'REFERRAL':
        return theme.colors.info;
      default:
        return theme.colors.textSecondary;
    }
  };

  const renderClinicalRecordCard = ({ item: record }: { item: ClinicalRecord }) => {
    return (
      <View style={styles.recordCard}>
        {/* Record Header */}
        <View style={styles.recordHeader}>
          <View style={styles.recordHeaderLeft}>
            <View style={[styles.recordIconContainer, { backgroundColor: getRecordTypeColor(record.clinicalType) }]}>
              <FontAwesome name={getRecordTypeIcon(record.clinicalType)} size={16} color={theme.colors.white} />
            </View>
            <View style={styles.recordMainInfo}>
              <Text style={styles.recordType}>{getRecordTypeLabel(record.clinicalType)}</Text>
              <Text style={styles.recordId}>#{record.clinicalId}</Text>
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(record.clinicalStatus) }]}>
            <Text style={styles.statusText}>{getStatusLabel(record.clinicalStatus)}</Text>
          </View>
        </View>

        {/* Record Details */}
        <View style={styles.recordDetails}>
          <View style={styles.recordDetailRow}>
            <FontAwesome name="calendar" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.recordDetailText}>{formatDateTime(record.clinicalDate)}</Text>
          </View>

          {record.clinicalMetadata?.servicerequestCategory && (
            <View style={styles.recordDetailRow}>
              <FontAwesome name="tag" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.recordDetailText}>{record.clinicalMetadata.servicerequestCategory}</Text>
            </View>
          )}

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

        {/* Items Preview - for REQUEST type showing what was requested */}
        {record.clinicalType === 'REQUEST' && record.clinicalMetadata?.items && (
          <View style={styles.metadataContainer}>
            <Text style={styles.metadataTitle}>Itens solicitados:</Text>
            {Array.isArray(record.clinicalMetadata.items) ? (
              record.clinicalMetadata.items.map((item: string, index: number) => (
                <Text key={index} style={styles.metadataText}>• {item}</Text>
              ))
            ) : (
              <Text style={styles.metadataText}>{record.clinicalMetadata.items}</Text>
            )}
          </View>
        )}

        {/* Referral Info - for REFERRAL type */}
        {record.clinicalType === 'REFERRAL' && record.clinicalMetadata?.referralCustomText && (
          <View style={styles.metadataContainer}>
            <Text style={styles.metadataText} numberOfLines={3}>
              {record.clinicalMetadata.referralCustomText}
            </Text>
          </View>
        )}

        {/* Attachments Section */}
        <View style={styles.attachmentsSection}>
          {!attachmentsMap[record.clinicalId] && !loadingAttachments[record.clinicalId] ? (
            <TouchableOpacity
              style={styles.loadAttachmentsButton}
              onPress={() => loadAttachments(record.clinicalId)}
            >
              <FontAwesome name="paperclip" size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.loadAttachmentsText}>Ver Anexos</Text>
            </TouchableOpacity>
          ) : loadingAttachments[record.clinicalId] ? (
            <View style={styles.attachmentsLoading}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.attachmentsLoadingText}>Carregando anexos...</Text>
            </View>
          ) : attachmentsMap[record.clinicalId]?.length > 0 ? (
            <View style={styles.attachmentsList}>
              <View style={styles.attachmentsHeader}>
                <FontAwesome name="paperclip" size={14} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                <Text style={styles.attachmentsHeaderText}>
                  Anexos ({attachmentsMap[record.clinicalId].length})
                </Text>
              </View>
              {attachmentsMap[record.clinicalId].map((attachment, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.attachmentItem}
                  onPress={() => handleAttachmentPress(attachment)}
                >
                  <View style={styles.attachmentIconContainer}>
                    <FontAwesome
                      name={attachment.externallink ? 'link' : 'file-text-o'}
                      size={16}
                      color={theme.colors.primary}
                    />
                  </View>
                  <View style={styles.attachmentInfo}>
                    <Text style={styles.attachmentName} numberOfLines={1}>
                      {attachment.suggestedFilename || attachment.blobname || attachment.identifier || record.clinicalId}
                    </Text>
                    {attachment.contentType && (
                      <Text style={styles.attachmentType}>{attachment.contentType}</Text>
                    )}
                  </View>
                  <FontAwesome name="chevron-right" size={14} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.noAttachments}>
              <Text style={styles.noAttachmentsText}>Nenhum anexo disponível</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    let icon = 'folder-open';
    let iconColor = theme.colors.textSecondary;
    let title = 'Nenhum Registro Encontrado';
    let description = 'Não há registros clínicos disponíveis para este paciente.';

    switch (selectedType) {
      case 'REQUEST':
        icon = 'file-text-o';
        iconColor = theme.colors.primary;
        title = 'Nenhum Pedido Médico';
        description = 'Este paciente ainda não possui pedidos de exames, procedimentos ou consultas registrados.';
        break;
      case 'ATESTADO':
        icon = 'certificate';
        iconColor = theme.colors.success;
        title = 'Nenhum Atestado';
        description = 'Não há atestados médicos emitidos para este paciente no momento.';
        break;
      case 'REFERRAL':
        icon = 'share';
        iconColor = theme.colors.info;
        title = 'Nenhum Encaminhamento';
        description = 'Este paciente não possui encaminhamentos para outros especialistas ou serviços.';
        break;
      case 'all':
      default:
        icon = 'folder-open';
        iconColor = theme.colors.textSecondary;
        title = 'Nenhum Registro Clínico';
        description = 'Este paciente ainda não possui registros clínicos cadastrados no sistema.';
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
            <Text style={styles.emptyStateButtonText}>Ver Todos os Registros</Text>
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
        <Text style={styles.loadingText}>Carregando registros clínicos...</Text>
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
              <Text style={styles.headerTitle}>Registros Clínicos</Text>
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
          renderItem={renderClinicalRecordCard}
          keyExtractor={(item) => item.clinicalId}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
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
  metadataContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
  },
  metadataTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },
  metadataText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
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
  attachmentsSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
  },
  loadAttachmentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  loadAttachmentsText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  attachmentsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  attachmentsLoadingText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
  attachmentsList: {
    gap: 8,
  },
  attachmentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  attachmentsHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  attachmentIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  attachmentInfo: {
    flex: 1,
    marginRight: 8,
  },
  attachmentName: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  attachmentType: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  noAttachments: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  noAttachmentsText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
});
