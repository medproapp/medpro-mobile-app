import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
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

      const response = await apiService.getPatients(user.email, pageNum, 20, search);
      
      // Transform API response to match our interface
      const patients = response.data.data.map((patient: any) => ({
        cpf: patient.patientCpf,
        name: patient.patientName,
        email: patient.patientEmail,
        phone: patient.patientPhone,
        gender: patient.patientGender,
      }));

      setData({
        patients,
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
          },
          {
            cpf: '987.654.321-00',
            name: 'João Santos',
            email: 'joao@email.com',
            phone: '(11) 91234-5678',
            gender: 'male',
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
    <TouchableOpacity onPress={() => handlePatientPress(item)}>
      <Card style={styles.patientCard}>
        <View style={styles.patientRow}>
          <View style={styles.patientAvatar}>
            <FontAwesome 
              name={item.gender === 'female' ? 'female' : 'male'} 
              size={24} 
              color={theme.colors.primary} 
            />
          </View>
          
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{item.name}</Text>
            <Text style={styles.patientDetails}>CPF: {formatCPF(item.cpf)}</Text>
            <Text style={styles.patientDetails}>{item.phone}</Text>
          </View>
          
          <View style={styles.patientActions}>
            <TouchableOpacity style={styles.actionButton}>
              <FontAwesome name="phone" size={16} color={theme.colors.success} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <FontAwesome name="envelope" size={16} color={theme.colors.info} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <FontAwesome name="chevron-right" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return <Loading text="Carregando pacientes..." />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <FontAwesome name="users" size={24} color={theme.colors.primary} />
          <Text style={styles.title}>Pacientes</Text>
        </View>
        <Text style={styles.subtitle}>
          {data?.total} paciente{data?.total !== 1 ? 's' : ''} encontrado{data?.total !== 1 ? 's' : ''}
        </Text>
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
        />
      </View>

      {/* Patients List */}
      <FlatList
        data={data?.patients || []}
        renderItem={renderPatientItem}
        keyExtractor={(item) => item.cpf}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome name="user-plus" size={48} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>Nenhum paciente encontrado</Text>
            <Text style={styles.emptySubtext}>
              {searchText ? 'Tente ajustar sua busca' : 'Adicione o primeiro paciente'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
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
    padding: theme.spacing.md,
  },
  patientCard: {
    marginBottom: theme.spacing.md,
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  patientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  patientDetails: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  patientActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.spacing.xl * 2,
  },
  emptyText: {
    ...theme.typography.h3,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  emptySubtext: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});