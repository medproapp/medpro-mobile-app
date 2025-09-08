import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Card } from '@components/common';
import { useAppointmentStore } from '@store/appointmentStore';
import { useAuthStore } from '@store/authStore';
import { theme } from '@theme/index';
import api from '@services/api';

export const AppointmentReviewScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { appointmentData, selectedServices, getTotalServicesValue, getTotalDuration, resetAppointment } = useAppointmentStore();
  const [loading, setLoading] = useState(false);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return timeString.substring(0, 5); // Remove seconds
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Submit appointment to backend
      const appointmentPayload = {
        ...appointmentData,
        // Ensure required fields are set
        practitionerid: appointmentData.practitionerid || user?.email,
        selected_services: selectedServices,
      };

      console.log('[AppointmentReview] Submitting appointment:', appointmentPayload);
      
      // Call API to create appointment
      const result = await api.createAppointment(appointmentPayload);
      
      if (result.success) {
        Alert.alert(
          'Agendamento Confirmado',
          'Seu agendamento foi criado com sucesso!',
          [
            {
              text: 'OK',
              onPress: () => {
                // Reset appointment data and navigate back
                resetAppointment();
                navigation.navigate('Dashboard' as never);
              }
            }
          ]
        );
      } else {
        throw new Error(result.message || 'Erro ao criar agendamento');
      }
    } catch (error) {
      console.error('[AppointmentReview] Error submitting appointment:', error);
      Alert.alert('Erro', 'Não foi possível confirmar o agendamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleEdit = (step: string) => {
    switch (step) {
      case 'patient':
        navigation.navigate('AppointmentStep1' as never);
        break;
      case 'services':
        navigation.navigate('AppointmentStep2' as never);
        break;
      case 'payment':
        navigation.navigate('AppointmentStep3' as never);
        break;
      case 'location':
        navigation.navigate('AppointmentStep4' as never);
        break;
      case 'datetime':
        navigation.navigate('AppointmentStep5' as never);
        break;
      case 'details':
        navigation.navigate('AppointmentStep6' as never);
        break;
    }
  };

  const getCategoryName = (id: string) => {
    const categories: { [key: string]: string } = {
      '1': 'Consulta',
      '2': 'Exame',
      '3': 'Procedimento',
      '4': 'Retorno',
    };
    return categories[id] || id;
  };

  const getTypeName = (id: string) => {
    const types: { [key: string]: string } = {
      '1001': 'Consulta Inicial',
      '1002': 'Consulta de Rotina',
      '1003': 'Consulta de Retorno',
      '2001': 'Exame Clínico',
      '2002': 'Exame Laboratorial',
    };
    return types[id] || id;
  };

  const getAppointmentTypeName = (id: string) => {
    const types: { [key: string]: string } = {
      'ROUTINE': 'Rotina',
      'URGENT': 'Urgente',
      'FOLLOWUP': 'Retorno',
      'CONSULTATION': 'Consulta',
    };
    return types[id] || id;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Revisar Agendamento</Text>
      <Text style={styles.subtitle}>Confira todos os dados antes de confirmar</Text>

      {/* Patient Information */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Paciente</Text>
          <Button
            title="Editar"
            onPress={() => handleEdit('patient')}
            variant="outline"
            size="small"
          />
        </View>
        <Text style={styles.infoText}><Text style={styles.label}>Nome:</Text> {appointmentData.patientName}</Text>
        <Text style={styles.infoText}><Text style={styles.label}>CPF:</Text> {appointmentData.subject}</Text>
        <Text style={styles.infoText}><Text style={styles.label}>Telefone:</Text> {appointmentData.patientPhone}</Text>
      </Card>

      {/* Services Information */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Serviços</Text>
          <Button
            title="Editar"
            onPress={() => handleEdit('services')}
            variant="outline"
            size="small"
          />
        </View>
        {selectedServices.map((service, index) => (
          <View key={index} style={styles.serviceItem}>
            <Text style={styles.serviceName}>{service.name}</Text>
            <Text style={styles.serviceDetails}>R$ {service.price.toFixed(2)}</Text>
            {service.duration && <Text style={styles.serviceDetails}>{service.duration} min</Text>}
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalText}>Total: R$ {getTotalServicesValue().toFixed(2)} ({getTotalDuration()} min)</Text>
        </View>
      </Card>

      {/* Payment Information */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pagamento</Text>
          <Button
            title="Editar"
            onPress={() => handleEdit('payment')}
            variant="outline"
            size="small"
          />
        </View>
        <Text style={styles.infoText}>
          <Text style={styles.label}>Forma de Pagamento:</Text> {appointmentData.paymentType === 'direct' ? 'Pagamento Direto' : 'Plano de Saúde'}
        </Text>
      </Card>

      {/* Location Information */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Local</Text>
          <Button
            title="Editar"
            onPress={() => handleEdit('location')}
            variant="outline"
            size="small"
          />
        </View>
        <Text style={styles.infoText}><Text style={styles.label}>Local:</Text> {appointmentData.locationName}</Text>
      </Card>

      {/* Date & Time Information */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Data e Horário</Text>
          <Button
            title="Editar"
            onPress={() => handleEdit('datetime')}
            variant="outline"
            size="small"
          />
        </View>
        <Text style={styles.infoText}><Text style={styles.label}>Data:</Text> {formatDate(appointmentData.startdate)}</Text>
        <Text style={styles.infoText}><Text style={styles.label}>Horário:</Text> {formatTime(appointmentData.starttime)} - {formatTime(appointmentData.endtime)}</Text>
        <Text style={styles.infoText}><Text style={styles.label}>Duração:</Text> {appointmentData.duration} minutos</Text>
      </Card>

      {/* Details Information */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Detalhes</Text>
          <Button
            title="Editar"
            onPress={() => handleEdit('details')}
            variant="outline"
            size="small"
          />
        </View>
        <Text style={styles.infoText}><Text style={styles.label}>Categoria:</Text> {getCategoryName(appointmentData.servicecategory)}</Text>
        <Text style={styles.infoText}><Text style={styles.label}>Especialidade:</Text> {getTypeName(appointmentData.servicetype)}</Text>
        <Text style={styles.infoText}><Text style={styles.label}>Tipo:</Text> {getAppointmentTypeName(appointmentData.appointmenttype)}</Text>
        {appointmentData.description && (
          <Text style={styles.infoText}><Text style={styles.label}>Descrição:</Text> {appointmentData.description}</Text>
        )}
        {appointmentData.note && (
          <Text style={styles.infoText}><Text style={styles.label}>Observações:</Text> {appointmentData.note}</Text>
        )}
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          title="Voltar"
          onPress={handleBack}
          variant="outline"
          style={styles.backButton}
        />
        <Button
          title="Confirmar Agendamento"
          onPress={handleSubmit}
          disabled={loading}
          loading={loading}
          style={styles.confirmButton}
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
  sectionCard: {
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  infoText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  label: {
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textSecondary,
  },
  serviceItem: {
    marginBottom: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  serviceName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  serviceDetails: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  totalRow: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  totalText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.lg,
  },
  backButton: {
    flex: 0.3,
  },
  confirmButton: {
    flex: 0.65,
  },
});