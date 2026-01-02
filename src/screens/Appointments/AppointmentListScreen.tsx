import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Card, Loading, CachedImage } from '@components/common';
import { theme } from '@theme/index';
import { useAuthStore } from '@store/authStore';
import { apiService, API_BASE_URL } from '@services/api';
import { DashboardStackParamList } from '@/types/navigation';
import { logger } from '@/utils/logger';

type AppointmentListNavigationProp = StackNavigationProp<DashboardStackParamList, 'AppointmentList'>;

interface AppointmentListItem {
  id: string;
  patientName: string;
  patientCpf?: string | null;
  time: string;
  date: string;
  type: string;
  status: string;
  patientPhoto?: string | null;
  startDateTime: Date;
  isLead?: boolean;
}

const formatAppointmentType = (type: string): string => {
  const types: Record<string, string> = {
    ROUTINE: 'Agendamento Regular',
    WALKIN: 'Visita não agendada',
    FOLLOWUP: 'Retorno',
    CHECKUP: 'Check-up de Rotina',
    EMERGENCY: 'Emergência',
    FIRST: 'Primeira Consulta',
    CONSULTATION: 'Consulta',
    EXAM: 'Exame',
    PROCEDURE: 'Procedimento',
    TELEMEDICINE: 'Telemedicina',
  };
  return types[type?.toUpperCase()] || 'Consulta';
};

const convertUTCToLocalDate = (utcDateStr: string, utcTimeStr: string = '00:00:00'): Date => {
  const combinedUTCString = `${utcDateStr.slice(0, 10)}T${utcTimeStr}`;
  return new Date(combinedUTCString + 'Z');
};

const getDateGroupLabel = (localDateStr: string): string => {
  const appointmentDate = new Date(localDateStr + 'T00:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  today.setHours(0, 0, 0, 0);
  tomorrow.setHours(0, 0, 0, 0);
  appointmentDate.setHours(0, 0, 0, 0);

  if (appointmentDate.getTime() === today.getTime()) {
    return 'Hoje';
  }
  if (appointmentDate.getTime() === tomorrow.getTime()) {
    return 'Amanhã';
  }

  return appointmentDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

const formatLocalDateIso = (date: Date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AppointmentListScreen: React.FC = () => {
  const navigation = useNavigation<AppointmentListNavigationProp>();
  const { user, token } = useAuthStore();

  const [appointments, setAppointments] = useState<AppointmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [totalRecords, setTotalRecords] = useState<number | null>(null);

  const headerSubtitle = useMemo(() => {
    if (!hasLoadedOnce) {
      return 'Carregando agendamentos...';
    }

    const count = totalRecords ?? appointments.length;

    if (count === 0) {
      return 'Nenhum agendamento encontrado';
    }
    if (count === 1) {
      return '1 agendamento';
    }
    return `${count} agendamentos`;
  }, [appointments.length, hasLoadedOnce, totalRecords]);

  const getStatusColor = useCallback((status: string) => {
    const normalized = status?.toLowerCase() ?? '';

    switch (normalized) {
      case 'cancelled':
      case 'canceled':
      case 'noshow':
      case 'no-show':
        return theme.colors.error;
      case 'booked':
      case 'pending':
      case 'scheduled':
        return theme.colors.warning;
      case 'confirmed':
      case 'fulfilled':
      case 'completed':
        return theme.colors.success;
      case 'arrived':
      case 'checked-in':
      case 'in-progress':
      case 'in_progress':
        return theme.colors.info;
      default:
        return theme.colors.textSecondary;
    }
  }, []);

  const getStatusLabel = useCallback((status: string) => {
    const normalized = status?.toLowerCase() ?? '';

    switch (normalized) {
      case 'booked':
      case 'pending':
      case 'scheduled':
        return 'Agendada';
      case 'confirmed':
        return 'Confirmada';
      case 'arrived':
        return 'Chegada registrada';
      case 'checked-in':
        return 'Check-in';
      case 'in-progress':
      case 'in_progress':
        return 'Em andamento';
      case 'fulfilled':
      case 'completed':
        return 'Atendida';
      case 'cancelled':
      case 'canceled':
        return 'Cancelada';
      case 'noshow':
      case 'no-show':
        return 'Não compareceu';
      default:
        return 'Desconhecido';
    }
  }, []);

  const getStatusIcon = useCallback((status: string) => {
    const normalized = status?.toLowerCase() ?? '';

    switch (normalized) {
      case 'cancelled':
      case 'canceled':
      case 'noshow':
      case 'no-show':
        return 'times-circle';
      case 'confirmed':
      case 'fulfilled':
      case 'completed':
        return 'check-circle';
      case 'arrived':
      case 'checked-in':
      case 'in-progress':
      case 'in_progress':
        return 'play-circle';
      case 'booked':
      case 'pending':
      case 'scheduled':
        return 'clock-o';
      default:
        return 'circle';
    }
  }, []);

  const loadAppointments = useCallback(async (silent: boolean = false) => {
    if (!user?.email) {
      logger.warn('[AppointmentList] User email not available, skipping fetch');
      setAppointments([]);
      setLoading(false);
      setRefreshing(false);
      setHasLoadedOnce(true);
      setTotalRecords(0);
      return;
    }

    try {
      if (!silent) {
        setLoading(true);
      }

      const aggregated: any[] = [];
      let currentPage = 1;
      const limit = 50;
      let totalPages = 1;
      let total = 0;

      do {
        const result = await apiService.getPractitionerAppointments(user.email, { page: currentPage, limit });

        if (currentPage === 1) {
          total = typeof result?.total === 'number' ? result.total : 0;
          totalPages = typeof result?.totalPages === 'number' ? result.totalPages : 1;
        }

        if (result?.data && Array.isArray(result.data)) {
          aggregated.push(...result.data);
        }

        const hasMorePages = currentPage < (result?.totalPages ?? totalPages);
        currentPage += 1;

        if (!hasMorePages) {
          break;
        }

        // Safety break to avoid infinite loops in unexpected responses
        if (currentPage > 10) {
          logger.warn('[AppointmentList] Reached page limit while fetching appointments');
          break;
        }
      } while (true);

      const items: AppointmentListItem[] = [];

      for (const appointment of aggregated) {
        const identifier = appointment.identifier || appointment.id || appointment.appointmentid;
        if (!identifier) {
          continue;
        }

        const startDateValue = typeof appointment.startdate === 'string' ? appointment.startdate : '';
        const datePart = startDateValue.includes('T') ? startDateValue.slice(0, 10) : startDateValue;
        const startTimeValue = appointment.starttime || '00:00:00';
        const localDateTime = convertUTCToLocalDate(
          datePart || new Date().toISOString().split('T')[0],
          startTimeValue
        );

        // Check if this is a lead appointment
        const isLead = appointment.subject_type === 'lead';
        const status = appointment.status || 'unknown';

        items.push({
          id: String(identifier),
          patientName: appointment.patientName || appointment.patientname || (isLead ? 'Lead' : 'Paciente'),
          patientCpf: isLead ? null : (appointment.patientCpf || appointment.subject || null),
          time: localDateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          date: formatLocalDateIso(localDateTime),
          type: formatAppointmentType(appointment.appointmenttype || appointment.servicetype || ''),
          status,
          startDateTime: localDateTime,
          isLead,
        });
      }

      const now = new Date();
      const upcoming = items
        .filter(item => item.startDateTime.getTime() >= now.getTime())
        .sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
      const past = items
        .filter(item => item.startDateTime.getTime() < now.getTime())
        .sort((a, b) => b.startDateTime.getTime() - a.startDateTime.getTime());

      const sortedItems = [...upcoming, ...past];

      setAppointments(sortedItems);
      setTotalRecords(total || sortedItems.length);
      setHasLoadedOnce(true);
    } catch (error) {
      logger.error('[AppointmentList] Error loading appointments:', error);
      setAppointments([]);
      setTotalRecords(0);
      setHasLoadedOnce(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.email]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedOnce) {
        loadAppointments(true);
      }
    }, [hasLoadedOnce, loadAppointments])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadAppointments(true);
  };

  const groupedAppointments = useMemo(() => {
    const groups: Record<string, AppointmentListItem[]> = {};

    appointments.forEach(appointment => {
      const label = getDateGroupLabel(appointment.date);
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(appointment);
    });

    return groups;
  }, [appointments]);

  if (loading) {
    return <Loading text="Carregando agendamentos..." />;
  }

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
              activeOpacity={0.7}
              onPress={() => navigation.goBack()}
            >
              <MaterialIcons name="arrow-back" size={22} color={theme.colors.white} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Agendamentos</Text>
              <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
            </View>
          </View>
        </View>
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
          {appointments.length === 0 ? (
            <View style={styles.emptyState}>
              <FontAwesome
                name="calendar-o"
                size={48}
                color={theme.colors.textSecondary}
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyTitle}>Nenhum agendamento</Text>
              <Text style={styles.emptySubtitle}>
                Você não possui agendamentos para exibir neste momento.
              </Text>
            </View>
          ) : (
            Object.entries(groupedAppointments).map(([groupLabel, items]) => (
              <View key={groupLabel} style={styles.groupContainer}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{groupLabel}</Text>
                  <View style={styles.groupDivider} />
                  <Text style={styles.groupCount}>{items.length}</Text>
                </View>

                {items.map(appointment => (
                  <Card key={appointment.id} style={styles.appointmentCard}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.appointmentContent}
                      onPress={() =>
                        navigation.navigate('AppointmentDetails', {
                          appointmentId: appointment.id,
                        })
                      }
                    >
                      <CachedImage
                        uri={appointment.patientCpf ? `${API_BASE_URL}/patient/getpatientphoto?patientCpf=${appointment.patientCpf}` : undefined}
                        headers={token ? { Authorization: `Bearer ${token}` } : undefined}
                        style={styles.patientAvatar}
                        fallbackIcon="user"
                        fallbackIconSize={20}
                        fallbackIconColor={theme.colors.primary}
                      />

                      <View style={styles.appointmentInfo}>
                        <View style={styles.timeRow}>
                          <Text style={styles.timeText}>{appointment.time}</Text>
                          <View
                            style={[
                              styles.timeIndicator,
                              { backgroundColor: getStatusColor(appointment.status) },
                            ]}
                          />
                        </View>
                        <View style={styles.patientNameRow}>
                          <Text style={styles.patientName}>{appointment.patientName}</Text>
                          {appointment.isLead && (
                            <View style={styles.leadBadge}>
                              <Text style={styles.leadBadgeText}>POTENCIAL</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.appointmentFooter}>
                          <Text style={styles.appointmentType} numberOfLines={1}>
                            {appointment.type}
                          </Text>
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: getStatusColor(appointment.status) + '20' },
                            ]}
                          >
                            <FontAwesome
                              name={getStatusIcon(appointment.status)}
                              size={12}
                              color={getStatusColor(appointment.status)}
                            />
                            <Text
                              style={[
                                styles.statusText,
                                { color: getStatusColor(appointment.status) },
                              ]}
                            >
                              {getStatusLabel(appointment.status)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Card>
                ))}
              </View>
            ))
          )}
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
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: theme.spacing.md,
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
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white + '20',
    marginRight: theme.spacing.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    ...theme.typography.h2,
    color: theme.colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.white + 'CC',
    fontSize: 12,
    marginTop: 4,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    paddingTop: theme.spacing.xl,
  },
  groupContainer: {
    marginBottom: theme.spacing.xl,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
  groupTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  groupDivider: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginHorizontal: theme.spacing.sm,
  },
  groupCount: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  appointmentCard: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  appointmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  patientAvatarImage: {
    width: '100%',
    height: '100%',
  },
  appointmentInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  timeText: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  timeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: theme.spacing.xs,
  },
  patientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  patientName: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 16,
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
  appointmentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  appointmentType: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    ...theme.typography.caption,
    fontWeight: '600',
    fontSize: 11,
    marginLeft: theme.spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyIcon: {
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default AppointmentListScreen;
