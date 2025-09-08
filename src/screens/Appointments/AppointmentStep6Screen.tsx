import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Card } from '@components/common';
import { useAppointmentStore } from '@store/appointmentStore';
import { useAuthStore } from '@store/authStore';
import { theme } from '@theme/index';
import api from '@services/api';

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
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const {
    appointmentData,
    setNotes,
    canProceedFromStep,
    isAppointmentComplete,
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
      // Load service categories (simplified - you might want to call actual APIs)
      const mockCategories = [
        { id: '1', name: 'Consulta' },
        { id: '2', name: 'Exame' },
        { id: '3', name: 'Procedimento' },
        { id: '4', name: 'Retorno' },
      ];
      setCategories(mockCategories);

      const mockTypes = [
        { id: '1001', name: 'Consulta Inicial' },
        { id: '1002', name: 'Consulta de Rotina' },
        { id: '1003', name: 'Consulta de Retorno' },
        { id: '2001', name: 'Exame Clínico' },
        { id: '2002', name: 'Exame Laboratorial' },
      ];
      setTypes(mockTypes);

      const mockAppointmentTypes = [
        { id: 'ROUTINE', name: 'Rotina' },
        { id: 'URGENT', name: 'Urgente' },
        { id: 'FOLLOWUP', name: 'Retorno' },
        { id: 'CONSULTATION', name: 'Consulta' },
      ];
      setAppointmentTypes(mockAppointmentTypes);

    } catch (error) {
      console.error('[AppointmentStep6] Error loading dropdown data:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados necessários');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
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

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Detalhes do Agendamento</Text>
      <Text style={styles.subtitle}>Passo 6 - Informações complementares</Text>

      <Card style={styles.formCard}>
        <Text style={styles.sectionTitle}>Categoria do Serviço *</Text>
        <View style={styles.optionsContainer}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.optionCard,
                servicecategory === category.id && styles.selectedOptionCard
              ]}
              onPress={() => setServiceCategory(category.id)}
              disabled={loading}
            >
              <Text style={[
                styles.optionText,
                servicecategory === category.id && styles.selectedOptionText
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Tipo de Serviço *</Text>
        <View style={styles.optionsContainer}>
          {types.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.optionCard,
                servicetype === type.id && styles.selectedOptionCard
              ]}
              onPress={() => setServiceType(type.id)}
              disabled={loading}
            >
              <Text style={[
                styles.optionText,
                servicetype === type.id && styles.selectedOptionText
              ]}>
                {type.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Tipo de Consulta *</Text>
        <View style={styles.optionsContainer}>
          {appointmentTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.optionCard,
                appointmenttype === type.id && styles.selectedOptionCard
              ]}
              onPress={() => setAppointmentType(type.id)}
              disabled={loading}
            >
              <Text style={[
                styles.optionText,
                appointmenttype === type.id && styles.selectedOptionText
              ]}>
                {type.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Descrição (Motivo do Agendamento)</Text>
        <TextInput
          style={styles.textArea}
          value={description}
          onChangeText={setDescription}
          placeholder="Descreva o motivo ou objetivo da consulta..."
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Text style={styles.sectionTitle}>Observações Internas (Opcional)</Text>
        <TextInput
          style={styles.textArea}
          value={note}
          onChangeText={setNote}
          placeholder="Adicione observações internas para referência..."
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          title="Voltar"
          onPress={handleBack}
          variant="outline"
          style={styles.backButton}
        />
        <Button
          title="Revisar Agendamento"
          onPress={handleNext}
          disabled={loading}
          style={styles.nextButton}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  formCard: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  textArea: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    minHeight: 100,
    marginBottom: theme.spacing.md,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.lg,
  },
  backButton: {
    flex: 0.45,
  },
  nextButton: {
    flex: 0.45,
  },
  optionsContainer: {
    marginBottom: theme.spacing.md,
  },
  optionCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  selectedOptionCard: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '20',
  },
  optionText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text,
    textAlign: 'center',
  },
  selectedOptionText: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semiBold,
  },
});