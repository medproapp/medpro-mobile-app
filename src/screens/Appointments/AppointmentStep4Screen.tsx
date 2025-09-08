import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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
import { useAuthStore } from '@store/authStore';
import { api } from '@services/api';
import { DashboardStackParamList } from '@types/navigation';

type Step4NavigationProp = StackNavigationProp<DashboardStackParamList, 'AppointmentStep4'>;

interface Location {
  locIdentifier: string;
  locName: string;
  locAddress?: string;
  locCity?: string;
  locState?: string;
  locType?: string;
  locPhone?: string;
}

export const AppointmentStep4Screen: React.FC = () => {
  const navigation = useNavigation<Step4NavigationProp>();
  const { user } = useAuthStore();
  const { 
    appointmentData, 
    selectedServices,
    canProceedFromStep,
    getTotalServicesValue,
    setLocation
  } = useAppointmentStore();

  // State
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Load locations on component mount
  useEffect(() => {
    loadLocations();
  }, []);

  // Load practitioner locations
  const loadLocations = async () => {
    if (!user?.email) {
      Alert.alert('Erro', 'Dados do usuário não encontrados');
      return;
    }

    setLoading(true);
    try {
      console.log('[AppointmentStep4] Loading locations for practitioner:', user.email);
      
      const result = await api.getPractitionerLocations(user.email);
      console.log('[AppointmentStep4] Locations result:', result);
      
      if (result?.data && Array.isArray(result.data)) {
        setLocations(result.data);
      } else if (Array.isArray(result)) {
        setLocations(result);
      } else {
        setLocations([]);
      }
    } catch (error) {
      console.error('[AppointmentStep4] Error loading locations:', error);
      setLocations([]);
      Alert.alert('Erro', 'Não foi possível carregar os locais de atendimento');
    } finally {
      setLoading(false);
    }
  };

  // Handle location selection
  const handleLocationSelect = (location: Location) => {
    setSelectedLocation(location.locIdentifier);
    setLocation(location.locIdentifier, location.locName);
  };

  // Handle continue to next step
  const handleContinue = () => {
    if (canProceedFromStep(4)) {
      navigation.navigate('AppointmentStep5');
    }
  };

  // Get location icon based on type or name
  const getLocationIcon = (locType?: string, locName?: string) => {
    const type = locType?.toLowerCase() || locName?.toLowerCase() || '';
    
    if (type.includes('hospital') || type.includes('centro médico')) return 'hospital-o';
    if (type.includes('clínica') || type.includes('clinic')) return 'user-md';
    if (type.includes('consultório') || type.includes('office')) return 'building-o';
    if (type.includes('domicílio') || type.includes('casa') || type.includes('home')) return 'home';
    if (type.includes('telemedicina') || type.includes('online') || type.includes('virtual')) return 'video-camera';
    
    return 'map-marker';
  };

  // Format address string
  const formatAddress = (location: Location) => {
    const parts = [];
    if (location.locAddress) parts.push(location.locAddress);
    if (location.locCity) parts.push(location.locCity);
    if (location.locState) parts.push(location.locState);
    return parts.join(', ') || 'Endereço não informado';
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
              <Text style={styles.greeting}>Local de Atendimento</Text>
              <Text style={styles.userName}>Passo 4 de 6</Text>
              <Text style={styles.dateText}>Escolha onde atender</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.logoutButton}>
              <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Question Title */}
          <View style={styles.questionContainer}>
            <Text style={styles.questionTitle}>Onde será a consulta?</Text>
            <Text style={styles.questionSubtitle}>
              Paciente: {appointmentData.patientName}
            </Text>
            <Text style={styles.questionSubtitle}>
              Total: R$ {getTotalServicesValue().toFixed(2)}
            </Text>
          </View>

          {/* Locations Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <FontAwesome name="map-marker" size={16} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Locais Disponíveis</Text>
            </View>

            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Carregando locais...</Text>
              </View>
            )}

            {!loading && locations.length === 0 && (
              <View style={styles.emptyContainer}>
                <FontAwesome name="map-o" size={32} color={theme.colors.textSecondary} />
                <Text style={styles.emptyTitle}>Nenhum local encontrado</Text>
                <Text style={styles.emptyText}>
                  Não há locais de atendimento cadastrados para este profissional
                </Text>
              </View>
            )}

            {!loading && locations.length > 0 && (
              <>
                {locations.map((location) => (
                  <TouchableOpacity
                    key={location.locIdentifier}
                    style={[
                      styles.locationCard,
                      selectedLocation === location.locIdentifier && styles.selectedLocationCard,
                    ]}
                    onPress={() => handleLocationSelect(location)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.locationCardContent}>
                      <View style={styles.locationIconContainer}>
                        <FontAwesome 
                          name={getLocationIcon(location.locType, location.locName)} 
                          size={24} 
                          color={selectedLocation === location.locIdentifier ? theme.colors.primary : theme.colors.textSecondary} 
                        />
                      </View>
                      
                      <View style={styles.locationInfo}>
                        <Text style={[
                          styles.locationName,
                          selectedLocation === location.locIdentifier && styles.selectedLocationText
                        ]}>
                          {location.locName}
                        </Text>
                        
                        <Text style={styles.locationAddress}>
                          {formatAddress(location)}
                        </Text>
                        
                        {location.locPhone && (
                          <View style={styles.phoneContainer}>
                            <FontAwesome name="phone" size={12} color={theme.colors.textSecondary} />
                            <Text style={styles.locationPhone}>
                              {location.locPhone}
                            </Text>
                          </View>
                        )}
                        
                        {location.locType && (
                          <View style={styles.typeContainer}>
                            <FontAwesome name="tag" size={12} color={theme.colors.textSecondary} />
                            <Text style={styles.locationType}>
                              {location.locType}
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      {selectedLocation === location.locIdentifier && (
                        <View style={styles.selectedIndicator}>
                          <MaterialIcons name="check-circle" size={24} color={theme.colors.primary} />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>

          {/* Location Summary */}
          {selectedLocation && (
            <View style={styles.sectionContainer}>
              <View style={styles.summaryContainer}>
                <Text style={styles.summaryTitle}>Local Selecionado</Text>
                
                {(() => {
                  const location = locations.find(l => l.locIdentifier === selectedLocation);
                  return location ? (
                    <>
                      <View style={styles.summaryRow}>
                        <FontAwesome name="building" size={16} color={theme.colors.primary} />
                        <Text style={styles.summaryValue}>{location.locName}</Text>
                      </View>
                      
                      <View style={styles.summaryRow}>
                        <FontAwesome name="map-marker" size={16} color={theme.colors.primary} />
                        <Text style={styles.summaryValue}>{formatAddress(location)}</Text>
                      </View>
                      
                      {location.locPhone && (
                        <View style={styles.summaryRow}>
                          <FontAwesome name="phone" size={16} color={theme.colors.primary} />
                          <Text style={styles.summaryValue}>{location.locPhone}</Text>
                        </View>
                      )}
                      
                      {location.locType && (
                        <View style={styles.summaryRow}>
                          <FontAwesome name="tag" size={16} color={theme.colors.primary} />
                          <Text style={styles.summaryValue}>{location.locType}</Text>
                        </View>
                      )}
                    </>
                  ) : null;
                })()}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Navigation Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <FontAwesome name="arrow-left" size={16} color={theme.colors.primary} />
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.continueButton,
              !selectedLocation && styles.disabledButton
            ]}
            onPress={handleContinue}
            disabled={!selectedLocation}
          >
            <Text
              style={[
                styles.continueButtonText,
                !selectedLocation && styles.disabledButtonText
              ]}
            >
              Continuar
            </Text>
            <FontAwesome 
              name="arrow-right" 
              size={16} 
              color={selectedLocation ? theme.colors.white : theme.colors.textSecondary} 
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
    marginBottom: 4,
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
  locationCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectedLocationCard: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: theme.colors.primary + '10',
  },
  locationCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  selectedLocationText: {
    color: theme.colors.primary,
  },
  locationAddress: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationPhone: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationType: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  selectedIndicator: {
    marginLeft: 12,
  },
  summaryContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  summaryValue: {
    fontSize: 14,
    color: theme.colors.text,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
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
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 12,
  },
  backButton: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
    marginLeft: 8,
  },
  continueButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
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