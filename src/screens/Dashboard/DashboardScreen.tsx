import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Card, Loading } from '@components/common';
import { theme } from '@theme/index';
import { useAuthStore } from '@store/authStore';
import { apiService } from '@services/api';

interface Appointment {
  id: string;
  patientName: string;
  time: string;
  type: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed';
}

interface DashboardData {
  nextAppointments: Appointment[];
}

export const DashboardScreen: React.FC = () => {
  const { user, logout } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      if (!user?.email) {
        throw new Error('User email not available');
      }

      // Call real API for next appointments
      const appointmentsData = await apiService.getNextAppointments(user.email, 7);
      
      // Transform API response to match our interface
      const appointments = await Promise.all(
        appointmentsData.slice(0, 5).map(async (apt: any) => {
          try {
            // Get patient details for each appointment
            const patientData = await apiService.getPatientDetails(apt.subject);
            
            return {
              id: apt.identifier.toString(),
              patientName: patientData.data?.name || 'Paciente',
              time: apt.starttime.substring(0, 5), // Extract HH:MM from "17:00:00"
              type: apt.appointmenttype === 'ROUTINE' ? 'Consulta' : apt.appointmenttype,
              status: apt.status === 'booked' ? 'confirmed' : apt.status
            };
          } catch (error) {
            console.error('Error fetching patient details:', error);
            return {
              id: apt.identifier.toString(),
              patientName: 'Paciente',
              time: apt.starttime.substring(0, 5),
              type: 'Consulta',
              status: 'scheduled'
            };
          }
        })
      );

      setData({
        nextAppointments: appointments
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
            type: 'Consulta',
            status: 'confirmed'
          },
          {
            id: '2',
            patientName: 'João Santos',
            time: '10:30',
            type: 'Retorno',
            status: 'scheduled'
          },
          {
            id: '3',
            patientName: 'Ana Costa',
            time: '11:15',
            type: 'Exame',
            status: 'confirmed'
          },
          {
            id: '4',
            patientName: 'Pedro Lima',
            time: '14:00',
            type: 'Consulta',
            status: 'scheduled'
          },
          {
            id: '5',
            patientName: 'Carla Oliveira',
            time: '15:30',
            type: 'Retorno',
            status: 'confirmed'
          }
        ]
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bom dia,</Text>
          <Text style={styles.userName}>{user?.name || 'Doutor'}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Next Appointments */}
      <Card style={styles.appointmentsCard}>
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <FontAwesome name="calendar" size={20} color={theme.colors.primary} />
            <FontAwesome name="calendar" size={20} color={theme.colors.primaryLight} style={styles.iconShadow} />
          </View>
          <Text style={styles.cardTitle}>Próximas Consultas</Text>
        </View>
        {data?.nextAppointments.map((appointment) => (
          <View key={appointment.id} style={styles.appointmentRow}>
            <View style={styles.appointmentTime}>
              <Text style={styles.timeText}>{appointment.time}</Text>
            </View>
            <View style={styles.appointmentInfo}>
              <Text style={styles.patientName}>{appointment.patientName}</Text>
              <Text style={styles.appointmentType}>{appointment.type}</Text>
            </View>
            <View style={styles.statusContainer}>
              <View style={styles.iconContainer}>
                <FontAwesome 
                  name={appointment.status === 'confirmed' ? 'check-circle' : 
                        appointment.status === 'scheduled' ? 'clock-o' : 
                        'circle'} 
                  size={16} 
                  color={getStatusColor(appointment.status)} 
                />
                <FontAwesome 
                  name={appointment.status === 'confirmed' ? 'check-circle' : 
                        appointment.status === 'scheduled' ? 'clock-o' : 
                        'circle'} 
                  size={16} 
                  color={getStatusColor(appointment.status)} 
                  style={[styles.iconShadow, { opacity: 0.2 }]} 
                />
              </View>
              <Text style={[styles.statusText, { color: getStatusColor(appointment.status) }]}>
                {appointment.status === 'confirmed' ? 'Confirmada' :
                 appointment.status === 'scheduled' ? 'Agendada' :
                 appointment.status === 'in_progress' ? 'Em andamento' : 'Concluída'}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
  },
  greeting: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  userName: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  logoutButton: {
    padding: theme.spacing.sm,
  },
  logoutText: {
    ...theme.typography.button,
    color: theme.colors.error,
  },
  appointmentsCard: {
    marginBottom: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  iconContainer: {
    position: 'relative',
    marginRight: theme.spacing.sm,
  },
  iconShadow: {
    position: 'absolute',
    top: 1,
    left: 1,
    opacity: 0.3,
  },
  cardTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  appointmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  appointmentTime: {
    width: 60,
    marginRight: theme.spacing.md,
  },
  timeText: {
    ...theme.typography.h3,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  appointmentInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  patientName: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '500',
    marginBottom: theme.spacing.xs,
  },
  appointmentType: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    ...theme.typography.caption,
    fontWeight: '500',
    fontSize: 12,
    marginLeft: theme.spacing.xs,
  },
});