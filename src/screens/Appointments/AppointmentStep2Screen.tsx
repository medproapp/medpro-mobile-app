import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
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
import { DashboardStackParamList } from '@/types/navigation';

type Step2NavigationProp = StackNavigationProp<DashboardStackParamList, 'AppointmentStep2'>;

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes?: number;
  category?: string;
  description?: string;
  is_preferred?: boolean;
}

const SEARCH_DELAY = 500; // ms
const SEARCH_MIN_LENGTH = 3;

export const AppointmentStep2Screen: React.FC = () => {
  const navigation = useNavigation<Step2NavigationProp>();
  const { user } = useAuthStore();
  const { 
    selectedServices,
    addService,
    removeService,
    canProceedFromStep,
    getTotalServicesValue,
    getTotalDuration,
    appointmentData
  } = useAppointmentStore();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Service[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [browseExpanded, setBrowseExpanded] = useState(false);
  const [servicesLoaded, setServicesLoaded] = useState(false);

  // Load all services for browsing
  const loadAllServices = useCallback(async () => {
    if (servicesLoaded) return;

    setLoading(true);
    try {
      console.log('[AppointmentStep2] Loading all services');
      
      const results = await api.getOfferings('SERVICE', true);
      console.log('[AppointmentStep2] Services results:', results);
      console.log('[AppointmentStep2] Results type:', typeof results);
      console.log('[AppointmentStep2] Results direct array check:', Array.isArray(results));
      
      if (Array.isArray(results)) {
        // Transform the API data to match our interface
        const transformedServices = results.map((service: any) => ({
          ...service,
          price: parseFloat(service.price) || 0, // Convert string price to number
        }));
        console.log('[AppointmentStep2] Transformed services:', transformedServices);
        setAllServices(transformedServices);
        setServicesLoaded(true);
      } else {
        console.log('[AppointmentStep2] Results is not an array:', results);
      }
    } catch (error) {
      console.error('[AppointmentStep2] Error loading services:', error);
      Alert.alert('Erro', 'Não foi possível carregar os serviços');
    } finally {
      setLoading(false);
    }
  }, [servicesLoaded]);

  // Search services
  const performSearch = useCallback(async (term: string) => {
    if (term.length < SEARCH_MIN_LENGTH) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    try {
      console.log('[AppointmentStep2] Searching for:', term);
      
      // Load all services first if not loaded
      if (allServices.length === 0 && !servicesLoaded) {
        const results = await api.getOfferings('SERVICE', true);
        if (Array.isArray(results)) {
          const transformedServices = results.map((service: any) => ({
            ...service,
            price: parseFloat(service.price) || 0,
          }));
          setAllServices(transformedServices);
          setServicesLoaded(true);
          
          // Filter from the newly loaded services
          const filteredServices = transformedServices.filter((service: any) => 
            service.name?.toLowerCase().includes(term.toLowerCase()) ||
            service.description?.toLowerCase().includes(term.toLowerCase()) ||
            service.category?.toLowerCase().includes(term.toLowerCase())
          );
          setSearchResults(filteredServices);
        }
      } else {
        // Filter from existing services
        const filteredServices = allServices.filter(service => 
          service.name?.toLowerCase().includes(term.toLowerCase()) ||
          service.description?.toLowerCase().includes(term.toLowerCase()) ||
          service.category?.toLowerCase().includes(term.toLowerCase())
        );
        setSearchResults(filteredServices);
      }
      
      setHasSearched(true);
      console.log('[AppointmentStep2] Search results:', searchResults.length);
    } catch (error) {
      console.error('[AppointmentStep2] Search error:', error);
      Alert.alert('Erro', 'Não foi possível buscar os serviços');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [allServices, servicesLoaded, loadAllServices]);

  // Handle search input change
  const handleSearchChange = (text: string) => {
    setSearchTerm(text);
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      performSearch(text);
    }, SEARCH_DELAY);
    
    setSearchTimeout(timeout);
  };

  // Handle service selection
  const handleServiceSelect = (service: Service) => {
    addService({
      id: service.id,
      name: service.name,
      price: service.price,
      duration: service.duration_minutes || null,
    });
  };

  // Handle service removal
  const handleServiceRemove = (serviceId: string) => {
    removeService(serviceId);
  };

  // Handle continue to next step
  const handleContinue = () => {
    if (canProceedFromStep(2)) {
      navigation.navigate('AppointmentStep3');
    }
  };

  // Toggle browse services
  const handleToggleBrowse = () => {
    setBrowseExpanded(!browseExpanded);
    if (!browseExpanded && !servicesLoaded) {
      loadAllServices();
    }
  };

  // Get service icon based on category
  const getServiceIcon = (category?: string) => {
    const iconMap: { [key: string]: string } = {
      'Consulta': 'user-md',
      'Exame': 'search',
      'Procedimento': 'hand-paper-o',
      'Cirurgia': 'plus-square',
      'Terapia': 'spa',
      'Diagnóstico': 'stethoscope',
      'Emergência': 'ambulance',
      'Preventivo': 'shield',
    };
    
    return iconMap[category || ''] || 'hospital-o';
  };

  // Group services by category
  const groupServicesByCategory = (services: Service[]) => {
    return services.reduce((acc: { [key: string]: Service[] }, service) => {
      const category = service.category || 'Outros Serviços';
      if (!acc[category]) acc[category] = [];
      acc[category].push(service);
      return acc;
    }, {});
  };

  // Render service card
  const renderServiceCard = (service: Service, isSelected: boolean = false) => {
    return (
      <TouchableOpacity
        key={service.id}
        style={[
          styles.serviceCard,
          isSelected && styles.selectedServiceCard,
          service.is_preferred && styles.preferredServiceCard,
        ]}
        onPress={() => handleServiceSelect(service)}
        activeOpacity={0.7}
        disabled={isSelected}
      >
        <View style={styles.serviceCardContent}>
          <View style={styles.serviceIconContainer}>
            <FontAwesome 
              name={getServiceIcon(service.category)} 
              size={20} 
              color={isSelected ? theme.colors.primary : theme.colors.textSecondary} 
            />
          </View>
          
          <View style={styles.serviceInfo}>
            <View style={styles.serviceHeader}>
              <Text style={[styles.serviceName, isSelected && styles.selectedServiceText]} numberOfLines={1}>
                {service.name}
              </Text>
              {service.is_preferred && (
                <View style={styles.preferredBadge}>
                  <FontAwesome name="star" size={10} color={theme.colors.warning} />
                </View>
              )}
            </View>
            
            {service.description && (
              <Text style={styles.serviceDescription} numberOfLines={2}>
                {service.description}
              </Text>
            )}
            
            <View style={styles.serviceDetails}>
              <Text style={[styles.servicePrice, isSelected && styles.selectedServiceText]}>
                R$ {service.price.toFixed(2)}
              </Text>
              {service.duration_minutes && (
                <View style={styles.durationContainer}>
                  <FontAwesome name="clock-o" size={12} color={theme.colors.textSecondary} />
                  <Text style={styles.durationText}>{service.duration_minutes} min</Text>
                </View>
              )}
            </View>
            
            {service.category && (
              <Text style={styles.categoryText}>
                {service.category}
              </Text>
            )}
          </View>
          
          {isSelected && (
            <View style={styles.selectedIndicator}>
              <MaterialIcons name="check-circle" size={24} color={theme.colors.primary} />
            </View>
          )}
        </View>
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
              <Text style={styles.greeting}>Serviços e Procedimentos</Text>
              <Text style={styles.userName}>Passo 2 de 6</Text>
              <Text style={styles.dateText}>Selecione os serviços</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.logoutButton}>
              <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Question Title */}
          <View style={styles.questionContainer}>
            <Text style={styles.questionTitle}>Que serviços deseja agendar?</Text>
            <Text style={styles.questionSubtitle}>
              Paciente: {appointmentData.patientName}
            </Text>
          </View>

          {/* Search Section */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <FontAwesome 
                name="search" 
                size={16} 
                color={theme.colors.textSecondary} 
                style={styles.searchIcon} 
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar serviços (mín. 3 caracteres)..."
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

            {/* Minimum search length hint */}
            {searchTerm.length > 0 && searchTerm.length < SEARCH_MIN_LENGTH && (
              <Text style={styles.searchHint}>
                Digite pelo menos {SEARCH_MIN_LENGTH} caracteres para buscar
              </Text>
            )}
          </View>

          {/* Selected Services */}
          {selectedServices.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <FontAwesome name="check-circle" size={16} color={theme.colors.success} />
                <Text style={styles.sectionTitle}>
                  Serviços Selecionados ({selectedServices.length})
                </Text>
              </View>
              
              {selectedServices.map((service) => (
                <View key={service.id} style={styles.selectedServiceItem}>
                  <View style={styles.selectedServiceInfo}>
                    <Text style={styles.selectedServiceName}>{service.name}</Text>
                    <View style={styles.selectedServiceDetails}>
                      <Text style={styles.selectedServicePrice}>R$ {service.price.toFixed(2)}</Text>
                      {service.duration && (
                        <Text style={styles.selectedServiceDuration}>{service.duration} min</Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleServiceRemove(service.id)}
                  >
                    <FontAwesome name="times" size={16} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
              
              {/* Total */}
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Total: R$ {getTotalServicesValue().toFixed(2)}</Text>
                <Text style={styles.totalDuration}>Duração: {getTotalDuration()} min</Text>
              </View>
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
                  <Text style={styles.loadingText}>Buscando serviços...</Text>
                </View>
              )}

              {!loading && searchResults.length === 0 && (
                <View style={styles.emptyContainer}>
                  <FontAwesome name="search" size={32} color={theme.colors.textSecondary} />
                  <Text style={styles.emptyTitle}>Nenhum serviço encontrado</Text>
                  <Text style={styles.emptyText}>
                    Tente buscar com diferentes termos
                  </Text>
                </View>
              )}

              {!loading && searchResults.map((service) => {
                const isSelected = selectedServices.some(s => s.id === service.id);
                return renderServiceCard(service, isSelected);
              })}
            </View>
          )}

          {/* Browse All Services */}
          {!hasSearched && (
            <View style={styles.sectionContainer}>
              <TouchableOpacity 
                style={styles.browseToggle}
                onPress={handleToggleBrowse}
              >
                <FontAwesome name="list" size={16} color={theme.colors.primary} />
                <Text style={styles.browseToggleText}>
                  {browseExpanded ? 'Ocultar' : 'Ver todos os serviços'}
                </Text>
                <FontAwesome 
                  name={browseExpanded ? "chevron-up" : "chevron-down"} 
                  size={14} 
                  color={theme.colors.primary} 
                />
              </TouchableOpacity>

              {browseExpanded && (
                <View style={styles.browseContent}>
                  {loading && (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text style={styles.loadingText}>Carregando serviços...</Text>
                    </View>
                  )}

                  {!loading && allServices.length > 0 && (() => {
                    const groupedServices = groupServicesByCategory(allServices);
                    return Object.keys(groupedServices)
                      .sort((a, b) => {
                        if (a === 'Outros Serviços') return 1;
                        if (b === 'Outros Serviços') return -1;
                        return a.localeCompare(b);
                      })
                      .map((category) => {
                        const services = groupedServices[category].sort((a, b) => {
                          if (a.is_preferred && !b.is_preferred) return -1;
                          if (!a.is_preferred && b.is_preferred) return 1;
                          return a.name.localeCompare(b.name);
                        });

                        return (
                          <View key={category} style={styles.categoryContainer}>
                            <View style={styles.categoryHeader}>
                              <Text style={styles.categoryTitle}>{category}</Text>
                              <View style={styles.categoryBadge}>
                                <Text style={styles.categoryBadgeText}>
                                  {services.length} serviço{services.length !== 1 ? 's' : ''}
                                </Text>
                              </View>
                            </View>
                            
                            {services.map((service) => {
                              const isSelected = selectedServices.some(s => s.id === service.id);
                              return renderServiceCard(service, isSelected);
                            })}
                          </View>
                        );
                      });
                  })()}
                </View>
              )}
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
              !canProceedFromStep(2) && styles.disabledButton
            ]}
            onPress={handleContinue}
            disabled={!canProceedFromStep(2)}
          >
            <Text
              style={[
                styles.continueButtonText,
                !canProceedFromStep(2) && styles.disabledButtonText
              ]}
            >
              Continuar
            </Text>
            <FontAwesome 
              name="arrow-right" 
              size={16} 
              color={canProceedFromStep(2) ? theme.colors.white : theme.colors.textSecondary} 
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
    marginBottom: 8,
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
  serviceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectedServiceCard: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: theme.colors.primary + '10',
  },
  preferredServiceCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.warning,
  },
  serviceCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  serviceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  selectedServiceText: {
    color: theme.colors.primary,
  },
  preferredBadge: {
    marginLeft: 8,
  },
  serviceDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  serviceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  categoryText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  selectedServiceItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.success + '30',
  },
  selectedServiceInfo: {
    flex: 1,
  },
  selectedServiceName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  selectedServiceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedServicePrice: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
    marginRight: 12,
  },
  selectedServiceDuration: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  removeButton: {
    padding: 8,
    backgroundColor: theme.colors.error + '20',
    borderRadius: 6,
  },
  totalContainer: {
    backgroundColor: theme.colors.primary + '10',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  totalDuration: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  browseToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  browseToggleText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.primary,
    marginLeft: 8,
    flex: 1,
  },
  browseContent: {
    marginTop: 12,
  },
  categoryContainer: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryBadgeText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
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
