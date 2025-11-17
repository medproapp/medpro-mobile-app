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
import {
  translateClinicalType,
  translateClinicalStatus,
  translateClinicalCategory,
  formatClinicalDateTime,
  getStatusBadgeStyle,
} from '@/utils/clinical';

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
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
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

  const [encounterDetails, setEncounterDetails] = useState<EncounterDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'general' | 'notes' | 'clinical' | 'medications' | 'diagnostics' | 'images' | 'attachments' | 'recordings' | 'documents' | 'summaries' | 'ai'
  >('general');
  const [patientOverview, setPatientOverview] = useState<PatientOverview | null>(null);
  const [patientDetails, setPatientDetails] = useState<PatientDetails>(null);
  const [encounterInfo, setEncounterInfo] = useState<EncounterInfo>(null);
  const [encounterServices, setEncounterServices] = useState<EncounterServicesData | null>(null);
  const [encounterServicesError, setEncounterServicesError] = useState<string | null>(null);
  const [encounterFinancials, setEncounterFinancials] = useState<EncounterFinancialsData | null>(null);
  const [encounterFinancialsError, setEncounterFinancialsError] = useState<string | null>(null);

  const loadEncounterDetails = async () => {
    try {
      console.log('[EncounterDetails] Loading details for encounter:', encounterId);
      
      // Load all encounter data in parallel - handle errors gracefully
      const [clinicalResponse, medicationResponse, diagnosticResponse, imageResponse, attachmentResponse] = await Promise.allSettled([
        api.getEncounterClinicalRecords(encounterId, { limit: 50 }).catch(() => ({ data: [] })),
        api.getEncounterMedications('', encounterId, { limit: 50 }).catch(() => ({ data: [] })), // CPF not needed for this call
        api.getEncounterDiagnostics(encounterId).catch(() => []),
        api.getEncounterImages(encounterId).catch(() => []),
        api.getEncounterAttachments(encounterId).catch(() => []),
      ]);

      if (clinicalResponse.status === 'fulfilled') {
        console.log('[EncounterDetails] Raw clinical records response:', JSON.stringify(clinicalResponse.value, null, 2));
      } else {
        console.error('[EncounterDetails] Clinical records request failed:', clinicalResponse.reason);
      }

      if (medicationResponse.status === 'fulfilled') {
        console.log('[EncounterDetails] Raw medications response:', JSON.stringify(medicationResponse.value, null, 2));
      } else {
        console.error('[EncounterDetails] Medications request failed:', medicationResponse.reason);
      }

      if (diagnosticResponse.status === 'fulfilled') {
        console.log('[EncounterDetails] Raw diagnostics response:', JSON.stringify(diagnosticResponse.value, null, 2));
      } else {
        console.error('[EncounterDetails] Diagnostics request failed:', diagnosticResponse.reason);
      }

      if (imageResponse.status === 'fulfilled') {
        console.log('[EncounterDetails] Raw images response:', JSON.stringify(imageResponse.value, null, 2));
      } else {
        console.error('[EncounterDetails] Images request failed:', imageResponse.reason);
      }

      if (attachmentResponse.status === 'fulfilled') {
        console.log('[EncounterDetails] Raw attachments response:', JSON.stringify(attachmentResponse.value, null, 2));
      } else {
        console.error('[EncounterDetails] Attachments request failed:', attachmentResponse.reason);
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

      console.log('[EncounterDetails] Loaded encounter details:', {
        clinical: clinicalRecords.length,
        medications: medications.length,
        diagnostics: diagnostics.length,
        images: images.length,
        attachments: attachments.length,
      });
      console.log('[EncounterDetails] Encounter record fields:', encounter ? Object.keys(encounter) : []);

      setEncounterDetails(details);
    } catch (error) {
      console.error('[EncounterDetails] Error loading encounter details:', error);
      Alert.alert('Erro', 'Não foi possível carregar os detalhes do encontro');
    }
  };

  const loadPatientOverview = async () => {
    if (!patientCpf) {
      setPatientOverview(null);
      return;
    }

    try {
      console.log('[EncounterDetails] Loading patient overview for CPF:', patientCpf);
      const response = await api.getPatientLastEncounterSummary(patientCpf, encounterId);
      setPatientOverview({
        total: response?.total ?? 0,
        lastEncounter: response?.data || null,
      });
    } catch (error) {
      console.error('[EncounterDetails] Error loading patient overview:', error);
      setPatientOverview(null);
    }
  };

  const loadPatientDetails = async () => {
    if (!patientCpf) {
      setPatientDetails(null);
      return;
    }

    try {
      console.log('[EncounterDetails] Loading patient details for CPF:', patientCpf);
      const response = await api.getPatientDetails(patientCpf);
      console.log('[EncounterDetails] Raw patient details response:', JSON.stringify(response, null, 2));
      const raw = response?.data ?? response;
      setPatientDetails(raw || null);
    } catch (error) {
      console.error('[EncounterDetails] Error loading patient details:', error);
      setPatientDetails(null);
    }
  };

  const loadEncounterInfo = async () => {
    try {
      console.log('[EncounterDetails] Loading encounter info row for:', encounterId);
      const response = await api.getEncounterInfoById(encounterId);
      console.log('[EncounterDetails] Raw encounter info response:', JSON.stringify(response, null, 2));
      const info = Array.isArray(response)
        ? response[0]
        : Array.isArray(response?.data)
          ? response.data[0]
          : response?.data ?? response;
      setEncounterInfo(info || null);
    } catch (error) {
      console.error('[EncounterDetails] Error loading encounter info:', error);
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
      console.log('[EncounterDetails] Loading encounter services for:', encounterId);
      setEncounterServicesError(null);
      const response = await api.getEncounterServices(encounterId);
      console.log('[EncounterDetails] Raw encounter services response:', JSON.stringify(response, null, 2));

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

      console.log('[EncounterDetails] Encounter services payload extracted:', JSON.stringify(payload, null, 2));

      if (!payload) {
        console.warn('[EncounterDetails] Encounter services payload empty, using fallback.');
        setEncounterServices(normalizeEncounterServicesData({ services: [] }));
        return;
      }

      const normalized = normalizeEncounterServicesData(payload);
      console.log('[EncounterDetails] Encounter services normalized data:', JSON.stringify(normalized, null, 2));
      setEncounterServices(normalized);
    } catch (error) {
      console.error('[EncounterDetails] Error loading encounter services:', error);
      const rawMessage = error instanceof Error ? error.message : '';
      let normalizedMessage = 'Não foi possível carregar os serviços agendados.';

      if (rawMessage.includes('Encounter not found')) {
        console.warn('[EncounterDetails] Encounter services request returned encounter not found.');
        normalizedMessage = 'Encontro não encontrado.';
      } else if (rawMessage.includes('Appointment not found')) {
        console.warn('[EncounterDetails] Encounter services request returned appointment not found.');
        normalizedMessage = 'Nenhum agendamento associado ao encontro.';
      }

      setEncounterServices(null);
      setEncounterServicesError(normalizedMessage);
    }
  };

  const loadEncounterFinancials = async () => {
    try {
      console.log('[EncounterDetails] Loading encounter financials for:', encounterId);
      setEncounterFinancialsError(null);
      const response = await api.getEncounterFinancials(encounterId);
      console.log('[EncounterDetails] Raw encounter financials response:', JSON.stringify(response, null, 2));

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

      console.log('[EncounterDetails] Encounter financials payload extracted:', JSON.stringify(payload, null, 2));

      if (!payload) {
        console.warn('[EncounterDetails] Encounter financials payload empty, using fallback.');
        setEncounterFinancials(normalizeEncounterFinancialsData({ selectedServices: [], totals: {} }));
        return;
      }

      const normalized = normalizeEncounterFinancialsData(payload);
      console.log('[EncounterDetails] Encounter financials normalized data:', JSON.stringify(normalized, null, 2));
      setEncounterFinancials(normalized);
    } catch (error) {
      console.error('[EncounterDetails] Error loading encounter financials:', error);
      const rawMessage = error instanceof Error ? error.message : '';
      let normalizedMessage = 'Não foi possível carregar o resumo financeiro.';

      if (rawMessage.includes('Encounter not found')) {
        console.warn('[EncounterDetails] Encounter financials request returned encounter not found.');
        normalizedMessage = 'Encontro não encontrado.';
      } else if (rawMessage.includes('Appointment not found')) {
        console.warn('[EncounterDetails] Encounter financials request returned appointment not found.');
        normalizedMessage = 'Nenhum agendamento associado ao encontro.';
      }

      setEncounterFinancials(null);
      setEncounterFinancialsError(normalizedMessage);
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

  const renderTabContent = () => {
    if (!encounterDetails) return null;

    switch (activeTab) {
      case 'general': {
        const details = patientDetails || {};
        const totalEncounters = patientOverview?.total;
        const name = details.name || details.fullName || details.patientName || patientName;
        const genderLabel = formatGenderLabel(details.gender || details.patientGender);
        const birthDate = details.birthdate || details.patientBirthDate;
        const age = calculateAge(birthDate);
        const metaParts: string[] = [];
        if (genderLabel) metaParts.push(genderLabel);
        if (typeof age === 'number') metaParts.push(`${age} ${age === 1 ? 'ano' : 'anos'}`);
        const metaLine = metaParts.join(' • ');
        const appointmentStatusLabel = formatStatusLabel(encounterServices?.appointmentStatus);

        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Dados Gerais</Text>
            <View style={styles.generalGrid}>
              <View style={[styles.generalCard, styles.patientCard]}>
                <View style={styles.patientCardHeader}>
                  <CachedImage
                    uri={patientCpf ? `${API_BASE_URL}/patient/getpatientphoto?patientCpf=${patientCpf}` : undefined}
                    style={styles.patientAvatar}
                    fallbackIcon="user"
                    fallbackIconSize={30}
                    fallbackIconColor={theme.colors.white}
                  />
                  <View style={styles.patientInfo}>
                    {name ? <Text style={styles.patientNameText}>{name}</Text> : null}
                    {metaLine ? <Text style={styles.patientMeta}>{metaLine}</Text> : null}
                  </View>
                </View>

                {typeof totalEncounters === 'number' && (
                  <View style={styles.patientBadges}>
                    <View style={styles.patientBadge}>
                      <FontAwesome name="calendar" size={12} color={theme.colors.primary} />
                      <View>
                        <Text style={styles.patientBadgeLabel}>Total de encontros</Text>
                        <Text style={styles.patientBadgeValue}>
                          {totalEncounters} encontro{totalEncounters === 1 ? '' : 's'}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.generalCard}>
                <Text style={styles.generalCardTitle}>Serviços Agendados</Text>
                {encounterServicesError ? (
                  <Text style={styles.generalError}>{encounterServicesError}</Text>
                ) : !encounterServices ? (
                  <Text style={styles.generalPlaceholder}>Carregando serviços...</Text>
                ) : (
                  <>
                    {(encounterServices.appointmentId || appointmentStatusLabel || encounterServices.serviceCategory || encounterServices.serviceType) && (
                      <View style={styles.servicesMetaRow}>
                        {encounterServices.appointmentId && (
                          <View style={[styles.serviceBadge, styles.serviceBadgeNeutral]}>
                            <FontAwesome name="bookmark" size={12} color={theme.colors.primary} />
                            <Text style={styles.serviceBadgeText}>Atendimento #{encounterServices.appointmentId}</Text>
                          </View>
                        )}
                        {appointmentStatusLabel && (
                          <View style={[styles.serviceBadge, styles.serviceBadgeStatus]}>
                            <FontAwesome name="info-circle" size={12} color={theme.colors.white} />
                            <Text style={[styles.serviceBadgeText, styles.serviceBadgeTextOnDark]}>{appointmentStatusLabel}</Text>
                          </View>
                        )}
                        {encounterServices.serviceCategory && (
                          <View style={[styles.serviceBadge, styles.serviceBadgeOutline]}>
                            <FontAwesome name="tags" size={12} color={theme.colors.primary} />
                            <Text style={styles.serviceBadgeText}>{encounterServices.serviceCategory}</Text>
                          </View>
                        )}
                        {encounterServices.serviceType && (
                          <View style={[styles.serviceBadge, styles.serviceBadgeOutline]}>
                            <FontAwesome name="briefcase" size={12} color={theme.colors.primary} />
                            <Text style={styles.serviceBadgeText}>{encounterServices.serviceType}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {encounterServices.services.length === 0 ? (
                      <Text style={styles.generalPlaceholder}>Nenhum serviço associado ao encontro.</Text>
                    ) : (
                      <View style={styles.servicesList}>
                        {encounterServices.services.map((service, index) => {
                          const priceLabel = formatCurrencyBRL(service.price);
                          const durationLabel = formatDurationMinutesLabel(service.duration || service.durationMinutes);
                          const professionalLabel = service.professional || service.providerName || service.professionalName || service.practitioner;

                          return (
                            <View key={service.id || `${service.name || 'service'}-${index}`} style={styles.serviceItem}>
                              <View style={styles.serviceItemHeader}>
                                <FontAwesome name="stethoscope" size={16} color={theme.colors.primary} />
                                <Text style={styles.serviceName}>{service.name || 'Serviço sem nome'}</Text>
                              </View>
                              <View style={styles.serviceDetailRow}>
                                {priceLabel && (
                                  <View style={styles.serviceDetailItem}>
                                    <FontAwesome name="money" size={12} color={theme.colors.textSecondary} />
                                    <Text style={styles.serviceDetailText}>{priceLabel}</Text>
                                  </View>
                                )}
                                {durationLabel && (
                                  <View style={styles.serviceDetailItem}>
                                    <FontAwesome name="clock-o" size={12} color={theme.colors.textSecondary} />
                                    <Text style={styles.serviceDetailText}>{durationLabel}</Text>
                                  </View>
                                )}
                                {professionalLabel && (
                                  <View style={styles.serviceDetailItem}>
                                    <FontAwesome name="user-md" size={12} color={theme.colors.textSecondary} />
                                    <Text style={styles.serviceDetailText}>{professionalLabel}</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}
              </View>

              <View style={styles.generalCard}>
                <Text style={styles.generalCardTitle}>Resumo Financeiro</Text>
                {encounterFinancialsError ? (
                  <Text style={styles.generalError}>{encounterFinancialsError}</Text>
                ) : !encounterFinancials ? (
                  <Text style={styles.generalPlaceholder}>Carregando resumo financeiro...</Text>
                ) : (
                  <>
                    {(() => {
                      const badges: React.ReactNode[] = [];
                      const paymentTypeLabel = formatStatusLabel(encounterFinancials.paymentType);
                      const carePlanCode = encounterFinancials.selectedPatientCarePlanCode;
                      const planId = encounterFinancials.selectedPractCarePlanIdForAppointment;

                      if (paymentTypeLabel) {
                        badges.push(
                          <View key="payment-type" style={[styles.serviceBadge, styles.serviceBadgeNeutral]}>
                            <FontAwesome name="credit-card" size={12} color={theme.colors.primary} />
                            <Text style={styles.serviceBadgeText}>{paymentTypeLabel}</Text>
                          </View>
                        );
                      }

                      if (carePlanCode) {
                        badges.push(
                          <View key="care-plan" style={[styles.serviceBadge, styles.serviceBadgeOutline]}>
                            <FontAwesome name="shield" size={12} color={theme.colors.primary} />
                            <Text style={styles.serviceBadgeText}>Plano {carePlanCode}</Text>
                          </View>
                        );
                      }

                      if (planId) {
                        badges.push(
                          <View key="care-plan-id" style={[styles.serviceBadge, styles.serviceBadgeOutline]}>
                            <FontAwesome name="id-card" size={12} color={theme.colors.primary} />
                            <Text style={styles.serviceBadgeText}>ID Plano #{planId}</Text>
                          </View>
                        );
                      }

                      if (badges.length === 0) return null;
                      return <View style={styles.servicesMetaRow}>{badges}</View>;
                    })()}

                    {(() => {
                      const totals = encounterFinancials.totals;
                      if (!totals) {
                        return <Text style={styles.generalPlaceholder}>Totais indisponíveis.</Text>;
                      }

                      const totalServicesLabel = formatCurrencyBRL(totals.totalServicesAmount) ?? '—';
                      const directPayLabel = formatCurrencyBRL(totals.directPayAmount) ?? '—';
                      const planCoveredLabel = formatCurrencyBRL(totals.planCoveredAmount) ?? '—';
                      const uncoveredLabel = formatCurrencyBRL(totals.uncoveredAmount) ?? '—';
                      const pendingDecisionLabel = typeof totals.pendingDecisionCount === 'number'
                        ? `${totals.pendingDecisionCount}`
                        : '—';

                      return (
                        <View style={styles.financialTotalsGrid}>
                          <View style={styles.financialTotalCard}>
                            <Text style={styles.financialTotalLabel}>Total de Serviços</Text>
                            <Text style={styles.financialTotalValue}>{totalServicesLabel}</Text>
                          </View>
                          <View style={styles.financialTotalCard}>
                            <Text style={styles.financialTotalLabel}>Pago Diretamente</Text>
                            <Text style={styles.financialTotalValue}>{directPayLabel}</Text>
                          </View>
                          <View style={styles.financialTotalCard}>
                            <Text style={styles.financialTotalLabel}>Coberto pelo Plano</Text>
                            <Text style={styles.financialTotalValue}>{planCoveredLabel}</Text>
                          </View>
                          <View style={styles.financialTotalCard}>
                            <Text style={styles.financialTotalLabel}>Não Coberto</Text>
                            <Text style={styles.financialTotalValue}>{uncoveredLabel}</Text>
                          </View>
                          <View style={styles.financialTotalCard}>
                            <Text style={styles.financialTotalLabel}>Pendências</Text>
                            <Text style={styles.financialTotalValue}>{pendingDecisionLabel}</Text>
                          </View>
                        </View>
                      );
                    })()}

                    {(() => {
                      const coverage = encounterFinancials.servicesCoverageStatus || [];
                      if (!coverage.length) {
                        const selectedServicesCount = encounterFinancials.selectedServices?.length || 0;
                        if (selectedServicesCount > 0) {
                          return (
                            <Text style={styles.generalPlaceholder}>
                              Nenhuma informação de cobertura registrada para os {selectedServicesCount} serviço(s).
                            </Text>
                          );
                        }
                        return <Text style={styles.generalPlaceholder}>Nenhum serviço financeiro vinculado.</Text>;
                      }

                      return (
                        <View style={styles.coverageList}>
                          {coverage.map((item, index) => {
                            const paymentChoice = (item.chosenPayment || '').toLowerCase();
                            let badgeStyle = styles.coverageBadgeNeutral;
                            let badgeIcon: string = 'question-circle';
                            let badgeText = 'Pagamento indefinido';
                            let badgeTextColor = theme.colors.primary;
                            let badgeIconColor = theme.colors.primary;

                            if (paymentChoice === 'plan') {
                              badgeStyle = styles.coverageBadgePlan;
                              badgeIcon = 'shield';
                              badgeText = 'Plano de saúde';
                              badgeTextColor = theme.colors.white;
                              badgeIconColor = theme.colors.white;
                            } else if (paymentChoice === 'direct_pay' || paymentChoice === 'direct') {
                              badgeStyle = styles.coverageBadgeDirect;
                              badgeIcon = 'money';
                              badgeText = 'Pagamento direto';
                            } else if (paymentChoice === 'pending' || paymentChoice === 'decision_pending') {
                              badgeStyle = styles.coverageBadgePending;
                              badgeIcon = 'hourglass-half';
                              badgeText = 'Decisão pendente';
                              badgeTextColor = theme.colors.warning;
                              badgeIconColor = theme.colors.warning;
                            } else if (item.isCoveredByPlan) {
                              badgeStyle = styles.coverageBadgePlan;
                              badgeIcon = 'shield';
                              badgeText = 'Coberto pelo plano';
                              badgeTextColor = theme.colors.white;
                              badgeIconColor = theme.colors.white;
                            }

                            const priceLabel = formatCurrencyBRL(item.price);

                            return (
                              <View key={item.serviceId || item.serviceName || index} style={styles.coverageItem}>
                                <View style={styles.coverageHeader}>
                                  <View style={styles.coverageTitleRow}>
                                    <FontAwesome name="file-text-o" size={14} color={theme.colors.primary} />
                                    <Text style={styles.coverageServiceName}>{item.serviceName || 'Serviço'}</Text>
                                  </View>
                                  <View style={[styles.coverageBadge, badgeStyle]}>
                                    <FontAwesome name={badgeIcon} size={11} color={badgeIconColor} />
                                    <Text style={[styles.coverageBadgeText, badgeStyle === styles.coverageBadgePlan && styles.coverageBadgeTextOnDark, { color: badgeTextColor }]}>
                                      {badgeText}
                                    </Text>
                                  </View>
                                </View>
                                <View style={styles.coverageDetails}>
                                  {priceLabel && (
                                    <View style={styles.coverageDetailItem}>
                                      <FontAwesome name="money" size={11} color={theme.colors.textSecondary} />
                                      <Text style={styles.coverageDetailText}>{priceLabel}</Text>
                                    </View>
                                  )}
                                  {typeof item.isCoveredByPlan === 'boolean' && (
                                    <View style={styles.coverageDetailItem}>
                                      <FontAwesome name={item.isCoveredByPlan ? 'check-circle' : 'times-circle'} size={11} color={item.isCoveredByPlan ? theme.colors.success : theme.colors.error} />
                                      <Text style={styles.coverageDetailText}>
                                        {item.isCoveredByPlan ? 'Coberto pelo plano' : 'Não coberto pelo plano'}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })()}
                  </>
                )}
              </View>
            </View>
          </View>
        );
      }
      
      case 'notes':
        const noteSource =
          (encounterInfo as any)?.Note ??
          (encounterInfo as any)?.note ??
          (encounterInfo as any)?.encounter?.Note ??
          (encounterInfo as any)?.encounter?.note ??
          encounterDetails.encounter?.Note ??
          encounterDetails.encounter?.note ??
          null;
        const formattedNote = (quillDeltaToPlainText(noteSource) || '').trim();

        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Notas</Text>
            {encounterDetails.encounter?.shortAISummary ? (
              <View style={styles.notesCard}>
                <Text style={styles.notesTitle}>Resumo IA</Text>
                <Text style={styles.notesText}>{encounterDetails.encounter.shortAISummary}</Text>
              </View>
            ) : null}

            {formattedNote ? (
              <View style={styles.notesCard}>
                <Text style={styles.notesText}>{formattedNote}</Text>
              </View>
            ) : (
              !encounterDetails.encounter?.shortAISummary && (
                <Text style={styles.emptyMessage}>Nenhuma nota disponível</Text>
              )
            )}
          </View>
        );

      case 'clinical':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Registros Clínicos ({encounterDetails.clinicalRecords.length})</Text>
            {encounterDetails.clinicalRecords.length > 0 ? (
              encounterDetails.clinicalRecords.map((record: any, index: number) => {
                const typeLabel = translateClinicalType(record.clinicalType) || translateClinicalType(record.type) || 'Registro Clínico';
                const statusLabel = translateClinicalStatus(record.clinicalStatus) || record.clinicalStatus || null;
                const categoryLabel = translateClinicalCategory(
                  record.clinicalMetadata?.servicerequestCategory ||
                  record.clinicalMetadata?.category ||
                  record.category
                );
                const recordId = record.clinicalId || record.identifier || record.id || `registro-${index}`;
                const rawStatus = (record.clinicalStatus || record.status || '').toString().trim().toLowerCase();

                const badges: Array<{
                  key: string;
                  label: string;
                  icon: string;
                  containerStyle: any[];
                  textStyle: any[];
                  iconColor: string;
                }> = [];

                if (typeLabel) {
                  badges.push({
                    key: 'type',
                    label: typeLabel,
                    icon: 'tag',
                    containerStyle: [styles.clinicalBadge, styles.clinicalBadgeInfo],
                    textStyle: [styles.clinicalBadgeText, styles.clinicalBadgeTextOnDark],
                    iconColor: theme.colors.white,
                  });
                }

                if (statusLabel) {
                  const statusBadge = getStatusBadgeStyle(rawStatus);

                  badges.push({
                    key: 'status',
                    label: statusLabel,
                    icon: statusBadge.icon,
                    containerStyle: [styles.clinicalBadge, statusBadge.container],
                    textStyle: [styles.clinicalBadgeText, { color: statusBadge.textColor }],
                    iconColor: statusBadge.iconColor,
                  });
                }

                if (categoryLabel) {
                  badges.push({
                    key: 'category',
                    label: categoryLabel,
                    icon: 'folder-open',
                    containerStyle: [styles.clinicalBadge, styles.clinicalBadgeNeutral],
                    textStyle: [styles.clinicalBadgeText],
                    iconColor: theme.colors.primary,
                  });
                }

                return (
                  <TouchableOpacity
                    key={recordId}
                    style={styles.itemCard}
                    activeOpacity={0.85}
                    onPress={() => handleClinicalRecordPress(record)}
                  >
                    <View style={styles.itemHeader}>
                      <FontAwesome name="file-text-o" size={16} color={theme.colors.info} />
                      <Text style={styles.itemTitle}>
                        {typeLabel} #{recordId}
                      </Text>
                    </View>
                    {record.clinicalDate && (
                      <Text style={styles.itemDate}>{formatDateTime(record.clinicalDate)}</Text>
                    )}
                    {badges.length > 0 && (
                      <View style={styles.clinicalBadgeRow}>
                        {badges.map((badge) => (
                          <View key={`${recordId}-${badge.key}`} style={badge.containerStyle}>
                            <FontAwesome name={badge.icon} size={11} color={badge.iconColor} />
                            <Text style={badge.textStyle}>{badge.label}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.emptyMessage}>Nenhum registro clínico encontrado</Text>
            )}
          </View>
        );

      case 'medications':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Medicações ({encounterDetails.medications.length})</Text>
            {encounterDetails.medications.length > 0 ? (
              encounterDetails.medications.map((med: any, index: number) => (
                <View key={index} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <FontAwesome name="medkit" size={16} color={theme.colors.success} />
                    <Text style={styles.itemTitle}>Prescrição #{med.medId}</Text>
                  </View>
                  <Text style={styles.itemDate}>{formatDateTime(med.medDate)}</Text>
                  <Text style={styles.itemStatus}>Status: {med.medStatus}</Text>
                  {med.medRequestItens && med.medRequestItens.length > 0 && (
                    <View style={styles.medicationItems}>
                      {med.medRequestItens.map((item: any, itemIndex: number) => (
                        <View key={itemIndex} style={styles.medicationItem}>
                          <Text style={styles.medicationName}>{item.productName}</Text>
                          <Text style={styles.medicationDosage}>Posologia: {item.posology}</Text>
                          <Text style={styles.medicationRegistry}>Registro: {item.registry}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.emptyMessage}>Nenhuma medicação encontrada</Text>
            )}
          </View>
        );

      case 'diagnostics':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Diagnósticos ({encounterDetails.diagnostics.length})</Text>
            {encounterDetails.diagnostics.length > 0 ? (
              encounterDetails.diagnostics.map((diag: any, index: number) => (
                <View key={index} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <FontAwesome name="stethoscope" size={16} color={theme.colors.warning} />
                    <Text style={styles.itemTitle}>Diagnóstico #{diag.identifier}</Text>
                  </View>
                  <Text style={styles.itemDate}>{formatDateTime(diag.effectiveDateTime)}</Text>
                  <Text style={styles.itemStatus}>Status: {diag.status}</Text>
                  <Text style={styles.itemCategory}>Categoria: {diag.category_code}</Text>
                  {diag.conclusion && (
                    <View style={styles.conclusionContainer}>
                      <Text style={styles.conclusionTitle}>Conclusão:</Text>
                      <Text style={styles.conclusionText}>{diag.conclusion}</Text>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.emptyMessage}>Nenhum diagnóstico encontrado</Text>
            )}
          </View>
        );

      case 'images':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Imagens ({encounterDetails.images.length})</Text>
            {encounterDetails.images.length > 0 ? (
              encounterDetails.images.map((image: any, index: number) => (
                <View key={index} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <FontAwesome name="picture-o" size={16} color={theme.colors.primary} />
                    <Text style={styles.itemTitle}>{image.file}</Text>
                  </View>
                  <Text style={styles.itemDate}>{formatDateTime(image.date)}</Text>
                  {image.title && <Text style={styles.imageTitle}>Título: {image.title}</Text>}
                  {image.description && <Text style={styles.imageDescription}>Descrição: {image.description}</Text>}
                </View>
              ))
            ) : (
              <Text style={styles.emptyMessage}>Nenhuma imagem encontrada</Text>
            )}
          </View>
        );

      case 'attachments':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Anexos ({encounterDetails.attachments.length})</Text>
            {encounterDetails.attachments.length > 0 ? (
              encounterDetails.attachments.map((attachment: any, index: number) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.itemCard}
                  onPress={() => handleAttachmentPress(attachment)}
                >
                  <View style={styles.itemHeader}>
                    <FontAwesome name="paperclip" size={16} color={theme.colors.textSecondary} />
                    <Text style={styles.itemTitle}>{attachment.identifier}</Text>
                    {attachment.externallink && (
                      <FontAwesome name="external-link" size={12} color={theme.colors.primary} />
                    )}
                  </View>
                  <Text style={styles.itemDate}>{formatDateTime(attachment.date)}</Text>
                  <Text style={styles.itemType}>Tipo: {attachment.type}</Text>
                  <Text style={styles.itemFileType}>Formato: {attachment.filetype}</Text>
                  {attachment.file_size && (
                    <Text style={styles.itemSize}>Tamanho: {(attachment.file_size / 1024).toFixed(1)} KB</Text>
                  )}
                  {attachment.metadata?.aiAnalysis?.summary && (
                    <View style={styles.aiAnalysisContainer}>
                      <Text style={styles.aiAnalysisTitle}>Análise IA:</Text>
                      <Text style={styles.aiAnalysisText}>{attachment.metadata.aiAnalysis.summary}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyMessage}>Nenhum anexo encontrado</Text>
            )}
          </View>
        );

      case 'recordings':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Gravações de Áudio</Text>
            {Array.isArray(encounterDetails.encounter?.recordings) && encounterDetails.encounter.recordings.length > 0 ? (
              encounterDetails.encounter.recordings.map((recording: any, index: number) => (
                <TouchableOpacity key={index} style={styles.itemCard} onPress={() => handleAttachmentPress(recording)}>
                  <View style={styles.itemHeader}>
                    <FontAwesome name="microphone" size={16} color={theme.colors.primary} />
                    <Text style={styles.itemTitle}>{recording.title || `Gravação ${index + 1}`}</Text>
                    {recording.externallink && (
                      <FontAwesome name="play" size={12} color={theme.colors.primary} />
                    )}
                  </View>
                  {recording.date && <Text style={styles.itemDate}>{formatDateTime(recording.date)}</Text>}
                  {recording.duration && <Text style={styles.itemStatus}>Duração: {recording.duration}</Text>}
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyMessage}>Nenhuma gravação disponível</Text>
            )}
          </View>
        );

      case 'documents':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Documentos</Text>
            {Array.isArray(encounterDetails.encounter?.documents) && encounterDetails.encounter.documents.length > 0 ? (
              encounterDetails.encounter.documents.map((doc: any, index: number) => (
                <TouchableOpacity key={index} style={styles.itemCard} onPress={() => handleAttachmentPress(doc)}>
                  <View style={styles.itemHeader}>
                    <FontAwesome name="file-pdf-o" size={16} color={theme.colors.error} />
                    <Text style={styles.itemTitle}>{doc.name || `Documento ${index + 1}`}</Text>
                    {doc.externallink && (
                      <FontAwesome name="external-link" size={12} color={theme.colors.primary} />
                    )}
                  </View>
                  {doc.date && <Text style={styles.itemDate}>{formatDateTime(doc.date)}</Text>}
                  {doc.description && <Text style={styles.itemType}>{doc.description}</Text>}
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyMessage}>Nenhum documento disponível</Text>
            )}
          </View>
        );

      case 'summaries':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Sumários Clínicos</Text>
            {Array.isArray(encounterDetails.encounter?.summaries) && encounterDetails.encounter.summaries.length > 0 ? (
              encounterDetails.encounter.summaries.map((summary: any, index: number) => (
                <View key={index} style={styles.notesCard}>
                  <View style={styles.notesHeader}>
                    <Text style={styles.notesAuthor}>{summary.author || 'Resumo automático'}</Text>
                    {summary.date && <Text style={styles.notesDate}>{formatDateTime(summary.date)}</Text>}
                  </View>
                  <Text style={styles.notesText}>{summary.text}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyMessage}>Nenhum sumário disponível</Text>
            )}
          </View>
        );

      case 'ai':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Insights de IA Clínica</Text>
            {encounterDetails.encounter?.aiInsights ? (
              <View style={styles.aiInsightsCard}>
                <Text style={styles.notesText}>{encounterDetails.encounter.aiInsights}</Text>
              </View>
            ) : encounterDetails.encounter?.metadata?.aiAnalysis ? (
              <View style={styles.aiInsightsCard}>
                {encounterDetails.encounter.metadata.aiAnalysis.summary && (
                  <Text style={styles.notesText}>{encounterDetails.encounter.metadata.aiAnalysis.summary}</Text>
                )}
                {encounterDetails.encounter.metadata.aiAnalysis.recommendations && (
                  <View style={styles.aiRecommendations}>
                    <Text style={styles.notesTitle}>Recomendações</Text>
                    {encounterDetails.encounter.metadata.aiAnalysis.recommendations.map((rec: string, idx: number) => (
                      <Text key={idx} style={styles.notesText}>• {rec}</Text>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.emptyMessage}>Nenhuma análise de IA disponível</Text>
            )}
          </View>
        );

      default:
        return null;
    }
  };

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

  const tabs = [
    { key: 'general', label: 'Dados Gerais', icon: 'info-circle', count: 0 },
    { key: 'notes', label: 'Notas', icon: 'sticky-note', count: (encounterDetails?.encounter?.notes?.length || 0) + (encounterDetails?.encounter?.shortAISummary ? 1 : 0) },
    { key: 'clinical', label: 'Clínicos', icon: 'file-text-o', count: encounterDetails?.clinicalRecords.length || 0 },
    { key: 'medications', label: 'Medicações', icon: 'medkit', count: encounterDetails?.medications.length || 0 },
    { key: 'diagnostics', label: 'Diagnósticos', icon: 'stethoscope', count: encounterDetails?.diagnostics.length || 0 },
    { key: 'images', label: 'Imagens', icon: 'picture-o', count: encounterDetails?.images.length || 0 },
    { key: 'attachments', label: 'Anexos', icon: 'paperclip', count: encounterDetails?.attachments.length || 0 },
    { key: 'recordings', label: 'Áudios', icon: 'microphone', count: encounterDetails?.encounter?.recordings?.length || 0 },
    { key: 'documents', label: 'Documentos', icon: 'file-pdf-o', count: encounterDetails?.encounter?.documents?.length || 0 },
    { key: 'summaries', label: 'Sumários', icon: 'file-text', count: encounterDetails?.encounter?.summaries?.length || 0 },
    { key: 'ai', label: 'IA Clínica', icon: 'magic', count: encounterDetails?.encounter?.metadata?.aiAnalysis ? 1 : (encounterDetails?.encounter?.aiInsights ? 1 : 0) },
  ];

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.container}>
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
                if (!encounterRecord) {
                  console.warn('[EncounterDetails] Encounter record missing for header metadata');
                  return null;
                }

                const startIso =
                  encounterRecord.actualStart ||
                  encounterRecord.startDate ||
                  encounterRecord.startdate ||
                  (encounterRecord.start && encounterRecord.starttime
                    ? `${encounterRecord.start}T${encounterRecord.starttime}`
                    : null) ||
                  encounterRecord.encounterDate ||
                  encounterRecord.encounterdate;

                const endIso =
                  encounterRecord.actualEnd ||
                  encounterRecord.endDate ||
                  encounterRecord.enddate ||
                  (encounterRecord.end && encounterRecord.endtime
                    ? `${encounterRecord.end}T${encounterRecord.endtime}`
                    : null);

                const durationRaw =
                  encounterRecord.Length ??
                  encounterRecord.length ??
                  encounterRecord.durationMinutes ??
                  encounterRecord.duration ??
                  encounterRecord.totalMinutes;

                const dateLabel = formatDateLabel(startIso || encounterRecord.date || encounterRecord.encounterDate);
                const timeLabel = formatTimeLabel(startIso, endIso);
                const durationSeconds = typeof durationRaw === 'string' ? Number(durationRaw) : durationRaw;
                const durationLabel = formatDurationLabel(durationSeconds);

                if (!dateLabel && !timeLabel && !durationLabel) {
                  return null;
                }

                return (
                  <View style={styles.headerMetaRow}>
                    {dateLabel && (
                      <View style={styles.headerMetaItem}>
                        <FontAwesome name="calendar" size={12} color={theme.colors.white} />
                        <Text style={styles.headerMetaText}>{dateLabel}</Text>
                      </View>
                    )}
                    {timeLabel && (
                      <View style={styles.headerMetaItem}>
                        <FontAwesome name="clock-o" size={12} color={theme.colors.white} />
                        <Text style={styles.headerMetaText}>{timeLabel}</Text>
                      </View>
                    )}
                    {durationLabel && (
                      <View style={styles.headerMetaItem}>
                        <FontAwesome name="hourglass-half" size={12} color={theme.colors.white} />
                        <Text style={styles.headerMetaText}>{durationLabel}</Text>
                      </View>
                    )}
                  </View>
                );
              })()}
            </View>
          </View>
        </View>

        <ScrollView 
          horizontal 
          style={styles.tabsContainer} 
          contentContainerStyle={styles.tabsContent}
          showsHorizontalScrollIndicator={false}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <FontAwesome 
                name={tab.icon} 
                size={16} 
                color={activeTab === tab.key ? theme.colors.primary : theme.colors.textSecondary} 
              />
              <Text style={[
                styles.tabText,
                activeTab === tab.key && styles.activeTabText
              ]}>
                {tab.label}
              </Text>
              {tab.count > 0 && (
                <View style={[styles.tabBadge, activeTab === tab.key && styles.activeTabBadge]}>
                  <Text style={[styles.tabBadgeText, activeTab === tab.key && styles.activeTabBadgeText]}>
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {renderTabContent()}
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
  tabsContainer: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    maxHeight: 56,
  },
  tabsContent: {
    alignItems: 'center',
    flexGrow: 0,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: 16,
  },
  activeTab: {
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  activeTabText: {
    color: theme.colors.primary,
  },
  tabBadge: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  activeTabBadge: {
    backgroundColor: theme.colors.primary,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  activeTabBadgeText: {
    color: theme.colors.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 32,
  },
  tabContent: {
    padding: 16,
  },
  tabTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 16,
  },
  itemCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  itemDate: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  itemStatus: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  itemType: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  clinicalBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  clinicalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  clinicalBadgeInfo: {
    backgroundColor: theme.colors.info,
    borderColor: theme.colors.info,
  },
  clinicalBadgeSuccess: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  clinicalBadgeActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  clinicalBadgeWarning: {
    backgroundColor: theme.colors.warningLight,
    borderColor: theme.colors.warning,
  },
  clinicalBadgeError: {
    backgroundColor: theme.colors.error,
    borderColor: theme.colors.error,
  },
  clinicalBadgeNeutral: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderColor: theme.colors.borderLight,
  },
  clinicalBadgeMuted: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderColor: theme.colors.border,
  },
  clinicalBadgeText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  clinicalBadgeTextOnDark: {
    color: theme.colors.white,
  },
  itemFileType: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  itemSize: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  medicationItems: {
    marginTop: 8,
    gap: 8,
  },
  medicationItem: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: 12,
    borderRadius: 6,
  },
  medicationName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  medicationDosage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  medicationRegistry: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: 'monospace',
  },
  conclusionContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 6,
  },
  conclusionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  conclusionText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  imageTitle: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 4,
  },
  imageDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  aiAnalysisContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  aiAnalysisTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  aiAnalysisText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  emptyMessage: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 40,
    fontStyle: 'italic',
  },
  generalGrid: {
    gap: 16,
  },
  generalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  generalCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  generalPlaceholder: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  generalError: {
    fontSize: 14,
    color: theme.colors.error,
    lineHeight: 20,
  },
  servicesMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  serviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  serviceBadgeNeutral: {
    backgroundColor: theme.colors.backgroundSecondary,
  },
  serviceBadgeStatus: {
    backgroundColor: theme.colors.primary,
  },
  serviceBadgeOutline: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
  },
  serviceBadgeText: {
    fontSize: 12,
    color: theme.colors.text,
  },
  serviceBadgeTextOnDark: {
    color: theme.colors.white,
  },
  servicesList: {
    gap: 12,
  },
  serviceItem: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: theme.colors.surface,
    gap: 8,
  },
  serviceItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceName: {
    fontSize: 15,
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
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  financialTotalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  financialTotalCard: {
    flexGrow: 1,
    minWidth: 130,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  financialTotalLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  financialTotalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  coverageList: {
    gap: 12,
  },
  coverageItem: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: theme.colors.surface,
    gap: 8,
  },
  coverageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  coverageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  coverageServiceName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    flexShrink: 1,
  },
  coverageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
  },
  coverageBadgePlan: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  coverageBadgeDirect: {
    backgroundColor: theme.colors.backgroundSecondary,
  },
  coverageBadgeNeutral: {
    backgroundColor: theme.colors.backgroundSecondary,
  },
  coverageBadgePending: {
    backgroundColor: theme.colors.warningLight,
    borderColor: theme.colors.warning,
  },
  coverageBadgeText: {
    fontSize: 12,
    color: theme.colors.primary,
  },
  coverageBadgeTextOnDark: {
    color: theme.colors.white,
  },
  coverageDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  coverageDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coverageDetailText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  patientCard: {
    gap: 16,
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
  patientInfoStandalone: {
    paddingLeft: 0,
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
  patientBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  patientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  patientBadgeLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  patientBadgeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  notesCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notesAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  notesDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  notesTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  aiInsightsCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },
  aiRecommendations: {
    marginTop: 12,
    gap: 6,
  },
});
