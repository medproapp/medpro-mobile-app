import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { Card, Loading } from '@components/common';
import { theme } from '@theme/index';
import { useAuthStore } from '@store/authStore';
import { apiService } from '@services/api';

interface Encounter {
  Identifier: string;
  Class: string;
  Status: string;
  Subject: string;
  actualStart: string;
  Length: number;
  Appointment?: string;
  patientName?: string;
}

interface EncounterListProps {
  route?: {
    params?: {
      filterStatus?: 'OPEN' | 'ALL';
    };
  };
}

export const EncounterListScreen: React.FC<EncounterListProps> = ({ route }) => {
  const { user } = useAuthStore();
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'OPEN' | 'ALL'>(
    route?.params?.filterStatus || 'ALL'
  );

  const fetchEncounters = async () => {
    try {
      if (!user?.email) {
        throw new Error('User email not available');
      }

      let encountersData;
      
      if (filterStatus === 'OPEN') {
        // Fetch only in-progress and on-hold encounters
        encountersData = await apiService.getInProgressEncounters(user.email);
      } else {
        // TODO: Implement full encounter list API
        encountersData = await apiService.getInProgressEncounters(user.email);
      }

      // Fetch patient names for each encounter
      const encountersWithPatients = await Promise.all(
        (encountersData?.data || []).map(async (encounter: Encounter) => {
          try {
            const patientData = await apiService.getPatientDetails(encounter.Subject);
            return {
              ...encounter,
              patientName: patientData.data?.name || 'Paciente Desconhecido'
            };
          } catch (error) {
            console.error('Error fetching patient name:', error);
            return {
              ...encounter,
              patientName: 'Paciente Desconhecido'
            };
          }
        })
      );

      setEncounters(encountersWithPatients);
    } catch (error) {
      console.error('Error fetching encounters:', error);
      setEncounters([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEncounters();
  }, [filterStatus]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchEncounters();
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'in-progress':
        return { text: 'Em Andamento', color: theme.colors.info, icon: 'play-circle' };
      case 'on-hold':
        return { text: 'Pausado', color: theme.colors.warning, icon: 'pause-circle' };
      case 'completed':
        return { text: 'Finalizado', color: theme.colors.success, icon: 'check-circle' };
      case 'cancelled':
        return { text: 'Cancelado', color: theme.colors.error, icon: 'times-circle' };
      default:
        return { text: status, color: theme.colors.textSecondary, icon: 'circle' };
    }
  };

  const getEncounterTypeText = (encounterClass: string) => {
    switch (encounterClass) {
      case 'AMB':
        return 'Consulta';
      case 'EMER':
        return 'Emergência';
      default:
        return encounterClass || 'N/A';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const handleEncounterPress = (encounter: Encounter) => {
    // TODO: Navigate to encounter details
    console.log('Navigate to encounter details:', encounter.Identifier);
  };

  const handleContinueEncounter = (encounter: Encounter) => {
    // TODO: Navigate to encounter start/continue
    console.log('Continue encounter:', encounter.Identifier);
  };

  if (loading) {
    return <Loading text="Carregando encontros..." />;
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <FontAwesome name="hospital-o" size={24} color={theme.colors.white} />
          <Text style={styles.headerTitle}>Encontros</Text>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[
              styles.filterTab,
              filterStatus === 'ALL' && styles.activeFilterTab
            ]}
            onPress={() => setFilterStatus('ALL')}
          >
            <Text style={[
              styles.filterTabText,
              filterStatus === 'ALL' && styles.activeFilterTabText
            ]}>
              Todos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              filterStatus === 'OPEN' && styles.activeFilterTab
            ]}
            onPress={() => setFilterStatus('OPEN')}
          >
            <Text style={[
              styles.filterTabText,
              filterStatus === 'OPEN' && styles.activeFilterTabText
            ]}>
              Em Andamento
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        >
          {encounters.length > 0 ? (
            encounters.map((encounter, index) => {
              const statusInfo = getStatusInfo(encounter.Status);
              const canContinue = encounter.Status === 'in-progress' || encounter.Status === 'on-hold';
              
              return (
                <Card key={encounter.Identifier} style={styles.encounterCard}>
                  <TouchableOpacity
                    style={styles.encounterRow}
                    onPress={() => handleEncounterPress(encounter)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.encounterHeader}>
                      <Text style={styles.encounterId}>#{encounter.Identifier}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                        <FontAwesome
                          name={statusInfo.icon}
                          size={12}
                          color={statusInfo.color}
                          style={styles.statusIcon}
                        />
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>
                          {statusInfo.text}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.encounterInfo}>
                      <Text style={styles.patientName}>{encounter.patientName}</Text>
                      <View style={styles.encounterDetails}>
                        <Text style={styles.encounterType}>
                          {getEncounterTypeText(encounter.Class)}
                        </Text>
                        <Text style={styles.encounterDate}>
                          {formatDate(encounter.actualStart)}
                        </Text>
                        <Text style={styles.encounterDuration}>
                          {formatDuration(encounter.Length)}
                        </Text>
                      </View>
                    </View>

                    {canContinue && (
                      <TouchableOpacity
                        style={styles.continueButton}
                        onPress={() => handleContinueEncounter(encounter)}
                        activeOpacity={0.7}
                      >
                        <FontAwesome name="play" size={16} color={theme.colors.primary} />
                        <Text style={styles.continueButtonText}>Continuar</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </Card>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome 
                name="hospital-o" 
                size={48} 
                color={theme.colors.textSecondary} 
                style={styles.emptyIcon} 
              />
              <Text style={styles.emptyTitle}>
                {filterStatus === 'OPEN' 
                  ? 'Nenhum encontro em andamento'
                  : 'Nenhum encontro encontrado'
                }
              </Text>
              <Text style={styles.emptySubtitle}>
                {filterStatus === 'OPEN'
                  ? 'Você não possui encontros em andamento no momento.'
                  : 'Não foram encontrados encontros para este filtro.'
                }
              </Text>
            </View>
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
  header: {
    backgroundColor: theme.colors.primary,
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    ...theme.typography.h1,
    color: theme.colors.white,
    fontSize: 24,
    fontWeight: '700',
    marginLeft: theme.spacing.md,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterTab: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeFilterTab: {
    borderBottomColor: theme.colors.primary,
  },
  filterTabText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  activeFilterTabText: {
    color: theme.colors.primary,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  encounterCard: {
    marginBottom: theme.spacing.md,
  },
  encounterRow: {
    padding: theme.spacing.md,
  },
  encounterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  encounterId: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 12,
  },
  statusIcon: {
    marginRight: theme.spacing.xs,
  },
  statusText: {
    ...theme.typography.caption,
    fontSize: 12,
    fontWeight: '600',
  },
  encounterInfo: {
    marginBottom: theme.spacing.sm,
  },
  patientName: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  encounterDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  encounterType: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  encounterDate: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
    flex: 1,
    textAlign: 'center',
  },
  encounterDuration: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
  },
  continueButtonText: {
    ...theme.typography.button,
    color: theme.colors.primary,
    fontWeight: '600',
    marginLeft: theme.spacing.xs,
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
  },
});