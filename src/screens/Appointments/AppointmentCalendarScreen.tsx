import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { LocaleConfig, CalendarProvider, ExpandableCalendar, AgendaList } from 'react-native-calendars';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Loading, CachedImage } from '@components/common';
import { theme } from '@theme/index';
import { useAuthStore } from '@store/authStore';
import { apiService, API_BASE_URL } from '@services/api';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DashboardStackParamList } from '@/types/navigation';
import { logger } from '@/utils/logger';

// Configure Portuguese locale for calendar
LocaleConfig.locales['pt-br'] = {
  monthNames: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje'
};
LocaleConfig.defaultLocale = 'pt-br';

type NavigationProp = StackNavigationProp<DashboardStackParamList>;

interface AppointmentItem {
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

interface MarkedDate {
  dots?: Array<{ key: string; color: string }>;
  marked?: boolean;
  selected?: boolean;
  selectedColor?: string;
}

// Helper function to convert UTC to local date
function convertUTCToLocalDate(utcDateStr: string, utcTimeStr: string): Date {
  const dateTimeParts = utcDateStr.split('-');
  const timeParts = utcTimeStr.split(':');

  const utcDate = new Date(Date.UTC(
    parseInt(dateTimeParts[0]),
    parseInt(dateTimeParts[1]) - 1,
    parseInt(dateTimeParts[2]),
    parseInt(timeParts[0]),
    parseInt(timeParts[1]),
    parseInt(timeParts[2] || '0')
  ));

  return utcDate;
}

// Get status color
function getStatusColor(status: string): string {
  switch (status) {
    case 'confirmed':
    case 'booked':
      return theme.colors.success;
    case 'scheduled':
      return theme.colors.info;
    case 'in_progress':
    case 'in-progress':
      return theme.colors.warning;
    case 'completed':
      return theme.colors.textSecondary;
    case 'cancelled':
    case 'no-show':
    case 'noshow':
      return theme.colors.error;
    default:
      return theme.colors.textSecondary;
  }
}

// Format appointment type
function formatAppointmentType(type: string): string {
  const typeMap: Record<string, string> = {
    ROUTINE: 'Consulta Rotina',
    FIRST: 'Primeira Consulta',
    WALKIN: 'Sem Agendamento',
    CHECKUP: 'Check-up',
    FOLLOWUP: 'Retorno',
    EMERGENCY: 'Emergência',
  };
  return typeMap[type] || type;
}

// Get status label
function getStatusLabel(status: string): string {
  switch (status) {
    case 'confirmed':
    case 'booked':
      return 'Confirmada';
    case 'scheduled':
      return 'Agendada';
    case 'in_progress':
    case 'in-progress':
      return 'Em andamento';
    case 'completed':
      return 'Concluída';
    case 'cancelled':
      return 'Cancelada';
    case 'no-show':
    case 'noshow':
      return 'Faltou';
    default:
      return status;
  }
}

// Get today's date in YYYY-MM-DD format
function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

export function AppointmentCalendarScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, token } = useAuthStore();
  const userEmail = user?.email || '';

  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [markedDates, setMarkedDates] = useState<Record<string, MarkedDate>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headerSubtitle = useMemo(() => {
    const count = appointments.length;
    if (count === 0) {
      return 'Nenhum agendamento futuro';
    }
    return `${count} ${count === 1 ? 'agendamento' : 'agendamentos'}`;
  }, [appointments.length]);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch all appointments (similar to AppointmentListScreen)
      let allAppointments: any[] = [];
      let currentPage = 1;
      let hasMore = true;
      const perPage = 50;

      while (hasMore) {
        const response = await apiService.getPractitionerAppointments(userEmail, {
          page: currentPage,
          limit: perPage,
          future: 'true', // Only load future appointments for better performance
        });

        const pageAppointments = response.data || [];
        allAppointments = [...allAppointments, ...pageAppointments];

        if (pageAppointments.length < perPage) {
          hasMore = false;
        } else {
          currentPage++;
        }
      }

      // Transform appointments (photos will be loaded automatically by CachedImage with caching)
      const transformedAppointments: AppointmentItem[] = [];
      const marked: Record<string, MarkedDate> = {};

      for (const apt of allAppointments) {
        // Handle patient or lead names
        let patientName = 'Paciente';
        const isLead = apt.subject_type === 'lead';

        if (isLead && apt.lead_id) {
          try {
            const leadData = await apiService.getLeadDetails(apt.lead_id);
            patientName = leadData.lead?.patient_name || 'Lead';
          } catch {
            patientName = 'Lead';
          }
        } else if (apt.subject_type === 'patient') {
          patientName = apt.patientName || apt.patientname || 'Paciente';
        }

        const localDateTime = convertUTCToLocalDate(
          apt.startdate || new Date().toISOString().split('T')[0],
          apt.starttime || '00:00:00'
        );

        const dateKey = localDateTime.toISOString().split('T')[0];
        const time = localDateTime.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        });

        const appointmentItem: AppointmentItem = {
          id: (apt.identifier || apt.id || apt.appointmentid || '').toString(),
          patientName,
          patientCpf: apt.subject || null,
          time,
          date: dateKey,
          type: formatAppointmentType(apt.appointmenttype || apt.servicetype || 'ROUTINE'),
          status: apt.status || 'scheduled',
          startDateTime: localDateTime,
          isLead,
        };

        transformedAppointments.push(appointmentItem);

        // Mark dates on calendar
        if (!marked[dateKey]) {
          marked[dateKey] = { dots: [], marked: true };
        }

        const statusColor = getStatusColor(appointmentItem.status);
        const existingDot = marked[dateKey].dots?.find(dot => dot.color === statusColor);

        if (!existingDot && marked[dateKey].dots) {
          marked[dateKey].dots.push({
            key: appointmentItem.status,
            color: statusColor,
          });
        }
      }

      // Sort appointments by date/time
      transformedAppointments.sort((a, b) => {
        return a.startDateTime.getTime() - b.startDateTime.getTime();
      });

      setAppointments(transformedAppointments);
      setMarkedDates(marked);
    } catch (error) {
      logger.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userEmail]);

  useFocusEffect(
    useCallback(() => {
      loadAppointments();
    }, [loadAppointments])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAppointments();
  }, [loadAppointments]);

  const getAppointmentsForDate = useCallback((date: string) => {
    return appointments.filter(apt => apt.date === date);
  }, [appointments]);

  const selectedDateAppointments = getAppointmentsForDate(selectedDate);

  // Prepare agenda items grouped by date for AgendaList
  const agendaSections = useMemo(() => {
    const grouped: { title: string; data: AppointmentItem[] }[] = [];
    const dateMap = new Map<string, AppointmentItem[]>();

    appointments.forEach(apt => {
      if (!dateMap.has(apt.date)) {
        dateMap.set(apt.date, []);
      }
      dateMap.get(apt.date)!.push(apt);
    });

    // Sort by date and create sections
    Array.from(dateMap.keys())
      .sort()
      .forEach(date => {
        grouped.push({
          title: date,
          data: dateMap.get(date)!,
        });
      });

    return grouped;
  }, [appointments]);

  // Format selected date header
  const formatSelectedDateHeader = (date: string): string => {
    const today = getTodayString();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    if (date === today) {
      return 'Hoje';
    } else if (date === tomorrowStr) {
      return 'Amanhã';
    } else {
      const dateObj = new Date(date + 'T00:00:00');
      return dateObj.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    }
  };

  const navigateToDetails = (appointmentId: string) => {
    navigation.navigate('AppointmentDetails', { appointmentId });
  };

  const renderAgendaItem = useCallback(({ item }: { item: AppointmentItem }) => (
    <TouchableOpacity
      style={styles.appointmentCard}
      onPress={() => navigateToDetails(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.appointmentContent}>
        <CachedImage
          uri={item.patientCpf && !item.isLead ? `${API_BASE_URL}/patient/getpatientphoto?patientCpf=${item.patientCpf}` : undefined}
          headers={token ? { Authorization: `Bearer ${token}` } : undefined}
          style={styles.patientAvatar}
          fallbackIcon="user"
          fallbackIconSize={18}
          fallbackIconColor={theme.colors.primary}
        />
        <View style={styles.appointmentDetails}>
          <View style={styles.appointmentHeader}>
            <Text style={styles.timeText}>{item.time}</Text>
            <View
              style={[
                styles.timeIndicator,
                { backgroundColor: getStatusColor(item.status) },
              ]}
            />
          </View>
          <View style={styles.patientNameRow}>
            <Text style={styles.patientName}>{item.patientName}</Text>
            {item.isLead && (
              <View style={styles.leadBadge}>
                <Text style={styles.leadBadgeText}>LEAD</Text>
              </View>
            )}
          </View>
          <Text style={styles.appointmentType}>{item.type}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) + '20' },
            ]}
          >
            <FontAwesome
              name={
                item.status === 'confirmed' || item.status === 'booked'
                  ? 'check-circle'
                  : item.status === 'scheduled'
                  ? 'clock-o'
                  : 'circle'
              }
              size={12}
              color={getStatusColor(item.status)}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(item.status) },
              ]}
            >
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  ), []);

  if (loading) {
    return <Loading />;
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.container}>
        {/* Navigation Header */}
        <View style={styles.headerBackground}>
          <Image
            source={require('../../assets/medpro-logo.png')}
            style={styles.backgroundLogo}
            resizeMode="contain"
          />
          <View style={styles.navigationHeader}>
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.7}
              onPress={() => navigation.goBack()}
            >
              <MaterialIcons name="arrow-back" size={22} color={theme.colors.white} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.navigationHeaderTitle}>Meus Agendamentos</Text>
              <Text style={styles.navigationHeaderSubtitle}>{headerSubtitle}</Text>
            </View>
          </View>
        </View>

        {/* Expandable Calendar with Agenda */}
        <View style={styles.contentContainer}>
          <CalendarProvider
            date={selectedDate}
            onDateChanged={setSelectedDate}
            showTodayButton
            todayButtonStyle={styles.todayButton}
          >
          <ExpandableCalendar
            markedDates={markedDates}
            markingType="multi-dot"
            firstDay={0}
            theme={{
              backgroundColor: theme.colors.background,
              calendarBackground: theme.colors.background,
              textSectionTitleColor: theme.colors.textSecondary,
              selectedDayBackgroundColor: theme.colors.primary,
              selectedDayTextColor: '#ffffff',
              todayTextColor: theme.colors.primary,
              dayTextColor: theme.colors.text,
              textDisabledColor: theme.colors.textSecondary + '40',
              dotColor: theme.colors.primary,
              selectedDotColor: '#ffffff',
              arrowColor: theme.colors.primary,
              monthTextColor: theme.colors.text,
              textDayFontSize: 14,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 12,
            }}
          />
          <AgendaList
            sections={agendaSections}
            renderItem={renderAgendaItem}
            sectionStyle={styles.agendaSection}
            dayFormat="yyyy-MM-dd"
          />
          </CalendarProvider>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  // Navigation Header Styles
  headerBackground: {
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  backgroundLogo: {
    position: 'absolute',
    top: 0,
    right: 20,
    width: 120,
    height: 120,
    opacity: 0.1,
    transform: [{ translateY: -60 }],
    tintColor: theme.colors.white,
  },
  navigationHeader: {
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
  navigationHeaderTitle: {
    ...theme.typography.h2,
    color: theme.colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  navigationHeaderSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.white + 'CC',
    fontSize: 12,
    marginTop: 4,
  },
  // Calendar Styles
  todayButton: {
    marginTop: theme.spacing.sm,
  },
  agendaSection: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  appointmentCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.large,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  appointmentContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  patientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  patientAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  appointmentDetails: {
    flex: 1,
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  timeText: {
    ...theme.typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.primary,
    marginRight: theme.spacing.xs,
  },
  timeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  patientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  patientName: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 14,
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
    borderRadius: theme.borderRadius.small,
  },
  statusText: {
    ...theme.typography.caption,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
});
