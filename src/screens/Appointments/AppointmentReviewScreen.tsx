import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { theme } from '@theme/index';
import { useAppointmentStore } from '@store/appointmentStore';
import { useAuthStore } from '@store/authStore';
import api from '@services/api';
import { DashboardStackParamList } from '@/types/navigation';
import { logger } from '@/utils/logger';

type ReviewNavigationProp = StackNavigationProp<DashboardStackParamList, 'AppointmentReview'>;

interface Props {
  navigation: ReviewNavigationProp;
}

export const AppointmentReviewScreen: React.FC<Props> = ({ navigation }) => {
  const [submitting, setSubmitting] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [typeName, setTypeName] = useState('');
  const [appointmentTypeName, setAppointmentTypeName] = useState('');
  const { appointmentData, resetAppointment, selectedServices, getTotalServicesValue } = useAppointmentStore();
  const { user } = useAuthStore();

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    return timeStr.substring(0, 5); // HH:MM format
  };

  const handleSubmit = async () => {
    const isLead = appointmentData.subjectType === 'lead';
    const hasIdentifier = isLead ? !!appointmentData.leadId : !!appointmentData.subject;
    if (!hasIdentifier || !appointmentData.startdate || !appointmentData.starttime) {
      Alert.alert('Erro', 'Dados incompletos para criar o agendamento');
      return;
    }

    setSubmitting(true);
    
    try {
      // Prepare appointment data for submission - match webapp format exactly
      const submitData = {
        subject: appointmentData.subjectType === 'lead' ? null : appointmentData.subject,
        leadId: appointmentData.subjectType === 'lead' ? appointmentData.leadId : null,
        lead_id: appointmentData.subjectType === 'lead' ? appointmentData.leadId : null, // align with backend naming
        subjectType: appointmentData.subjectType ?? 'patient',
        subject_type: appointmentData.subjectType ?? 'patient', // backend alias
        locationid: appointmentData.locationid.toString(), // Convert to string like webapp
        status: appointmentData.status,
        practitionerid: user?.email || appointmentData.practitionerid,
        startdate: appointmentData.startdate,
        starttime: appointmentData.starttime,
        duration: appointmentData.duration.toString(), // Convert to string like webapp
        description: appointmentData.description,
        note: appointmentData.note || "",
        created: new Date().toISOString().slice(0, 19).replace('T', ' '), // YYYY-MM-DD HH:mm:ss
        servicecategory: appointmentData.servicecategory,
        servicetype: appointmentData.servicetype,
        appointmenttype: appointmentData.appointmenttype,
        selected_services: appointmentData.selected_services,
        paymentType: appointmentData.paymentType,
        selectedPractCarePlanIdForAppointment: null, // Add missing webapp field
        selectedPatientCarePlanCode: null, // Add missing webapp field
        servicesCoverageStatus: appointmentData.servicesCoverageStatus,
      };

      logger.debug('[AppointmentReview] Submitting appointment:', submitData);
      
      const result = await api.createAppointment(submitData);
      
      logger.debug('[AppointmentReview] Appointment created successfully:', result);
      
      Alert.alert(
        'Sucesso!',
        'Agendamento criado com sucesso',
        [
          {
            text: 'OK',
            onPress: () => {
              resetAppointment();
              navigation.navigate('DashboardHome');
            },
          },
        ]
      );
    } catch (error: any) {
      logger.error('[AppointmentReview] Error creating appointment:', error);
      Alert.alert(
        'Erro',
        error.message || 'Não foi possível criar o agendamento. Tente novamente.',
        [
          { text: 'Tentar Novamente', onPress: () => setSubmitting(false) },
          { text: 'Cancelar', style: 'cancel', onPress: () => setSubmitting(false) },
        ]
      );
    }
  };

  const navigateToStep = (step: number) => {
    const stepRoutes = [
      'AppointmentStep1',
      'AppointmentStep2', 
      'AppointmentStep3',
      'AppointmentStep4',
      'AppointmentStep5',
      'AppointmentStep6'
    ];
    
    if (step >= 1 && step <= 6) {
      navigation.navigate(stepRoutes[step - 1] as never);
    }
  };

  const totalServices = getTotalServicesValue();

  // Load display names for appointment details
  useEffect(() => {
    const loadDisplayNames = async () => {
      if (!user?.email) return;

      try {
        // Load service categories
        if (appointmentData.servicecategory) {
          const allCategoriesResult = await api.getServiceCategories();
          const category = allCategoriesResult?.find((cat: any) => 
            cat.categoryId.toString() === appointmentData.servicecategory
          );
          if (category) {
            setCategoryName(category.categoryDesc);
          }
        }

        // Load service types
        if (appointmentData.servicetype) {
          const allTypesResult = await api.getServiceTypes();
          const type = allTypesResult?.find((type: any) => 
            type.serviceType.toString() === appointmentData.servicetype
          );
          if (type) {
            setTypeName(type.servicetypeDesc);
          }
        }

        // Load appointment types
        if (appointmentData.appointmenttype) {
          const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
            ROUTINE: "Agendamento Regular",
            FIRST: "Primeira Consulta",
            WALKIN: "Visita não agendada",
            CHECKUP: "Check-up de Rotina",
            FOLLOWUP: "Retorno",
            EMERGENCY: "Emergência",
          };

          const appointmentTypesResult = await api.getAppointmentTypes(user.email);
          const apptConfigItem = appointmentTypesResult?.find((item: any) => item.configitem === "APPT_TYPES_CONFIG");

          if (apptConfigItem && apptConfigItem.configvalue) {
            const savedApptConfigs = typeof apptConfigItem.configvalue === "string"
              ? JSON.parse(apptConfigItem.configvalue)
              : apptConfigItem.configvalue;

            if (savedApptConfigs[appointmentData.appointmenttype]) {
              setAppointmentTypeName(APPOINTMENT_TYPE_LABELS[appointmentData.appointmenttype] || appointmentData.appointmenttype);
            }
          } else {
            // Use default labels
            setAppointmentTypeName(APPOINTMENT_TYPE_LABELS[appointmentData.appointmenttype] || appointmentData.appointmenttype);
          }
        }
      } catch (error) {
        logger.error('[AppointmentReview] Error loading display names:', error);
      }
    };

    loadDisplayNames();
  }, [appointmentData.servicecategory, appointmentData.servicetype, appointmentData.appointmenttype, user?.email]);

  const getPaymentMethodTranslation = (paymentType: string | null): string => {
    if (!paymentType) return '';
    
    const translations: { [key: string]: string } = {
      'direct': 'Pagamento Direto',
      'CASH': 'Dinheiro',
      'CREDIT_CARD': 'Cartão de Crédito',
      'DEBIT_CARD': 'Cartão de Débito',
      'PIX': 'PIX',
      'BANK_TRANSFER': 'Transferência Bancária',
      'HEALTH_INSURANCE': 'Plano de Saúde',
      'CHECK': 'Cheque',
      'BOLETO': 'Boleto',
      'INSTALLMENT': 'Parcelado',
      'FREE': 'Gratuito',
      'OTHER': 'Outro'
    };
    
    return translations[paymentType] || paymentType;
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
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Revisão do Agendamento</Text>
              <Text style={styles.headerSubtitle}>Confirme os dados antes de finalizar</Text>
            </View>

            <View style={styles.headerRight} />
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Patient Information */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <FontAwesome name="user" size={18} color={theme.colors.primary} />
                <Text style={styles.sectionTitle}>Paciente</Text>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigateToStep(1)}
              >
                <MaterialIcons name="edit" size={16} color={theme.colors.primary} />
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Nome:</Text>
              <Text style={styles.infoValue}>{appointmentData.patientName}</Text>
              <Text style={styles.infoLabel}>CPF:</Text>
              <Text style={styles.infoValue}>{appointmentData.subject}</Text>
              <Text style={styles.infoLabel}>Telefone:</Text>
              <Text style={styles.infoValue}>{appointmentData.patientPhone}</Text>
            </View>
          </View>

          {/* Location Information */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <FontAwesome name="map-marker" size={18} color={theme.colors.primary} />
                <Text style={styles.sectionTitle}>Local</Text>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigateToStep(3)}
              >
                <MaterialIcons name="edit" size={16} color={theme.colors.primary} />
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoValue}>{appointmentData.locationName}</Text>
            </View>
          </View>

          {/* Date and Time */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <FontAwesome name="calendar" size={18} color={theme.colors.primary} />
                <Text style={styles.sectionTitle}>Data e Horário</Text>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigateToStep(5)}
              >
                <MaterialIcons name="edit" size={16} color={theme.colors.primary} />
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Data:</Text>
              <Text style={styles.infoValue}>{formatDate(appointmentData.startdate)}</Text>
              <Text style={styles.infoLabel}>Horário:</Text>
              <Text style={styles.infoValue}>
                {formatTime(appointmentData.starttime)} - {formatTime(appointmentData.endtime)}
              </Text>
              <Text style={styles.infoLabel}>Duração:</Text>
              <Text style={styles.infoValue}>{appointmentData.duration} minutos</Text>
            </View>
          </View>

          {/* Appointment Details */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <FontAwesome name="clipboard" size={18} color={theme.colors.primary} />
                <Text style={styles.sectionTitle}>Detalhes da Consulta</Text>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigateToStep(6)}
              >
                <MaterialIcons name="edit" size={16} color={theme.colors.primary} />
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Categoria do Serviço:</Text>
              <Text style={styles.infoValue}>{categoryName || appointmentData.servicecategory}</Text>
              <Text style={styles.infoLabel}>Tipo de Serviço:</Text>
              <Text style={styles.infoValue}>{typeName || appointmentData.servicetype}</Text>
              <Text style={styles.infoLabel}>Tipo de Consulta:</Text>
              <Text style={styles.infoValue}>{appointmentTypeName || appointmentData.appointmenttype}</Text>
            </View>
          </View>

          {/* Selected Services */}
          {selectedServices.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                  <FontAwesome name="stethoscope" size={18} color={theme.colors.primary} />
                  <Text style={styles.sectionTitle}>Serviços Selecionados</Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => navigateToStep(2)}
                >
                  <MaterialIcons name="edit" size={16} color={theme.colors.primary} />
                  <Text style={styles.editButtonText}>Editar</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.infoCard}>
                {selectedServices.map((service, index) => (
                  <View key={index} style={styles.serviceRow}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.serviceDuration}>
                      {service.duration ? `${service.duration} min` : 'N/A'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Payment Method */}
          {(appointmentData.paymentType || totalServices > 0) && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                  <FontAwesome name="credit-card" size={18} color={theme.colors.primary} />
                  <Text style={styles.sectionTitle}>Pagamento</Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => navigateToStep(4)}
                >
                  <MaterialIcons name="edit" size={16} color={theme.colors.primary} />
                  <Text style={styles.editButtonText}>Editar</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.infoCard}>
                {appointmentData.paymentType && (
                  <>
                    <Text style={styles.infoLabel}>Forma de Pagamento:</Text>
                    <Text style={styles.infoValue}>{getPaymentMethodTranslation(appointmentData.paymentType)}</Text>
                  </>
                )}
                {totalServices > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Valor Total:</Text>
                    <Text style={styles.totalValue}>R$ {totalServices.toFixed(2)}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Description and Notes */}
          {(appointmentData.description || appointmentData.note) && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                  <FontAwesome name="sticky-note-o" size={18} color={theme.colors.primary} />
                  <Text style={styles.sectionTitle}>Observações</Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => navigateToStep(6)}
                >
                  <MaterialIcons name="edit" size={16} color={theme.colors.primary} />
                  <Text style={styles.editButtonText}>Editar</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.infoCard}>
                {appointmentData.description && (
                  <>
                    <Text style={styles.infoLabel}>Descrição:</Text>
                    <Text style={styles.infoValue}>{appointmentData.description}</Text>
                  </>
                )}
                {appointmentData.note && (
                  <>
                    <Text style={[styles.infoLabel, appointmentData.description && { marginTop: 12 }]}>
                      Observações Internas:
                    </Text>
                    <Text style={styles.infoValue}>{appointmentData.note}</Text>
                  </>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.backButtonFooter}
            onPress={() => navigation.goBack()}
            disabled={submitting}
          >
            <FontAwesome name="arrow-left" size={16} color={theme.colors.primary} />
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Confirmar Agendamento</Text>
                <FontAwesome name="check" size={16} color={theme.colors.white} />
              </>
            )}
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
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.white,
    textAlign: 'center',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.white,
    opacity: 0.9,
    textAlign: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight + '15',
  },
  editButtonText: {
    fontSize: 12,
    color: theme.colors.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 2,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 8,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  serviceName: {
    fontSize: 14,
    color: theme.colors.text,
    flex: 1,
  },
  servicePrice: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  serviceDuration: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  totalLabel: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
    gap: theme.spacing.sm,
  },
  backButtonFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    flex: 0.4,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: theme.colors.primary,
    marginLeft: 8,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    flex: 0.6,
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    color: theme.colors.white,
    fontWeight: '600',
    marginRight: 8,
  },
  disabledButton: {
    opacity: 0.6,
    backgroundColor: theme.colors.textSecondary,
  },
});
