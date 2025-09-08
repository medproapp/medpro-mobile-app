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
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Card, Loading } from '@components/common';
import { theme } from '@theme/index';
import { apiService } from '@services/api';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DashboardStackParamList } from '@types/navigation';
import { useAuthStore } from '@store/authStore';

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
  location?: {
    name: string;
    address: string;
  };
  practitioner?: {
    name: string;
    crm: string;
  };
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

export const AppointmentDetailsScreen: React.FC = () => {
  const navigation = useNavigation<AppointmentDetailsNavigationProp>();
  const route = useRoute<AppointmentDetailsScreenProps>();
  const { appointmentId } = route.params;
  const { user } = useAuthStore();

  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);


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
        
        // Get patient details
        let patientName = 'Paciente';
        let patientCpf = '';
        let patientPhoto = null;
        try {
          const patientData = await apiService.getPatientDetails(apt.subject);
          patientName = patientData.data?.name || 'Paciente';
          patientCpf = patientData.data?.cpf || '';
          
          // Try to get patient photo using the API service method
          try {
            const photoBase64 = await apiService.getPatientPhoto(apt.subject);
            if (photoBase64) {
              patientPhoto = photoBase64;
              console.log('Patient photo loaded successfully, length:', photoBase64.length);
            }
          } catch (photoError) {
            console.log('No patient photo available:', photoError.message);
          }
        } catch (error) {
          console.error('Error fetching patient details:', error);
        }

        const appointmentDetails: AppointmentDetails = {
          id: apt.identifier?.toString() || appointmentId,
          identifier: apt.identifier?.toString() || appointmentId,
          patientName,
          patientCpf,
          patientPhoto,
          date: apt.startdate ? new Date(apt.startdate).toLocaleDateString('pt-BR') : 'Data não disponível',
          time: apt.starttime?.substring(0, 5) || '00:00',
          startdate: apt.startdate || '',
          starttime: apt.starttime || '',
          duration: apt.duration ? `${apt.duration} min` : '60 min',
          type: formatAppointmentType(apt.appointmenttype || ''),
          appointmenttype: apt.appointmenttype || '',
          description: apt.description || 'Sem descrição',
          note: apt.note || 'Sem observações',
          status: apt.status || 'booked',
          serviceCategory: apt.servicecategory || 'Não especificado',
          serviceType: apt.servicetype || 'Não especificado',
          location: apt.locationid ? {
            name: `Local ${apt.locationid}`,
            address: 'Endereço não disponível'
          } : undefined,
          practitioner: apt.practitionerid ? {
            name: apt.practitionerid,
            crm: ''
          } : undefined
        };

        console.log('Final appointment details:', appointmentDetails);

        setAppointment(appointmentDetails);
      }
    } catch (error) {
      console.error('Error fetching appointment details:', error);
      console.error('Error details:', error.message || error);
      Alert.alert(
        'Erro',
        `Não foi possível carregar os detalhes do agendamento: ${error.message || error}`,
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
    if (appointment && appointment.patientCpf) {
      navigation.navigate('PatientDetails', { patientId: appointment.patientCpf });
    }
  };

  const handleEditAppointment = () => {
    Alert.alert('Info', 'Funcionalidade de edição será implementada em breve.');
  };

  const handleCancelAppointment = () => {
    if (appointment) {
      Alert.alert(
        'Cancelar Agendamento',
        `Deseja cancelar o agendamento com ${appointment.patientName}?`,
        [
          { text: 'Não', style: 'cancel' },
          { 
            text: 'Sim, Cancelar', 
            style: 'destructive',
            onPress: () => {
              console.log('Cancelling appointment:', appointmentId);
              Alert.alert('Info', 'Funcionalidade de cancelamento será implementada em breve.');
            }
          }
        ]
      );
    }
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
            <View style={styles.patientImageContainer}>
              <Image
                source={
                  appointment.patientPhoto 
                    ? { uri: appointment.patientPhoto }
                    : require('../../assets/medpro-logo.png')
                }
                style={styles.patientImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.patientInfo}>
              <Text style={styles.patientLabel}>Agendamento com:</Text>
              <Text style={styles.patientName}>{appointment.patientName}</Text>
              {appointment.patientCpf && (
                <Text style={styles.patientCpf}>CPF: {appointment.patientCpf}</Text>
              )}
            </View>
          </View>
          
          <TouchableOpacity style={styles.viewPatientButton} onPress={handleViewPatient}>
            <FontAwesome name="id-card" size={16} color={theme.colors.primary} />
            <Text style={styles.viewPatientText}>Ver Prontuário</Text>
          </TouchableOpacity>
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
            <Text style={styles.detailValue}>{appointment.serviceCategory}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Especialidade:</Text>
            <Text style={styles.detailValue}>{appointment.serviceType}</Text>
          </View>
        </Card>

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
            
            <TouchableOpacity style={[styles.secondaryButton, styles.cancelButton]} onPress={handleCancelAppointment}>
              <FontAwesome name="times" size={16} color={theme.colors.error} />
              <Text style={[styles.secondaryButtonText, { color: theme.colors.error }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>

          <View style={styles.bottomSpacing} />
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
    fontSize: 12,
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
  patientInfo: {
    flex: 1,
  },
  patientLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  patientName: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: theme.spacing.xs,
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
  },
  timeCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 16,
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
    fontSize: 12,
    marginTop: theme.spacing.sm,
  },
  timeValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    marginTop: theme.spacing.xs,
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
    fontSize: 14,
    fontWeight: '500',
    width: 100,
  },
  detailValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
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
  },
  locationAddress: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  actionButtons: {
    marginTop: theme.spacing.lg,
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
  bottomSpacing: {
    height: theme.spacing.xl,
  },
});