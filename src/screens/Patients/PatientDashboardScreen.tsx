import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { RouteProp, useRoute, useNavigation, NavigationProp } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { api } from '@services/api';
import { PatientsStackParamList } from '@types/navigation';

type PatientDashboardRouteProp = RouteProp<PatientsStackParamList, 'PatientDashboard'>;

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
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
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

export const PatientDashboardScreen: React.FC = () => {
  const route = useRoute<PatientDashboardRouteProp>();
  const navigation = useNavigation<NavigationProp<PatientsStackParamList>>();
  const { patientCpf, patientName } = route.params;

  const [patient, setPatient] = useState<PatientData | null>(null);
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<'overview' | 'history' | 'medical' | 'contact'>('overview');

  const loadPatientData = async () => {
    try {
      console.log('[PatientDashboard] Loading patient data for CPF:', patientCpf);
      const response = await api.getPatientDetails(patientCpf);
      console.log('[PatientDashboard] Patient data received:', JSON.stringify(response, null, 2));
      
      // Extract patient data from API response structure
      const rawData = response.data || response;
      
      // Map API fields to component expected fields
      const patientData = {
        ...rawData,
        birthDate: rawData.birthdate || rawData.birthDate, // API uses 'birthdate'
        conditions: rawData.conditions || [], // Default empty array
        allergies: rawData.allergies || [], // Default empty array
        medications: rawData.medications || [], // Default empty array
      };
      
      console.log('[PatientDashboard] Processed patient data:', patientData);
      setPatient(patientData);
    } catch (error) {
      console.error('[PatientDashboard] Error loading patient:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados do paciente');
    }
  };

  const loadPatientAppointments = async () => {
    try {
      console.log('[PatientDashboard] Loading appointments for CPF:', patientCpf);
      const appointmentsData = await api.getPatientAppointments(patientCpf);
      console.log('[PatientDashboard] Appointments data received:', JSON.stringify(appointmentsData, null, 2));
      
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
      
      console.log('[PatientDashboard] Processed appointments:', appointments);
      setAppointments(appointments);
    } catch (error) {
      console.error('[PatientDashboard] Error loading appointments:', error);
    }
  };

  const loadData = async () => {
    console.log('[PatientDashboard] Starting to load data...');
    setLoading(true);
    await Promise.all([
      loadPatientData(),
      loadPatientAppointments(),
    ]);
    console.log('[PatientDashboard] Data loading completed');
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    console.log('[PatientDashboard] Component mounted with patientCpf:', patientCpf, 'patientName:', patientName);
    loadData();
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

  const getPatientPhotoUri = (photo: any): string | null => {
    try {
      if (!photo) return null;
      
      // If photo is a buffer with data array
      if (photo.data && Array.isArray(photo.data)) {
        const uint8Array = new Uint8Array(photo.data);
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64String = btoa(binaryString);
        return `data:image/png;base64,${base64String}`;
      }
      
      // If photo is already a string
      if (typeof photo === 'string') {
        return photo.startsWith('data:') ? photo : `data:image/png;base64,${photo}`;
      }
      
      return null;
    } catch (error) {
      console.error('[PatientDashboard] Error processing patient photo:', error);
      return null;
    }
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
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header Section */}
      <View style={styles.header}>
        {/* Top Row: Back button and Action buttons */}
        <View style={styles.headerTopRow}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <FontAwesome name="arrow-left" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton}>
              <FontAwesome name="phone" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <FontAwesome name="envelope" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <FontAwesome name="edit" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Patient Info Row */}
        <View style={styles.patientInfo}>
          <View style={styles.avatarContainer}>
            {(() => {
              const photoUri = getPatientPhotoUri(patient.photo);
              console.log('[PatientDashboard] Photo URI:', photoUri ? 'Generated successfully' : 'No photo available');
              
              return photoUri ? (
                <Image 
                  source={{ uri: photoUri }} 
                  style={styles.avatar}
                  onError={(error) => console.log('[PatientDashboard] Failed to load patient photo:', error)}
                  onLoad={() => console.log('[PatientDashboard] Patient photo loaded successfully')}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <FontAwesome 
                    name={patient.gender === 'female' ? 'female' : 'male'} 
                    size={36} 
                    color={theme.colors.textSecondary} 
                  />
                </View>
              );
            })()}
          </View>
          
          <View style={styles.patientDetails}>
            <Text style={styles.patientName} numberOfLines={2} adjustsFontSizeToFit>
              {patient.name}
            </Text>
            <Text style={styles.patientSubtitle}>
              {calculateAge(patient.birthDate)} anos • {patient.gender === 'female' ? 'Feminino' : 'Masculino'}
            </Text>
            <Text style={styles.patientCpf}>CPF: {patient.cpf}</Text>
          </View>
        </View>
      </View>

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

        {/* Row with three medical info cards */}
        <View style={styles.medicalInfoRow}>
          <View style={styles.smallCard}>
            <View style={styles.smallCardIconContainer}>
              <FontAwesome name="heartbeat" size={10} color={theme.colors.error} />
            </View>
            <Text style={styles.smallCardTitle}>Condições</Text>
            <Text style={styles.smallCardValue}>
              {patient.conditions?.length || 0}
            </Text>
          </View>

          <View style={styles.smallCard}>
            <View style={styles.smallCardIconContainer}>
              <FontAwesome name="exclamation-triangle" size={10} color={theme.colors.warning} />
            </View>
            <Text style={styles.smallCardTitle}>Alergias</Text>
            <Text style={styles.smallCardValue}>
              {patient.allergies?.length || 0}
            </Text>
          </View>

          <View style={styles.smallCard}>
            <View style={styles.smallCardIconContainer}>
              <FontAwesome name="tint" size={10} color={theme.colors.primary} />
            </View>
            <Text style={styles.smallCardTitle}>Tipo Sanguíneo</Text>
            <Text style={styles.smallCardValue}>
              {patient.bloodType || '-'}
            </Text>
          </View>
        </View>
      </View>

      {/* Section Tabs */}
      <View style={styles.sectionTabs}>
        {[
          { key: 'overview', label: 'Resumo', icon: 'user' },
          { key: 'history', label: 'Histórico', icon: 'history' },
          { key: 'medical', label: 'Médico', icon: 'heartbeat' },
          { key: 'contact', label: 'Contato', icon: 'phone' },
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
                <Text style={styles.infoLabel}>Última Consulta:</Text>
                <Text style={styles.infoValue}>{formatDate(patient.lastAppointment)}</Text>
              </View>
            </View>
          </View>
        )}

        {activeSection === 'history' && (
          <View>
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>Histórico Médico</Text>
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={() => navigation.navigate('PatientHistory', { patientCpf, patientName })}
              >
                <Text style={styles.viewAllButtonText}>Ver Histórico Completo</Text>
                <FontAwesome name="chevron-right" size={12} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
            
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
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Condições Médicas</Text>
              {patient.conditions && patient.conditions.length > 0 ? (
                patient.conditions.map((condition, index) => (
                  <View key={index} style={styles.listItem}>
                    <FontAwesome name="circle" size={6} color={theme.colors.primary} />
                    <Text style={styles.listItemText}>{condition}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyMessage}>Nenhuma condição registrada</Text>
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Alergias</Text>
              {patient.allergies && patient.allergies.length > 0 ? (
                patient.allergies.map((allergy, index) => (
                  <View key={index} style={styles.listItem}>
                    <FontAwesome name="circle" size={6} color={theme.colors.error} />
                    <Text style={styles.listItemText}>{allergy}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyMessage}>Nenhuma alergia registrada</Text>
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Medicamentos</Text>
              {patient.medications && patient.medications.length > 0 ? (
                patient.medications.map((medication, index) => (
                  <View key={index} style={styles.listItem}>
                    <FontAwesome name="circle" size={6} color={theme.colors.success} />
                    <Text style={styles.listItemText}>{medication}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyMessage}>Nenhum medicamento registrado</Text>
              )}
            </View>
          </View>
        )}

        {activeSection === 'contact' && (
          <View>
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Endereço</Text>
              {patient.address ? (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Rua:</Text>
                    <Text style={styles.infoValue}>
                      {patient.address.street}, {patient.address.number}
                    </Text>
                  </View>
                  {patient.address.complement && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Complemento:</Text>
                      <Text style={styles.infoValue}>{patient.address.complement}</Text>
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Bairro:</Text>
                    <Text style={styles.infoValue}>{patient.address.neighborhood}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Cidade:</Text>
                    <Text style={styles.infoValue}>
                      {patient.address.city}, {patient.address.state}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>CEP:</Text>
                    <Text style={styles.infoValue}>{patient.address.zipCode}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.emptyMessage}>Endereço não cadastrado</Text>
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Contato de Emergência</Text>
              {patient.emergencyContact ? (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Nome:</Text>
                    <Text style={styles.infoValue}>{patient.emergencyContact.name}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Parentesco:</Text>
                    <Text style={styles.infoValue}>{patient.emergencyContact.relationship}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Telefone:</Text>
                    <Text style={styles.infoValue}>{patient.emergencyContact.phone}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.emptyMessage}>Contato de emergência não cadastrado</Text>
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Plano de Saúde</Text>
              {patient.healthInsurance ? (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Operadora:</Text>
                    <Text style={styles.infoValue}>{patient.healthInsurance.provider}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Número:</Text>
                    <Text style={styles.infoValue}>{patient.healthInsurance.number}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Validade:</Text>
                    <Text style={styles.infoValue}>{formatDate(patient.healthInsurance.validity)}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.emptyMessage}>Plano de saúde não cadastrado</Text>
              )}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
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
  header: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 20,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientDetails: {
    flex: 1,
    paddingRight: 16,
  },
  patientName: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
    lineHeight: 26,
  },
  patientSubtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  patientCpf: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: 'monospace',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
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
  medicalInfoRow: {
    flexDirection: 'row',
    gap: 6,
  },
  smallCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 6,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    fontSize: 16,
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
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewAllButtonText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
  },
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