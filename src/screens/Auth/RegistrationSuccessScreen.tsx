import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from '@components/common';
import { theme } from '@theme/index';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { AuthStackParamList } from '../../types/navigation';
import { logger } from '@/utils/logger';

type SuccessNavigationProp = StackNavigationProp<AuthStackParamList, 'RegistrationSuccess'>;
type SuccessRouteProp = RouteProp<AuthStackParamList, 'RegistrationSuccess'>;

const FEATURES = [
  'Agenda inteligente com confirmações automáticas',
  'Gestão completa de pacientes e prontuários',
  'Assistente clínico com IA para apoio no dia a dia',
];

const backgroundImage = require('../../assets/welcome1.png');

export const RegistrationSuccessScreen: React.FC = () => {
  const navigation = useNavigation<SuccessNavigationProp>();
  const route = useRoute<SuccessRouteProp>();

  const name = route.params?.name ?? '';
  const email = route.params?.email ?? '';

  const displayName = name || email;

  if (__DEV__) {
    logger.debug('🛠️ [RegistrationSuccess] Screen mounted', {
      name,
      email,
    });
  }

  const handleContinue = () => {
    if (__DEV__) {
      logger.debug('🛠️ [RegistrationSuccess] Continuar acionado', {
        displayName,
        email,
      });
    }
    navigation.replace('RegistrationWelcome', {
      name: displayName,
      email,
    });
  };

  return (
    <ImageBackground
      source={backgroundImage}
      style={styles.background}
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.card}>
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Conta criada</Text>
            </View>
          </View>

          <Text style={styles.title}>
            Bem-vindo(a), {displayName}!
          </Text>

          <Text style={styles.subtitle}>
            Você ganhou 15 dias de acesso gratuito para explorar todos os recursos do MedPro para profissionais.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>O que você pode fazer agora:</Text>
            {FEATURES.map(item => (
              <View key={item} style={styles.featureItem}>
                <Text style={styles.featureBullet}>•</Text>
                <Text style={styles.featureText}>{item}</Text>
              </View>
            ))}
          </View>

          {email ? (
            <Text style={styles.emailHint}>
              Usaremos o email <Text style={styles.emailHighlight}>{email}</Text> para o primeiro acesso.
            </Text>
          ) : null}

            <Button
              title="Continuar"
              onPress={handleContinue}
              fullWidth
              style={styles.primaryButton}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  backgroundImage: {
    opacity: 0.75,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(245, 245, 245, 0.6)',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: theme.spacing.xl,
    borderRadius: theme.borderRadius.large,
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  badge: {
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.round,
  },
  badgeText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  featureBullet: {
    ...theme.typography.body,
    color: theme.colors.primary,
    marginRight: theme.spacing.sm,
  },
  featureText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  },
  emailHint: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  emailHighlight: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  primaryButton: {
    marginBottom: theme.spacing.sm,
  },
});
