import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { Card, Loading } from '@components/common';
import { theme } from '@theme/index';
import { useAuthStore } from '@store/authStore';
import { apiService } from '@services/api';
import { PatientsStackParamList } from '@types/navigation';

type PatientsNavigationProp = StackNavigationProp<PatientsStackParamList, 'PatientsList'>;

interface Patient {
  cpf: string;
  name: string;
  email: string;
  phone: string;
  gender: 'male' | 'female';
  photo?: string; // Add photo field
}

interface PatientsData {
  patients: Patient[];
  total: number;
  page: number;
  pages: number;
}

export const PatientsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const navigation = useNavigation<PatientsNavigationProp>();
  const [data, setData] = useState<PatientsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);

  const fetchPatients = async (pageNum: number = 1, search: string = '') => {
    try {
      if (!user?.email) {
        throw new Error('User email not available');
      }

      console.log('[PatientsScreen] Fetching patients for page:', pageNum, 'search:', search);
      const response = await apiService.getPatients(user.email, pageNum, 20, search);
      
      // Transform API response to match our interface
      const patients = response.data.data.map((patient: any) => ({
        cpf: patient.patientCpf,
        name: patient.patientName,
        email: patient.patientEmail,
        phone: patient.patientPhone,
        gender: patient.patientGender,
        photo: null, // Will be loaded separately
      }));

      console.log('[PatientsScreen] Fetched', patients.length, 'patients, now loading photos...');

      // Load photos for each patient in parallel
      const patientsWithPhotos = await Promise.all(
        patients.map(async (patient) => {
          try {
            console.log('[PatientsScreen] Loading photo for patient:', patient.name, 'CPF:', patient.cpf);
            const photo = await apiService.getPatientPhoto(patient.cpf);
            return {
              ...patient,
              photo: photo || null,
            };
          } catch (error) {
            console.log('[PatientsScreen] Photo not available for', patient.name, ':', error.message);
            return {
              ...patient,
              photo: null,
            };
          }
        })
      );

      console.log('[PatientsScreen] Completed loading photos for all patients');

      setData({
        patients: patientsWithPhotos,
        total: response.data.total,
        page: pageNum,
        pages: Math.ceil(response.data.total / 20),
      });
    } catch (error) {
      console.error('Error fetching patients:', error);
      
      // Fallback to mock data if API fails
      setData({
        patients: [
          {
            cpf: '123.456.789-00',
            name: 'Maria Silva',
            email: 'maria@email.com',
            phone: '(11) 98765-4321',
            gender: 'female',
            photo: null,
          },
          {
            cpf: '987.654.321-00',
            name: 'João Santos',
            email: 'joao@email.com',
            phone: '(11) 91234-5678',
            gender: 'male',
            photo: null,
          },
        ],
        total: 2,
        page: 1,
        pages: 1,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchPatients(1, searchText);
  };

  const handleSearch = (text: string) => {
    setSearchText(text);
    setPage(1);
    fetchPatients(1, text);
  };

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handlePatientPress = (patient: Patient) => {
    navigation.navigate('PatientDashboard', {
      patientCpf: patient.cpf,
      patientName: patient.name,
    });
  };

  const renderPatientItem = ({ item }: { item: Patient }) => (
    <TouchableOpacity 
      onPress={() => handlePatientPress(item)}
      activeOpacity={0.8}
      style={styles.patientCardContainer}
    >
      <Card style={styles.patientCard}>
        <View style={styles.patientRow}>
          {/* Enhanced Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.patientAvatar}>
              {item.photo ? (
                <Image 
                  source={{ uri: item.photo }} 
                  style={styles.patientPhotoImage}
                  onError={(error) => {
                    console.log('[PatientsScreen] Failed to load photo for', item.name, ':', error);
                  }}
                  onLoad={() => {
                    console.log('[PatientsScreen] Photo loaded successfully for', item.name);
                  }}
                />
              ) : (
                <FontAwesome 
                  name={item.gender === 'female' ? 'female' : 'male'} 
                  size={26} 
                  color={theme.colors.white}
                />
              )}
            </View>
            {/* Online status indicator (could be dynamic in the future) */}
            <View style={styles.statusIndicator} />
          </View>
          
          {/* Enhanced Patient Info */}
          <View style={styles.patientInfo}>
            <View style={styles.patientHeader}>
              <Text style={styles.patientName} numberOfLines={1}>{item.name}</Text>
              <View style={[styles.genderBadge, { 
                backgroundColor: item.gender === 'female' ? theme.colors.success + '15' : theme.colors.info + '15' 
              }]}>
                <FontAwesome 
                  name={item.gender === 'female' ? 'venus' : 'mars'} 
                  size={10} 
                  color={item.gender === 'female' ? theme.colors.success : theme.colors.info} 
                />
                <Text style={[styles.genderBadgeText, { 
                  color: item.gender === 'female' ? theme.colors.success : theme.colors.info 
                }]}>
                  {item.gender === 'female' ? 'F' : 'M'}
                </Text>
              </View>
            </View>
            
            <View style={styles.patientDetailsContainer}>
              <View style={styles.detailRow}>
                <FontAwesome name="id-card-o" size={11} color={theme.colors.textSecondary} />
                <Text style={styles.patientDetails}>{formatCPF(item.cpf)}</Text>
              </View>
              <View style={styles.detailRow}>
                <FontAwesome name="phone" size={11} color={theme.colors.textSecondary} />
                <Text style={styles.patientDetails}>{item.phone}</Text>
              </View>
            </View>
          </View>
          
          {/* Enhanced Actions Section */}
          <View style={styles.patientActions}>
            <FontAwesome name="chevron-right" size={16} color={theme.colors.primary} />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return <Loading text="Carregando pacientes..." />;
  }

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
              <Text style={styles.greeting}>Pacientes</Text>
              <Text style={styles.userName}>Gerenciar Pacientes</Text>
              <Text style={styles.dateText}>
                {data?.total} paciente{data?.total !== 1 ? 's' : ''} encontrado{data?.total !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <FontAwesome name="users" size={24} color={theme.colors.primary} />
            <Text style={styles.statNumber}>{data?.total || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <FontAwesome name="user-plus" size={24} color={theme.colors.success} />
            <Text style={styles.statNumber}>
              {data?.patients.filter(p => p.gender === 'female').length || 0}
            </Text>
            <Text style={styles.statLabel}>Mulheres</Text>
          </View>
          <View style={styles.statCard}>
            <FontAwesome name="user" size={24} color={theme.colors.info} />
            <Text style={styles.statNumber}>
              {data?.patients.filter(p => p.gender === 'male').length || 0}
            </Text>
            <Text style={styles.statLabel}>Homens</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <FontAwesome name="search" size={16} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome, CPF ou telefone..."
            value={searchText}
            onChangeText={handleSearch}
            autoCapitalize="none"
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>

        {/* Patients List */}
        <FlatList
          data={data?.patients || []}
          renderItem={renderPatientItem}
          keyExtractor={(item) => item.cpf}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome name="user-plus" size={48} color={theme.colors.textSecondary} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>Nenhum paciente encontrado</Text>
              <Text style={styles.emptySubtext}>
                {searchText ? 'Tente ajustar sua busca' : 'Adicione o primeiro paciente'}
              </Text>
              <TouchableOpacity style={styles.emptyAction} activeOpacity={0.7}>
                <FontAwesome name="plus" size={16} color={theme.colors.primary} />
                <Text style={styles.emptyActionText}>Adicionar novo paciente</Text>
              </TouchableOpacity>
            </View>
          }
        />
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
  headerBackground: {
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: StatusBar.currentHeight || 44,
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xl,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.text,
    paddingVertical: theme.spacing.md,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  patientCardContainer: {
    marginBottom: theme.spacing.md,
  },
  patientCard: {
    borderRadius: 20,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight + '50',
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  avatarSection: {
    position: 'relative',
    marginRight: theme.spacing.md,
  },
  patientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  patientPhotoImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  patientInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs - 2,
  },
  patientName: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
    marginRight: theme.spacing.xs,
  },
  patientDetailsContainer: {
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  patientDetails: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  patientActions: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.success + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.success + '30',
  },
  chevronContainer: {
    padding: theme.spacing.xs,
  },
  genderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs - 2,
    borderRadius: 10,
    gap: theme.spacing.xs - 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  genderBadgeText: {
    ...theme.typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xl,
  },
  emptyIcon: {
    opacity: 0.5,
    marginBottom: theme.spacing.lg,
  },
  emptyText: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
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
});