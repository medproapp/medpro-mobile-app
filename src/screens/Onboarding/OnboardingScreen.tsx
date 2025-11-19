import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Loading } from '@components/common';
import { theme } from '@theme/index';
import { useOnboardingStore } from '@store/onboardingStore';
import { useAuthStore } from '@store/authStore';
import { SetupModal } from './SetupModal';
import { OnboardingStepKey } from '@/types/onboarding';
import { logger } from '@/utils/logger';

const backgroundImage = require('../../assets/welcome1.png');

const stepStatusLabel: Record<string, string> = {
  pending: 'Pendente',
  'in-progress': 'Em andamento',
  completed: 'Concluído',
};

const statusEmoji: Record<string, string> = {
  pending: '📝',
  'in-progress': '⏳',
  completed: '✅',
};

export const OnboardingScreen: React.FC = () => {
  const isInitialized = useOnboardingStore(state => state.isInitialized);
  const isLoading = useOnboardingStore(state => state.isLoading);
  const initialize = useOnboardingStore(state => state.initialize);
  const refreshChecklist = useOnboardingStore(state => state.refreshChecklist);
  const practitionerName = useOnboardingStore(state => state.practitionerName);
  const organizationName = useOnboardingStore(state => state.organizationName);
  const organizationLogoUrl = useOnboardingStore(state => state.organizationLogoUrl);
  const steps = useOnboardingStore(state => state.steps);
  const progress = useOnboardingStore(state => state.progress);
  const openModal = useOnboardingStore(state => state.openModal);
  const closeModal = useOnboardingStore(state => state.closeModal);
  const modalVisible = useOnboardingStore(state => state.modalVisible);
  const form = useOnboardingStore(state => state.form);
  const updateForm = useOnboardingStore(state => state.updateForm);
  const submitSetup = useOnboardingStore(state => state.submitSetup);
  const isSubmitting = useOnboardingStore(state => state.isSubmitting);
  const availableCategories = useOnboardingStore(state => state.availableCategories);
  const availableServiceTypes = useOnboardingStore(state => state.availableServiceTypes);
  const error = useOnboardingStore(state => state.error);
  const canManagePricing = useOnboardingStore(state => state.canManagePricing);
  const checklist = useOnboardingStore(state => state.checklist);
  const activeStep = useOnboardingStore(state => state.activeStep);
  const resetOnboarding = useOnboardingStore(state => state.reset);
  const setCanManagePricing = useOnboardingStore(state => state.setCanManagePricing);

  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);
  const logout = useAuthStore(state => state.logout);

  const [refreshing, setRefreshing] = useState(false);
  const [completionAlertShown, setCompletionAlertShown] = useState(false);
  const catalogReloadAttemptedRef = useRef(false);

  useEffect(() => {
    logger.debug('OnboardingScreen mounted');
    logger.debug('isInitialized:', isInitialized, 'isLoading:', isLoading);
    if (!user) {
      logger.debug('OnboardingScreen: no authenticated user, skipping initialize');
      return;
    }

    if (!isInitialized && !isLoading) {
      initialize();
      return;
    }

    if (
      isInitialized &&
      !isLoading &&
      !catalogReloadAttemptedRef.current &&
      (availableCategories.length === 0 || availableServiceTypes.length === 0)
    ) {
      catalogReloadAttemptedRef.current = true;
      logger.debug('[OnboardingScreen] Forcing catalog reload');
      initialize({ reloadCatalog: true }).catch(error => {
        logger.error('[OnboardingScreen] Catalog reload failed', error);
      });
    }
  }, [availableCategories.length, availableServiceTypes.length, initialize, isInitialized, isLoading, user]);

  useEffect(() => {
    if (!user || !isInitialized) {
      return;
    }
    refreshChecklist();
    const interval = setInterval(() => {
      refreshChecklist();
    }, 15000);

    return () => clearInterval(interval);
  }, [isInitialized, refreshChecklist, user]);

  useEffect(() => {
    if (user?.isAdmin) {
      if (!canManagePricing) {
        setCanManagePricing(true);
      }
    } else if (canManagePricing) {
      setCanManagePricing(false);
    }
  }, [canManagePricing, setCanManagePricing, user?.isAdmin]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      catalogReloadAttemptedRef.current = false;
      await initialize({ reloadCatalog: true });
      await refreshChecklist();
    } finally {
      setRefreshing(false);
    }
  }, [initialize, refreshChecklist]);

  const handleOpenModal = useCallback(
    (step: OnboardingStepKey) => {
      openModal(step);
    },
    [openModal]
  );

  const handleCancel = useCallback(() => {
    closeModal();
    resetOnboarding();
    logout();
  }, [closeModal, logout, resetOnboarding]);

  const progressCompleted = progress.value >= 100;

  const handleNavigateHome = useCallback(() => {
    if (user) {
      setUser({ ...user, firstLogin: false });
    }
    resetOnboarding();
  }, [resetOnboarding, setUser, user]);

  const heroGreeting = useMemo(() => {
    if (!practitionerName) return 'Bem-vindo ao MedPro';
    return `Bem-vindo, ${practitionerName}!`;
  }, [practitionerName]);

  const organizationGreeting = useMemo(() => {
    if (!organizationName) return 'Prepare seu consultório para começar';
    return `Vamos preparar o consultório da ${organizationName}`;
  }, [organizationName]);

  useEffect(() => {
    if (!progressCompleted || completionAlertShown) {
      return;
    }

    setCompletionAlertShown(true);
    Alert.alert(
      'Tudo pronto!',
      'Vamos acessar o painel inicial do MedPro.',
      [
        {
          text: 'Ok',
          onPress: handleNavigateHome,
        },
      ],
      { cancelable: false }
    );
  }, [completionAlertShown, handleNavigateHome, progressCompleted]);

  if (!isInitialized && isLoading) {
    return <Loading text="Preparando onboarding..." />;
  }

  return (
    <ImageBackground source={backgroundImage} style={styles.background} imageStyle={styles.backgroundImage}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <View style={styles.heroSection}>
            {organizationLogoUrl ? (
              <Image source={{ uri: organizationLogoUrl }} style={styles.logo} resizeMode="contain" />
            ) : (
              <Image source={require('../../assets/medpro-logo.png')} style={styles.logo} resizeMode="contain" />
            )}
            <Text style={styles.heroTitle}>{heroGreeting}</Text>
            <Text style={styles.heroSubtitle}>{organizationGreeting}</Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: progress.value <= 0 ? '4%' : `${Math.min(progress.value, 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>{progress.label}</Text>
            </View>
            <Button
              title="Cancelar e voltar ao login"
              variant="ghost"
              onPress={handleCancel}
              fullWidth
              style={styles.cancelButton}
            />
          </View>

          {error && (
            <Card variant="outlined" padding="md" style={styles.errorCard}>
              <Text style={styles.errorTitle}>Não conseguimos validar tudo</Text>
              <Text style={styles.errorDescription}>{error}</Text>
              <Button title="Tentar novamente" variant="outline" onPress={handleRefresh} fullWidth />
            </Card>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Etapas obrigatórias</Text>
            <Button title="Atualizar" variant="ghost" onPress={handleRefresh} />
          </View>

          {steps
            .filter(step => step.key === 'profile' || step.key === 'parameters')
            .map(step => {
              const isCompleted = step.status === 'completed';
              const isDisabled = step.disabled || isCompleted;
              return (
                <Card key={step.key} style={styles.stepCard}>
                  <View style={styles.stepHeader}>
                    <Text style={styles.stepEmoji}>{statusEmoji[step.status]}</Text>
                    <View style={styles.stepHeaderText}>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                      <Text style={styles.stepStatus}>{stepStatusLabel[step.status]}</Text>
                    </View>
                  </View>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                  <Button
                    title={isCompleted ? 'Etapa concluída' : 'Configurar agora'}
                    onPress={() => handleOpenModal(step.key)}
                    disabled={
                      isDisabled || (step.key === 'parameters' && !checklist.profileCompleted)
                    }
                    variant={isCompleted ? 'ghost' : 'primary'}
                    fullWidth
                    style={styles.stepButton}
                  />
                  {step.key === 'parameters' && !checklist.profileCompleted && !isCompleted && (
                    <Text style={styles.stepHelper}>Finalize os dados essenciais antes de continuar.</Text>
                  )}
                </Card>
              );
            })}

          <Text style={styles.sectionTitle}>Experiências futuras</Text>
          <Card style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepEmoji}>🤖</Text>
              <View style={styles.stepHeaderText}>
                <Text style={styles.stepTitle}>Assistente IA MedPro</Text>
                <Text style={styles.aiBadge}>Em breve</Text>
              </View>
            </View>
            <Text style={styles.stepDescription}>
              Nossa equipe está preparando recursos de IA para automatizar documentação, fornecer insights e agilizar
              atendimentos. Você receberá um aviso assim que estiver disponível!
            </Text>
          </Card>

          <Text style={styles.sectionTitle}>O que faremos automaticamente</Text>
          <Card style={styles.autoCard}>
            {[
              'Criaremos um local padrão baseado no seu CEP',
              'Configuraremos horários padrão (segunda a sexta, 8h às 17h)',
              'Definiremos parâmetros otimizados para sua prática',
              'Criaremos um serviço de consulta padrão com suas configurações',
            ].map((item, index) => (
              <View key={`auto-${index}`} style={styles.autoItem}>
                <Text style={styles.autoIcon}>✅</Text>
                <Text style={styles.autoText}>{item}</Text>
              </View>
            ))}
          </Card>

          {progressCompleted && (
            <Card style={styles.completionCard}>
              <Text style={styles.completionTitle}>Tudo pronto!</Text>
              <Text style={styles.completionSubtitle}>
                Seus dados foram configurados. Toque abaixo para acessar o painel do profissional.
              </Text>
              <Button title="Ir para o painel" onPress={handleNavigateHome} fullWidth />
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>

      <SetupModal
        visible={modalVisible}
        onClose={closeModal}
        form={form}
        updateForm={updateForm}
        onSubmit={submitSetup}
        submitting={isSubmitting}
        categories={availableCategories}
        serviceTypes={availableServiceTypes}
        error={error}
        canManagePricing={canManagePricing}
        step={activeStep}
      />
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  backgroundImage: {
    opacity: 0.45,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(245, 245, 245, 0.6)',
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: theme.spacing.sm,
  },
  heroTitle: {
    ...theme.typography.h1,
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  heroSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginTop: theme.spacing.lg,
  },
  progressBar: {
    height: 10,
    borderRadius: theme.borderRadius.large,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.large,
  },
  progressLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  stepCard: {
    paddingVertical: theme.spacing.lg,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  stepEmoji: {
    fontSize: 24,
    marginRight: theme.spacing.md,
  },
  stepHeaderText: {
    flex: 1,
  },
  stepTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
  },
  stepStatus: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  stepDescription: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  stepButton: {
    marginTop: theme.spacing.sm,
  },
  stepHelper: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  aiBadge: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    marginTop: theme.spacing.xs,
  },
  autoCard: {
    paddingVertical: theme.spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  autoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  autoIcon: {
    fontSize: 16,
    marginRight: theme.spacing.sm,
  },
  autoText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  errorCard: {
    borderColor: theme.colors.error,
    backgroundColor: 'rgba(255, 51, 102, 0.08)',
  },
  errorTitle: {
    ...theme.typography.body,
    color: theme.colors.error,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  errorDescription: {
    ...theme.typography.caption,
    color: theme.colors.error,
    marginBottom: theme.spacing.sm,
  },
  completionCard: {
    marginTop: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
  },
  completionTitle: {
    ...theme.typography.h2,
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  completionSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
});
