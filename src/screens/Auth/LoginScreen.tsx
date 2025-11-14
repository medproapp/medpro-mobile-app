import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button, Input, Card } from '@components/common';
import { theme } from '@theme/index';
import { useAuthStore } from '@store/authStore';
import { LoginCredentials } from '../../types/auth';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../types/navigation';

type LoginNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;
type LoginRouteProp = RouteProp<AuthStackParamList, 'Login'>;

const loginSchema = yup.object({
  email: yup
    .string()
    .email('Email inválido')
    .required('Email é obrigatório'),
  password: yup
    .string()
    .min(6, 'Senha deve ter pelo menos 6 caracteres')
    .required('Senha é obrigatória'),
});

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginNavigationProp>();
  const route = useRoute<LoginRouteProp>();
  const { login, isLoading, error, clearError, lastLoginEmail } = useAuthStore();
  const prefilledEmail = route.params?.email ?? lastLoginEmail ?? '';

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    setValue,
  } = useForm<LoginCredentials>({
    resolver: yupResolver(loginSchema) as any,
    mode: 'onChange',
    defaultValues: {
      email: prefilledEmail,
      password: '',
    },
  });

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (prefilledEmail) {
      reset({ email: prefilledEmail, password: '' });
    }
  }, [prefilledEmail, reset]);

  const onSubmit = async (data: LoginCredentials) => {
    try {
      if (__DEV__) {
        console.log('🛠️ [LoginScreen] Tentando login com credenciais', {
          email: data.email,
        });
      }
      clearError();
      await login(data);
      if (__DEV__) {
        console.log('✅ [LoginScreen] Login solicitado com sucesso');
      }
      // Navigation will be handled by the auth state change
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [LoginScreen] Falha no login', error);
      }
      Alert.alert(
        'Erro no Login',
        error instanceof Error ? error.message : 'Falha na autenticação'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Image 
              source={require('../../assets/medpro-logo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>MedPro</Text>
            <Text style={styles.subtitle}>
              Acesse sua conta profissional
            </Text>
          </View>

          <Card style={styles.loginCard}>
            <Text style={styles.cardTitle}>Entrar</Text>

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email"
                  placeholder="seu.email@medpro.com"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                  autoComplete="email"
                  importantForAutofill="yes"
                  required
                  containerStyle={styles.input}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Senha"
                  placeholder="Digite sua senha"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  autoComplete="password"
                  importantForAutofill="yes"
                  enablesReturnKeyAutomatically
                  required
                  containerStyle={styles.input}
                />
              )}
            />

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            <Button
              title="Entrar"
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              disabled={!isValid}
              fullWidth
              style={styles.loginButton}
            />

            <Button
              title="Esqueci minha senha"
              onPress={() => navigation.navigate('ForgotPassword')}
              variant="ghost"
              fullWidth
              style={styles.forgotButton}
            />
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Não tem uma conta?{' '}
              <Text 
                style={styles.linkText}
                onPress={() => navigation.navigate('Register')}
              >
                Registre-se
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: theme.spacing.sm,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  loginCard: {
    marginBottom: theme.spacing.lg,
  },
  cardTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  input: {
    marginBottom: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.error,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  loginButton: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  forgotButton: {
    marginTop: theme.spacing.xs,
  },
  footer: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  footerText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  linkText: {
    color: theme.colors.primary,
    fontWeight: '500',
  },
});
