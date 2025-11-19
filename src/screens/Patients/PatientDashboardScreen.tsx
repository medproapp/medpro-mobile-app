import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { RouteProp, useRoute, useNavigation, NavigationProp } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Markdown from 'react-native-markdown-display';
import { theme } from '@theme/index';
import { api, API_BASE_URL } from '@services/api';
import { PatientsStackParamList } from '@/types/navigation';
import { CachedImage } from '@components/common';
import { useAuthStore } from '@store/authStore';
import { logger } from '@/utils/logger';

type PatientDashboardRouteProp = RouteProp<PatientsStackParamList, 'PatientDashboard'>;

interface MedicalData {
  bloodType?: string;
  vaccinationStatus?: string;
  allergies?: string;
  chronicConditions?: string;
  surgicalHistory?: string;
  hereditaryConditions?: string;
  continuousMedications?: string;
  lifestyleHabits?: string;
  implantedDevices?: string;
}

interface PatientData {
  id: string;
  cpf: string;
  name: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  gender?: 'male' | 'female';
  photo?: string;
  bloodType?: string;
  conditions?: string[];
  allergies?: string[];
  medications?: string[];
  summary?: string;
  lastPrescriptions?: string;
  conditionDiagnostics?: string;
  medical_data?: MedicalData;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    fullAddress?: string;
  };
  healthInsurance?: {
    provider?: string;
    number?: string;
    validity?: string;
  };
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  lastAppointment?: string;
}

interface PatientAppointment {
  id: string;
  start: string;
  end: string;
  type: string;
  status: string;
  location?: string;
  notes?: string;
}

const HEADER_TOP_PADDING = Platform.OS === 'android'
  ? (StatusBar.currentHeight || 44)
  : 52;

export const PatientDashboardScreen: React.FC = () => {
  const route = useRoute<PatientDashboardRouteProp>();
  const navigation = useNavigation<NavigationProp<PatientsStackParamList>>();
  const { patientCpf, patientName } = route.params;
  const { token } = useAuthStore();

  const [patient, setPatient] = useState<PatientData | null>(null);
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [lastEncounter, setLastEncounter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<'overview' | 'history' | 'medical'>('overview');
  const [clinicalRecordsCount, setClinicalRecordsCount] = useState<number | null>(null);
  const [prescriptionsCount, setPrescriptionsCount] = useState<number | null>(null);
  const [diagnosticsCount, setDiagnosticsCount] = useState<number | null>(null);
  const [imagesCount, setImagesCount] = useState<number | null>(null);
  const [attachmentsCount, setAttachmentsCount] = useState<number | null>(null);
  const [recordingsCount, setRecordingsCount] = useState<number | null>(null);

  // Request deduplication - prevent concurrent loadData calls
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  const renderMarkdownContent = (value: string | undefined | null, fallback: string) => {
    const trimmedValue = value?.trim();
    if (trimmedValue) {
      return (
        <Markdown style={markdownStyles}>
          {trimmedValue}
        </Markdown>
      );
    }

    return <Text style={styles.textBlock}>{fallback}</Text>;
  };

  const loadPatientData = async () => {
    try {

      // Load patient details (photo will be loaded by CachedImage with caching)
      const response = await api.getPatientDetails(patientCpf);

      
      // Extract patient data from API response structure
      const rawData = response.data || response;
      const patientPayload =
        rawData && typeof rawData === 'object' && 'data' in rawData && rawData.data && typeof rawData.data === 'object'
          ? rawData.data
          : rawData;

      
      // Map API fields to component expected fields
      const patientData = {
        ...patientPayload,
        birthDate: patientPayload.birthdate || patientPayload.birthDate, // API uses 'birthdate'
        conditions: patientPayload.conditions || [], // Default empty array
        allergies: patientPayload.allergies || [], // Default empty array
        medications: patientPayload.medications || [], // Default empty array
        summary: patientPayload.summary,
        lastPrescriptions: patientPayload.lastprescriptions || patientPayload.lastPrescriptions,
        conditionDiagnostics: patientPayload.condanddiag || patientPayload.conditionDiagnostics,
        lastAppointment: patientPayload.lastAppointment || patientPayload.lastAppointmentDate || patientPayload.lastencounterdate || patientPayload.lastEncounterDate,
        // Photos will be loaded automatically by CachedImage with caching
        // Just use the address as it comes from API
        address: patientPayload.address ? {
          fullAddress: patientPayload.address,
          city: patientPayload.city,
          state: patientPayload.state,
        } : null,
      };
      
      setPatient(patientData);
    } catch (error) {
      logger.error('[PatientDashboard] Error loading patient:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados do paciente');
    }
  };

  const loadPatientAppointments = async () => {
    try {
      const appointmentsData = await api.getPatientAppointments(patientCpf);

      // The API returns appointments directly as an array, not wrapped in .appointments
      const rawAppointments = Array.isArray(appointmentsData) ? appointmentsData : appointmentsData.appointments || [];

      // Map API appointment fields to component expected fields
      const appointments = rawAppointments.map((apt: any) => ({
        id: apt.identifier?.toString() || apt.id,
        start: apt.startdate ? `${apt.startdate.split('T')[0]}T${apt.starttime || '00:00:00'}` : apt.start,
        end: apt.enddate || apt.end,
        type: apt.appointmenttype || apt.type || 'Consulta',
        status: apt.status,
        location: apt.location,
        notes: apt.note || apt.notes,
      }));

      setAppointments(appointments);
    } catch (error) {
      logger.error('[PatientDashboard] Error loading appointments:', error);
    }
  };

  const loadClinicalRecordsCount = async () => {
    try {
      const response = await api.getPatientClinicalRecords(patientCpf, { page: 1, limit: 1 });
      const count = response?.total || 0;
      if (mountedRef.current) {
        setClinicalRecordsCount(count);
      }
    } catch (error) {
      logger.error('[PatientDashboard] Error loading clinical records count:', error);
      if (mountedRef.current) {
        setClinicalRecordsCount(null); // null indicates error/unavailable
      }
    }
  };

  const loadPrescriptionsCount = async () => {
    try {
      const response = await api.getPatientMedicationRecords(patientCpf, { page: 1, limit: 1 });
      const count = response?.total || 0;
      if (mountedRef.current) {
        setPrescriptionsCount(count);
      }
    } catch (error) {
      logger.error('[PatientDashboard] Error loading prescriptions count:', error);
      if (mountedRef.current) {
        setPrescriptionsCount(null);
      }
    }
  };

  const loadDiagnosticsCount = async () => {
    try {
      const response = await api.getPatientDiagnosticRecords(patientCpf, { page: 1, limit: 1 });
      const count = response?.total || 0;
      if (mountedRef.current) {
        setDiagnosticsCount(count);
      }
    } catch (error) {
      logger.error('[PatientDashboard] Error loading diagnostics count:', error);
      if (mountedRef.current) {
        setDiagnosticsCount(null);
      }
    }
  };

  const loadImagesCount = async () => {
    try {
      const response = await api.getPatientImageRecords(patientCpf, { page: 1, limit: 1 });
      const count = response?.total || 0;
      if (mountedRef.current) {
        setImagesCount(count);
      }
    } catch (error) {
      logger.error('[PatientDashboard] Error loading images count:', error);
      if (mountedRef.current) {
        setImagesCount(null);
      }
    }
  };

  const loadAttachmentsCount = async () => {
    try {
      const response = await api.getPatientAttachments(patientCpf, { page: 1, limit: 1 });
      const count = response?.total || 0;
      if (mountedRef.current) {
        setAttachmentsCount(count);
      }
    } catch (error) {
      logger.error('[PatientDashboard] Error loading attachments count:', error);
      if (mountedRef.current) {
        setAttachmentsCount(null);
      }
    }
  };

  const loadRecordingsCount = async () => {
    try {
      const response = await api.getPatientRecordings(patientCpf, { page: 1, limit: 1 });
      const count = response?.total || 0;
      if (mountedRef.current) {
        setRecordingsCount(count);
      }
    } catch (error) {
      logger.error('[PatientDashboard] Error loading recordings count:', error);
      if (mountedRef.current) {
        setRecordingsCount(null);
      }
    }
  };

  const loadLastEncounter = async () => {
    try {
      const response = await api.getPractitionerPatientEncounters(patientCpf);
      logger.debug('[PatientDashboard] Last encounter date:', response?.data?.data?.[0]?.date);
      if (mountedRef.current) {
        setLastEncounter(response);
      }
    } catch (error) {
      logger.error('[PatientDashboard] Error loading last encounter:', error);
      if (mountedRef.current) {
        setLastEncounter(null);
      }
    }
  };

  const loadData = async () => {
    // Prevent concurrent load requests
    if (loadingRef.current) {
      logger.debug('[PatientDashboard] Already loading, skipping duplicate request');
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);

      // Use Promise.allSettled to handle errors independently
      // This prevents one failed API from blocking others
      const results = await Promise.allSettled([
        loadPatientData(),
        loadPatientAppointments(),
        loadClinicalRecordsCount(),
        loadPrescriptionsCount(),
        loadDiagnosticsCount(),
        loadImagesCount(),
        loadAttachmentsCount(),
        loadRecordingsCount(),
        loadLastEncounter(),
      ]);

      // Log any failures (for debugging)
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const names = ['PatientData', 'Appointments', 'ClinicalRecords', 'Prescriptions', 'Diagnostics', 'Images', 'Attachments', 'Recordings', 'LastEncounter'];
          logger.warn(`[PatientDashboard] ${names[index]} failed:`, result.reason);
        }
      });
    } catch (error) {
      logger.error('[PatientDashboard] Unexpected error in loadData:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      loadingRef.current = false;
    }
  };

  const onRefresh = async () => {
    // Don't allow refresh while already loading
    if (loadingRef.current) {
      return;
    }

    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    mountedRef.current = true;
    loadData();

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
    };
  }, [patientCpf]);

  const calculateAge = (birthDate?: string): number => {
    if (!birthDate) return 0;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString?: string): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando dados do paciente...</Text>
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome name="exclamation-triangle" size={48} color={theme.colors.error} />
        <Text style={styles.errorText}>Paciente não encontrado</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nextAppointment = appointments.find(apt => new Date(apt.start) > new Date());

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
            <View style={styles.headerLeft}>
              <CachedImage
                uri={`${API_BASE_URL}/patient/getpatientphoto?patientCpf=${patientCpf}`}
                headers={token ? { Authorization: `Bearer ${token}` } : undefined}
                style={[styles.avatarContainer, styles.headerAvatar]}
                fallbackIcon={patient.gender === 'female' ? 'female' : 'male'}
                fallbackIconSize={24}
                fallbackIconColor={theme.colors.white}
              />
              <View style={styles.headerContent}>
                <Text style={styles.greeting}>Paciente</Text>
                <Text style={styles.userName}>{patient?.name || 'Carregando...'}</Text>
                <Text style={styles.dateText}>
                  {calculateAge(patient.birthDate)} anos • {patient.gender === 'female' ? 'Feminino' : 'Masculino'}
                </Text>
                <Text style={styles.dateText}>
                  CPF: {patient?.cpf ? patient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
      {/* Overview Cards */}
      <View style={styles.overviewCards}>
        {/* Full width card for next appointment */}
        <View style={styles.compactCard}>
          <View style={styles.cardIconContainer}>
            <FontAwesome name="calendar" size={12} color={theme.colors.primary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Próxima Consulta</Text>
            <Text style={styles.cardValue}>
              {nextAppointment ? formatDateTime(nextAppointment.start).split(' ')[0] : 'Nenhuma'}
            </Text>
          </View>
        </View>

        {/* Horizontal scrollable row with all cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.medicalInfoScrollContainer}
          style={styles.medicalInfoScrollWrapper}
        >
          {/* Clinical Records Card */}
          <TouchableOpacity
            style={styles.smallCard}
            onPress={() => navigation.navigate('ClinicalRecords', { patientCpf, patientName })}
          >
            <View style={styles.smallCardIconContainer}>
              <FontAwesome name="file-text-o" size={10} color={theme.colors.primary} />
            </View>
            <Text style={styles.smallCardTitle}>Clínico</Text>
            <Text style={styles.smallCardValue}>
              {clinicalRecordsCount === null ? '-' : clinicalRecordsCount}
            </Text>
          </TouchableOpacity>

          {/* Prescriptions Card */}
          <TouchableOpacity
            style={styles.smallCard}
            onPress={() => navigation.navigate('Prescriptions', { patientCpf, patientName })}
          >
            <View style={styles.smallCardIconContainer}>
              <FontAwesome name="file-text" size={10} color={theme.colors.success} />
            </View>
            <Text style={styles.smallCardTitle}>Prescrições</Text>
            <Text style={styles.smallCardValue}>
              {prescriptionsCount === null ? '-' : prescriptionsCount}
            </Text>
          </TouchableOpacity>

          {/* Diagnostics Card */}
          <TouchableOpacity
            style={styles.smallCard}
            onPress={() => navigation.navigate('Diagnostics', { patientCpf, patientName })}
          >
            <View style={styles.smallCardIconContainer}>
              <FontAwesome name="stethoscope" size={10} color={theme.colors.error} />
            </View>
            <Text style={styles.smallCardTitle}>Diagnósticos</Text>
            <Text style={styles.smallCardValue}>
              {diagnosticsCount === null ? '-' : diagnosticsCount}
            </Text>
          </TouchableOpacity>

          {/* Images Card */}
          <TouchableOpacity
            style={styles.smallCard}
            onPress={() => navigation.navigate('Images', { patientCpf, patientName })}
          >
            <View style={styles.smallCardIconContainer}>
              <FontAwesome name="image" size={10} color={theme.colors.info} />
            </View>
            <Text style={styles.smallCardTitle}>Imagens</Text>
            <Text style={styles.smallCardValue}>
              {imagesCount === null ? '-' : imagesCount}
            </Text>
          </TouchableOpacity>

          {/* Attachments Card */}
          <TouchableOpacity
            style={styles.smallCard}
            onPress={() => navigation.navigate('Attachments', { patientCpf, patientName })}
          >
            <View style={styles.smallCardIconContainer}>
              <FontAwesome name="paperclip" size={10} color={theme.colors.warning} />
            </View>
            <Text style={styles.smallCardTitle}>Anexos</Text>
            <Text style={styles.smallCardValue}>
              {attachmentsCount === null ? '-' : attachmentsCount}
            </Text>
          </TouchableOpacity>

          {/* Recordings Card */}
          <TouchableOpacity
            style={styles.smallCard}
            onPress={() => navigation.navigate('Recordings', { patientCpf, patientName })}
          >
            <View style={styles.smallCardIconContainer}>
              <FontAwesome name="microphone" size={10} color={theme.colors.error} />
            </View>
            <Text style={styles.smallCardTitle}>Gravações</Text>
            <Text style={styles.smallCardValue}>
              {recordingsCount === null ? '-' : recordingsCount}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Section Tabs */}
      <View style={styles.sectionTabs}>
        {[
          { key: 'overview', label: 'Resumo', icon: 'user' },
          { key: 'history', label: 'Histórico', icon: 'history' },
          { key: 'medical', label: 'Médico', icon: 'heartbeat' },
        ].map((section) => (
          <TouchableOpacity
            key={section.key}
            style={[
              styles.sectionTab,
              activeSection === section.key && styles.activeSectionTab,
            ]}
            onPress={() => setActiveSection(section.key as any)}
          >
            <FontAwesome 
              name={section.icon} 
              size={16} 
              color={activeSection === section.key ? theme.colors.white : theme.colors.textSecondary} 
            />
            <Text style={[
              styles.sectionTabText,
              activeSection === section.key && styles.activeSectionTabText,
            ]}>
              {section.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Section Content */}
      <View style={styles.sectionContent}>
        {activeSection === 'overview' && (
          <View>
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Informações Básicas</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email:</Text>
                <Text style={styles.infoValue}>{patient.email || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Telefone:</Text>
                <Text style={styles.infoValue}>{patient.phone || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Data de Nascimento:</Text>
                <Text style={styles.infoValue}>{formatDate(patient.birthDate)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Último Encontro:</Text>
                <Text style={styles.infoValue}>
                  {(() => {
                    const encounters = lastEncounter?.data?.data || [];
                    const nonAutomaticEncounter = encounters.find((enc: any) => enc.class !== 'automatic');
                    return nonAutomaticEncounter?.date ? formatDate(nonAutomaticEncounter.date) : '-';
                  })()}
                </Text>
              </View>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Resumo Clínico</Text>
              {renderMarkdownContent(patient.summary, 'Nenhum resumo clínico informado.')}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Últimas Prescrições</Text>
              {renderMarkdownContent(patient.lastPrescriptions, 'Nenhuma prescrição registrada.')}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Condições e Diagnósticos</Text>
              {renderMarkdownContent(
                patient.conditionDiagnostics,
                'Nenhuma condição ou diagnóstico detalhado disponível.'
              )}
            </View>
          </View>
        )}

        {activeSection === 'history' && (
          <View>
            <View style={styles.historyPreview}>
              <View style={styles.historyPreviewCard}>
                <FontAwesome name="history" size={24} color={theme.colors.primary} />
                <View style={styles.historyPreviewContent}>
                  <Text style={styles.historyPreviewTitle}>Histórico Completo Disponível</Text>
                  <Text style={styles.historyPreviewText}>
                    Acesse o histórico médico completo com encontros, prescrições, exames e mais.
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.historyActionButton}
                onPress={() => navigation.navigate('PatientHistory', { patientCpf, patientName })}
              >
                <FontAwesome name="file-text-o" size={16} color={theme.colors.white} />
                <Text style={styles.historyActionButtonText}>Abrir Histórico</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeSection === 'medical' && (
          <View>
            {patient.medical_data ? (
              <>
                {/* Blood Type */}
                {patient.medical_data.bloodType && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Tipo Sanguíneo</Text>
                    <View style={styles.infoRow}>
                      <FontAwesome name="tint" size={14} color={theme.colors.error} style={{ marginRight: 8 }} />
                      <Text style={styles.infoValue}>{patient.medical_data.bloodType}</Text>
                    </View>
                  </View>
                )}

                {/* Allergies */}
                {patient.medical_data.allergies && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Alergias</Text>
                    <View style={styles.infoRow}>
                      <FontAwesome name="warning" size={14} color={theme.colors.error} style={{ marginRight: 8 }} />
                      <Text style={styles.infoValue}>{patient.medical_data.allergies}</Text>
                    </View>
                  </View>
                )}

                {/* Chronic Conditions */}
                {patient.medical_data.chronicConditions && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Condições Crônicas</Text>
                    <View style={styles.infoRow}>
                      <FontAwesome name="heartbeat" size={14} color={theme.colors.primary} style={{ marginRight: 8 }} />
                      <Text style={styles.infoValue}>{patient.medical_data.chronicConditions}</Text>
                    </View>
                  </View>
                )}

                {/* Continuous Medications */}
                {patient.medical_data.continuousMedications && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Medicamentos Contínuos</Text>
                    <View style={styles.infoRow}>
                      <FontAwesome name="medkit" size={14} color={theme.colors.success} style={{ marginRight: 8 }} />
                      <Text style={styles.infoValue}>{patient.medical_data.continuousMedications}</Text>
                    </View>
                  </View>
                )}

                {/* Surgical History */}
                {patient.medical_data.surgicalHistory && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Histórico Cirúrgico</Text>
                    <View style={styles.infoRow}>
                      <FontAwesome name="cut" size={14} color={theme.colors.info} style={{ marginRight: 8 }} />
                      <Text style={styles.infoValue}>{patient.medical_data.surgicalHistory}</Text>
                    </View>
                  </View>
                )}

                {/* Hereditary Conditions */}
                {patient.medical_data.hereditaryConditions && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Condições Hereditárias</Text>
                    <View style={styles.infoRow}>
                      <FontAwesome name="users" size={14} color={theme.colors.warning} style={{ marginRight: 8 }} />
                      <Text style={styles.infoValue}>{patient.medical_data.hereditaryConditions}</Text>
                    </View>
                  </View>
                )}

                {/* Vaccination Status */}
                {patient.medical_data.vaccinationStatus && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Status de Vacinação</Text>
                    <View style={styles.infoRow}>
                      <FontAwesome name="shield" size={14} color={theme.colors.success} style={{ marginRight: 8 }} />
                      <Text style={styles.infoValue}>{patient.medical_data.vaccinationStatus}</Text>
                    </View>
                  </View>
                )}

                {/* Lifestyle Habits */}
                {patient.medical_data.lifestyleHabits && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Hábitos de Vida</Text>
                    <View style={styles.infoRow}>
                      <FontAwesome name="life-ring" size={14} color={theme.colors.info} style={{ marginRight: 8 }} />
                      <Text style={styles.infoValue}>{patient.medical_data.lifestyleHabits}</Text>
                    </View>
                  </View>
                )}

                {/* Implanted Devices */}
                {patient.medical_data.implantedDevices && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Dispositivos Implantados</Text>
                    <View style={styles.infoRow}>
                      <FontAwesome name="microchip" size={14} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
                      <Text style={styles.infoValue}>{patient.medical_data.implantedDevices}</Text>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.infoSection}>
                <Text style={styles.emptyMessage}>Nenhuma informação médica registrada</Text>
              </View>
            )}
          </View>
        )}
      </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
  scrollContainer: {
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: theme.colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overviewCards: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginBottom: 1,
  },
  cardValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  medicalInfoScrollWrapper: {
    marginBottom: 0,
  },
  medicalInfoScrollContainer: {
    paddingHorizontal: 16,
    gap: 6,
  },
  smallCard: {
    width: 90,
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 6,
  },
  smallCardIconContainer: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  smallCardTitle: {
    fontSize: 9,
    color: theme.colors.textSecondary,
    marginBottom: 1,
    textAlign: 'center',
  },
  smallCardValue: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  sectionTabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
  },
  sectionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  activeSectionTab: {
    backgroundColor: theme.colors.primary,
  },
  sectionTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  activeSectionTabText: {
    color: theme.colors.white,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  infoSection: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  listItemText: {
    fontSize: 14,
    color: theme.colors.text,
    flex: 1,
  },
  emptyMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  textBlock: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  appointmentCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appointmentDate: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: theme.colors.white,
    fontWeight: '500',
  },
  appointmentType: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  appointmentNotes: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  // History section styles
  historyPreview: {
    gap: 16,
  },
  historyPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 16,
  },
  historyPreviewContent: {
    flex: 1,
  },
  historyPreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  historyPreviewText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  historyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  historyActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.white,
  },
});

const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  heading1: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: 8,
  },
  heading2: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: 6,
  },
  heading3: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  heading4: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  strong: {
    fontWeight: '600',
  },
  em: {
    fontStyle: 'italic',
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
});
