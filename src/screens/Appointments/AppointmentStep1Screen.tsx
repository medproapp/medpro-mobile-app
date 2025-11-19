import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { theme } from '@theme/index';
import { useAppointmentStore } from '@store/appointmentStore';
import { RecentPatient } from '../../types/api';
import { useAuthStore } from '@store/authStore';
import { api } from '@services/api';
import { DashboardStackParamList } from '@/types/navigation';
import { logger } from '@/utils/logger';

type Step1NavigationProp = StackNavigationProp<DashboardStackParamList, 'AppointmentStep1'>;

interface Patient {
  cpf: string;
  name: string;
  phone?: string;
  email?: string;
  lastAppointment?: string;
  photo?: string;
  raw?: unknown;
}

const SEARCH_DELAY = 500; // ms
const SEARCH_MIN_LENGTH = 3;

export const AppointmentStep1Screen: React.FC = () => {
  const navigation = useNavigation<Step1NavigationProp>();
  const { user } = useAuthStore();
  const { 
    setPatient, 
    setPractitioner, 
    recentPatients, 
    loadRecentPatients, 
    addRecentPatient,
    canProceedFromStep
  } = useAppointmentStore();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'cpf' | 'phone'>('name');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hasSearched, setHasSearched] = useState(false);


  // Load recent patients on component mount
  useEffect(() => {
    loadRecentPatients();
    // Set practitioner ID if not already set
    if (user?.email) {
      setPractitioner(user.email);
    }
  }, []);

  const normalizePatient = useCallback((data: any): Patient => {
    const cpf = typeof data?.cpf === 'string' && data.cpf.length > 0
      ? data.cpf
      : typeof data?.patientCpf === 'string'
        ? data.patientCpf
        : '';

    const name = typeof data?.name === 'string' && data.name.length > 0
      ? data.name
      : typeof data?.patientName === 'string' && data.patientName.length > 0
        ? data.patientName
        : 'Nome não disponível';

    const phone = typeof data?.phone === 'string' && data.phone.length > 0
      ? data.phone
      : typeof data?.patientPhone === 'string' && data.patientPhone.length > 0
        ? data.patientPhone
        : undefined;

    const email = typeof data?.email === 'string' ? data.email : undefined;

    const lastAppointment = typeof data?.lastAppointment === 'string'
      ? data.lastAppointment
      : typeof data?.lastAppointmentDate === 'string'
        ? data.lastAppointmentDate
        : undefined;

    const photo = typeof data?.photo === 'string' && data.photo.length > 0 ? data.photo : undefined;

    return {
      cpf,
      name,
      phone,
      email,
      lastAppointment,
      photo,
      raw: data,
    };
  }, []);

  const recentPatientsList = useMemo(
    () => recentPatients.map((patient) => normalizePatient(patient)),
    [recentPatients, normalizePatient]
  );

  // Debounced search function
  const performSearch = useCallback(async (term: string, type: 'name' | 'cpf' | 'phone') => {
    if (term.length < SEARCH_MIN_LENGTH) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    try {
      logger.debug('[AppointmentStep1] Searching for:', term, 'type:', type);
      
      const results = await api.searchPatients(term, type, 1);
      logger.debug('[AppointmentStep1] Search results:', results);
      
      if (Array.isArray(results?.data?.data)) {
        const normalized = results.data.data.map((item: any) => normalizePatient(item));
        setSearchResults(normalized);
        setHasSearched(true);
      }
    } catch (error) {
      logger.error('[AppointmentStep1] Search error:', error);
      Alert.alert('Erro', 'Não foi possível buscar os pacientes');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle search input change
  const handleSearchChange = (text: string) => {
    setSearchTerm(text);
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      performSearch(text, searchType);
    }, SEARCH_DELAY);
    
    setSearchTimeout(timeout);
  };

  // Handle search type change
  const handleSearchTypeChange = (type: 'name' | 'cpf' | 'phone') => {
    setSearchType(type);
    if (searchTerm.length >= SEARCH_MIN_LENGTH) {
      performSearch(searchTerm, type);
    }
  };

  // Handle patient selection
  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    const cpf = patient.cpf;
    const name = patient.name;
    const phone = patient.phone ?? '';

    setPatient(cpf, name, phone);
    const recentPatient = (patient.raw && typeof patient.raw === 'object' && 'cpf' in patient.raw && 'name' in patient.raw)
      ? patient.raw
      : { cpf, name, phone };
    addRecentPatient(recentPatient as RecentPatient);
  };

  // Handle continue to next step
  const handleContinue = () => {
    if (canProceedFromStep(1)) {
      navigation.navigate('AppointmentStep2');
    }
  };

  // Format CPF for display
  const formatCPF = (cpf: string | undefined) => {
    if (!cpf) return '';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  // Format phone for display
  const formatPhone = (phone: string | undefined) => {
    if (!phone) return '';
    return phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
  };

  // Get search type display name
  const getSearchTypeLabel = (type: string) => {
    switch (type) {
      case 'name': return 'Nome';
      case 'cpf': return 'CPF';
      case 'phone': return 'Telefone';
      default: return 'Nome';
    }
  };

  // Render patient card
  const renderPatientCard = ({ item: patient, isRecent = false }: { item: Patient; isRecent?: boolean }) => {
    const isSelected = selectedPatient?.cpf === patient.cpf && patient.cpf.length > 0;
    
    return (
      <TouchableOpacity
        style={[
          styles.patientCard,
          isSelected && styles.selectedPatientCard,
          isRecent && styles.recentPatientCard,
        ]}
        onPress={() => handlePatientSelect(patient)}
        activeOpacity={0.7}
      >
        <View style={styles.patientInfo}>
          <View style={styles.avatarContainer}>
            {patient.photo ? (
              <Image source={{ uri: patient.photo }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <FontAwesome name="user" size={20} color={theme.colors.textSecondary} />
              </View>
            )}
          </View>
          
          <View style={styles.patientDetails}>
            <Text style={styles.patientName} numberOfLines={1}>
              {patient.name}
            </Text>
            <Text style={styles.patientCpf}>
              CPF: {formatCPF(patient.cpf)}
            </Text>
            {patient.phone && (
              <Text style={styles.patientPhone}>
                📱 {formatPhone(patient.phone)}
              </Text>
            )}
            {patient.lastAppointment && (
              <Text style={styles.lastAppointment}>
                Última consulta: {new Date(patient.lastAppointment).toLocaleDateString('pt-BR')}
              </Text>
            )}
          </View>
        </View>
        
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <MaterialIcons name="check-circle" size={24} color={theme.colors.primary} />
          </View>
        )}
        
        {isRecent && (
          <View style={styles.recentBadge}>
            <Text style={styles.recentBadgeText}>Recente</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

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
              <Text style={styles.greeting}>Novo Agendamento</Text>
              <Text style={styles.userName}>Passo 1 de 6</Text>
              <Text style={styles.dateText}>Selecione o paciente</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.logoutButton}>
              <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Question Title */}
          <View style={styles.questionContainer}>
            <Text style={styles.questionTitle}>Para quem é a consulta?</Text>
            <Text style={styles.questionSubtitle}>
              Busque e selecione o paciente para agendar
            </Text>
          </View>

          {/* Search Section */}
          <View style={styles.searchContainer}>
            {/* Search Input */}
            <View style={styles.searchInputContainer}>
              <FontAwesome 
                name="search" 
                size={16} 
                color={theme.colors.textSecondary} 
                style={styles.searchIcon} 
              />
              <TextInput
                style={styles.searchInput}
                placeholder={`Buscar por ${getSearchTypeLabel(searchType).toLowerCase()}...`}
                value={searchTerm}
                onChangeText={handleSearchChange}
                placeholderTextColor={theme.colors.textSecondary}
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchTerm('');
                    setSearchResults([]);
                    setHasSearched(false);
                  }}
                >
                  <FontAwesome name="times" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Search Type Toggle */}
            <View style={styles.searchTypeContainer}>
              {(['name', 'cpf', 'phone'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.searchTypeButton,
                    searchType === type && styles.activeSearchTypeButton
                  ]}
                  onPress={() => handleSearchTypeChange(type)}
                >
                  <Text
                    style={[
                      styles.searchTypeButtonText,
                      searchType === type && styles.activeSearchTypeButtonText
                    ]}
                  >
                    {getSearchTypeLabel(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Minimum search length hint */}
            {searchTerm.length > 0 && searchTerm.length < SEARCH_MIN_LENGTH && (
              <Text style={styles.searchHint}>
                Digite pelo menos {SEARCH_MIN_LENGTH} caracteres para buscar
              </Text>
            )}
          </View>

          {/* Recent Patients */}
          {recentPatientsList.length > 0 && !hasSearched && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <FontAwesome name="history" size={16} color={theme.colors.primary} />
                <Text style={styles.sectionTitle}>Pacientes Recentes</Text>
              </View>
              
              {recentPatientsList.map((patient, index) => (
                <View key={`recent-${patient.cpf || patient.name || index}`}>
                  {renderPatientCard({ item: patient, isRecent: true })}
                </View>
              ))}
            </View>
          )}

          {/* Search Results */}
          {hasSearched && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <FontAwesome name="search" size={16} color={theme.colors.primary} />
                <Text style={styles.sectionTitle}>
                  Resultados da busca ({searchResults.length})
                </Text>
              </View>

              {loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={styles.loadingText}>Buscando pacientes...</Text>
                </View>
              )}

              {!loading && searchResults.length === 0 && (
                <View style={styles.emptyContainer}>
                  <FontAwesome name="user-times" size={32} color={theme.colors.textSecondary} />
                  <Text style={styles.emptyTitle}>Nenhum paciente encontrado</Text>
                  <Text style={styles.emptyText}>
                    Tente buscar com diferentes termos ou cadastre um novo paciente
                  </Text>
                </View>
              )}

              {!loading && searchResults.map((patient, index) => (
                <View key={`search-${patient.cpf || patient.name || index}`}>
                  {renderPatientCard({ item: patient })}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              !canProceedFromStep(1) && styles.disabledButton
            ]}
            onPress={handleContinue}
            disabled={!canProceedFromStep(1)}
          >
            <Text
              style={[
                styles.continueButtonText,
                !canProceedFromStep(1) && styles.disabledButtonText
              ]}
            >
              Continuar
            </Text>
            <FontAwesome 
              name="arrow-right" 
              size={16} 
              color={canProceedFromStep(1) ? theme.colors.white : theme.colors.textSecondary} 
            />
          </TouchableOpacity>
        </View>
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
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 44,
    paddingBottom: theme.spacing.lg,
    marginBottom: -theme.spacing.md,
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
  logoutButton: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.white + '20',
    borderRadius: 8,
    marginTop: theme.spacing.xs,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  questionContainer: {
    marginBottom: 24,
  },
  questionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  questionSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  searchContainer: {
    marginBottom: 24,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
  },
  searchTypeContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 4,
    marginBottom: 8,
  },
  searchTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeSearchTypeButton: {
    backgroundColor: theme.colors.primary,
  },
  searchTypeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  activeSearchTypeButtonText: {
    color: theme.colors.white,
  },
  searchHint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: 8,
  },
  patientCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  selectedPatientCard: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: theme.colors.primary + '10',
  },
  recentPatientCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientDetails: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  patientCpf: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  patientPhone: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  lastAppointment: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  recentBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  recentBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.white,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 250,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  continueButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: theme.colors.backgroundSecondary,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.white,
    marginRight: 8,
  },
  disabledButtonText: {
    color: theme.colors.textSecondary,
  },
});
