import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { theme } from '@theme/index';
import { useAppointmentStore } from '@store/appointmentStore';
import { useAuthStore } from '@store/authStore';
import api from '@services/api';
import { DashboardStackParamList } from '@/types/navigation';

type Step6NavigationProp = StackNavigationProp<DashboardStackParamList, 'AppointmentStep6'>;

interface ServiceCategory {
  id: string;
  name: string;
}

interface ServiceType {
  id: string;
  name: string;
}

interface AppointmentType {
  id: string;
  name: string;
}

export const AppointmentStep6Screen: React.FC = () => {
  const navigation = useNavigation<Step6NavigationProp>();
  const { user } = useAuthStore();
  const { 
    appointmentData,
    canProceedFromStep,
  } = useAppointmentStore();

  // State for form fields
  const [description, setDescription] = useState(appointmentData.description || '');
  const [note, setNote] = useState(appointmentData.note || '');
  const [servicecategory, setServiceCategory] = useState(appointmentData.servicecategory || '');
  const [servicetype, setServiceType] = useState(appointmentData.servicetype || '');
  const [appointmenttype, setAppointmentType] = useState(appointmentData.appointmenttype || '');
  
  // State for dropdown options
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [loading, setLoading] = useState(false);

  // Load dropdown data on mount
  useEffect(() => {
    loadDropdownData();
  }, []);

  const loadDropdownData = async () => {
    if (!user?.email) return;
    
    setLoading(true);
    try {
      // Load service categories - same as webapp
      const allCategoriesResult = await api.getServiceCategories();
      const practCategoriesResult = await api.getPractServiceCategories(user.email);
      
      if (allCategoriesResult && practCategoriesResult?.data?.serviceCategoryList) {
        const practServiceCategoryIds = practCategoriesResult.data.serviceCategoryList;
        console.log('[AppointmentStep6] Practitioner category IDs:', practServiceCategoryIds);
        console.log('[AppointmentStep6] All categories:', allCategoriesResult);
        
        const availableCategories = allCategoriesResult.filter((cat: any) => 
          practServiceCategoryIds.includes(parseInt(cat.categoryId))
        ).map((cat: any) => ({
          id: cat.categoryId.toString(),
          name: cat.categoryDesc
        }));
        
        console.log('[AppointmentStep6] Available categories:', availableCategories);
        setCategories(availableCategories);
      }

      // Load service types - same as webapp
      const allTypesResult = await api.getServiceTypes();
      const practTypesResult = await api.getPractServiceTypes(user.email);
      
      if (allTypesResult && practTypesResult?.data?.serviceTypeList) {
        const practServiceTypeIds = practTypesResult.data.serviceTypeList;
        const availableTypes = allTypesResult.filter((type: any) => 
          practServiceTypeIds.includes(parseInt(type.serviceType))
        ).map((type: any) => ({
          id: type.serviceType.toString(),
          name: type.servicetypeDesc
        }));
        setTypes(availableTypes);
      }

      // Load appointment types - same as webapp
      const appointmentTypesResult = await api.getAppointmentTypes(user.email);
      
      const APPOINTMENT_TYPE_LABELS = {
        ROUTINE: "Agendamento Regular",
        FIRST: "Primeira Consulta", 
        WALKIN: "Visita não agendada",
        CHECKUP: "Check-up de Rotina",
        FOLLOWUP: "Retorno",
        EMERGENCY: "Emergência",
      };

      if (appointmentTypesResult) {
        // Find APPT_TYPES_CONFIG in practitioner config
        const apptConfigItem = appointmentTypesResult.find((item: any) => item.configitem === "APPT_TYPES_CONFIG");
        const availableAppointmentTypes = [];
        
        if (apptConfigItem && apptConfigItem.configvalue) {
          const savedApptConfigs = typeof apptConfigItem.configvalue === "string" 
            ? JSON.parse(apptConfigItem.configvalue) 
            : apptConfigItem.configvalue;
            
          for (const typeKey in savedApptConfigs) {
            if (savedApptConfigs.hasOwnProperty(typeKey) && savedApptConfigs[typeKey].active) {
              availableAppointmentTypes.push({
                id: typeKey,
                name: APPOINTMENT_TYPE_LABELS[typeKey] || typeKey
              });
            }
          }
        } else {
          // Default appointment types if no config found
          const defaultTypes = ["WALKIN", "CHECKUP", "FOLLOWUP", "EMERGENCY", "ROUTINE"];
          defaultTypes.forEach(key => {
            availableAppointmentTypes.push({
              id: key,
              name: APPOINTMENT_TYPE_LABELS[key] || key
            });
          });
        }
        
        setAppointmentTypes(availableAppointmentTypes);
      }

    } catch (error) {
      console.error('[AppointmentStep6] Error loading dropdown data:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados necessários');
    } finally {
      setLoading(false);
    }
  };

  // Handle continue to next step
  const handleContinue = () => {
    // Validate required fields
    if (!servicecategory) {
      Alert.alert('Campo Obrigatório', 'Por favor, selecione a categoria do serviço');
      return;
    }
    
    if (!servicetype) {
      Alert.alert('Campo Obrigatório', 'Por favor, selecione o tipo de serviço');
      return;
    }
    
    if (!appointmenttype) {
      Alert.alert('Campo Obrigatório', 'Por favor, selecione o tipo de consulta');
      return;
    }

    // Update appointment data with details
    const appointmentStore = useAppointmentStore.getState();
    appointmentStore.appointmentData.description = description;
    appointmentStore.appointmentData.note = note;
    appointmentStore.appointmentData.servicecategory = servicecategory;
    appointmentStore.appointmentData.servicetype = servicetype;
    appointmentStore.appointmentData.appointmenttype = appointmenttype;

    // Navigate to review screen
    navigation.navigate('AppointmentReview' as never);
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
              <Text style={styles.greeting}>Detalhes</Text>
              <Text style={styles.userName}>Passo 6 de 6</Text>
              <Text style={styles.dateText}>Informações complementares</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.logoutButton}>
              <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
        >
          {/* Question Title */}
          <View style={styles.questionContainer}>
            <Text style={styles.questionTitle}>Detalhes do Agendamento</Text>
            <Text style={styles.questionSubtitle}>
              Complete as informações do agendamento
            </Text>
          </View>

          {/* Service Category Selection */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <FontAwesome name="tags" size={16} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Categoria do Serviço *</Text>
            </View>
            
            <View style={styles.optionsGrid}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.optionCard,
                    servicecategory === category.id && styles.selectedOptionCard
                  ]}
                  onPress={() => setServiceCategory(category.id)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.optionText,
                    servicecategory === category.id && styles.selectedOptionText
                  ]}>
                    {category.name}
                  </Text>
                  {servicecategory === category.id && (
                    <MaterialIcons 
                      name="check-circle" 
                      size={16} 
                      color={theme.colors.primary}
                      style={styles.checkIcon} 
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Service Type Selection */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <FontAwesome name="cog" size={16} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Tipo de Serviço *</Text>
            </View>
            
            <View style={styles.optionsGrid}>
              {types.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.optionCard,
                    servicetype === type.id && styles.selectedOptionCard
                  ]}
                  onPress={() => setServiceType(type.id)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.optionText,
                    servicetype === type.id && styles.selectedOptionText
                  ]}>
                    {type.name}
                  </Text>
                  {servicetype === type.id && (
                    <MaterialIcons 
                      name="check-circle" 
                      size={16} 
                      color={theme.colors.primary}
                      style={styles.checkIcon} 
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Appointment Type Selection */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <FontAwesome name="calendar-check-o" size={16} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Tipo de Consulta *</Text>
            </View>
            
            <View style={styles.optionsGrid}>
              {appointmentTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.optionCard,
                    appointmenttype === type.id && styles.selectedOptionCard
                  ]}
                  onPress={() => setAppointmentType(type.id)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.optionText,
                    appointmenttype === type.id && styles.selectedOptionText
                  ]}>
                    {type.name}
                  </Text>
                  {appointmenttype === type.id && (
                    <MaterialIcons 
                      name="check-circle" 
                      size={16} 
                      color={theme.colors.primary}
                      style={styles.checkIcon} 
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <FontAwesome name="edit" size={16} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Descrição</Text>
            </View>
            <TextInput
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder="Descreva o motivo ou objetivo da consulta..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Notes */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <FontAwesome name="sticky-note-o" size={16} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Observações Internas</Text>
            </View>
            <TextInput
              style={styles.textArea}
              value={note}
              onChangeText={setNote}
              placeholder="Adicione observações internas para referência..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
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
              (!servicecategory || !servicetype || !appointmenttype) && styles.disabledButton
            ]}
            onPress={handleContinue}
            disabled={!servicecategory || !servicetype || !appointmenttype}
          >
            <Text
              style={[
                styles.continueButtonText,
                (!servicecategory || !servicetype || !appointmenttype) && styles.disabledButtonText
              ]}
            >
              Continuar
            </Text>
            <FontAwesome 
              name="arrow-right" 
              size={16} 
              color={(servicecategory && servicetype && appointmenttype) ? theme.colors.white : theme.colors.textSecondary} 
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
    fontSize: 16,
    color: theme.colors.white + 'CC',
  },
  userName: {
    fontSize: 24,
    color: theme.colors.white,
    fontWeight: '700',
    marginTop: theme.spacing.xs,
  },
  dateText: {
    fontSize: 14,
    color: theme.colors.white + 'AA',
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
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  optionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    margin: 6,
    minWidth: '45%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    position: 'relative',
  },
  selectedOptionCard: {
    backgroundColor: theme.colors.primary + '15',
    borderColor: theme.colors.primary,
  },
  optionText: {
    fontSize: 14,
    color: theme.colors.text,
    textAlign: 'center',
    fontWeight: '500',
  },
  selectedOptionText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  checkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    minHeight: 100,
    textAlignVertical: 'top',
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