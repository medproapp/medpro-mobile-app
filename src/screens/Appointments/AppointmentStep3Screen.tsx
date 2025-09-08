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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { theme } from '@theme/index';
import { useAppointmentStore } from '@store/appointmentStore';
import { useAuthStore } from '@store/authStore';
import { api } from '@services/api';
import { DashboardStackParamList } from '@types/navigation';

type Step3NavigationProp = StackNavigationProp<DashboardStackParamList, 'AppointmentStep3'>;

interface CarePlan {
  pract_care_plan_id: string;
  NM_PLANO: string;
  cd_plano: string;
  RAZAO_SOCIAL: string;
  services_metadata?: string;
}

type PaymentType = 'direct' | 'careplan' | null;

export const AppointmentStep3Screen: React.FC = () => {
  const navigation = useNavigation<Step3NavigationProp>();
  const { user } = useAuthStore();
  const { 
    appointmentData, 
    selectedServices,
    canProceedFromStep,
    getTotalServicesValue,
    setPayment
  } = useAppointmentStore();

  // State
  const [paymentType, setPaymentType] = useState<PaymentType>(null);
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [selectedCarePlan, setSelectedCarePlan] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [carePlansLoaded, setCarePlansLoaded] = useState(false);

  // Load care plans when careplan payment is selected
  const loadCarePlans = async () => {
    if (!appointmentData.subject || !user?.email) {
      Alert.alert('Erro', 'Dados do paciente não encontrados');
      return;
    }

    setLoading(true);
    try {
      console.log('[AppointmentStep3] Loading care plans for patient:', appointmentData.subject);
      
      const result = await api.getPatientCarePlans(appointmentData.subject, user.email);
      console.log('[AppointmentStep3] Care plans result:', result);
      
      if (result?.data && Array.isArray(result.data)) {
        setCarePlans(result.data);
      } else if (Array.isArray(result)) {
        setCarePlans(result);
      } else {
        setCarePlans([]);
      }
      setCarePlansLoaded(true);
    } catch (error) {
      console.error('[AppointmentStep3] Error loading care plans:', error);
      setCarePlans([]);
      setCarePlansLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  // Handle payment type selection
  const handlePaymentTypeChange = async (type: PaymentType) => {
    setPaymentType(type);
    
    if (type === 'direct') {
      // Direct payment - clear care plan data
      setSelectedCarePlan('');
      setCarePlans([]);
      setCarePlansLoaded(false);
      // Save to store
      setPayment('direct', []);
    } else if (type === 'careplan') {
      // Care plan payment - load care plans
      if (!carePlansLoaded) {
        await loadCarePlans();
      }
      // Clear store payment until care plan is selected
      setPayment('', []);
    } else {
      // Clear everything
      setSelectedCarePlan('');
      setCarePlans([]);
      setCarePlansLoaded(false);
      setPayment('', []);
    }
  };

  // Handle care plan selection
  const handleCarePlanSelect = (planId: string) => {
    setSelectedCarePlan(planId);
    const plan = carePlans.find(p => p.pract_care_plan_id === planId);
    
    if (plan) {
      // Save to store
      setPayment('careplan', [{
        planId: plan.pract_care_plan_id,
        planName: plan.NM_PLANO,
        planCode: plan.cd_plano,
        operatorName: plan.RAZAO_SOCIAL,
      }]);
    } else {
      setPayment('', []);
    }
  };

  // Handle continue to next step
  const handleContinue = () => {
    if (canProceedFromStep(3)) {
      navigation.navigate('AppointmentStep4');
    }
  };

  // Check if can proceed (payment type selected, and if careplan, care plan selected)
  const canProceed = () => {
    if (paymentType === 'direct') {
      return true;
    } else if (paymentType === 'careplan') {
      return !!selectedCarePlan;
    }
    return false;
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
              <Text style={styles.greeting}>Forma de Pagamento</Text>
              <Text style={styles.userName}>Passo 3 de 6</Text>
              <Text style={styles.dateText}>Selecione como pagar</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.logoutButton}>
              <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Question Title */}
          <View style={styles.questionContainer}>
            <Text style={styles.questionTitle}>Como deseja pagar?</Text>
            <Text style={styles.questionSubtitle}>
              Paciente: {appointmentData.patientName}
            </Text>
            <Text style={styles.questionSubtitle}>
              Total: R$ {getTotalServicesValue().toFixed(2)} ({selectedServices.length} serviço{selectedServices.length !== 1 ? 's' : ''})
            </Text>
          </View>

          {/* Payment Options */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <FontAwesome name="credit-card" size={16} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Opções de Pagamento</Text>
            </View>

            {/* Direct Payment Option */}
            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentType === 'direct' && styles.selectedPaymentOption,
              ]}
              onPress={() => handlePaymentTypeChange('direct')}
              activeOpacity={0.7}
            >
              <View style={styles.paymentOptionContent}>
                <View style={styles.paymentIconContainer}>
                  <FontAwesome 
                    name="money" 
                    size={24} 
                    color={paymentType === 'direct' ? theme.colors.primary : theme.colors.textSecondary} 
                  />
                </View>
                
                <View style={styles.paymentInfo}>
                  <Text style={[styles.paymentTitle, paymentType === 'direct' && styles.selectedPaymentText]}>
                    Pagamento Direto
                  </Text>
                  <Text style={styles.paymentDescription}>
                    Pagamento particular sem convênio
                  </Text>
                  <Text style={[styles.paymentAmount, paymentType === 'direct' && styles.selectedPaymentText]}>
                    R$ {getTotalServicesValue().toFixed(2)}
                  </Text>
                </View>
                
                {paymentType === 'direct' && (
                  <View style={styles.selectedIndicator}>
                    <MaterialIcons name="check-circle" size={24} color={theme.colors.primary} />
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* Care Plan Option */}
            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentType === 'careplan' && styles.selectedPaymentOption,
              ]}
              onPress={() => handlePaymentTypeChange('careplan')}
              activeOpacity={0.7}
            >
              <View style={styles.paymentOptionContent}>
                <View style={styles.paymentIconContainer}>
                  <FontAwesome 
                    name="shield" 
                    size={24} 
                    color={paymentType === 'careplan' ? theme.colors.primary : theme.colors.textSecondary} 
                  />
                </View>
                
                <View style={styles.paymentInfo}>
                  <Text style={[styles.paymentTitle, paymentType === 'careplan' && styles.selectedPaymentText]}>
                    Usar Convênio
                  </Text>
                  <Text style={styles.paymentDescription}>
                    Pagamento através de plano de saúde
                  </Text>
                  <Text style={styles.paymentSubtext}>
                    {paymentType === 'careplan' ? 'Selecione o convênio abaixo' : 'Cobertura conforme plano'}
                  </Text>
                </View>
                
                {paymentType === 'careplan' && (
                  <View style={styles.selectedIndicator}>
                    <MaterialIcons name="check-circle" size={24} color={theme.colors.primary} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Care Plan Selection */}
          {paymentType === 'careplan' && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <FontAwesome name="list-ul" size={16} color={theme.colors.primary} />
                <Text style={styles.sectionTitle}>Convênios Disponíveis</Text>
              </View>

              {loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={styles.loadingText}>Carregando convênios...</Text>
                </View>
              )}

              {!loading && carePlansLoaded && carePlans.length === 0 && (
                <View style={styles.emptyContainer}>
                  <FontAwesome name="exclamation-triangle" size={32} color={theme.colors.warning} />
                  <Text style={styles.emptyTitle}>Nenhum convênio disponível</Text>
                  <Text style={styles.emptyText}>
                    Paciente não possui convênios ativos com este profissional
                  </Text>
                </View>
              )}

              {!loading && carePlans.length > 0 && (
                <>
                  {carePlans.map((plan) => (
                    <TouchableOpacity
                      key={plan.pract_care_plan_id}
                      style={[
                        styles.carePlanOption,
                        selectedCarePlan === plan.pract_care_plan_id && styles.selectedCarePlanOption,
                      ]}
                      onPress={() => handleCarePlanSelect(plan.pract_care_plan_id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.carePlanContent}>
                        <View style={styles.carePlanInfo}>
                          <Text style={[
                            styles.carePlanName,
                            selectedCarePlan === plan.pract_care_plan_id && styles.selectedCarePlanText
                          ]}>
                            {plan.NM_PLANO || 'Plano'}
                          </Text>
                          <Text style={styles.carePlanCode}>
                            Código: {plan.cd_plano}
                          </Text>
                          <Text style={styles.carePlanOperator}>
                            Operadora: {plan.RAZAO_SOCIAL || 'N/A'}
                          </Text>
                        </View>
                        
                        {selectedCarePlan === plan.pract_care_plan_id && (
                          <View style={styles.selectedIndicator}>
                            <MaterialIcons name="check-circle" size={20} color={theme.colors.primary} />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </View>
          )}

          {/* Payment Summary */}
          {paymentType && (
            <View style={styles.sectionContainer}>
              <View style={styles.summaryContainer}>
                <Text style={styles.summaryTitle}>Resumo do Pagamento</Text>
                
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Forma de pagamento:</Text>
                  <Text style={styles.summaryValue}>
                    {paymentType === 'direct' ? 'Pagamento Direto' : 'Convênio'}
                  </Text>
                </View>
                
                {paymentType === 'careplan' && selectedCarePlan && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Convênio:</Text>
                    <Text style={styles.summaryValue}>
                      {carePlans.find(p => p.pract_care_plan_id === selectedCarePlan)?.NM_PLANO}
                    </Text>
                  </View>
                )}
                
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Valor Total:</Text>
                  <Text style={styles.totalValue}>R$ {getTotalServicesValue().toFixed(2)}</Text>
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
              !canProceed() && styles.disabledButton
            ]}
            onPress={handleContinue}
            disabled={!canProceed()}
          >
            <Text
              style={[
                styles.continueButtonText,
                !canProceed() && styles.disabledButtonText
              ]}
            >
              Continuar
            </Text>
            <FontAwesome 
              name="arrow-right" 
              size={16} 
              color={canProceed() ? theme.colors.white : theme.colors.textSecondary} 
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
  paymentOption: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectedPaymentOption: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: theme.colors.primary + '10',
  },
  paymentOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  selectedPaymentText: {
    color: theme.colors.primary,
  },
  paymentDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  paymentSubtext: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  selectedIndicator: {
    marginLeft: 12,
  },
  carePlanOption: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectedCarePlanOption: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: theme.colors.primary + '10',
  },
  carePlanContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carePlanInfo: {
    flex: 1,
  },
  carePlanName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  selectedCarePlanText: {
    color: theme.colors.primary,
  },
  carePlanCode: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  carePlanOperator: {
    fontSize: 14,
    color: theme.colors.textSecondary,
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
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  summaryLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
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
    maxWidth: 250,
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