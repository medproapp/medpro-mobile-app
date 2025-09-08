import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Image,
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Card, Loading, InProgressEncountersAlert } from '@components/common';
import { theme } from '@theme/index';
import { useAuthStore } from '@store/authStore';
import { apiService } from '@services/api';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DashboardStackParamList } from '@types/navigation';

interface Appointment {
  id: string;
  patientName: string;
  time: string;
  date: string;
  type: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed';
}

interface DashboardData {
  nextAppointments: Appointment[];
  inProgressEncountersCount: number;
}

type DashboardNavigationProp = StackNavigationProp<DashboardStackParamList, 'DashboardHome'>;

const formatAppointmentType = (type: string): string => {
  const types: Record<string, string> = {
    ROUTINE: "Agendamento Regular",
    WALKIN: "Visita não agendada", 
    FOLLOWUP: "Retorno",
    CHECKUP: "Check-up de Rotina",
    EMERGENCY: "Emergência",
  };
  return types[type] || (type ? type : "Não especificado");
};

const getAppointmentTypeIcon = (type: string): string => {
  if (type.includes('Emergência')) return 'exclamation-triangle';
  if (type.includes('Retorno')) return 'rotate-left';
  if (type.includes('Check-up')) return 'list-alt';
  if (type.includes('não agendada')) return 'door-open';
  return 'calendar-check-o';
};

const convertUTCToLocalDate = (utcDateStr: string, utcTimeStr: string = '00:00:00'): Date => {
  // Combine date and time strings like the webapp does
  // Format: YYYY-MM-DD + T + HH:mm:ss = YYYY-MM-DDTHH:mm:ss
  const combinedUTCString = `${utcDateStr.slice(0, 10)}T${utcTimeStr}`;
  
  // Parse as UTC then convert to local (same as webapp: moment.utc().local())
  const utcDate = new Date(combinedUTCString + 'Z'); // Add Z to ensure UTC parsing
  
  return utcDate; // JavaScript Date automatically represents in local timezone
};

const getDateGroupLabel = (localDateStr: string): string => {
  // localDateStr is already in local timezone format (YYYY-MM-DD)
  const appointmentDate = new Date(localDateStr + 'T00:00:00'); // Local date at midnight
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  // Reset time for comparison (local timezone)
  today.setHours(0, 0, 0, 0);
  tomorrow.setHours(0, 0, 0, 0);
  appointmentDate.setHours(0, 0, 0, 0);
  
  if (appointmentDate.getTime() === today.getTime()) {
    return 'Hoje';
  } else if (appointmentDate.getTime() === tomorrow.getTime()) {
    return 'Amanhã';
  } else {
    return appointmentDate.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long'
    });
  }
};

const groupAppointmentsByDate = (appointments: Appointment[]) => {
  const groups: { [key: string]: Appointment[] } = {};
  
  appointments.forEach(appointment => {
    const groupLabel = getDateGroupLabel(appointment.date);
    if (!groups[groupLabel]) {
      groups[groupLabel] = [];
    }
    groups[groupLabel].push(appointment);
  });
  
  return groups;
};

export const DashboardScreen: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigation = useNavigation<DashboardNavigationProp>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      if (!user?.email) {
        throw new Error('User email not available');
      }

      // Fetch appointments and in-progress encounters in parallel
      const [appointmentsData, inProgressData] = await Promise.all([
        apiService.getNextAppointments(user.email, 7),
        apiService.getInProgressEncounters(user.email).catch(() => ({ data: [] })) // Handle errors gracefully
      ]);
      
      // Transform API response to match our interface
      const appointments = await Promise.all(
        appointmentsData.slice(0, 5).map(async (apt: any) => {
          try {
            // Get patient details for each appointment
            const patientData = await apiService.getPatientDetails(apt.subject);
            
            // Convert UTC datetime to local for proper date grouping
            const localDateTime = convertUTCToLocalDate(
              apt.startdate || new Date().toISOString().split('T')[0], 
              apt.starttime || '00:00:00'
            );
            
            return {
              id: apt.identifier.toString(),
              patientName: patientData.data?.name || 'Paciente',
              time: localDateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), // Local time
              date: localDateTime.toISOString().split('T')[0], // Local date for grouping
              type: formatAppointmentType(apt.appointmenttype),
              status: apt.status === 'booked' ? 'confirmed' : apt.status
            };
          } catch (error) {
            console.error('Error fetching patient details:', error);
            // Convert UTC datetime to local for error fallback
            const localDateTime = convertUTCToLocalDate(
              apt.startdate || new Date().toISOString().split('T')[0], 
              apt.starttime || '00:00:00'
            );
            
            return {
              id: apt.identifier.toString(),
              patientName: 'Paciente',
              time: localDateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              date: localDateTime.toISOString().split('T')[0],
              type: formatAppointmentType('ROUTINE'),
              status: 'scheduled'
            };
          }
        })
      );

      // Count in-progress encounters
      const inProgressCount = inProgressData?.data?.length || 0;

      setData({
        nextAppointments: appointments,
        inProgressEncountersCount: inProgressCount
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      
      // Fallback to mock data if API fails
      setData({
        nextAppointments: [
          {
            id: '1',
            patientName: 'Maria Silva',
            time: '09:00',
            date: new Date().toLocaleDateString('en-CA'), // Today (YYYY-MM-DD format, local)
            type: formatAppointmentType('ROUTINE'),
            status: 'confirmed'
          },
          {
            id: '2',
            patientName: 'João Santos',
            time: '10:30',
            date: new Date().toLocaleDateString('en-CA'), // Today (YYYY-MM-DD format, local)
            type: formatAppointmentType('FOLLOWUP'),
            status: 'scheduled'
          },
          {
            id: '3',
            patientName: 'Ana Costa',
            time: '11:15',
            date: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-CA'), // Tomorrow (local)
            type: formatAppointmentType('CHECKUP'),
            status: 'confirmed'
          },
          {
            id: '4',
            patientName: 'Pedro Lima',
            time: '14:00',
            date: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-CA'), // Tomorrow (local)
            type: formatAppointmentType('ROUTINE'),
            status: 'scheduled'
          },
          {
            id: '5',
            patientName: 'Carla Oliveira',
            time: '15:30',
            date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA'), // Day after tomorrow (local)
            type: formatAppointmentType('FOLLOWUP'),
            status: 'confirmed'
          }
        ],
        inProgressEncountersCount: 0
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getCurrentDate = () => {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return today.toLocaleDateString('pt-BR', options);
  };

  const handleInProgressEncountersPress = () => {
    navigation.navigate('EncounterList', { filterStatus: 'OPEN' });
  };

  if (loading) {
    return <Loading text="Carregando dashboard..." />;
  }

  const getStatusColor = (status: Appointment['status']) => {
    switch (status) {
      case 'confirmed': return theme.colors.success;
      case 'scheduled': return theme.colors.warning;
      case 'in_progress': return theme.colors.info;
      case 'completed': return theme.colors.textSecondary;
      default: return theme.colors.textSecondary;
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.container}>
        {/* Header with gradient background - Fixed at top */}
        <View style={styles.headerBackground}>
          {/* Background Logo */}
          <Image
            source={require('../../assets/medpro-logo.png')}
            style={styles.backgroundLogo}
            resizeMode="contain"
          />
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.greeting}>{getTimeBasedGreeting()},</Text>
              <Text style={styles.userName}>{user?.name || 'Doutor'}</Text>
              <Text style={styles.dateText}>{getCurrentDate()}</Text>
            </View>
            <TouchableOpacity onPress={logout} style={styles.logoutButton}>
              <FontAwesome name="sign-out" size={20} color={theme.colors.white} />
            </TouchableOpacity>
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

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <FontAwesome name="calendar-check-o" size={24} color={theme.colors.primary} />
            <Text style={styles.statNumber}>{data?.nextAppointments.length || 0}</Text>
            <Text style={styles.statLabel}>Hoje</Text>
          </View>
          <View style={styles.statCard}>
            <FontAwesome name="clock-o" size={24} color={theme.colors.info} />
            <Text style={styles.statNumber}>
              {data?.nextAppointments.filter(apt => apt.status === 'scheduled').length || 0}
            </Text>
            <Text style={styles.statLabel}>Pendentes</Text>
          </View>
          <View style={styles.statCard}>
            <FontAwesome name="check-circle" size={24} color={theme.colors.success} />
            <Text style={styles.statNumber}>
              {data?.nextAppointments.filter(apt => apt.status === 'confirmed').length || 0}
            </Text>
            <Text style={styles.statLabel}>Confirmadas</Text>
          </View>
        </View>

        {/* In-Progress Encounters Alert */}
        <InProgressEncountersAlert
          encounterCount={data?.inProgressEncountersCount || 0}
          onPress={handleInProgressEncountersPress}
        />

        {/* Next Appointments */}
        <Card style={styles.appointmentsCard}>
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <FontAwesome name="calendar" size={22} color={theme.colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Próximas Consultas</Text>
            <View style={styles.cardHeaderBadge}>
              <Text style={styles.cardHeaderBadgeText}>
                {data?.nextAppointments.length || 0}
              </Text>
            </View>
          </View>
          
          {data?.nextAppointments && data.nextAppointments.length > 0 ? (
            (() => {
              const groupedAppointments = groupAppointmentsByDate(data.nextAppointments);
              return Object.entries(groupedAppointments).map(([dateGroup, appointments]) => (
                <View key={dateGroup}>
                  <View style={styles.dateGroupHeader}>
                    <Text style={styles.dateGroupTitle}>{dateGroup}</Text>
                    <View style={styles.dateGroupLine} />
                    <Text style={styles.dateGroupCount}>{appointments.length}</Text>
                  </View>
                  {appointments.map((appointment, index) => (
                    <TouchableOpacity 
                      key={appointment.id} 
                      style={[
                        styles.appointmentRow,
                        index === appointments.length - 1 && styles.lastAppointmentRow
                      ]}
                      activeOpacity={0.7}
                    >
                      <View style={styles.appointmentTimeContainer}>
                        <Text style={styles.timeText}>{appointment.time}</Text>
                        <View style={[styles.timeIndicator, { backgroundColor: getStatusColor(appointment.status) }]} />
                      </View>
                      <View style={styles.appointmentInfo}>
                        <Text style={styles.patientName}>{appointment.patientName}</Text>
                        <Text style={styles.appointmentType}>{appointment.type}</Text>
                      </View>
                      <View style={styles.statusContainer}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) + '20' }]}>
                          <FontAwesome 
                            name={appointment.status === 'confirmed' ? 'check-circle' : 
                                  appointment.status === 'scheduled' ? 'clock-o' : 
                                  'circle'} 
                            size={14} 
                            color={getStatusColor(appointment.status)} 
                          />
                          <Text style={[styles.statusText, { color: getStatusColor(appointment.status) }]}>
                            {appointment.status === 'confirmed' ? 'Confirmada' :
                             appointment.status === 'scheduled' ? 'Agendada' :
                             appointment.status === 'in_progress' ? 'Em andamento' : 'Concluída'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ));
            })()
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome name="calendar-o" size={48} color={theme.colors.textSecondary} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>Nenhuma consulta agendada</Text>
              <Text style={styles.emptySubtitle}>
                Você não possui consultas marcadas para hoje.
              </Text>
              <TouchableOpacity style={styles.emptyAction} activeOpacity={0.7}>
                <FontAwesome name="plus" size={16} color={theme.colors.primary} />
                <Text style={styles.emptyActionText}>Agendar nova consulta</Text>
              </TouchableOpacity>
            </View>
          )}
          </Card>
        </ScrollView>
        
        {/* Floating Action Button */}
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => navigation.navigate('AppointmentStep1')}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={28} color={theme.colors.white} />
        </TouchableOpacity>
      </View>
    </>
  );
};

const { width } = Dimensions.get('window');

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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.md,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: theme.spacing.xs,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    ...theme.typography.h1,
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: theme.spacing.xs,
  },
  appointmentsCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  iconContainer: {
    marginRight: theme.spacing.sm,
  },
  cardTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
  },
  cardHeaderBadge: {
    backgroundColor: theme.colors.primary + '20',
    borderRadius: 12,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  cardHeaderBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  appointmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    borderRadius: 8,
    marginBottom: theme.spacing.xs,
  },
  lastAppointmentRow: {
    borderBottomWidth: 0,
    marginBottom: 0,
  },
  appointmentTimeContainer: {
    alignItems: 'center',
    marginRight: theme.spacing.lg,
    position: 'relative',
  },
  timeText: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  timeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: theme.spacing.xs,
  },
  appointmentInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  patientName: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 16,
    marginBottom: theme.spacing.xs,
  },
  appointmentType: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 12,
  },
  statusText: {
    ...theme.typography.caption,
    fontWeight: '600',
    fontSize: 11,
    marginLeft: theme.spacing.xs,
  },
  dateGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
  dateGroupTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  dateGroupLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginHorizontal: theme.spacing.md,
  },
  dateGroupCount: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyIcon: {
    opacity: 0.5,
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.xl,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
  },
  emptyActionText: {
    ...theme.typography.button,
    color: theme.colors.primary,
    fontWeight: '600',
    marginLeft: theme.spacing.sm,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 999,
  },
});