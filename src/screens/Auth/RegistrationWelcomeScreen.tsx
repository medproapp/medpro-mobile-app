import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from '@components/common';
import { theme } from '@theme/index';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { AuthStackParamList } from '../../types/navigation';

type WelcomeNavigationProp = StackNavigationProp<AuthStackParamList, 'RegistrationWelcome'>;
type WelcomeRouteProp = RouteProp<AuthStackParamList, 'RegistrationWelcome'>;

const backgroundImage = require('../../assets/welcome1.png');

export const RegistrationWelcomeScreen: React.FC = () => {
  const navigation = useNavigation<WelcomeNavigationProp>();
  const route = useRoute<WelcomeRouteProp>();

  const name = route.params?.name ?? '';
  const email = route.params?.email ?? '';

  if (__DEV__) {
    console.log('🛠️ [RegistrationWelcome] Screen mounted', {
      name,
      email,
    });
  }

  const handleContinue = () => {
    if (__DEV__) {
      console.log('🛠️ [RegistrationWelcome] Ir para o login acionado', {
        email,
      });
    }
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'Login',
          params: email ? { email } : undefined,
        },
      ],
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
            <View style={styles.header}>
            <Image
              source={require('../../assets/medpro-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Tudo pronto, {name || 'Profissional'}!</Text>
            <Text style={styles.subtitle}>
              Sua conta foi criada e estamos preparando a melhor experiência pra você começar a atender com o MedPro.
            </Text>
          </View>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Antes de começar</Text>
            <Text style={styles.sectionText}>
              Vamos direcionar você para a tela de login. Utilize o email abaixo para acessar sua conta recém-criada.
            </Text>

            {email ? (
              <View style={styles.emailContainer}>
                <Text style={styles.emailLabel}>Email de acesso</Text>
                <Text style={styles.emailValue}>{email}</Text>
              </View>
            ) : null}

            <Text style={styles.sectionText}>
              Após o login, você terá 15 dias gratuitos para explorar agenda inteligente, prontuários, assistente clínico e muito mais.
            </Text>

              <Button
                title="Ir para o login"
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
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: theme.spacing.sm,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    marginTop: theme.spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: theme.borderRadius.large,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  sectionText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  emailContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emailLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  emailValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: theme.spacing.md,
  },
});
