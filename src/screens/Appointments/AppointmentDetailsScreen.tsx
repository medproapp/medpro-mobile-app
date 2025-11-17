import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
  StatusBar,
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { Card, Loading, CachedImage } from '@components/common';
import { theme } from '@theme/index';
import { apiService, API_BASE_URL } from '@services/api';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DashboardStackParamList } from '@/types/navigation';
import { useAuthStore } from '@store/authStore';
import { PreAppointmentFormStatus } from '@/types/preAppointment';

type AppointmentDetailsScreenProps = RouteProp<DashboardStackParamList, 'AppointmentDetails'>;
type AppointmentDetailsNavigationProp = StackNavigationProp<DashboardStackParamList, 'AppointmentDetails'>;

interface AppointmentDetails {
  id: string;
  identifier: string;
  patientName: string;
  patientCpf: string;
  patientPhoto?: string;
  date: string;
  time: string;
  startdate: string;
  starttime: string;
  duration: string;
  type: string;
  appointmenttype: string;
  description: string;
  note: string;
  status: 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'checked-in';
  serviceCategory: string;
  serviceType: string;
  serviceCategoryCode?: string;
  serviceTypeCode?: string;
  location?: {
    name: string;
    id: string;
    address: string;
    phone?: string;
    email?: string;
  };
  practitioner?: {
    name: string;
    crm: string;
  };
  isLead?: boolean;
}

const formatAppointmentType = (type: string): string => {
  const types: Record<string, string> = {
    ROUTINE: "Agendamento Regular",
    WALKIN: "Visita não agendada", 
    FOLLOWUP: "Retorno",
    CHECKUP: "Check-up de Rotina",
    EMERGENCY: "Emergência",
  };
  return types[type] || type || "Não especificado";
};

const toLocalDateTime = (utcDate?: string, utcTime?: string): Date => {
  if (!utcDate) {
    return new Date();
  }

  const trimmedDate = utcDate.trim();
  const baseDate = trimmedDate.includes('T') ? trimmedDate.slice(0, 10) : trimmedDate;

  let timePart = (utcTime || '').trim();
  if (timePart.includes(' ')) {
    timePart = timePart.split(' ')[0];
  }
  if (timePart.endsWith('Z')) {
    timePart = timePart.slice(0, -1);
  }
  if (/^\d{2}:\d{2}$/.test(timePart)) {
    timePart = `${timePart}:00`;
  }
  if (!/^\d{2}:\d{2}:\d{2}$/.test(timePart)) {
    timePart = '00:00:00';
  }

  const isoString = `${baseDate}T${timePart}Z`;
  const localDate = new Date(isoString);

  if (Number.isNaN(localDate.getTime())) {
    return new Date(trimmedDate);
  }

  return localDate;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'booked': return theme.colors.info;
    case 'arrived': return theme.colors.warning;
    case 'checked-in': return theme.colors.primary;
    case 'fulfilled': return theme.colors.success;
    case 'cancelled': return theme.colors.error;
    default: return theme.colors.textSecondary;
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'booked': return 'Agendada';
    case 'arrived': return 'Chegou';
    case 'checked-in': return 'Check-in';
    case 'fulfilled': return 'Atendida';
    case 'cancelled': return 'Cancelada';
    default: return status;
  }
};

// Pre-appointment form status helpers
const getFormStatusColor = (status: string) => {
  switch (status) {
    case 'submitted': return theme.colors.success;
    case 'started': return theme.colors.warning;
    case 'pending': return theme.colors.textSecondary;
    case 'expired': return theme.colors.error;
    case 'dismissed': return theme.colors.textSecondary;
    default: return theme.colors.textSecondary;
  }
};

const getFormStatusIcon = (status: string) => {
  switch (status) {
    case 'submitted': return 'check-circle';
    case 'started': return 'clock-o';
    case 'pending': return 'circle-o';
    case 'expired': return 'exclamation-triangle';
    case 'dismissed': return 'times-circle';
    default: return 'circle-o';
  }
};

const getFormStatusText = (status: string) => {
  switch (status) {
    case 'submitted': return 'Completo';
    case 'started': return 'Em Andamento';
    case 'pending': return 'Pendente';
    case 'expired': return 'Expirado';
    case 'dismissed': return 'Dispensado';
    default: return status;
  }
};

export const AppointmentDetailsScreen: React.FC = () => {
  const navigation = useNavigation<AppointmentDetailsNavigationProp>();
  const route = useRoute<AppointmentDetailsScreenProps>();
  const { appointmentId } = route.params;
  const { user, token } = useAuthStore();

  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [formStatus, setFormStatus] = useState<PreAppointmentFormStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);


  const fetchAppointmentDetails = async () => {
    try {
      setLoading(true);
      console.log('Fetching appointment details for ID:', appointmentId);

      const appointmentData = await apiService.getAppointmentById(appointmentId);
      console.log('Raw appointment data response:', appointmentData);

      if (appointmentData) {
        // The data might be directly in the response or nested under 'data'
        const apt = appointmentData.data || appointmentData;
        console.log('Processed appointment data:', apt);

        const isLead = apt.subject_type === 'lead';
        const localStartDate = toLocalDateTime(apt.startdate, apt.starttime);

        // Fetch all independent data in parallel for better performance
        const [patientResult, serviceInfo, locationResult, formData] = await Promise.all([
          // 1. Fetch patient or lead details
          (async () => {
            if (isLead && apt.lead_id) {
              console.log('[AppointmentDetails] Processing lead appointment:', apt.lead_id);
              try {
                const leadData = await apiService.getLeadDetails(apt.lead_id);
                return {
                  name: leadData.lead?.patient_name || 'Lead',
                  cpf: '', // Leads don't have CPF/photos
                };
              } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.warn('[AppointmentDetails] Error fetching lead details:', errorMessage);
                return { name: 'Lead', cpf: '' };
              }
            } else if (apt.subject) {
              try {
                const patientData = await apiService.getPatientDetails(apt.subject);
                return {
                  name: patientData.data?.name || 'Paciente',
                  cpf: patientData.data?.cpf || '',
                };
              } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error('[AppointmentDetails] Error fetching patient details:', errorMessage);
                return { name: 'Paciente', cpf: '' };
              }
            }
            return { name: 'Paciente', cpf: '' };
          })(),

          // 2. Fetch service descriptions
          (async () => {
            if (apt.servicecategory || apt.servicetype) {
              try {
                return await apiService.getServiceDescriptions(
                  apt.servicecategory || null,
                  apt.servicetype || null
                );
              } catch (error) {
                console.error('[AppointmentDetails] Error fetching service descriptions:', error);
                return null;
              }
            }
            return null;
          })(),

          // 3. Fetch location details
          (async () => {
            if (apt.locationid) {
              try {
                const location = await apiService.getLocationById(
                  String(apt.locationid),
                  user?.email || undefined
                );

                if (location) {
                  return {
                    id: String(apt.locationid),
                    name:
                      location.locName ??
                      location.locationname ??
                      location.name ??
                      '',
                    address:
                      location.locAddress ??
                      location.locationaddress ??
                      location.address ??
                      location.addressline1 ??
                      '',
                    phone:
                      location.locContact ??
                      location.phone ??
                      location.contactphone ??
                      location.phoneNumber ??
                      '',
                    email: location.email ?? location.contactemail ?? '',
                  };
                }
              } catch (error) {
                console.error('[AppointmentDetails] Error fetching location info:', error);
              }
            }
            return undefined;
          })(),

          // 4. Fetch pre-appointment form status
          (async () => {
            try {
              const formData = await apiService.getPreAppointmentFormStatus(appointmentId);
              if (formData) {
                console.log('[AppointmentDetails] Pre-appointment form status:', formData);
              } else {
                console.log('[AppointmentDetails] No pre-appointment form found for this appointment');
              }
              return formData;
            } catch (formError) {
              console.log('[AppointmentDetails] Error fetching pre-appointment form:', formError);
              return null;
            }
          })(),
        ]);

        // Process service descriptions
        const serviceCategoryDisplay = serviceInfo?.category
          ? (serviceInfo.category.categoryDesc || serviceInfo.category.description || apt.servicecategory || 'Não especificado')
          : (apt.servicecategory || 'Não especificado');

        const serviceTypeDisplay = serviceInfo?.type
          ? (serviceInfo.type.servicetypeDesc || serviceInfo.type.description || apt.servicetype || 'Não especificado')
          : (apt.servicetype || 'Não especificado');

        // Build appointment details object
        const appointmentDetails: AppointmentDetails = {
          id: apt.identifier?.toString() || appointmentId,
          identifier: apt.identifier?.toString() || appointmentId,
          patientName: patientResult.name,
          patientCpf: patientResult.cpf,
          date: localStartDate.toLocaleDateString('pt-BR'),
          time: localStartDate.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          startdate: apt.startdate || '',
          starttime: apt.starttime || '',
          duration: apt.duration ? `${apt.duration} min` : '60 min',
          type: formatAppointmentType(apt.appointmenttype || ''),
          appointmenttype: apt.appointmenttype || '',
          description: apt.description || 'Sem descrição',
          note: apt.note || 'Sem observações',
          status: apt.status || 'booked',
          serviceCategory: serviceCategoryDisplay,
          serviceCategoryCode: apt.servicecategory || undefined,
          serviceType: serviceTypeDisplay,
          serviceTypeCode: apt.servicetype || undefined,
          location: locationResult,
          practitioner: apt.practitionerid ? {
            name: apt.practitionerid,
            crm: ''
          } : undefined,
          isLead
        };

        console.log('Final appointment details:', appointmentDetails);

        // Update state in a single batch
        setAppointment(appointmentDetails);
        setFormStatus(formData);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching appointment details:', errorMessage);
      console.error('Error details:', errorMessage);
      Alert.alert(
        'Erro',
        `Não foi possível carregar os detalhes do agendamento: ${errorMessage}`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAppointmentDetails();
  }, [appointmentId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAppointmentDetails();
  };

  const handleStartEncounter = () => {
    if (appointment) {
      Alert.alert(
        'Iniciar Atendimento',
        `Deseja iniciar o atendimento com ${appointment.patientName}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Iniciar', 
            onPress: () => {
              // Navigate to encounter start (this would need to be implemented)
              console.log('Starting encounter for appointment:', appointmentId);
              Alert.alert('Info', 'Funcionalidade de iniciar atendimento será implementada em breve.');
            }
          }
        ]
      );
    }
  };

  const handleViewPatient = () => {
    if (!appointment?.patientCpf) {
      return;
    }

    const tabNavigation = navigation.getParent();
    if (tabNavigation) {
      tabNavigation.navigate('Patients', {
        screen: 'PatientDashboard',
        params: {
          patientCpf: appointment.patientCpf,
          patientName: appointment.patientName,
        },
      });
      return;
    }

    navigation.navigate('PatientDetails', {
      patientId: appointment.patientCpf,
    });
  };

  const handleEditAppointment = () => {
    Alert.alert('Info', 'Funcionalidade de edição será implementada em breve.');
  };

  const handleCancelAppointment = () => {
    if (!appointment) return;

    // Don't allow cancelling if already cancelled
    if (appointment.status === 'cancelled') {
      Alert.alert('Atenção', 'Este agendamento já foi cancelado.');
      return;
    }

    Alert.alert(
      'Cancelar Agendamento',
      `Deseja cancelar o agendamento com ${appointment.patientName}?`,
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);
              console.log('[AppointmentDetails] Cancelling appointment:', appointmentId);

              await apiService.cancelAppointment(appointmentId);

              console.log('[AppointmentDetails] Appointment cancelled successfully');

              // Show success message
              Alert.alert(
                'Sucesso',
                'Agendamento cancelado com sucesso.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Refresh the appointment details to show updated status
                      fetchAppointmentDetails();
                      // Optionally navigate back to appointment list
                      // navigation.goBack();
                    }
                  }
                ]
              );
            } catch (error: any) {
              console.error('[AppointmentDetails] Error cancelling appointment:', error);
              Alert.alert(
                'Erro',
                error.message || 'Não foi possível cancelar o agendamento. Tente novamente.'
              );
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return <Loading text="Carregando detalhes do agendamento..." />;
  }

  if (!appointment) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome name="exclamation-triangle" size={48} color={theme.colors.error} />
        <Text style={styles.errorTitle}>Agendamento não encontrado</Text>
        <Text style={styles.errorSubtitle}>Verifique se o ID do agendamento está correto.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.container}>
        {/* Header with gradient background - same as main page */}
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
              <Text style={styles.greeting}>Agendamento</Text>
              <Text style={styles.userName}>{appointment.patientName}</Text>
              <Text style={styles.dateText}>{appointment.date} às {appointment.time}</Text>
            </View>
            <View style={styles.appointmentBadge}>
              <Text style={styles.appointmentBadgeText}>#{appointment.identifier}</Text>
            </View>
          </View>
        </View>

        {/* Scrollable content area with pull-to-refresh */}
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        >
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
            <Text style={styles.statusText}>{getStatusText(appointment.status)}</Text>
          </View>
        </View>

        {/* Patient Info */}
        <Card style={styles.patientCard}>
          <View style={styles.patientHeader}>
            <CachedImage
              uri={appointment.patientCpf ? `${API_BASE_URL}/patient/getpatientphoto?patientCpf=${appointment.patientCpf}` : undefined}
              headers={token ? { Authorization: `Bearer ${token}` } : undefined}
              style={[styles.patientImageContainer, styles.patientImage]}
              fallbackIcon="user"
              fallbackIconSize={30}
              fallbackIconColor={theme.colors.primary}
            />
            <View style={styles.patientInfo}>
              <Text style={styles.patientLabel}>Agendamento com:</Text>
              <View style={styles.patientNameRow}>
                <Text style={styles.patientName}>{appointment.patientName}</Text>
                {appointment.isLead && (
                  <View style={styles.leadBadge}>
                    <Text style={styles.leadBadgeText}>LEAD</Text>
                  </View>
                )}
              </View>
              {appointment.patientCpf && (
                <Text style={styles.patientCpf}>CPF: {appointment.patientCpf}</Text>
              )}
            </View>
          </View>

          {!appointment.isLead && (
            <TouchableOpacity style={styles.viewPatientButton} onPress={handleViewPatient}>
              <FontAwesome name="id-card" size={16} color={theme.colors.primary} />
              <Text style={styles.viewPatientText}>Ver Prontuário</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Appointment Time */}
        <Card style={styles.timeCard}>
          <Text style={styles.sectionTitle}>Data e Horário</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeItem}>
              <FontAwesome name="calendar" size={20} color={theme.colors.primary} />
              <Text style={styles.timeLabel}>Data</Text>
              <Text style={styles.timeValue}>{appointment.date}</Text>
            </View>
            <View style={styles.timeItem}>
              <FontAwesome name="clock-o" size={20} color={theme.colors.primary} />
              <Text style={styles.timeLabel}>Hora</Text>
              <Text style={styles.timeValue}>{appointment.time}</Text>
            </View>
            <View style={styles.timeItem}>
              <FontAwesome name="hourglass-half" size={20} color={theme.colors.primary} />
              <Text style={styles.timeLabel}>Duração</Text>
              <Text style={styles.timeValue}>{appointment.duration}</Text>
            </View>
          </View>
        </Card>

        {/* Appointment Details */}
        <Card style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Detalhes do Agendamento</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tipo:</Text>
            <Text style={styles.detailValue}>{appointment.type}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Descrição:</Text>
            <Text style={styles.detailValue}>{appointment.description}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Observações:</Text>
            <Text style={styles.detailValue}>{appointment.note}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Categoria:</Text>
            <View style={styles.detailValueContainer}>
              <View style={[styles.detailBadge, styles.categoryBadge]}>
                <Text style={[styles.detailBadgeText, styles.categoryBadgeText]}>
                  {appointment.serviceCategory}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Especialidade:</Text>
            <View style={styles.detailValueContainer}>
              <View style={[styles.detailBadge, styles.typeBadge]}>
                <Text style={[styles.detailBadgeText, styles.typeBadgeText]}>
                  {appointment.serviceType}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Pre-Appointment Form Status */}
        {formStatus && (
          <Card style={styles.formStatusCard}>
            <Text style={styles.sectionTitle}>Formulário Pré-Consulta</Text>

            <View style={styles.formStatusRow}>
              <View style={styles.formStatusInfo}>
                <View style={styles.formStatusBadge}>
                  <FontAwesome
                    name={getFormStatusIcon(formStatus.formStatus)}
                    size={18}
                    color={getFormStatusColor(formStatus.formStatus)}
                    style={styles.formStatusIconStyle}
                  />
                  <Text style={[styles.formStatusLabel, { color: getFormStatusColor(formStatus.formStatus) }]}>
                    {getFormStatusText(formStatus.formStatus)}
                  </Text>
                </View>
                {formStatus.totalFormsCount > 0 && (
                  <Text style={styles.formCount}>
                    {formStatus.totalFormsCount} {formStatus.totalFormsCount === 1 ? 'formulário' : 'formulários'}
                  </Text>
                )}
              </View>

              <View style={styles.formProgressContainer}>
                <Text style={styles.formProgressLabel}>Progresso</Text>
                <View style={styles.formProgressBar}>
                  <View
                    style={[
                      styles.formProgressFill,
                      {
                        width: `${formStatus.progressPercentage}%`,
                        backgroundColor: getFormStatusColor(formStatus.formStatus),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.formProgressText}>{formStatus.progressPercentage}%</Text>
              </View>
            </View>

            {formStatus.formSubmittedAt && (
              <View style={styles.formTimestampRow}>
                <FontAwesome name="check-circle" size={12} color={theme.colors.success} />
                <Text style={styles.formTimestampText}>
                  Enviado em {new Date(formStatus.formSubmittedAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}

            {(formStatus.formStatus === 'submitted' || formStatus.formStatus === 'started') && (
              <TouchableOpacity
                style={styles.viewFormButton}
                onPress={() => {
                  navigation.navigate('FormResponse', {
                    trackingId: formStatus.trackingId,
                    patientName: formStatus.patientName,
                    appointmentDate: `${formStatus.appointmentDate} às ${formStatus.appointmentTime}`,
                  });
                }}
              >
                <FontAwesome name="file-text-o" size={16} color={theme.colors.primary} />
                <Text style={styles.viewFormButtonText}>Ver Respostas</Text>
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* Location Info */}
        {appointment.location && (
          <Card style={styles.locationCard}>
            <Text style={styles.sectionTitle}>Localização</Text>
            <View style={styles.locationInfo}>
              <FontAwesome name="map-marker" size={20} color={theme.colors.primary} />
              <View style={styles.locationDetails}>
                <Text style={styles.locationName}>{appointment.location.name}</Text>
                <Text style={styles.locationAddress}>{appointment.location.address}</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <View style={styles.secondaryActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleEditAppointment}>
              <FontAwesome name="edit" size={16} color={theme.colors.primary} />
              <Text style={styles.secondaryButtonText}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryButton,
                styles.cancelButton,
                (cancelling || appointment?.status === 'cancelled') && styles.disabledButton
              ]}
              onPress={handleCancelAppointment}
              disabled={cancelling || appointment?.status === 'cancelled'}
            >
              <FontAwesome
                name={cancelling ? "spinner" : "times"}
                size={16}
                color={
                  (cancelling || appointment?.status === 'cancelled')
                    ? theme.colors.textSecondary
                    : theme.colors.error
                }
              />
              <Text style={[
                styles.secondaryButtonText,
                {
                  color: (cancelling || appointment?.status === 'cancelled')
                    ? theme.colors.textSecondary
                    : theme.colors.error
                }
              ]}>
                {cancelling ? 'Cancelando...' : 'Cancelar'}
              </Text>
            </TouchableOpacity>
          </View>
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
  scrollContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xl,
    padding: theme.spacing.lg,
  },
  headerBackground: {
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: theme.spacing.lg,
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
    zIndex: 1,
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
    marginLeft: theme.spacing.md,
  },
  greeting: {
    ...theme.typography.body,
    color: theme.colors.white + 'CC',
    fontSize: 14,
  },
  userName: {
    ...theme.typography.h1,
    color: theme.colors.white,
    fontSize: 20,
    fontWeight: '700',
    marginTop: theme.spacing.xs,
  },
  dateText: {
    ...theme.typography.caption,
    color: theme.colors.white + 'AA',
    fontSize: 12,
    marginTop: theme.spacing.xs,
    textTransform: 'capitalize',
  },
  backButton: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.white + '20',
    borderRadius: 8,
  },
  appointmentBadge: {
    backgroundColor: theme.colors.white + '20',
    borderRadius: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  appointmentBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  statusContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
  },
  statusText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  patientCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  patientImageContainer: {
    marginRight: theme.spacing.md,
  },
  patientImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary + '20',
    borderWidth: 2,
    borderColor: theme.colors.primary + '30',
  },
  patientImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary + '20',
    borderWidth: 2,
    borderColor: theme.colors.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientInfo: {
    flex: 1,
  },
  patientLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  patientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  patientName: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  leadBadge: {
    backgroundColor: theme.colors.warning + '20',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  leadBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.warning,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  patientCpf: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  viewPatientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
  },
  viewPatientText: {
    ...theme.typography.button,
    color: theme.colors.primary,
    marginLeft: theme.spacing.sm,
    fontSize: 12,
  },
  timeCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: theme.spacing.md,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  timeItem: {
    alignItems: 'center',
  },
  timeLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: theme.spacing.sm,
  },
  timeValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    marginTop: theme.spacing.xs,
    fontSize: 14,
  },
  detailsCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  detailLabel: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    width: 100,
  },
  detailValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
    fontSize: 14,
  },
  detailValueContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
  },
  detailBadgeText: {
    ...theme.typography.caption,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  categoryBadge: {
    backgroundColor: theme.colors.primary + '15',
    borderColor: theme.colors.primary + '40',
  },
  categoryBadgeText: {
    color: theme.colors.primary,
  },
  typeBadge: {
    backgroundColor: theme.colors.info + '15',
    borderColor: theme.colors.info + '40',
  },
  typeBadgeText: {
    color: theme.colors.info,
  },
  locationCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationDetails: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  locationName: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
    fontSize: 14,
  },
  locationAddress: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  actionButtons: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: 8,
    marginBottom: theme.spacing.md,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  primaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    marginLeft: theme.spacing.sm,
    fontWeight: '600',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  cancelButton: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.error + '10',
  },
  disabledButton: {
    opacity: 0.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  secondaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.primary,
    marginLeft: theme.spacing.sm,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  errorTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  errorSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  backButtonText: {
    ...theme.typography.button,
    color: theme.colors.primary,
  },
  // Form Status Card Styles
  formStatusCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  formStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: theme.spacing.md,
  },
  formStatusInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  formStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  formStatusIconStyle: {
    marginRight: theme.spacing.sm,
  },
  formStatusLabel: {
    ...theme.typography.body,
    fontSize: 16,
    fontWeight: '600',
  },
  formCount: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: theme.spacing.xs,
  },
  formProgressContainer: {
    alignItems: 'flex-end',
    width: 120,
  },
  formProgressLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginBottom: theme.spacing.xs,
  },
  formProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  formProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  formProgressText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  formTimestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  formTimestampText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginLeft: theme.spacing.sm,
  },
  viewFormButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary + '15',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: 8,
    marginTop: theme.spacing.md,
  },
  viewFormButtonText: {
    ...theme.typography.button,
    color: theme.colors.primary,
    marginLeft: theme.spacing.sm,
    fontSize: 14,
    fontWeight: '600',
  },
});
