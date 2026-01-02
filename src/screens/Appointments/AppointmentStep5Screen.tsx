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
  RefreshControl,
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
import { logger } from '@/utils/logger';

type Step5NavigationProp = StackNavigationProp<DashboardStackParamList, 'AppointmentStep5'>;

interface TimeSlot {
  time: string;
  available: boolean;
  busy?: boolean;
  slotId?: string;
}

interface DaySlots {
  date: string;
  dayName: string;
  dayNumber: number;
  month: string;
  slots: TimeSlot[];
}

export const AppointmentStep5Screen: React.FC = () => {
  const navigation = useNavigation<Step5NavigationProp>();
  const { user } = useAuthStore();
  const { 
    appointmentData, 
    selectedServices,
    canProceedFromStep,
    getTotalServicesValue,
    getTotalDuration,
    setDateTime
  } = useAppointmentStore();

  // State
  const [availableDays, setAvailableDays] = useState<DaySlots[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nextFiveSlots, setNextFiveSlots] = useState<{ date: string; time: string; dayName: string }[]>([]);
  const [busySlots, setBusySlots] = useState<{ date: string; startTime: string; endTime: string }[]>([]);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Toggle day expansion
  const toggleDayExpansion = (date: string) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  // Auto-expand first day when available days load
  useEffect(() => {
    if (availableDays.length > 0 && expandedDays.size === 0) {
      setExpandedDays(new Set([availableDays[0].date]));
    }
  }, [availableDays]);

  // Load available times on component mount
  useEffect(() => {
    loadBusySlots().then((busy) => {
      logger.debug('[DEBUG-BUSY] Initial busy slots loaded:', busy?.length ?? 0, busy);
      loadAvailableTimes(busy);
      loadNextFiveSlots(busy);
    });
  }, [user?.email]);

  // Load busy slots from existing appointments
  const loadBusySlots = async () => {
    logger.debug('[DEBUG-BUSY] 🚀 loadBusySlots called, user email:', user?.email);
    
    if (!user?.email) {
      logger.debug('[DEBUG-BUSY] ❌ No user email, exiting');
      return [];
    }

    try {
      logger.debug('[AppointmentStep5] Loading busy slots from existing appointments');
      const result = await api.getPractitionerAppointments(user.email, { future: 'true', limit: 100 });
      
      logger.debug('[DEBUG-BUSY] API Response:', result);
      
      const busy: { date: string; startTime: string; endTime: string }[] = [];
      
      if (result?.data && Array.isArray(result.data)) {
        logger.debug('[DEBUG-BUSY] Processing', result.data.length, 'appointments');
        
        result.data.forEach((appointment: any, index: number) => {
          logger.debug(`[DEBUG-BUSY] Appointment ${index}:`, appointment);
          
          // Only consider appointments with these statuses as "busy" (same as web app)
          const busyStatuses = ['booked', 'confirmed', 'arrived', 'checked-in', 'scheduled', 'pending'];
          const status = appointment.status ? appointment.status.toLowerCase() : '';
          
          logger.debug(`[DEBUG-BUSY] Status check: "${status}" in [${busyStatuses.join(', ')}] = ${busyStatuses.includes(status)}`);
          
          if (busyStatuses.includes(status) && appointment.startdate && appointment.starttime && appointment.duration) {
            // Convert UTC appointment times to local for comparison
            try {
              // appointment.startdate is already a full UTC datetime like "2025-09-08T00:00:00.000Z"
              // appointment.starttime is like "11:00:00" and represents UTC TIME, not local time
              // Extract just the date part from startdate
              const dateOnly = appointment.startdate.split('T')[0]; // "2025-09-08"
              
              // Create the full UTC datetime string and parse it
              const utcDateTimeString = `${dateOnly}T${appointment.starttime}Z`;
              const utcDateTime = new Date(utcDateTimeString);
              
              // JavaScript automatically converts to local time when we access date/time components
              // Calculate end time in UTC, then convert to local
              const endDateTime = new Date(utcDateTime.getTime() + (appointment.duration * 60 * 1000));
              
              // Format local date and times (getFullYear(), getMonth(), etc. return LOCAL values)
              const dateYear = utcDateTime.getFullYear();
              const dateMonth = (utcDateTime.getMonth() + 1).toString().padStart(2, '0');
              const dateDay = utcDateTime.getDate().toString().padStart(2, '0');
              const localDate = `${dateYear}-${dateMonth}-${dateDay}`;
              
              // Format time components directly from Date object (automatically local)
              const startHours = utcDateTime.getHours().toString().padStart(2, '0');
              const startMinutes = utcDateTime.getMinutes().toString().padStart(2, '0');
              const startSeconds = utcDateTime.getSeconds().toString().padStart(2, '0');
              const startTime = `${startHours}:${startMinutes}:${startSeconds}`;
              
              const endHours = endDateTime.getHours().toString().padStart(2, '0');
              const endMinutes = endDateTime.getMinutes().toString().padStart(2, '0');
              const endSeconds = endDateTime.getSeconds().toString().padStart(2, '0');
              const endTime = `${endHours}:${endMinutes}:${endSeconds}`;
              
              busy.push({
                date: localDate,
                startTime,
                endTime
              });
            } catch (error) {
              logger.warn('[AppointmentStep5] Error processing appointment time:', error, appointment);
            }
          }
        });
      }
      
      setBusySlots(busy);
      logger.debug('[AppointmentStep5] Loaded busy slots:', busy.length);
      logger.debug('[DEBUG-BUSY] Busy slots details:', busy);
      return busy;
    } catch (error) {
      logger.warn('[AppointmentStep5] Could not load busy slots:', error);
      return [];
    }
  };

  // Load available times for the next 7 days
  const loadAvailableTimes = async (busyOverride?: { date: string; startTime: string; endTime: string }[]) => {
    const busyList = busyOverride ?? busySlots;
    logger.debug('[DEBUG-BUSY] loadAvailableTimes using busy list size:', busyList.length, busyList);
    if (!user?.email || !appointmentData.locationid) {
      Alert.alert('Erro', 'Dados incompletos para buscar horários');
      return;
    }

    setLoading(true);
    try {
      logger.debug('[AppointmentStep5] Loading available times');
      const duration = getTotalDuration();

      // Get next 7 days in local timezone
      const days: DaySlots[] = [];
      const now = new Date();
      const today = new Date(now);
      // Reset time to start of day in local timezone
      today.setHours(0, 0, 0, 0);

      // Calculate next full hour after now (same as webapp logic)
      const nextFullHourAfterNow = new Date(now);
      nextFullHourAfterNow.setMinutes(0, 0, 0);
      nextFullHourAfterNow.setHours(nextFullHourAfterNow.getHours() + 1);
      logger.debug('[AppointmentStep5] Next full hour cutoff:', nextFullHourAfterNow.toISOString());

      for (let i = 0; i < 7; i++) {
        const localDate = new Date(today);
        localDate.setDate(today.getDate() + i);
        const isToday = i === 0;
        
        // Format date for API (YYYY-MM-DD) in local timezone
        const year = localDate.getFullYear();
        const month = (localDate.getMonth() + 1).toString().padStart(2, '0');
        const day = localDate.getDate().toString().padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        
        try {
          const result = await api.getAvailableTimes(
            user.email, 
            appointmentData.locationid, 
            dateString, 
            duration
          );
          
          const slots: TimeSlot[] = [];
          if (result?.data && Array.isArray(result.data)) {
            result.data.forEach((slot: any) => {
              // Backend returns UTC date and time, convert to local
              const utcDate = slot.date || dateString;
              const utcTime = slot.time || slot.starttime || '';
              
              if (utcTime) {
                try {
                  // Create UTC datetime from the returned date and time
                  const utcDateTimeString = `${utcDate}T${utcTime}Z`;
                  const utcDateTime = new Date(utcDateTimeString);
                  
                  // Convert to local time
                  const localDateTime = new Date(utcDateTime.getTime());
                  
                  // Check if this slot belongs to the requested local date (use local methods, not toISOString)
                  const year = localDateTime.getFullYear();
                  const month = (localDateTime.getMonth() + 1).toString().padStart(2, '0');
                  const day = localDateTime.getDate().toString().padStart(2, '0');
                  const localDateString = `${year}-${month}-${day}`;
                  
                  if (localDateString === dateString) {
                    // For today, filter out slots before next full hour (same as webapp)
                    if (isToday && localDateTime < nextFullHourAfterNow) {
                      logger.debug(`[AppointmentStep5] Skipping past slot for today: ${localDateTime.toISOString()}`);
                      return; // Skip this slot
                    }

                    // This slot belongs to the requested date after timezone conversion
                    const localTimeString = localDateTime.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    });

                    // Check if this slot conflicts with existing appointments
                    const slotDuration = getTotalDuration();
                    const isBusy = isSlotBusyWith(busyList, localDateString, localTimeString + ':00', slotDuration);
                    
                    slots.push({
                      time: localTimeString,
                      available: slot.available !== false && !isBusy,
                      busy: isBusy,
                      slotId: slot.id || slot.slotId,
                    });
                  }
                } catch (error) {
                  logger.warn('[AppointmentStep5] Error converting UTC time:', error, { slot });
                  // Fallback: use the time as-is
                  const duration = getTotalDuration();
                  const isBusy = isSlotBusyWith(busyList, dateString, utcTime, duration);
                  
                  slots.push({
                    time: utcTime.slice(0, 5), // HH:MM
                    available: slot.available !== false && !isBusy,
                    busy: isBusy,
                    slotId: slot.id || slot.slotId,
                  });
                }
              }
            });
          }
          
          // Only add days that have available slots
          if (slots.length > 0) {
            days.push({
              date: dateString,
              dayName: localDate.toLocaleDateString('pt-BR', { weekday: 'short' }),
              dayNumber: localDate.getDate(),
              month: localDate.toLocaleDateString('pt-BR', { month: 'short' }),
              slots: slots,
            });
          }
        } catch (error) {
          logger.warn(`[AppointmentStep5] No slots for ${dateString}:`, error);
        }
      }
      
      setAvailableDays(days);
      logger.debug('[AppointmentStep5] Loaded available days:', days.length);
    } catch (error) {
      logger.error('[AppointmentStep5] Error loading available times:', error);
      Alert.alert('Erro', 'Não foi possível carregar os horários disponíveis');
    } finally {
      setLoading(false);
    }
  };

  // Load next 5 available slots for quick selection
  const loadNextFiveSlots = async (busyOverride?: { date: string; startTime: string; endTime: string }[]) => {
    const busyList = busyOverride ?? busySlots;
    if (!user?.email || !appointmentData.locationid) return;

    try {
      logger.debug('[AppointmentStep5] Loading next five slots');
      const duration = getTotalDuration();
      
      const result = await api.getNextFiveSlots(user.email, appointmentData.locationid, duration);
      
      if (result?.data && Array.isArray(result.data)) {
        const now = new Date();
        const slots = result.data
          .map((slot: any) => {
            // Backend returns UTC date and time, convert to local
            const utcDate = slot.date;
            const utcTime = slot.time || slot.starttime;
            
            try {
              // Create UTC datetime from the returned date and time
              const utcDateTimeString = `${utcDate}T${utcTime}Z`;
              const utcDateTime = new Date(utcDateTimeString);
              
              // Convert to local time
              const localDateTime = new Date(utcDateTime.getTime());
              
              // Format local date as YYYY-MM-DD (use local methods, not toISOString which converts back to UTC)
              const year = localDateTime.getFullYear();
              const month = (localDateTime.getMonth() + 1).toString().padStart(2, '0');
              const day = localDateTime.getDate().toString().padStart(2, '0');
              const localDateString = `${year}-${month}-${day}`;
              
              // Format local time as HH:MM
              const localTimeString = localDateTime.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              });
              
              return {
                date: localDateString,
                time: localTimeString,
                dayName: localDateTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }),
                localDateTime, // Keep the full datetime for filtering
              };
            } catch (error) {
              logger.warn('[AppointmentStep5] Error converting UTC time for quick slot:', error, { slot });
              // Fallback: use the data as-is
              return {
                date: utcDate,
                time: utcTime ? utcTime.slice(0, 5) : '',
                dayName: new Date(utcDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }),
                localDateTime: new Date(`${utcDate}T${utcTime}`), // Fallback datetime
              };
            }
          })
          .filter((slot: any) => {
            // Filter out slots that are in the past
            return slot.localDateTime > now;
          })
          .filter((slot: any) => {
            const duration = getTotalDuration();
            return !isSlotBusyWith(busyList, slot.date, slot.time + ':00', duration);
          })
          .map(({ localDateTime, ...slot }: { localDateTime: Date; [key: string]: any }) => slot); // Remove localDateTime from final result
        
        setNextFiveSlots(slots);
        logger.debug('[AppointmentStep5] Loaded next five slots (future only):', slots.length);
        logger.debug('[DEBUG-BUSY] Next five slots after filtering busy:', slots);
      }
    } catch (error) {
      logger.warn('[AppointmentStep5] Could not load next five slots:', error);
    }
  };

  const isSlotBusyWith = (
    busyList: { date: string; startTime: string; endTime: string }[],
    date: string,
    time: string,
    duration: number
  ): boolean => {
    // Parse the slot time as local time
    const [dateYear, dateMonth, dateDay] = date.split('-').map(Number);
    const [timeHoursStr = '0', timeMinutesStr = '0', timeSecondsStr = '0'] = (time || '0:0:0').split(':');
    const timeHours = Number(timeHoursStr) || 0;
    const timeMinutes = Number(timeMinutesStr) || 0;
    const timeSeconds = Number(timeSecondsStr) || 0;
    const slotStart = new Date(dateYear, dateMonth - 1, dateDay, timeHours, timeMinutes, timeSeconds);
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
    
    logger.debug(`[DEBUG-BUSY] Checking slot ${date} ${time} (duration: ${duration}min)`);
    logger.debug(`[DEBUG-BUSY] Slot time range: ${slotStart.toISOString()} - ${slotEnd.toISOString()}`);
    logger.debug(`[DEBUG-BUSY] Busy list provided (${busyList.length}):`, busyList);
    
    const conflicts = busyList.filter(busy => {
      logger.debug(`[DEBUG-BUSY] Checking against busy slot: ${busy.date} ${busy.startTime}-${busy.endTime}`);
      
      if (busy.date !== date) {
        logger.debug(`[DEBUG-BUSY] Date mismatch: ${busy.date} !== ${date}`);
        return false;
      }
      
      // Parse busy times as local time too
      const [busyHoursStr = '0', busyMinutesStr = '0', busySecondsStr = '0'] = (busy.startTime || '0:0:0').split(':');
      const [endHoursStr = '0', endMinutesStr = '0', endSecondsStr = '0'] = (busy.endTime || '0:0:0').split(':');
      const busyStart = new Date(dateYear, dateMonth - 1, dateDay, Number(busyHoursStr) || 0, Number(busyMinutesStr) || 0, Number(busySecondsStr) || 0);
      const busyEnd = new Date(dateYear, dateMonth - 1, dateDay, Number(endHoursStr) || 0, Number(endMinutesStr) || 0, Number(endSecondsStr) || 0);
      
      logger.debug(`[DEBUG-BUSY] Busy time range: ${busyStart.toISOString()} - ${busyEnd.toISOString()}`);
      
      // Check if the slot overlaps with the busy time
      const overlaps = slotStart < busyEnd && slotEnd > busyStart;
      logger.debug(`[DEBUG-BUSY] Overlap check: ${slotStart.toISOString()} < ${busyEnd.toISOString()} && ${slotEnd.toISOString()} > ${busyStart.toISOString()} = ${overlaps}`);
      
      if (overlaps) {
        logger.debug(`[DEBUG-BUSY] ❌ CONFLICT with appointment: ${busy.date} ${busy.startTime}-${busy.endTime}`);
      }
      
      return overlaps;
    });
    
    if (conflicts.length > 0) {
      logger.debug(`[DEBUG-BUSY] ❌ Slot ${date} ${time} is BUSY (${conflicts.length} conflicts)`);
      return true;
    }
    
    logger.debug(`[DEBUG-BUSY] ✅ Slot ${date} ${time} is AVAILABLE`);
    return false;
  };

  // Check if a slot conflicts with existing appointments (uses current state)
  const isSlotBusy = (date: string, time: string, duration: number): boolean =>
    isSlotBusyWith(busySlots, date, time, duration);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    const busy = await loadBusySlots();
    await Promise.all([loadAvailableTimes(busy), loadNextFiveSlots(busy)]);
    setRefreshing(false);
  };

  // Handle slot selection
  const handleSlotSelect = (date: string, time: string) => {
    setSelectedSlot({ date, time });
    
    // Calculate end time based on duration
    const duration = getTotalDuration();
    const [hours, minutes] = time.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
    const endTime = endDate.toTimeString().slice(0, 8); // HH:MM:SS
    
    setDateTime(date, time + ':00', endTime); // Add seconds for API format
  };

  // Handle continue to next step
  const handleContinue = () => {
    if (canProceedFromStep(5)) {
      navigation.navigate('AppointmentStep6' as never);
    }
  };

  // Format time for display
  const formatTime = (time: string) => {
    return time.slice(0, 5); // Remove seconds: HH:MM:SS -> HH:MM
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
              <Text style={styles.greeting}>Data e Horário</Text>
              <Text style={styles.userName}>Passo 5 de 6</Text>
              <Text style={styles.dateText}>Escolha quando atender</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.logoutButton}>
              <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        >
          {/* Question Title */}
          <View style={styles.questionContainer}>
            <Text style={styles.questionTitle}>Quando será a consulta?</Text>
            <Text style={styles.questionSubtitle}>
              Paciente: {appointmentData.patientName}
            </Text>
            <Text style={styles.questionSubtitle}>
              Duração: {getTotalDuration()} minutos
            </Text>
          </View>

          {/* Quick Selection - Next 5 Slots */}
          {nextFiveSlots.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <FontAwesome name="clock-o" size={16} color={theme.colors.success} />
                <Text style={styles.sectionTitle}>Próximos Horários</Text>
              </View>
              
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.quickSlotsContainer}
              >
                {nextFiveSlots.map((slot, index) => (
                  <TouchableOpacity
                    key={`${slot.date}-${slot.time}`}
                    style={[
                      styles.quickSlotCard,
                      selectedSlot?.date === slot.date && selectedSlot?.time === slot.time && styles.selectedQuickSlot,
                    ]}
                    onPress={() => handleSlotSelect(slot.date, slot.time)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.quickSlotDay,
                      selectedSlot?.date === slot.date && selectedSlot?.time === slot.time && styles.selectedQuickSlotText
                    ]}>
                      {slot.dayName}
                    </Text>
                    <Text style={[
                      styles.quickSlotTime,
                      selectedSlot?.date === slot.date && selectedSlot?.time === slot.time && styles.selectedQuickSlotText
                    ]}>
                      {formatTime(slot.time)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Available Days and Slots */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <FontAwesome name="calendar" size={16} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Horários Disponíveis</Text>
            </View>

            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Carregando horários...</Text>
              </View>
            )}

            {!loading && availableDays.length === 0 && (
              <View style={styles.emptyContainer}>
                <FontAwesome name="calendar-times-o" size={32} color={theme.colors.textSecondary} />
                <Text style={styles.emptyTitle}>Nenhum horário disponível</Text>
                <Text style={styles.emptyText}>
                  Não há horários livres nos próximos 7 dias para a duração selecionada ({getTotalDuration()} min)
                </Text>
                <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
                  <FontAwesome name="refresh" size={16} color={theme.colors.primary} />
                  <Text style={styles.refreshButtonText}>Atualizar</Text>
                </TouchableOpacity>
              </View>
            )}

            {!loading && availableDays.map((day) => {
              const isExpanded = expandedDays.has(day.date);
              const hasSelectedSlot = selectedSlot?.date === day.date;
              const availableCount = day.slots.filter(s => s.available).length;

              return (
                <View key={day.date} style={styles.dayContainer}>
                  {/* Day Header - Collapsible */}
                  <TouchableOpacity
                    style={[styles.dayHeader, !isExpanded && styles.dayHeaderCollapsed]}
                    onPress={() => toggleDayExpansion(day.date)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dayInfo}>
                      <Text style={styles.dayName}>{day.dayName}</Text>
                      <Text style={styles.dayNumber}>{day.dayNumber}</Text>
                      <Text style={styles.dayMonth}>{day.month}</Text>
                    </View>
                    <View style={styles.dayHeaderRight}>
                      {hasSelectedSlot && (
                        <View style={styles.selectedBadge}>
                          <MaterialIcons name="check" size={12} color={theme.colors.white} />
                          <Text style={styles.selectedBadgeText}>{formatTime(selectedSlot.time)}</Text>
                        </View>
                      )}
                      <Text style={styles.slotsCount}>
                        {availableCount} horário{availableCount !== 1 ? 's' : ''}
                      </Text>
                      <FontAwesome
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={theme.colors.textSecondary}
                        style={styles.chevronIcon}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Time Slots Grid - Collapsible */}
                  {isExpanded && (
                    <View style={styles.slotsGrid}>
                      {day.slots.map((slot) => (
                        <TouchableOpacity
                          key={`${day.date}-${slot.time}`}
                          style={[
                            styles.slotCard,
                            !slot.available && styles.unavailableSlotCard,
                            slot.busy && styles.busySlotCard,
                            selectedSlot?.date === day.date && selectedSlot?.time === slot.time && styles.selectedSlotCard,
                          ]}
                          onPress={() => slot.available && handleSlotSelect(day.date, slot.time)}
                          disabled={!slot.available}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.slotTime,
                            !slot.available && styles.unavailableSlotText,
                            slot.busy && styles.busySlotText,
                            selectedSlot?.date === day.date && selectedSlot?.time === slot.time && styles.selectedSlotText,
                          ]}>
                            {formatTime(slot.time)}
                          </Text>

                          {selectedSlot?.date === day.date && selectedSlot?.time === slot.time && (
                            <MaterialIcons
                              name="check-circle"
                              size={16}
                              color={theme.colors.white}
                              style={styles.slotCheckIcon}
                            />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Selected Slot Summary */}
          {selectedSlot && (
            <View style={styles.sectionContainer}>
              <View style={styles.summaryContainer}>
                <Text style={styles.summaryTitle}>Horário Selecionado</Text>
                
                <View style={styles.summaryRow}>
                  <FontAwesome name="calendar" size={16} color={theme.colors.primary} />
                  <Text style={styles.summaryValue}>
                    {new Date(selectedSlot.date).toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </Text>
                </View>
                
                <View style={styles.summaryRow}>
                  <FontAwesome name="clock-o" size={16} color={theme.colors.primary} />
                  <Text style={styles.summaryValue}>
                    {formatTime(selectedSlot.time)} ({getTotalDuration()} minutos)
                  </Text>
                </View>
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
              !selectedSlot && styles.disabledButton
            ]}
            onPress={handleContinue}
            disabled={!selectedSlot}
          >
            <Text
              style={[
                styles.continueButtonText,
                !selectedSlot && styles.disabledButtonText
              ]}
            >
              Continuar
            </Text>
            <FontAwesome 
              name="arrow-right" 
              size={16} 
              color={selectedSlot ? theme.colors.white : theme.colors.textSecondary} 
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
  quickSlotsContainer: {
    marginBottom: 8,
  },
  quickSlotCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectedQuickSlot: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  quickSlotDay: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  selectedQuickSlotText: {
    color: theme.colors.white,
  },
  quickSlotTime: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  dayContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dayHeaderCollapsed: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.white,
  },
  dayInfo: {
    alignItems: 'center',
  },
  dayName: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  dayNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 2,
  },
  dayMonth: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  slotsCount: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  slotCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 12,
    margin: 6,
    minWidth: 70,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    position: 'relative',
  },
  selectedSlotCard: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  unavailableSlotCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderColor: theme.colors.border,
    opacity: 0.5,
  },
  busySlotCard: {
    backgroundColor: '#ffebee',
    borderColor: '#ffcdd2',
    opacity: 0.7,
  },
  slotTime: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  selectedSlotText: {
    color: theme.colors.white,
  },
  unavailableSlotText: {
    color: theme.colors.textSecondary,
  },
  busySlotText: {
    color: '#d32f2f',
    textDecorationLine: 'line-through',
    textDecorationColor: '#d32f2f',
  },
  slotCheckIcon: {
    position: 'absolute',
    top: 2,
    right: 2,
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
    textTransform: 'capitalize',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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
    marginBottom: 16,
    maxWidth: 280,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  refreshButtonText: {
    fontSize: 14,
    color: theme.colors.primary,
    marginLeft: 8,
    fontWeight: '500',
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
