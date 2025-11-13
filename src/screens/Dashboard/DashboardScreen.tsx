import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { apiService, API_BASE_URL } from '@services/api';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DashboardStackParamList } from '@/types/navigation';
import { useNotificationStore } from '@store/notificationStore';

interface Appointment {
  id: string;
  patientName: string;
  time: string;
  date: string;
  type: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed';
  patientPhoto?: string | null;
}

interface DashboardData {
  nextAppointments: Appointment[];
  inProgressEncountersCount: number;
}

interface ScheduleSummaryBlock {
  id: string;
  location: string;
  startTime: string;
  endTime: string;
}

interface ScheduleDayMeta {
  calendarDay: string;
  calendarMonth: string;
  weekdayLabel: string;
  isWeekend: boolean;
}

interface ScheduleSummaryDay extends ScheduleDayMeta {
  date: string;
  dateValue: Date | null;
  displayDate: string;
  blocks: ScheduleSummaryBlock[];
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

const MS_IN_DAY = 24 * 60 * 60 * 1000;

const MONTH_ALIASES: Record<string, string> = {
  jan: '01',
  janeiro: '01',
  january: '01',
  'jan.': '01',
  fev: '02',
  fevereiro: '02',
  feb: '02',
  february: '02',
  'feb.': '02',
  mar: '03',
  março: '03',
  'mar.': '03',
  march: '03',
  abr: '04',
  abril: '04',
  apr: '04',
  april: '04',
  'abr.': '04',
  'apr.': '04',
  maio: '05',
  mai: '05',
  may: '05',
  jun: '06',
  'jun.': '06',
  june: '06',
  jul: '07',
  'jul.': '07',
  july: '07',
  ago: '08',
  'ago.': '08',
  aug: '08',
  august: '08',
  agosto: '08',
  set: '09',
  'set.': '09',
  setembro: '09',
  sep: '09',
  sept: '09',
  'sep.': '09',
  september: '09',
  out: '10',
  'out.': '10',
  outubro: '10',
  oct: '10',
  'oct.': '10',
  october: '10',
  nov: '11',
  'nov.': '11',
  novembro: '11',
  november: '11',
  dez: '12',
  'dez.': '12',
  dezembro: '12',
  dec: '12',
  'dec.': '12',
  december: '12',
};

const removeOrdinalSuffix = (value: string) =>
  value.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1').replace(/[ºª]/g, '');

const parseScheduleDateString = (value?: string, fallbackYear?: number): Date | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('/');
    const iso = `${year}-${month}-${day}`;
    const parsed = new Date(`${iso}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const isoLocal = new Date(`${trimmed}T00:00:00`);
    if (!Number.isNaN(isoLocal.getTime())) {
      return isoLocal;
    }
  }

  const directExact = new Date(trimmed);
  if (!Number.isNaN(directExact.getTime())) {
    return directExact;
  }

  const normalized = removeOrdinalSuffix(trimmed.replace(/-/g, ' '))
    .replace(/,/g, '')
    .replace(/\s+/g, ' ');

  const direct = new Date(normalized);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const isoDate = new Date(`${normalized}T00:00:00`);
    if (!Number.isNaN(isoDate.getTime())) {
      return isoDate;
    }
  }

  if (!normalized.includes('T') && normalized.includes(' ')) {
    const isoCandidate = normalized.replace(' ', 'T');
    const isoParsed = new Date(isoCandidate);
    if (!Number.isNaN(isoParsed.getTime())) {
      return isoParsed;
    }
  }

  const parts = normalized.split(' ');
  if (parts.length >= 2) {
    const [maybeMonth, maybeDay, maybeYear] = parts;
    const monthKey = maybeMonth.toLowerCase().replace('.', '');
    const monthNumber = MONTH_ALIASES[monthKey];
    const dayNumber = Number.parseInt(maybeDay, 10);
    const parsedYear = Number.parseInt(maybeYear, 10);
    const finalYear = !Number.isNaN(parsedYear) ? parsedYear : fallbackYear;

    if (monthNumber && !Number.isNaN(dayNumber) && finalYear) {
      const iso = `${finalYear}-${monthNumber}-${dayNumber.toString().padStart(2, '0')}`;
      const composed = new Date(`${iso}T00:00:00`);
      if (!Number.isNaN(composed.getTime())) {
        return composed;
      }
    }
  }

  return null;
};

const formatScheduleDateLabel = (date: Date | null, fallback?: string) => {
  if (date) {
    return date.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
    });
  }

  if (fallback && fallback.trim().length > 0) {
    return fallback;
  }

  return 'Data não definida';
};

const deriveScheduleDayMeta = (date: Date | null, fallbackLabel?: string): ScheduleDayMeta => {
  if (date) {
    const weekdayLabel = date.toLocaleDateString('pt-BR', { weekday: 'long' });
    const calendarDay = date.getDate().toString().padStart(2, '0');
    const monthLabelRaw = date.toLocaleDateString('pt-BR', { month: 'short' });
    const calendarMonth = monthLabelRaw.replace('.', '').trim().toUpperCase();
    const isWeekend = [0, 6].includes(date.getDay());

    return {
      calendarDay,
      calendarMonth,
      weekdayLabel,
      isWeekend,
    };
  }

  return {
    calendarDay: '--',
    calendarMonth: '--',
    weekdayLabel: fallbackLabel || 'Dia não definido',
    isWeekend: false,
  };
};

const formatScheduleTimeRange = (start?: string, end?: string, baseDate?: Date) => {
  const parseTime = (value?: string) => {
    if (!value) {
      return null;
    }

    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) {
      return direct;
    }

    if (baseDate) {
      const baseDateStr = baseDate.toISOString().split('T')[0];
      const combined = new Date(`${baseDateStr}T${value}`);
      if (!Number.isNaN(combined.getTime())) {
        return combined;
      }
    }

    return null;
  };

  const startDate = parseTime(start);
  const endDate = parseTime(end);

  if (startDate && endDate) {
    const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    const startLabel = startDate.toLocaleTimeString('pt-BR', options);
    const endLabel = endDate.toLocaleTimeString('pt-BR', options);
    return `${startLabel} - ${endLabel}`;
  }

  if (start && end) {
    return `${start} - ${end}`;
  }

  if (start) {
    return start;
  }

  return 'Horário não definido';
};

export const DashboardScreen: React.FC = () => {
  const { user, token } = useAuthStore();
  const navigation = useNavigation<DashboardNavigationProp>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photoAvailable, setPhotoAvailable] = useState(true);
  const [scheduleSummary, setScheduleSummary] = useState<ScheduleSummaryDay[]>([]);
  const pendingCount = useNotificationStore(state => state.pendingCount);
  const isLoadingPendingCount = useNotificationStore(state => state.isLoadingCount);
  const fetchPendingCount = useNotificationStore(state => state.fetchPendingCount);

  const photoUri = useMemo(() => {
    if (!user?.email) {
      return null;
    }
    return `${API_BASE_URL}/pract/getmyphoto?email=${encodeURIComponent(user.email)}`;
  }, [user?.email]);

  useEffect(() => {
    setPhotoAvailable(true);
  }, [photoUri]);

  const fetchDashboardData = async () => {
    try {
      if (!user?.email) {
        throw new Error('User email not available');
      }

      // Fetch appointments, in-progress encounters and schedule summary in parallel
      const [appointmentsData, inProgressData, scheduleSummaryData] = await Promise.all([
        apiService.getNextAppointments(user.email, 7),
        apiService.getInProgressEncounters(user.email).catch(() => ({ data: [] })), // Handle errors gracefully
        apiService
          .getPractitionerScheduleSummary(user.email, 10)
          .catch(error => {
            console.error('Error fetching practitioner schedule summary:', error);
            return null;
          })
      ]);
      
      // Transform API response to match our interface
      const appointments = await Promise.all(
        appointmentsData.slice(0, 5).map(async (apt: any) => {
          try {
            // Get patient details for each appointment
            const patientData = await apiService.getPatientDetails(apt.subject);
            let patientPhoto: string | null = null;

            try {
              const photoBase64 = await apiService.getPatientPhoto(apt.subject);
              if (typeof photoBase64 === 'string' && photoBase64.length > 0) {
                patientPhoto = photoBase64;
              }
            } catch (photoError) {
              const message = photoError instanceof Error ? photoError.message : 'Unknown error';
              console.warn('[Dashboard] No patient photo available:', message);
            }
            
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
              status: apt.status === 'booked' ? 'confirmed' : apt.status,
              patientPhoto,
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
              status: 'scheduled',
              patientPhoto: null,
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

      const windowStartRaw =
        scheduleSummaryData?.window?.startDate ||
        scheduleSummaryData?.window?.startdate ||
        scheduleSummaryData?.window?.start_date;
      const windowStartDate = parseScheduleDateString(windowStartRaw);
      const fallbackYear = windowStartDate?.getFullYear();

      const processedSchedule = Array.isArray(scheduleSummaryData?.days)
        ? scheduleSummaryData.days.slice(0, 10).map((day: any, dayIndex: number) => {
            const parsedDate =
              parseScheduleDateString(day.date) ||
              parseScheduleDateString(day.displayDate, fallbackYear) ||
              (windowStartDate
                ? new Date(windowStartDate.getTime() + dayIndex * MS_IN_DAY)
                : null);

            const displayDateRaw =
              typeof day.displayDate === 'string' && day.displayDate.trim().length > 0
                ? day.displayDate.trim()
                : undefined;

            const formattedLabel = formatScheduleDateLabel(parsedDate, displayDateRaw);
            const displayDate = formattedLabel;
            const meta = deriveScheduleDayMeta(parsedDate, displayDateRaw || formattedLabel);
            const blocks = Array.isArray(day.blocks)
              ? day.blocks.map((block: any, blockIndex: number) => {
                  const start = block.startTime ?? block.start_time ?? block.start ?? '';
                  const end = block.endTime ?? block.end_time ?? block.end ?? '';
                  const location =
                    block.locationName ||
                    block.location_name ||
                    block.location?.name ||
                    block.location ||
                    'Local não informado';
                  const idValue =
                    block.scheduleId ||
                    block.schedule_id ||
                    block.id ||
                    `${day.date}-${start}-${end}-${blockIndex}`;

                  const blockSummary: ScheduleSummaryBlock = {
                    id: String(idValue),
                    location: location || 'Local não informado',
                    startTime: start,
                    endTime: end,
                  };

                  return blockSummary;
                })
              : [];

            const daySummary: ScheduleSummaryDay = {
              date: typeof day.date === 'string' && day.date.length > 0 ? day.date : `day-${dayIndex}`,
              dateValue: parsedDate,
              displayDate,
              blocks,
              calendarDay: meta.calendarDay,
              calendarMonth: meta.calendarMonth,
              weekdayLabel: meta.weekdayLabel,
              isWeekend: meta.isWeekend,
            };

            return daySummary;
          })
        : [];

      setScheduleSummary(processedSchedule);
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
      setScheduleSummary([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPendingCount();
    }, [fetchPendingCount])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
    fetchPendingCount();
  };

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const organizationLabel = useMemo(() => {
    if (!user?.organization || !user.organization.trim()) {
      return 'Organização não informada';
    }

    return user.organization.trim();
  }, [user?.organization]);

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
            <View style={styles.userSection}>
              <View style={styles.avatarContainer}>
                {photoUri && photoAvailable ? (
                  <Image
                    source={{
                      uri: photoUri,
                      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    }}
                    style={styles.userAvatar}
                    onError={() => setPhotoAvailable(false)}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>
                      {(user?.name || user?.email || 'D').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.headerContent}>
                <Text style={styles.greeting}>{getTimeBasedGreeting()},</Text>
                <Text style={styles.userName}>{user?.name || 'Doutor'}</Text>
                <Text style={styles.dateText} numberOfLines={1}>
                  {organizationLabel}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.notificationButton, isLoadingPendingCount && styles.notificationButtonLoading]}
              onPress={() => navigation.navigate('Notifications')}
            >
              <MaterialIcons
                name={pendingCount > 0 ? 'notifications' : 'notifications-none'}
                size={24}
                color={theme.colors.white}
              />
              {pendingCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {pendingCount > 99 ? '99+' : String(pendingCount)}
                  </Text>
                </View>
              )}
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
            <FontAwesome
              name="calendar-check-o"
              size={20}
              color={theme.colors.primary}
              style={styles.statIcon}
            />
            <Text style={styles.statNumber} numberOfLines={1}>
              {data?.nextAppointments.length || 0}
            </Text>
            <Text
              style={styles.statLabel}
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit
            >
              Hoje
            </Text>
          </View>
          <View style={styles.statCard}>
            <FontAwesome
              name="clock-o"
              size={20}
              color={theme.colors.info}
              style={styles.statIcon}
            />
            <Text style={styles.statNumber} numberOfLines={1}>
              {data?.nextAppointments.filter(apt => apt.status === 'scheduled').length || 0}
            </Text>
            <Text
              style={styles.statLabel}
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit
            >
              Pendentes
            </Text>
          </View>
          <View style={styles.statCard}>
            <FontAwesome
              name="check-circle"
              size={20}
              color={theme.colors.success}
              style={styles.statIcon}
            />
            <Text style={styles.statNumber} numberOfLines={1}>
              {data?.nextAppointments.filter(apt => apt.status === 'confirmed').length || 0}
            </Text>
            <Text
              style={styles.statLabel}
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit
            >
              Confirmadas
            </Text>
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
            <Text
              style={styles.cardTitle}
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit
            >
              Próximos Agendamentos
            </Text>
            <View style={styles.cardHeaderBadge}>
              <Text style={styles.cardHeaderBadgeText}>
                {data?.nextAppointments.length || 0}
              </Text>
            </View>
          </View>
          
          {data?.nextAppointments && data.nextAppointments.length > 0 ? (
            (() => {
              const groupedAppointments = groupAppointmentsByDate(data.nextAppointments);
              return (
                <>
                  {Object.entries(groupedAppointments).map(([dateGroup, appointments]) => (
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
                          onPress={() => navigation.navigate('AppointmentDetails', { appointmentId: appointment.id })}
                        >
                          <View style={styles.appointmentRowContent}>
                            <View style={styles.patientAvatar}>
                              {appointment.patientPhoto ? (
                                <Image
                                  source={{ uri: appointment.patientPhoto }}
                                  style={styles.patientAvatarImage}
                                />
                              ) : (
                                <FontAwesome name="user" size={18} color={theme.colors.primary} />
                              )}
                            </View>
                            <View style={styles.appointmentContent}>
                              <View style={styles.timeRow}>
                                <Text style={styles.timeText}>{appointment.time}</Text>
                                <View style={[styles.timeIndicator, { backgroundColor: getStatusColor(appointment.status) }]} />
                              </View>
                              <Text style={styles.patientName}>{appointment.patientName}</Text>
                              <View style={styles.appointmentFooter}>
                                <Text style={styles.appointmentType} numberOfLines={1}>
                                  {appointment.type}
                                </Text>
                                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) + '20' }]}>
                                  <FontAwesome 
                                    name={appointment.status === 'confirmed' ? 'check-circle' : 
                                          appointment.status === 'scheduled' ? 'clock-o' : 
                                          'circle'} 
                                    size={12} 
                                    color={getStatusColor(appointment.status)} 
                                  />
                                  <Text style={[styles.statusText, { color: getStatusColor(appointment.status) }]}>
                                    {appointment.status === 'confirmed' ? 'Confirmada' :
                                     appointment.status === 'scheduled' ? 'Agendada' :
                                     appointment.status === 'in_progress' ? 'Em andamento' : 'Concluída'}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.appointmentMoreButton}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('AppointmentList')}
                  >
                    <Text style={styles.appointmentMoreText}>Ver mais</Text>
                    <FontAwesome name="angle-right" size={14} color={theme.colors.primary} />
                  </TouchableOpacity>
                </>
              );
            })()
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome name="calendar-o" size={48} color={theme.colors.textSecondary} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>Nenhum agendamento</Text>
              <Text style={styles.emptySubtitle}>
                Você não possui agendamentos.
              </Text>
              <TouchableOpacity
                style={styles.emptyAction}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AppointmentStep1')}
              >
                <FontAwesome name="plus" size={16} color={theme.colors.primary} />
                <Text style={styles.emptyActionText}>Criar novo agendamento</Text>
              </TouchableOpacity>
            </View>
          )}
          </Card>

          <Card style={styles.scheduleCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <FontAwesome name="map-marker" size={22} color={theme.colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Locais nos próximos 10 dias</Text>
            </View>

            {scheduleSummary.length > 0 ? (
              scheduleSummary.map((day, dayIndex) => (
                <View
                  key={day.date || `schedule-day-${dayIndex}`}
                  style={[styles.scheduleDayRow, dayIndex !== scheduleSummary.length - 1 && styles.scheduleDayRowDivider]}
                >
                  <View style={[styles.calendarBox, day.isWeekend && styles.calendarBoxWeekend]}>
                    <Text style={[styles.calendarMonth, day.isWeekend && styles.calendarTextWeekend]}>
                      {day.calendarMonth}
                    </Text>
                    <Text style={[styles.calendarDay, day.isWeekend && styles.calendarTextWeekend]}>
                      {day.calendarDay}
                    </Text>
                  </View>
                  <View style={styles.scheduleContentArea}>
                    <View style={styles.scheduleHeadingRow}>
                      <Text style={[styles.scheduleDayWeekday, day.isWeekend && styles.scheduleDayWeekdayWeekend]}>
                        {day.weekdayLabel}
                      </Text>
                      {day.blocks.length > 1 && (
                        <View style={styles.scheduleCountPill}>
                          <Text style={styles.scheduleCountText}>
                            {day.blocks.length} atendimentos
                          </Text>
                        </View>
                      )}
                    </View>

                    {day.blocks.length > 0 ? (
                      day.blocks.map((block, blockIndex) => (
                        <View
                          key={block.id}
                          style={[styles.scheduleChip, blockIndex !== day.blocks.length - 1 && styles.scheduleChipSpacing]}
                        >
                          <FontAwesome
                            name="map-marker"
                            size={14}
                            color={theme.colors.primary}
                            style={styles.scheduleChipIcon}
                          />
                          <View style={styles.scheduleChipInfo}>
                            <Text style={styles.scheduleChipTitle}>{block.location}</Text>
                            <Text style={styles.scheduleChipSubtitle}>
                              <FontAwesome name="clock-o" size={12} color={theme.colors.textSecondary} />
                              {'  '}
                              {formatScheduleTimeRange(block.startTime, block.endTime, day.dateValue || undefined)}
                            </Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <View style={styles.scheduleChipEmpty}>
                        <FontAwesome
                          name="calendar-o"
                          size={14}
                          color={theme.colors.textSecondary}
                          style={styles.scheduleChipIcon}
                        />
                        <Text style={styles.scheduleEmptyInline}>Sem atendimentos neste dia</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.scheduleEmptyState}>
                <FontAwesome
                  name="calendar-o"
                  size={32}
                  color={theme.colors.textSecondary}
                  style={styles.scheduleEmptyIcon}
                />
                <Text style={styles.scheduleEmptyTitle}>Agenda não disponível</Text>
                <Text style={styles.scheduleEmptySubtitle}>
                  Atualize sua agenda para visualizar os próximos locais de atendimento.
                </Text>
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
const CALENDAR_BOX_WIDTH = 60;
const scheduleContentOffset = theme.spacing.md + CALENDAR_BOX_WIDTH;

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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: theme.spacing.md,
    backgroundColor: theme.colors.white + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...theme.typography.h2,
    color: theme.colors.white,
    fontWeight: '700',
  },
  headerContent: {
    flex: 1,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.white + '1F',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationButtonLoading: {
    opacity: 0.7,
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  greeting: {
    ...theme.typography.body,
    color: theme.colors.white + 'CC',
    fontSize: 13,
    lineHeight: 18,
  },
  userName: {
    ...theme.typography.h1,
    color: theme.colors.white,
    fontSize: 19,
    fontWeight: '700',
    marginTop: 2,
    lineHeight: 24,
  },
  dateText: {
    ...theme.typography.caption,
    color: theme.colors.white + 'AA',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
    textTransform: 'capitalize',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: theme.spacing.xs,
    minHeight: 92,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: {
    marginBottom: theme.spacing.xs,
  },
  statNumber: {
    ...theme.typography.h1,
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
    width: '100%',
    textAlign: 'center',
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginTop: theme.spacing.xs,
    width: '100%',
    textAlign: 'center',
  },
  appointmentsCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
  },
  scheduleCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
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
    fontSize: 16,
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
  scheduleDayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.md,
  },
  scheduleDayRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  calendarBox: {
    width: CALENDAR_BOX_WIDTH,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xs,
    marginRight: theme.spacing.md,
  },
  calendarBoxWeekend: {
    backgroundColor: theme.colors.error + '12',
    borderColor: theme.colors.error + '40',
  },
  calendarMonth: {
    ...theme.typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  calendarDay: {
    ...theme.typography.h1,
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 24,
  },
  calendarTextWeekend: {
    color: theme.colors.error,
  },
  scheduleContentArea: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  scheduleHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  scheduleDayWeekday: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  scheduleDayWeekdayWeekend: {
    color: theme.colors.error,
    fontWeight: '600',
  },
  scheduleCountPill: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: theme.colors.primary + '15',
  },
  scheduleCountText: {
    ...theme.typography.caption,
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  scheduleChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  scheduleChipSpacing: {
    marginBottom: theme.spacing.xs,
  },
  scheduleChipIcon: {
    marginRight: theme.spacing.sm,
    marginTop: 2,
  },
  scheduleChipInfo: {
    flex: 1,
  },
  scheduleChipTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
  },
  scheduleChipSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  scheduleChipEmpty: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  scheduleEmptyInline: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  scheduleEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
  },
  scheduleEmptyIcon: {
    marginBottom: theme.spacing.md,
  },
  scheduleEmptyTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  scheduleEmptySubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  appointmentRow: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    borderRadius: 8,
    marginBottom: theme.spacing.xs,
  },
  lastAppointmentRow: {
    borderBottomWidth: 0,
    marginBottom: 0,
  },
  appointmentRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  appointmentContent: {
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
  patientName: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 14,
    marginBottom: theme.spacing.xs,
  },
  appointmentType: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  appointmentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  appointmentMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 12,
    backgroundColor: theme.colors.primary + '12',
  },
  appointmentMoreText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: theme.spacing.xs,
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
    fontSize: 10,
    marginLeft: theme.spacing.xs,
  },
  patientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  patientAvatarImage: {
    width: '100%',
    height: '100%',
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
    fontSize: 16,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    fontSize: 13,
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
