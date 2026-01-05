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
  Linking,
  Image,
  StatusBar,
  Platform,
} from 'react-native';
import { RouteProp, useRoute, useNavigation, NavigationProp } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { api, API_BASE_URL } from '@services/api';
import { PatientsStackParamList } from '@/types/navigation';
import { CachedImage } from '@components/common';
import { useAuthStore } from '@store/authStore';
import {
  translateClinicalType,
  translateClinicalStatus,
  translateClinicalCategory,
  formatClinicalDateTime,
  getStatusBadgeStyle,
} from '@/utils/clinical';
import { logger } from '@/utils/logger';

type EncounterDetailsRouteProp = RouteProp<PatientsStackParamList, 'EncounterDetails'>;

interface EncounterDetails {
  encounter: any;
  clinicalRecords: any[];
  medications: any[];
  diagnostics: any[];
  images: any[];
  attachments: any[];
}

interface PatientOverview {
  total: number;
  lastEncounter: any | null;
}

type PatientDetails = Record<string, any> | null;
type EncounterInfo = Record<string, any> | null;

interface EncounterServiceItem {
  id?: string;
  name?: string;
  price?: number;
  professional?: string;
  startTime?: string;
  endTime?: string;
  [key: string]: any;
}

interface EncounterServicesData {
  encounterId?: string;
  appointmentId?: string | number | null;
  services: EncounterServiceItem[];
  serviceCategory?: string | null;
  serviceType?: string | null;
  appointmentStatus?: string | null;
}

interface EncounterServiceCoverage {
  serviceId?: string;
  serviceName?: string;
  price?: number;
  isCoveredByPlan?: boolean;
  chosenPayment?: string | null;
  [key: string]: any;
}

interface EncounterFinancialTotals {
  totalServicesAmount?: number;
  directPayAmount?: number;
  planCoveredAmount?: number;
  uncoveredAmount?: number;
  pendingDecisionCount?: number;
  [key: string]: any;
}

interface EncounterFinancialsData {
  encounterId?: string;
  appointmentId?: string | number | null;
  paymentType?: string | null;
  selectedPractCarePlanIdForAppointment?: number | string | null;
  selectedPatientCarePlanCode?: string | null;
  selectedServices?: EncounterServiceItem[];
  servicesCoverageStatus?: EncounterServiceCoverage[];
  totals?: EncounterFinancialTotals | null;
}

const calculateAge = (birthDate?: string | null): number | null => {
  if (!birthDate) return null;
  const parsed = new Date(birthDate);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }
  return age;
};

const formatGenderLabel = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value.toString().toLowerCase();
  if (normalized.startsWith('f')) return 'Feminino';
  if (normalized.startsWith('m')) return 'Masculino';
  return value;
};

const formatDateLabel = (dateString?: string | null): string | null => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const formatTimeLabel = (start?: string | null, end?: string | null): string | null => {
  if (!start) return null;
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return null;

  const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const startLabel = startDate.toLocaleTimeString('pt-BR', options);

  if (!end) return startLabel;

  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return startLabel;

  const endLabel = endDate.toLocaleTimeString('pt-BR', options);
  return `${startLabel} - ${endLabel}`;
};

const formatDurationLabel = (seconds?: number | null): string | null => {
  if (seconds === undefined || seconds === null) return null;

  const totalSeconds = Number(seconds);
  if (Number.isNaN(totalSeconds) || totalSeconds < 0) return null;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}min`);
  }

  if (hours === 0 && minutes === 0) {
    parts.push(`${secs}s`);
  } else if (secs > 0) {
    parts.push(`${secs}s`);
  }

  return parts.join(' ');
};

const formatCurrencyBRL = (value?: number | null): string | null => {
  if (value === undefined || value === null) return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(numeric);
};

const formatDurationMinutesLabel = (minutes?: number | null): string | null => {
  if (minutes === undefined || minutes === null) return null;
  const numeric = Number(minutes);
  if (Number.isNaN(numeric) || numeric < 0) return null;

  if (numeric === 0) return '0 min';

  const hours = Math.floor(numeric / 60);
  const remainingMinutes = Math.round(numeric % 60);

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (remainingMinutes > 0) {
    parts.push(`${remainingMinutes}min`);
  }

  return parts.join(' ');
};

const formatStatusLabel = (status?: string | null): string | null => {
  if (!status || typeof status !== 'string') return null;
  const trimmed = status.trim();
  if (!trimmed) return null;

  switch (trimmed.toLowerCase()) {
    case 'in-progress':
      return 'Em Andamento';
    case 'on-hold':
      return 'Pausado';
    case 'complete':
    case 'completed':
    case 'finished':
      return 'Finalizado';
    case 'cancelled':
    case 'canceled':
      return 'Cancelado';
    case 'entered-in-error':
      return 'Erro de Entrada';
    case 'planned':
      return 'Planejado';
    case 'arrived':
      return 'Chegou';
    case 'triaged':
      return 'Triagem';
    default:
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
};

const quillDeltaToPlainText = (input: unknown): string => {
  if (input === null || input === undefined) {
    return '';
  }

  const ensureArrayOps = (value: any): any[] | null => {
    if (!value) return null;
    if (Array.isArray(value)) return value;
    if (Array.isArray(value.ops)) return value.ops;
    return null;
  };

  const normalizeString = (value: string): string => value.replace(/\r\n/g, '\n');

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return '';

    try {
      const parsed = JSON.parse(trimmed);
      const ops = ensureArrayOps(parsed);
      if (!ops) {
        return normalizeString(trimmed);
      }
      input = ops;
    } catch (error) {
      // Not a JSON payload; return raw text normalized
      return normalizeString(trimmed);
    }
  }

  const ops = ensureArrayOps(input);
  if (!ops) {
    return typeof input === 'string' ? normalizeString(input) : '';
  }

  const parts: string[] = [];
  const orderedCounters: number[] = [];

  const resetOrderedCounters = (level: number = 0) => {
    orderedCounters.splice(level);
  };

  const formatListLine = (text: string, indent: number, prefix: string): string => {
    const trimmed = text.replace(/\n+$/, '');
    if (!trimmed.trim()) {
      return '';
    }
    const indentation = '  '.repeat(indent);
    return `${indentation}${prefix}${trimmed}\n`;
  };

  for (const op of ops) {
    if (!op) continue;
    const insertValue = op.insert ?? op.value ?? '';
    const attributes = op.attributes || {};

    if (typeof insertValue === 'string') {
      const value = insertValue.replace(/\r\n/g, '\n');

      if (attributes.list === 'ordered' || attributes.list === 'bullet') {
        const indentLevel = Number(attributes.indent || 0);
        if (attributes.list === 'ordered') {
          orderedCounters[indentLevel] = (orderedCounters[indentLevel] ?? 0) + 1;
          orderedCounters.length = indentLevel + 1;
          const listIndex = orderedCounters[indentLevel];
          const line = formatListLine(value, indentLevel, `${listIndex}. `);
          if (line) {
            parts.push(line);
          }
        } else {
          resetOrderedCounters(indentLevel);
          const line = formatListLine(value, indentLevel, '• ');
          if (line) {
            parts.push(line);
          }
        }
        continue;
      }

      resetOrderedCounters();

      if (value === '\n' && attributes.header) {
        parts.push('\n');
        continue;
      }

      parts.push(value);
    } else if (insertValue && typeof insertValue === 'object') {
      resetOrderedCounters();
      if ('image' in insertValue) {
        parts.push('[Imagem]');
      } else if ('video' in insertValue) {
        parts.push('[Vídeo]');
      } else {
        parts.push('[Conteúdo não textual]');
      }
    }
  }

  const rawText = parts.join('');
  return rawText
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const HEADER_TOP_PADDING = Platform.OS === 'android'
  ? (StatusBar.currentHeight || 44)
  : 52;

export const EncounterDetailsScreen: React.FC = () => {
  const route = useRoute<EncounterDetailsRouteProp>();
  const navigation = useNavigation<NavigationProp<PatientsStackParamList>>();
  const { encounterId, patientName, patientCpf } = route.params;
  const { token } = useAuthStore();

  const [encounterDetails, setEncounterDetails] = useState<EncounterDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patientOverview, setPatientOverview] = useState<PatientOverview | null>(null);
  const [patientDetails, setPatientDetails] = useState<PatientDetails>(null);
  const [encounterInfo, setEncounterInfo] = useState<EncounterInfo>(null);
  const [encounterServices, setEncounterServices] = useState<EncounterServicesData | null>(null);
  const [encounterServicesError, setEncounterServicesError] = useState<string | null>(null);
  const [encounterFinancials, setEncounterFinancials] = useState<EncounterFinancialsData | null>(null);
  const [encounterFinancialsError, setEncounterFinancialsError] = useState<string | null>(null);
  const [encounterSummary, setEncounterSummary] = useState<any>(null);
  const [encounterAI, setEncounterAI] = useState<any>(null);
  const [recordings, setRecordings] = useState<any[]>([]);

  const loadEncounterDetails = async () => {
    try {
      logger.debug('[EncounterDetails] Loading details for encounter:', encounterId);
      
      // Load all encounter data in parallel - handle errors gracefully
      const [clinicalResponse, medicationResponse, diagnosticResponse, imageResponse, attachmentResponse] = await Promise.allSettled([
        api.getEncounterClinicalRecords(encounterId, { limit: 50 }).catch(() => ({ data: [] })),
        api.getEncounterMedications('', encounterId, { limit: 50 }).catch(() => ({ data: [] })), // CPF not needed for this call
        api.getEncounterDiagnostics(encounterId).catch(() => []),
        api.getEncounterImages(encounterId).catch(() => []),
        api.getEncounterAttachments(encounterId).catch(() => []),
      ]);

      if (clinicalResponse.status === 'fulfilled') {
      } else {
        logger.error('[EncounterDetails] Clinical records request failed:', clinicalResponse.reason);
      }

      if (medicationResponse.status === 'fulfilled') {
      } else {
        logger.error('[EncounterDetails] Medications request failed:', medicationResponse.reason);
      }

      if (diagnosticResponse.status === 'fulfilled') {
      } else {
        logger.error('[EncounterDetails] Diagnostics request failed:', diagnosticResponse.reason);
      }

      if (imageResponse.status === 'fulfilled') {
      } else {
        logger.error('[EncounterDetails] Images request failed:', imageResponse.reason);
      }

      if (attachmentResponse.status === 'fulfilled') {
      } else {
        logger.error('[EncounterDetails] Attachments request failed:', attachmentResponse.reason);
      }

      // Extract data from settled promises - all should be successful now
      const clinicalRecords = clinicalResponse.status === 'fulfilled'
        ? (clinicalResponse.value?.data || []).map((record: any) => ({
            ...record,
            clinicalId: record?.clinicalId ?? record?.identifier ?? record?.id ?? record?.ID ?? null,
            clinicalType: record?.clinicalType ?? record?.type ?? record?.resourceType ?? null,
            clinicalStatus: record?.clinicalStatus ?? record?.status ?? null,
            clinicalDate: record?.clinicalDate ?? record?.date ?? record?.authoredOn ?? record?.occurrence ?? record?.createdAt ?? null,
            clinicalMetadata: record?.clinicalMetadata ?? record?.metadata ?? record?.meta ?? null,
          }))
        : [];
      const medications = medicationResponse.status === 'fulfilled' ? (medicationResponse.value?.data || []) : [];
      const diagnostics = diagnosticResponse.status === 'fulfilled' ? (Array.isArray(diagnosticResponse.value) ? diagnosticResponse.value : []) : [];
      const images = imageResponse.status === 'fulfilled' ? (Array.isArray(imageResponse.value) ? imageResponse.value : []) : [];
      const attachments = attachmentResponse.status === 'fulfilled' ? (Array.isArray(attachmentResponse.value) ? attachmentResponse.value : []) : [];

      // Get encounter basic info from the first available source
      const encounter = clinicalRecords[0] || medications[0] || diagnostics[0] || images[0] || { Identifier: encounterId };

      const details: EncounterDetails = {
        encounter,
        clinicalRecords,
        medications,
        diagnostics,
        images,
        attachments,
      };

      logger.debug('[EncounterDetails] Loaded encounter details:', {
        clinical: clinicalRecords.length,
        medications: medications.length,
        diagnostics: diagnostics.length,
        images: images.length,
        attachments: attachments.length,
      });
      logger.debug('[EncounterDetails] Encounter record fields:', encounter ? Object.keys(encounter) : []);

      setEncounterDetails(details);
    } catch (error) {
      logger.error('[EncounterDetails] Error loading encounter details:', error);
      Alert.alert('Erro', 'Não foi possível carregar os detalhes do encontro');
    }
  };

  const loadPatientOverview = async () => {
    if (!patientCpf) {
      setPatientOverview(null);
      return;
    }

    try {
      const response = await api.getPatientLastEncounterSummary(patientCpf, encounterId);
      setPatientOverview({
        total: response?.total ?? 0,
        lastEncounter: response?.data || null,
      });
    } catch (error) {
      logger.error('[EncounterDetails] Error loading patient overview:', error);
      setPatientOverview(null);
    }
  };

  const loadPatientDetails = async () => {
    if (!patientCpf) {
      setPatientDetails(null);
      return;
    }

    try {
      const response = await api.getPatientDetails(patientCpf);
      const raw = response?.data ?? response;
      setPatientDetails(raw || null);
    } catch (error) {
      logger.error('[EncounterDetails] Error loading patient details:', error);
      setPatientDetails(null);
    }
  };

  const loadEncounterInfo = async () => {
    try {
      logger.debug('[EncounterDetails] Loading encounter info row for:', encounterId);
      const response = await api.getEncounterInfoById(encounterId);
      const info = Array.isArray(response)
        ? response[0]
        : Array.isArray(response?.data)
          ? response.data[0]
          : response?.data ?? response;
      setEncounterInfo(info || null);
    } catch (error) {
      logger.error('[EncounterDetails] Error loading encounter info:', error);
      setEncounterInfo(null);
    }
  };

  const normalizeEncounterServicesData = (payload: any): EncounterServicesData => ({
    encounterId: payload?.encounterId ?? encounterId,
    appointmentId: payload?.appointmentId ?? null,
    services: Array.isArray(payload?.services) ? payload.services : [],
    serviceCategory: payload?.serviceCategory ?? payload?.category ?? null,
    serviceType: payload?.serviceType ?? payload?.type ?? null,
    appointmentStatus: payload?.appointmentStatus ?? payload?.status ?? null,
  });

  const normalizeEncounterFinancialsData = (payload: any): EncounterFinancialsData => ({
    encounterId: payload?.encounterId ?? encounterId,
    appointmentId: payload?.appointmentId ?? null,
    paymentType: payload?.paymentType ?? payload?.payment_type ?? null,
    selectedPractCarePlanIdForAppointment: payload?.selectedPractCarePlanIdForAppointment ?? payload?.selectedPractCarePlanId ?? null,
    selectedPatientCarePlanCode: payload?.selectedPatientCarePlanCode ?? payload?.carePlanCode ?? null,
    selectedServices: Array.isArray(payload?.selectedServices) ? payload.selectedServices : [],
    servicesCoverageStatus: Array.isArray(payload?.servicesCoverageStatus) ? payload.servicesCoverageStatus : [],
    totals: payload?.totals ?? null,
  });

  const loadEncounterServices = async () => {
    try {
      logger.debug('[EncounterDetails] Loading encounter services for:', encounterId);
      setEncounterServicesError(null);
      const response = await api.getEncounterServices(encounterId);

      if (response && typeof response === 'object' && 'error' in response && response.error) {
        const errorMessage = typeof response.error === 'string'
          ? response.error
          : 'Não foi possível carregar os serviços agendados.';
        setEncounterServices(null);
        setEncounterServicesError(errorMessage);
        return;
      }

      const payload = response && typeof response === 'object' && 'data' in response
        ? (response as any).data
        : response;


      if (!payload) {
        logger.warn('[EncounterDetails] Encounter services payload empty, using fallback.');
        setEncounterServices(normalizeEncounterServicesData({ services: [] }));
        return;
      }

      const normalized = normalizeEncounterServicesData(payload);
      setEncounterServices(normalized);
    } catch (error) {
      logger.error('[EncounterDetails] Error loading encounter services:', error);
      const rawMessage = error instanceof Error ? error.message : '';
      let normalizedMessage = 'Não foi possível carregar os serviços agendados.';

      if (rawMessage.includes('Encounter not found')) {
        logger.warn('[EncounterDetails] Encounter services request returned encounter not found.');
        normalizedMessage = 'Encontro não encontrado.';
      } else if (rawMessage.includes('Appointment not found')) {
        logger.warn('[EncounterDetails] Encounter services request returned appointment not found.');
        normalizedMessage = 'Nenhum agendamento associado ao encontro.';
      }

      setEncounterServices(null);
      setEncounterServicesError(normalizedMessage);
    }
  };

  const loadEncounterFinancials = async () => {
    try {
      logger.debug('[EncounterDetails] Loading encounter financials for:', encounterId);
      setEncounterFinancialsError(null);
      const response = await api.getEncounterFinancials(encounterId);

      if (response && typeof response === 'object' && 'error' in response && response.error) {
        const errorMessage = typeof response.error === 'string'
          ? response.error
          : 'Não foi possível carregar o resumo financeiro.';
        setEncounterFinancials(null);
        setEncounterFinancialsError(errorMessage);
        return;
      }

      const payload = response && typeof response === 'object' && 'data' in response
        ? (response as any).data
        : response;


      if (!payload) {
        logger.warn('[EncounterDetails] Encounter financials payload empty, using fallback.');
        setEncounterFinancials(normalizeEncounterFinancialsData({ selectedServices: [], totals: {} }));
        return;
      }

      const normalized = normalizeEncounterFinancialsData(payload);
      setEncounterFinancials(normalized);
    } catch (error) {
      logger.error('[EncounterDetails] Error loading encounter financials:', error);
      const rawMessage = error instanceof Error ? error.message : '';
      let normalizedMessage = 'Não foi possível carregar o resumo financeiro.';

      if (rawMessage.includes('Encounter not found')) {
        logger.warn('[EncounterDetails] Encounter financials request returned encounter not found.');
        normalizedMessage = 'Encontro não encontrado.';
      } else if (rawMessage.includes('Appointment not found')) {
        logger.warn('[EncounterDetails] Encounter financials request returned appointment not found.');
        normalizedMessage = 'Nenhum agendamento associado ao encontro.';
      }

      setEncounterFinancials(null);
      setEncounterFinancialsError(normalizedMessage);
    }
  };

  const loadEncounterSummary = async () => {
    try {
      logger.debug('[EncounterDetails] Loading encounter summary for:', encounterId);
      const response = await api.getEncounterSummary(encounterId);
      setEncounterSummary(response?.data || response || null);
    } catch (error) {
      logger.error('[EncounterDetails] Error loading encounter summary:', error);
      setEncounterSummary(null);
    }
  };

  const loadEncounterAI = async () => {
    try {
      logger.debug('[EncounterDetails] Loading encounter AI data for:', encounterId);
      const response = await api.getEncounterAI(encounterId);
      setEncounterAI(response?.data || response || null);
    } catch (error) {
      logger.error('[EncounterDetails] Error loading encounter AI:', error);
      setEncounterAI(null);
    }
  };

  const loadRecordings = async () => {
    try {
      logger.debug('[EncounterDetails] Loading recordings for encounter:', encounterId);
      const response = await api.getEncounterRecordings(encounterId, { limit: 20 });
      const data = response?.data || response || [];
      setRecordings(Array.isArray(data) ? data : []);
    } catch (error) {
      logger.error('[EncounterDetails] Error loading recordings:', error);
      setRecordings([]);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadEncounterDetails(),
      loadPatientOverview(),
      loadPatientDetails(),
      loadEncounterInfo(),
      loadEncounterServices(),
      loadEncounterFinancials(),
      loadEncounterSummary(),
      loadEncounterAI(),
      loadRecordings(),
    ]);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadEncounterDetails(),
      loadPatientOverview(),
      loadPatientDetails(),
      loadEncounterInfo(),
      loadEncounterServices(),
      loadEncounterFinancials(),
      loadEncounterSummary(),
      loadEncounterAI(),
      loadRecordings(),
    ]);
    setRefreshing(false);
  };

  useEffect(() => {
    setEncounterServices(null);
    setEncounterServicesError(null);
    setEncounterFinancials(null);
    setEncounterFinancialsError(null);
    loadData();
  }, [encounterId, patientCpf]);

  const formatDateTime = (dateString?: string | null): string => {
    return formatClinicalDateTime(dateString) ?? '—';
  };

  const handleClinicalRecordPress = (record: any) => {
    if (!record) return;

    navigation.navigate('ClinicalRecordDetails', {
      encounterId,
      patientCpf,
      patientName,
      clinicalRecord: record,
    });
  };

  const handleAttachmentPress = async (attachment: any) => {
    if (attachment.externallink) {
      try {
        await Linking.openURL(attachment.externallink);
      } catch (error) {
        Alert.alert('Erro', 'Não foi possível abrir o anexo');
      }
    } else {
      Alert.alert('Aviso', 'Link do anexo não disponível');
    }
  };

  // Section rendering helpers
  const renderSectionHeader = (title: string, icon: string) => (
    <View style={styles.sectionHeader}>
      <FontAwesome name={icon} size={18} color={theme.colors.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const renderPatientInfo = () => {
    const details = patientDetails || {};
    const name = details.name || details.fullName || details.patientName || patientName;
    const genderLabel = formatGenderLabel(details.gender || details.patientGender);
    const birthDate = details.birthdate || details.patientBirthDate;
    const age = calculateAge(birthDate);
    const metaParts: string[] = [];
    if (genderLabel) metaParts.push(genderLabel);
    if (typeof age === 'number') metaParts.push(`${age} ${age === 1 ? 'ano' : 'anos'}`);
    const metaLine = metaParts.join(' • ');

    return (
      <View style={styles.section}>
        {renderSectionHeader('Informações do Paciente', 'user')}
        <View style={styles.sectionContent}>
          {!patientDetails ? (
            <Text style={styles.emptyMessage}>Carregando informações do paciente...</Text>
          ) : (
            <View style={styles.patientCardHeader}>
              <CachedImage
                uri={patientCpf ? `${API_BASE_URL}/patient/getpatientphoto?patientCpf=${patientCpf}` : undefined}
                headers={token ? { Authorization: `Bearer ${token}` } : undefined}
                style={styles.patientAvatar}
                fallbackIcon="user"
                fallbackIconSize={30}
                fallbackIconColor={theme.colors.white}
              />
              <View style={styles.patientInfo}>
                {name ? <Text style={styles.patientNameText}>{name}</Text> : null}
                {metaLine ? <Text style={styles.patientMeta}>{metaLine}</Text> : null}
                {patientCpf ? <Text style={styles.patientCpf}>CPF: {patientCpf}</Text> : null}
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderEncounterDetails = () => {
    const encounterRecord = encounterInfo || encounterDetails?.encounter;

    return (
      <View style={styles.section}>
        {renderSectionHeader('Detalhes do Atendimento', 'clipboard')}
        <View style={styles.sectionContent}>
          {!encounterRecord ? (
            <Text style={styles.emptyMessage}>Carregando detalhes do atendimento...</Text>
          ) : (
            <View style={styles.dataGrid}>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>Profissional</Text>
                <Text style={styles.dataValue}>
                  {encounterRecord.practName || encounterRecord.practitioner || encounterRecord.Practitioner || '—'}
                </Text>
              </View>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>Status</Text>
                {(() => {
                  const status = encounterRecord.Status || encounterRecord.status;
                  const statusLabel = formatStatusLabel(status) || '—';
                  const statusLower = (status || '').toLowerCase();

                  let badgeStyle = styles.statusBadgeNeutral;
                  if (statusLower === 'finished' || statusLower === 'completed' || statusLower === 'finalizado') {
                    badgeStyle = styles.statusBadgeSuccess;
                  } else if (statusLower === 'in-progress' || statusLower === 'ongoing' || statusLower === 'em andamento') {
                    badgeStyle = styles.statusBadgeInfo;
                  } else if (statusLower === 'cancelled' || statusLower === 'canceled' || statusLower === 'cancelado') {
                    badgeStyle = styles.statusBadgeError;
                  } else if (statusLower === 'planned' || statusLower === 'planejado' || statusLower === 'agendado') {
                    badgeStyle = styles.statusBadgeWarning;
                  }

                  return (
                    <View style={[styles.statusBadgeContainer, badgeStyle]}>
                      <Text style={styles.statusBadgeTextSmall}>{statusLabel}</Text>
                    </View>
                  );
                })()}
              </View>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>Início</Text>
                <Text style={styles.dataValue}>
                  {(() => {
                    const startIso = encounterRecord.actualStart || encounterRecord.startDate || encounterRecord.startdate || encounterRecord.encounterDate || encounterRecord.encounterdate;
                    return startIso ? formatDateTime(startIso) : '—';
                  })()}
                </Text>
              </View>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>Término</Text>
                <Text style={styles.dataValue}>
                  {(() => {
                    const endIso = encounterRecord.actualEnd || encounterRecord.endDate || encounterRecord.enddate;
                    return endIso ? formatDateTime(endIso) : '—';
                  })()}
                </Text>
              </View>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>Duração</Text>
                <Text style={styles.dataValue}>
                  {(() => {
                    const durationRaw = encounterRecord.Length ?? encounterRecord.length ?? encounterRecord.durationMinutes ?? encounterRecord.duration ?? encounterRecord.totalMinutes;
                    const durationSeconds = typeof durationRaw === 'string' ? Number(durationRaw) : durationRaw;
                    return formatDurationLabel(durationSeconds) || '—';
                  })()}
                </Text>
              </View>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>Consulta</Text>
                <Text style={styles.dataValue}>
                  {encounterServices?.appointmentId || encounterRecord.appointmentId || '—'}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderServices = () => {
    return (
      <View style={styles.section}>
        {renderSectionHeader('Serviços Realizados', 'briefcase')}
        <View style={styles.sectionContent}>
          {encounterServicesError ? (
            <Text style={styles.emptyMessage}>{encounterServicesError}</Text>
          ) : encounterServices?.services && encounterServices.services.length > 0 ? (
            encounterServices.services.map((service, index) => {
              const priceLabel = formatCurrencyBRL(service.price);
              const durationLabel = formatDurationMinutesLabel(service.duration || service.durationMinutes);

              return (
                <View key={service.id || `service-${index}`} style={styles.serviceItem}>
                  <View style={styles.serviceItemHeader}>
                    <FontAwesome name="stethoscope" size={14} color={theme.colors.primary} />
                    <Text style={styles.serviceName}>{service.name || 'Serviço sem nome'}</Text>
                  </View>
                  <View style={styles.serviceDetailRow}>
                    {priceLabel && (
                      <View style={styles.serviceDetailItem}>
                        <FontAwesome name="money" size={11} color={theme.colors.textSecondary} />
                        <Text style={styles.serviceDetailText}>{priceLabel}</Text>
                      </View>
                    )}
                    {durationLabel && (
                      <View style={styles.serviceDetailItem}>
                        <FontAwesome name="clock-o" size={11} color={theme.colors.textSecondary} />
                        <Text style={styles.serviceDetailText}>{durationLabel}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyMessage}>Nenhum serviço registrado</Text>
          )}
        </View>
      </View>
    );
  };

  const renderAISummary = () => {
    const summary = encounterSummary?.summary || encounterSummary?.shortAISummary || encounterDetails?.encounter?.shortAISummary;

    return (
      <View style={styles.section}>
        {renderSectionHeader('Resumo Clínico AI', 'magic')}
        <View style={[styles.sectionContent, styles.aiSection]}>
          {summary ? (
            <Text style={styles.aiSummaryText}>{summary}</Text>
          ) : (
            <Text style={styles.emptyMessage}>Nenhum resumo AI disponível</Text>
          )}
        </View>
      </View>
    );
  };

  const renderAIFindings = () => {
    const hasDiagnoses = Array.isArray(encounterAI?.diagnoses) && encounterAI.diagnoses.length > 0;
    const hasMedications = Array.isArray(encounterAI?.medications) && encounterAI.medications.length > 0;
    const hasLabs = Array.isArray(encounterAI?.labs) && encounterAI.labs.length > 0;
    const hasProcedures = Array.isArray(encounterAI?.procedures) && encounterAI.procedures.length > 0;

    return (
      <View style={styles.section}>
        {renderSectionHeader('Dados de IA', 'lightbulb-o')}
        <View style={[styles.sectionContent, styles.aiSection]}>
          {!hasDiagnoses && !hasMedications && !hasLabs && !hasProcedures ? (
            <Text style={styles.emptyMessage}>Nenhum dado AI disponível</Text>
          ) : (
            <>
              {hasDiagnoses && (
            <View style={styles.aiSubsection}>
              <View style={styles.aiSubsectionHeader}>
                <FontAwesome name="stethoscope" size={14} color={theme.colors.white} />
                <Text style={styles.aiSubsectionTitle}>Diagnósticos AI</Text>
                <View style={styles.aiCountBadge}>
                  <Text style={styles.aiCountText}>{encounterAI.diagnoses.length}</Text>
                </View>
              </View>
              {encounterAI.diagnoses.map((diag: any, idx: number) => (
                <View key={idx} style={styles.aiItem}>
                  <Text style={styles.aiItemText}>{diag.diagnosis_text || diag.code || diag.name || diag.description}</Text>
                  {diag.status && <Text style={styles.aiItemSubtext}>Status: {diag.status}</Text>}
                </View>
              ))}
            </View>
          )}

          {hasMedications && (
            <View style={styles.aiSubsection}>
              <View style={styles.aiSubsectionHeader}>
                <FontAwesome name="medkit" size={14} color={theme.colors.white} />
                <Text style={styles.aiSubsectionTitle}>Medicações AI</Text>
                <View style={styles.aiCountBadge}>
                  <Text style={styles.aiCountText}>{encounterAI.medications.length}</Text>
                </View>
              </View>
              {encounterAI.medications.map((med: any, idx: number) => (
                <View key={idx} style={styles.aiItem}>
                  <Text style={styles.aiItemText}>{med.medication_text || med.name || med.productName}</Text>
                  {med.dosage && <Text style={styles.aiItemSubtext}>Dosagem: {med.dosage}</Text>}
                </View>
              ))}
            </View>
          )}

          {hasLabs && (
            <View style={styles.aiSubsection}>
              <View style={styles.aiSubsectionHeader}>
                <FontAwesome name="flask" size={14} color={theme.colors.white} />
                <Text style={styles.aiSubsectionTitle}>Resultados de Laboratório AI</Text>
                <View style={styles.aiCountBadge}>
                  <Text style={styles.aiCountText}>{encounterAI.labs.length}</Text>
                </View>
              </View>
              {encounterAI.labs.map((lab: any, idx: number) => (
                <View key={idx} style={styles.aiItem}>
                  <Text style={styles.aiItemText}>{lab.lab_text || lab.name || lab.test}</Text>
                  {lab.result && <Text style={styles.aiItemSubtext}>Resultado: {lab.result}</Text>}
                </View>
              ))}
            </View>
          )}

          {hasProcedures && (
            <View style={styles.aiSubsection}>
              <View style={styles.aiSubsectionHeader}>
                <FontAwesome name="plus-square" size={14} color={theme.colors.white} />
                <Text style={styles.aiSubsectionTitle}>Procedimentos AI</Text>
                <View style={styles.aiCountBadge}>
                  <Text style={styles.aiCountText}>{encounterAI.procedures.length}</Text>
                </View>
              </View>
              {encounterAI.procedures.map((proc: any, idx: number) => (
                <View key={idx} style={styles.aiItem}>
                  <Text style={styles.aiItemText}>{proc.procedure_text || proc.name || proc.description}</Text>
                </View>
              ))}
            </View>
          )}
            </>
          )}
        </View>
      </View>
    );
  };

  const renderClinicalNotes = () => {
    const noteSource =
      (encounterInfo as any)?.Note ??
      (encounterInfo as any)?.note ??
      (encounterInfo as any)?.encounter?.Note ??
      (encounterInfo as any)?.encounter?.note ??
      encounterDetails?.encounter?.Note ??
      encounterDetails?.encounter?.note ??
      encounterSummary?.note ??
      encounterSummary?.clinicalNote ??
      null;

    const formattedNote = (quillDeltaToPlainText(noteSource) || '').trim();

    return (
      <View style={styles.section}>
        {renderSectionHeader('Notas Clínicas', 'file-text-o')}
        <View style={styles.sectionContent}>
          {formattedNote ? (
            <Text style={styles.notesText}>{formattedNote}</Text>
          ) : (
            <Text style={styles.emptyMessage}>Nenhuma nota clínica disponível</Text>
          )}
        </View>
      </View>
    );
  };

  const renderClinicalRecords = () => {
    const records = encounterDetails?.clinicalRecords || [];

    return (
      <View style={styles.section}>
        {renderSectionHeader(`Registros Clínicos (${records.length})`, 'file-text')}
        <View style={styles.sectionContent}>
          {records.length === 0 ? (
            <Text style={styles.emptyMessage}>Nenhum registro clínico disponível</Text>
          ) : (
            records.map((record: any, index: number) => {
            const typeLabel = translateClinicalType(record.clinicalType) || translateClinicalType(record.type) || 'Registro Clínico';
            const statusLabel = translateClinicalStatus(record.clinicalStatus) || record.clinicalStatus || null;
            const recordId = record.clinicalId || record.identifier || record.id || `registro-${index}`;

            return (
              <TouchableOpacity
                key={recordId}
                style={styles.itemCard}
                activeOpacity={0.85}
                onPress={() => handleClinicalRecordPress(record)}
              >
                <View style={styles.itemHeader}>
                  <FontAwesome name="file-text-o" size={14} color={theme.colors.info} />
                  <Text style={styles.itemTitle}>{typeLabel} #{recordId}</Text>
                </View>
                {record.clinicalDate && (
                  <Text style={styles.itemDate}>{formatDateTime(record.clinicalDate)}</Text>
                )}
                {statusLabel && (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{statusLabel}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
            })
          )}
        </View>
      </View>
    );
  };

  const renderPrescriptions = () => {
    const medications = encounterDetails?.medications || [];

    return (
      <View style={styles.section}>
        {renderSectionHeader(`Prescrições (${medications.length})`, 'medkit')}
        <View style={styles.sectionContent}>
          {medications.length === 0 ? (
            <Text style={styles.emptyMessage}>Nenhuma prescrição disponível</Text>
          ) : (
            medications.map((med: any, index: number) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <FontAwesome name="medkit" size={14} color={theme.colors.success} />
                <Text style={styles.itemTitle}>Prescrição #{med.medId}</Text>
              </View>
              <Text style={styles.itemDate}>{formatDateTime(med.medDate)}</Text>
              {med.medRequestItens && med.medRequestItens.length > 0 && (
                <View style={styles.medicationItems}>
                  {med.medRequestItens.map((item: any, itemIndex: number) => (
                    <View key={itemIndex} style={styles.medicationItem}>
                      <Text style={styles.medicationName}>{item.productName}</Text>
                      {item.posology && <Text style={styles.medicationDosage}>Posologia: {item.posology}</Text>}
                    </View>
                  ))}
                </View>
              )}
            </View>
            ))
          )}
        </View>
      </View>
    );
  };

  const renderDiagnostics = () => {
    const diagnostics = encounterDetails?.diagnostics || [];

    return (
      <View style={styles.section}>
        {renderSectionHeader(`Diagnósticos e Exames (${diagnostics.length})`, 'flask')}
        <View style={styles.sectionContent}>
          {diagnostics.length === 0 ? (
            <Text style={styles.emptyMessage}>Nenhum diagnóstico disponível</Text>
          ) : (
            diagnostics.map((diag: any, index: number) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <FontAwesome name="stethoscope" size={14} color={theme.colors.warning} />
                <Text style={styles.itemTitle}>Diagnóstico #{diag.identifier}</Text>
              </View>
              <Text style={styles.itemDate}>{formatDateTime(diag.effectiveDateTime)}</Text>
              {diag.conclusion && (
                <View style={styles.conclusionContainer}>
                  <Text style={styles.conclusionText}>{diag.conclusion}</Text>
                </View>
              )}
            </View>
            ))
          )}
        </View>
      </View>
    );
  };

  const renderImages = () => {
    const images = encounterDetails?.images || [];

    return (
      <View style={styles.section}>
        {renderSectionHeader(`Imagens (${images.length})`, 'picture-o')}
        <View style={styles.sectionContent}>
          {images.length === 0 ? (
            <Text style={styles.emptyMessage}>Nenhuma imagem disponível</Text>
          ) : (
            images.map((image: any, index: number) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <FontAwesome name="picture-o" size={14} color={theme.colors.primary} />
                <Text style={styles.itemTitle}>{image.title || image.file}</Text>
              </View>
              <Text style={styles.itemDate}>{formatDateTime(image.date)}</Text>
              {image.description && <Text style={styles.imageDescription}>{image.description}</Text>}
            </View>
            ))
          )}
        </View>
      </View>
    );
  };

  const renderAttachments = () => {
    const attachments = encounterDetails?.attachments || [];

    return (
      <View style={styles.section}>
        {renderSectionHeader(`Anexos (${attachments.length})`, 'paperclip')}
        <View style={styles.sectionContent}>
          {attachments.length === 0 ? (
            <Text style={styles.emptyMessage}>Nenhum anexo disponível</Text>
          ) : (
            attachments.map((attachment: any, index: number) => (
            <TouchableOpacity
              key={index}
              style={styles.itemCard}
              onPress={() => handleAttachmentPress(attachment)}
            >
              <View style={styles.itemHeader}>
                <FontAwesome name="paperclip" size={14} color={theme.colors.textSecondary} />
                <Text style={styles.itemTitle}>Anexo #{attachment.identifier}</Text>
                {attachment.externallink && (
                  <FontAwesome name="external-link" size={11} color={theme.colors.primary} />
                )}
              </View>
              <Text style={styles.itemDate}>{formatDateTime(attachment.date)}</Text>
              {attachment.filetype && <Text style={styles.itemFileType}>Formato: {attachment.filetype}</Text>}
            </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    );
  };

  const renderRecordings = () => {
    return (
      <View style={styles.section}>
        {renderSectionHeader(`Gravações (${recordings.length})`, 'microphone')}
        <View style={styles.sectionContent}>
          {recordings.length === 0 ? (
            <Text style={styles.emptyMessage}>Nenhuma gravação disponível</Text>
          ) : (
            recordings.map((recording: any, index: number) => (
            <TouchableOpacity
              key={index}
              style={styles.itemCard}
              onPress={() => handleAttachmentPress(recording)}
            >
              <View style={styles.itemHeader}>
                <FontAwesome name="microphone" size={14} color={theme.colors.primary} />
                <Text style={styles.itemTitle}>{recording.title || `Gravação ${index + 1}`}</Text>
                {recording.url && <FontAwesome name="play" size={11} color={theme.colors.primary} />}
              </View>
              {recording.date && <Text style={styles.itemDate}>{formatDateTime(recording.date)}</Text>}
              {recording.duration && (
                <Text style={styles.itemStatus}>Duração: {formatDurationLabel(recording.duration)}</Text>
              )}
              {recording.transcript && (
                <View style={styles.transcriptContainer}>
                  <Text style={styles.transcriptLabel}>Transcrição:</Text>
                  <Text style={styles.transcriptText} numberOfLines={3}>{recording.transcript}</Text>
                </View>
              )}
            </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    );
  };

  // Loading state
  if (loading) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
        <View style={styles.loadingContainer}>
          <Image
            source={require('../../assets/medpro-logo.png')}
            style={styles.loadingLogo}
            resizeMode="contain"
          />
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loadingSpinner} />
          <Text style={styles.loadingText}>Carregando detalhes do encontro...</Text>
        </View>
      </>
    );
  }

  // Main render with vertical sections
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerBackground}>
          <Image
            source={require('../../assets/medpro-logo.png')}
            style={styles.backgroundLogo}
            resizeMode="contain"
          />
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Encontro #{encounterId}</Text>
              <Text style={styles.headerSubtitle}>{patientName}</Text>
              {(() => {
                const encounterRecord = encounterInfo || encounterDetails?.encounter;
                if (!encounterRecord) return null;

                const startIso =
                  encounterRecord.actualStart ||
                  encounterRecord.startDate ||
                  encounterRecord.startdate ||
                  encounterRecord.encounterDate ||
                  encounterRecord.encounterdate;

                const dateLabel = formatDateLabel(startIso || encounterRecord.date);
                const timeLabel = formatTimeLabel(startIso, encounterRecord.actualEnd || encounterRecord.endDate);

                return (
                  <View style={styles.headerMetaRow}>
                    {dateLabel && (
                      <View style={styles.headerMetaItem}>
                        <FontAwesome name="calendar" size={11} color={theme.colors.white} />
                        <Text style={styles.headerMetaText}>{dateLabel}</Text>
                      </View>
                    )}
                    {timeLabel && (
                      <View style={styles.headerMetaItem}>
                        <FontAwesome name="clock-o" size={11} color={theme.colors.white} />
                        <Text style={styles.headerMetaText}>{timeLabel}</Text>
                      </View>
                    )}
                  </View>
                );
              })()}
            </View>
          </View>
        </View>

        {/* Vertical Scrolling Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {renderPatientInfo()}
          {renderEncounterDetails()}
          {renderServices()}
          {renderAISummary()}
          {renderAIFindings()}
          {renderClinicalNotes()}
          {renderClinicalRecords()}
          {renderPrescriptions()}
          {renderDiagnostics()}
          {renderImages()}
          {renderAttachments()}
          {renderRecordings()}
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
    right: -40,
    width: 180,
    height: 180,
    opacity: 0.12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 6,
  },
  headerMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  headerMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  headerMetaText: {
    fontSize: 12,
    color: theme.colors.white,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 32,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  sectionContent: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  patientCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  patientAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.backgroundSecondary,
    overflow: 'hidden',
  },
  patientInfo: {
    flex: 1,
    gap: 4,
  },
  patientNameText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  patientMeta: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  patientCpf: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  dataItem: {
    width: '47%',
    gap: 4,
  },
  dataLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  dataValue: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '400',
  },
  serviceItem: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  serviceItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  serviceDetailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serviceDetailText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  aiSection: {
    backgroundColor: theme.colors.info + '10',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.info,
  },
  aiSummaryText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  aiSubsection: {
    marginBottom: 16,
  },
  aiSubsectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.info,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  aiSubsectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.white,
    flex: 1,
  },
  aiCountBadge: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  aiCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.info,
  },
  aiItem: {
    backgroundColor: theme.colors.surface,
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.info,
  },
  aiItemText: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '500',
  },
  aiItemSubtext: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  notesText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  itemCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  itemDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  itemStatus: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  itemFileType: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    color: theme.colors.white,
    fontWeight: '500',
  },
  statusBadgeContainer: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 4,
  },
  statusBadgeTextSmall: {
    fontSize: 12,
    color: theme.colors.white,
    fontWeight: '600',
  },
  statusBadgeSuccess: {
    backgroundColor: theme.colors.success,
  },
  statusBadgeInfo: {
    backgroundColor: theme.colors.info,
  },
  statusBadgeWarning: {
    backgroundColor: theme.colors.warning,
  },
  statusBadgeError: {
    backgroundColor: theme.colors.error,
  },
  statusBadgeNeutral: {
    backgroundColor: theme.colors.textSecondary,
  },
  medicationItems: {
    gap: 8,
    marginTop: 8,
  },
  medicationItem: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: 10,
    borderRadius: 6,
  },
  medicationName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  medicationDosage: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  conclusionContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 6,
  },
  conclusionText: {
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18,
  },
  imageDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  transcriptContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 6,
  },
  transcriptLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 12,
    color: theme.colors.text,
    lineHeight: 16,
  },
  emptyMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
});
