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
  Image,
  StatusBar,
  Platform,
  Switch,
} from 'react-native';
import { RouteProp, useRoute, useNavigation, NavigationProp } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Markdown from 'react-native-markdown-display';
import { theme } from '@theme/index';
import { api } from '@services/api';
import { PatientsStackParamList } from '@/types/navigation';
import { logger } from '@/utils/logger';
import { translateClinicalType } from '@/utils/clinical';

type PatientHistoryRouteProp = RouteProp<PatientsStackParamList, 'PatientHistory'>;

interface Encounter {
  Identifier: string;
  Status: string;
  Class: string;
  actualStart: string;
  actualEnd?: string;
  Length?: number;
  Practitioner: string;
  practName?: string;
  Subject: string;
  shortAISummary?: string;
  reasonCode?: string;
}

interface EncounterWithDetails extends Encounter {
  clinicalRecords: any[];
  medications: any[];
  diagnostics: any[];
  images: any[];
  attachments: any[];
  clinicalCount: number;
  medicationCount: number;
  diagnosticCount: number;
  imageCount: number;
  attachmentCount: number;
}

const HEADER_TOP_PADDING = Platform.OS === 'android'
  ? (StatusBar.currentHeight || 44)
  : 52;

export const PatientHistoryScreen: React.FC = () => {
  const route = useRoute<PatientHistoryRouteProp>();
  const navigation = useNavigation<NavigationProp<PatientsStackParamList>>();
  const { patientCpf, patientName } = route.params;

  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [encounterDetails, setEncounterDetails] = useState<Map<string, Partial<EncounterWithDetails>>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedEncounters, setExpandedEncounters] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showAutomatic, setShowAutomatic] = useState(true);

  const loadPatientHistory = async (pageNum: number = 1, append: boolean = false) => {
    try {
      const ITEMS_PER_PAGE = 10;

      // Load encounters with pagination - ONLY basic encounter data
      const encountersResponse = await api.getPatientEncounters(patientCpf, {
        limit: ITEMS_PER_PAGE,
        page: pageNum
      });

      if (!encountersResponse?.data || !Array.isArray(encountersResponse.data)) {
        setEncounters(append ? encounters : []);
        setHasMore(false);
        return;
      }

      // Sort encounters by date (most recent first)
      const sortedEncounters = [...encountersResponse.data].sort((a, b) =>
        new Date(b.actualStart).getTime() - new Date(a.actualStart).getTime()
      );

      if (append) {
        setEncounters(prev => [...prev, ...sortedEncounters]);
      } else {
        setEncounters(sortedEncounters);
      }

      // Check if there are more pages
      setHasMore(encountersResponse.data.length === ITEMS_PER_PAGE);
      setPage(pageNum);

    } catch (error) {
      logger.error('[PatientHistory] Error loading patient history:', error);
      Alert.alert('Erro', 'Não foi possível carregar o histórico do paciente');
    }
  };

  // Load encounter details ONLY when expanded
  const loadEncounterDetails = async (encounterId: string) => {
    if (encounterDetails.has(encounterId) || loadingDetails.has(encounterId)) {
      return; // Already loaded or loading
    }

    setLoadingDetails(prev => new Set(prev).add(encounterId));

    try {
      // Load all related data for this encounter in parallel
      const [clinicalResponse, medicationResponse, diagnosticResponse, imageResponse, attachmentResponse] = await Promise.allSettled([
        api.getEncounterClinicalRecords(encounterId, { limit: 10 }).catch(() => ({ data: [] })),
        api.getEncounterMedications(patientCpf, encounterId, { limit: 10 }).catch(() => ({ data: [] })),
        api.getEncounterDiagnostics(encounterId).catch(() => []),
        api.getEncounterImages(encounterId).catch(() => []),
        api.getEncounterAttachments(encounterId).catch(() => []),
      ]);

      // Extract data from settled promises
      const clinicalRecords = clinicalResponse.status === 'fulfilled' ? (clinicalResponse.value?.data || []) : [];
      const medications = medicationResponse.status === 'fulfilled' ? (medicationResponse.value?.data || []) : [];
      const diagnostics = diagnosticResponse.status === 'fulfilled' ? (Array.isArray(diagnosticResponse.value) ? diagnosticResponse.value : []) : [];
      const images = imageResponse.status === 'fulfilled' ? (Array.isArray(imageResponse.value) ? imageResponse.value : []) : [];
      const attachments = attachmentResponse.status === 'fulfilled' ? (Array.isArray(attachmentResponse.value) ? attachmentResponse.value : []) : [];

      setEncounterDetails(prev => new Map(prev).set(encounterId, {
        clinicalRecords,
        medications,
        diagnostics,
        images,
        attachments,
        clinicalCount: clinicalRecords.length,
        medicationCount: medications.length,
        diagnosticCount: diagnostics.length,
        imageCount: images.length,
        attachmentCount: attachments.length,
      }));
    } catch (error) {
      logger.error(`[PatientHistory] Error loading details for encounter ${encounterId}:`, error);
    } finally {
      setLoadingDetails(prev => {
        const newSet = new Set(prev);
        newSet.delete(encounterId);
        return newSet;
      });
    }
  };

  const loadData = async () => {
    setLoading(true);
    await loadPatientHistory();
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setEncounterDetails(new Map()); // Clear cached details
    setPage(1);
    await loadPatientHistory(1, false);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;

    setLoadingMore(true);
    await loadPatientHistory(page + 1, true);
    setLoadingMore(false);
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

  const toggleEncounterExpansion = (encounterId: string) => {
    const newExpanded = new Set(expandedEncounters);
    if (newExpanded.has(encounterId)) {
      newExpanded.delete(encounterId);
    } else {
      newExpanded.add(encounterId);
      // Load details when expanding
      loadEncounterDetails(encounterId);
    }
    setExpandedEncounters(newExpanded);
  };

  const navigateToEncounterDetails = (encounter: Encounter) => {
    navigation.navigate('EncounterDetails', {
      encounterId: encounter.Identifier,
      patientName,
      patientCpf,
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'completed':
        return theme.colors.success;
      case 'in-progress':
        return theme.colors.warning;
      case 'planned':
        return theme.colors.info;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'Concluído';
      case 'in-progress':
        return 'Em andamento';
      case 'planned':
        return 'Planejado';
      case 'cancelled':
        return 'Cancelado';
      case 'on-hold':
        return 'Em espera';
      default:
        return status;
    }
  };

  const renderEncounterCard = (encounter: Encounter) => {
    const isExpanded = expandedEncounters.has(encounter.Identifier);
    const details = encounterDetails.get(encounter.Identifier);
    const isLoadingDetails = loadingDetails.has(encounter.Identifier);
    const isAutomatic = encounter.Class === 'automatic';
    const hasData = details && (
      (details.clinicalCount ?? 0) > 0 ||
      (details.medicationCount ?? 0) > 0 ||
      (details.diagnosticCount ?? 0) > 0 ||
      (details.imageCount ?? 0) > 0 ||
      (details.attachmentCount ?? 0) > 0
    );

    return (
      <View key={encounter.Identifier} style={[
        styles.encounterCard,
        isAutomatic && styles.automaticEncounterCard
      ]}>
        {/* Automatic Badge */}
        {isAutomatic && (
          <View style={styles.automaticBadge}>
            <FontAwesome name="cog" size={10} color={theme.colors.white} />
            <Text style={styles.automaticBadgeText}>Automático</Text>
          </View>
        )}

        {/* Header */}
        <TouchableOpacity
          style={styles.encounterHeader}
          onPress={() => navigateToEncounterDetails(encounter)}
        >
          <View style={styles.encounterHeaderLeft}>
            <View style={[
              styles.timelineDot,
              isAutomatic && styles.automaticTimelineDot
            ]} />
            <View style={styles.encounterMainInfo}>
              <Text style={styles.encounterTitle}>Encontro #{encounter.Identifier}</Text>
              <Text style={styles.encounterDate}>{formatDateTime(encounter.actualStart)}</Text>
              <Text style={styles.encounterPractitioner}>
                com {encounter.practName || encounter.Practitioner}
              </Text>
            </View>
          </View>

          <View style={styles.encounterHeaderRight}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(encounter.Status) }]}>
              <Text style={styles.statusText}>{getStatusLabel(encounter.Status)}</Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color={theme.colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* AI Summary */}
        {encounter.shortAISummary && (
          <View style={styles.aiSummaryContainer}>
            <Markdown style={markdownStyles}>
              {encounter.shortAISummary.trim()}
            </Markdown>
          </View>
        )}

        {/* Data Counts or Load Button */}
        <TouchableOpacity
          style={styles.dataCountsContainer}
          onPress={() => toggleEncounterExpansion(encounter.Identifier)}
          disabled={details && !hasData}
          activeOpacity={0.7}
        >
          {isLoadingDetails ? (
            <View style={styles.dataCountsFull}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.dataCountText}>Carregando detalhes...</Text>
            </View>
          ) : hasData ? (
            <>
              <View style={styles.dataCounts}>
                {(details.clinicalCount ?? 0) > 0 && (
                  <View style={styles.dataCount}>
                    <FontAwesome name="file-text-o" size={12} color={theme.colors.info} />
                    <Text style={styles.dataCountText}>{details.clinicalCount} Registros</Text>
                  </View>
                )}
                {(details.medicationCount ?? 0) > 0 && (
                  <View style={styles.dataCount}>
                    <FontAwesome name="medkit" size={12} color={theme.colors.success} />
                    <Text style={styles.dataCountText}>{details.medicationCount} Medicações</Text>
                  </View>
                )}
                {(details.diagnosticCount ?? 0) > 0 && (
                  <View style={styles.dataCount}>
                    <FontAwesome name="stethoscope" size={12} color={theme.colors.warning} />
                    <Text style={styles.dataCountText}>{details.diagnosticCount} Diagnósticos</Text>
                  </View>
                )}
                {(details.imageCount ?? 0) > 0 && (
                  <View style={styles.dataCount}>
                    <FontAwesome name="picture-o" size={12} color={theme.colors.primary} />
                    <Text style={styles.dataCountText}>{details.imageCount} Imagens</Text>
                  </View>
                )}
                {(details.attachmentCount ?? 0) > 0 && (
                  <View style={styles.dataCount}>
                    <FontAwesome name="paperclip" size={12} color={theme.colors.textSecondary} />
                    <Text style={styles.dataCountText}>{details.attachmentCount} Anexos</Text>
                  </View>
                )}
              </View>
              <FontAwesome
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={12}
                color={theme.colors.textSecondary}
              />
            </>
          ) : details ? (
            <View style={styles.dataCountsFull}>
              <FontAwesome name="inbox" size={12} color={theme.colors.textSecondary} />
              <Text style={styles.dataCountText}>Este encontro não possui detalhes</Text>
            </View>
          ) : (
            <View style={styles.dataCountsFull}>
              <FontAwesome name="info-circle" size={12} color={theme.colors.textSecondary} />
              <Text style={styles.dataCountText}>Ver detalhes</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Expanded Content */}
        {isExpanded && details && (
          <View style={styles.expandedContent}>
            {(details.clinicalRecords?.length ?? 0) > 0 && (
              <View style={styles.expandedSection}>
                <Text style={styles.expandedSectionTitle}>Registros Clínicos</Text>
                {details.clinicalRecords!.map((record: any, index: number) => {
                  const typeLabel = translateClinicalType(record.clinicalType || record.type) || 'Registro';
                  const recordId = record.clinicalId || record.identifier || record.id;
                  return (
                    <Text key={index} style={styles.expandedItem}>
                      • {typeLabel} #{recordId}
                    </Text>
                  );
                })}
              </View>
            )}

            {(details.medications?.length ?? 0) > 0 && (
              <View style={styles.expandedSection}>
                <Text style={styles.expandedSectionTitle}>Medicações</Text>
                {details.medications!.map((med: any, index: number) => (
                  <Text key={index} style={styles.expandedItem}>
                    • {med.medRequestItens?.[0]?.productName || `Prescrição #${med.medId}`}
                  </Text>
                ))}
              </View>
            )}

            {(details.diagnostics?.length ?? 0) > 0 && (
              <View style={styles.expandedSection}>
                <Text style={styles.expandedSectionTitle}>Diagnósticos</Text>
                {details.diagnostics!.map((diag: any, index: number) => (
                  <Text key={index} style={styles.expandedItem}>
                    • {diag.conclusion || `Diagnóstico #${diag.identifier}`}
                  </Text>
                ))}
              </View>
            )}

            {(details.attachments?.length ?? 0) > 0 && (
              <View style={styles.expandedSection}>
                <Text style={styles.expandedSectionTitle}>Anexos</Text>
                {details.attachments!.map((attachment: any, index: number) => {
                  const typeMap: Record<string, string> = {
                    'MEDREQUEST': 'Prescrição',
                    'MEDREQUEST-SIGNED': 'Prescrição Assinada',
                    'REQUEST': 'Solicitação',
                    'REQUEST-SIGNED': 'Solicitação Assinada',
                    'REFERRAL': 'Encaminhamento',
                    'ATESTADO': 'Atestado',
                    'EXAM_RESULT': 'Resultado de Exame',
                    'MANUAL': 'Manual',
                  };
                  const typeLabel = typeMap[attachment.type] || attachment.type || 'Anexo';
                  return (
                    <Text key={index} style={styles.expandedItem}>
                      • {typeLabel} #{attachment.identifier}
                    </Text>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Image 
          source={require('../../assets/medpro-logo.png')} 
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loadingSpinner} />
        <Text style={styles.loadingText}>Carregando histórico médico...</Text>
      </View>
    );
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
              <Text style={styles.greeting}>Histórico Médico</Text>
              <Text style={styles.userName}>{patientName}</Text>
              <Text style={styles.dateText}>
                {encounters.length} encontro{encounters.length !== 1 ? 's' : ''} registrado{encounters.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </View>

      {/* Timeline */}
      <ScrollView
        style={styles.timeline}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {encounters.length > 0 ? (
          <>
            <View style={styles.timelineHeader}>
              <Text style={styles.timelineHeaderText}>
                {encounters.length} encontro{encounters.length !== 1 ? 's' : ''}
              </Text>
              <View style={styles.toggleContainer}>
                <Text style={styles.timelineHeaderText}>Automáticos</Text>
                <Switch
                  value={showAutomatic}
                  onValueChange={setShowAutomatic}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={theme.colors.white}
                />
              </View>
            </View>
            {encounters
              .filter(enc => showAutomatic || enc.Class !== 'automatic')
              .map(renderEncounterCard)}

            {/* Load More Button */}
            {hasMore && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={styles.loadMoreText}>Carregando...</Text>
                  </>
                ) : (
                  <>
                    <FontAwesome name="chevron-down" size={14} color={theme.colors.primary} />
                    <Text style={styles.loadMoreText}>Carregar mais encontros</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <FontAwesome name="history" size={48} color={theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>Nenhum histórico encontrado</Text>
            <Text style={styles.emptyMessage}>
              Este paciente ainda não possui registros médicos no sistema.
            </Text>
          </View>
        )}
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingLogo: {
    width: 80,
    height: 80,
    marginBottom: 24,
  },
  loadingSpinner: {
    marginVertical: 16,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: theme.colors.white,
    opacity: 0.9,
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    color: theme.colors.white,
    opacity: 0.8,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  timeline: {
    flex: 1,
    padding: 16,
  },
  timelineHeader: {
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineHeaderText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  encounterCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    position: 'relative',
  },
  automaticEncounterCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderColor: theme.colors.warning + '40',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.warning,
  },
  automaticBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  automaticBadgeText: {
    fontSize: 10,
    color: theme.colors.white,
    fontWeight: '600',
  },
  encounterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  encounterHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    marginRight: 16,
  },
  automaticTimelineDot: {
    backgroundColor: theme.colors.warning,
  },
  encounterMainInfo: {
    flex: 1,
  },
  encounterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  encounterDate: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  encounterPractitioner: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  encounterHeaderRight: {
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    color: theme.colors.white,
    fontWeight: '500',
  },
  aiSummaryContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  dataCountsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    marginTop: 8,
    paddingTop: 12,
  },
  dataCounts: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dataCountsFull: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dataCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dataCountText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  expandedSection: {
    marginBottom: 12,
  },
  expandedSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },
  expandedItem: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 2,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginVertical: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.primary,
  },
});

const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  heading1: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },
  heading3: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  bullet_list: {
    marginBottom: 0,
    paddingLeft: 12,
  },
  ordered_list: {
    marginBottom: 0,
    paddingLeft: 12,
  },
  list_item: {
    marginBottom: 4,
  },
  strong: {
    fontWeight: '600',
  },
  em: {
    fontStyle: 'italic',
  },
});
