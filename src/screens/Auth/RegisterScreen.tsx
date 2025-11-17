import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button, Card, Input } from '@components/common';
import { theme } from '@theme/index';
import { useAuthStore } from '@store/authStore';
import { RegisterData } from '../../types/auth';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../types/navigation';
import api from '@services/api';

type RegisterNavigationProp = StackNavigationProp<AuthStackParamList, 'Register'>;

const registerSchema = yup.object({
  name: yup
    .string()
    .trim()
    .min(3, 'Informe nome e sobrenome')
    .required('Nome completo é obrigatório'),
  email: yup
    .string()
    .trim()
    .email('Email inválido')
    .required('Email é obrigatório'),
  password: yup
    .string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres')
    .matches(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula')
    .matches(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
    .matches(/[0-9]/, 'A senha deve conter pelo menos um número')
    .matches(/[^a-zA-Z0-9]/, 'A senha deve conter pelo menos um caractere especial (!@#$%^&*)')
    .required('Senha é obrigatória'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'As senhas não coincidem')
    .required('Confirme sua senha'),
});

type BackendStatus = 'checking' | 'online' | 'offline';

const DEV_FIRST_NAMES = [
  'Pedro',
  'Ana',
  'Felipe',
  'Laura',
  'Ricardo',
  'Marina',
  'Gabriel',
  'Tatiane',
  'Henrique',
  'Carolina',
  'Thiago',
  'Juliana',
  'Eduardo',
  'Camila',
  'Leonardo',
  'Fernanda',
];

const DEV_LAST_NAMES = [
  'Carvalho',
  'Cardoso',
  'Martins',
  'Queiroz',
  'Souza',
  'Almeida',
  'Santiago',
  'Franco',
  'Amaral',
  'Ferraz',
  'Nogueira',
  'Mendes',
  'Teixeira',
  'Gonçalves',
  'Barbosa',
  'Figueiredo',
];

const DEV_TITLES = ['Dr.', 'Dra.'];

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/\.\.+/g, '.')
    .replace(/^\.|\.$/g, '');

const buildDevPractitioner = () => {
  const first = DEV_FIRST_NAMES[Math.floor(Math.random() * DEV_FIRST_NAMES.length)];
  const last = DEV_LAST_NAMES[Math.floor(Math.random() * DEV_LAST_NAMES.length)];
  const title = DEV_TITLES[Math.floor(Math.random() * DEV_TITLES.length)];
  const randomNumber = Math.floor(1000 + Math.random() * 9000);

  const emailBase = slugify(`${first}.${last}`) || 'medpro.pract';
  const email = `${emailBase}.${randomNumber}@medpro.com`;

  return {
    name: `${title} ${first} ${last}`.trim(),
    email,
  };
};

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<RegisterNavigationProp>();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    getValues,
    setValue,
  } = useForm<RegisterData>({
    resolver: yupResolver(registerSchema) as any,
    mode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    clearError();
    let isMounted = true;

    const checkBackendStatus = async () => {
      const isOnline = await api.checkHealth();
      if (__DEV__) {
        console.log('🛠️ [RegisterScreen] Resultado do health check da API', {
          isOnline,
        });
      }
      if (isMounted) {
        setBackendStatus(isOnline ? 'online' : 'offline');
      }
    };

    checkBackendStatus();

    return () => {
      isMounted = false;
    };
  }, [clearError]);

  const statusLabel = useMemo(() => {
    switch (backendStatus) {
      case 'online':
        return 'API operacional';
      case 'offline':
        return 'API indisponível';
      default:
        return 'Verificando status da API...';
    }
  }, [backendStatus]);

  const onSubmit = async (formData: RegisterData) => {
    try {
      if (__DEV__) {
        console.log('🛠️ [RegisterScreen] Enviando cadastro de profissional', {
          name: formData.name,
          email: formData.email,
        });
      }
      const result = await register(formData);

      reset({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
      });

      if (__DEV__) {
        console.log('✅ [RegisterScreen] Cadastro concluído com sucesso', {
          name: result.fullname || formData.name,
          email: result.email || formData.email,
        });
        console.log('🛠️ [RegisterScreen] Navegando para RegistrationSuccess', {
          route: 'RegistrationSuccess',
          params: {
            name: (result.fullname || formData.name).trim() || formData.name.trim(),
            email: result.email || formData.email,
          },
        });
      }

      navigation.navigate('RegistrationSuccess', {
        name: (result.fullname || formData.name).trim() || formData.name.trim(),
        email: result.email || formData.email,
      });
    } catch (submitError) {
      if (__DEV__) {
        console.error('❌ [RegisterScreen] Falha ao cadastrar profissional', submitError);
      }
      Alert.alert(
        'Erro no cadastro',
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível concluir o cadastro. Tente novamente.'
      );
    }
  };

  const handleGoToLogin = () => {
    const email = getValues('email')?.trim();
    navigation.navigate('Login', email ? { email } : undefined);
  };

  const handleFillDevData = () => {
    const { name, email } = buildDevPractitioner();

    if (__DEV__) {
      console.log('🧪 [RegisterScreen] Populando formulário com credenciais de teste', {
        name,
        email,
      });
    }

    setValue('name', name, { shouldValidate: true, shouldDirty: true });
    setValue('email', email, { shouldValidate: true, shouldDirty: true });
    // Password fields removed - use environment variables for test credentials if needed
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            <Text style={styles.title}>Criar conta profissional</Text>
            <Text style={styles.subtitle}>
              Cadastre-se para começar a usar a experiência MedPro para profissionais de saúde.
            </Text>

            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusDot,
                  backendStatus === 'online'
                    ? styles.statusOnline
                    : backendStatus === 'offline'
                    ? styles.statusOffline
                    : styles.statusChecking,
                ]}
              />
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
          </View>

          <Card style={styles.formCard}>
            <Text style={styles.sectionTitle}>Dados do profissional</Text>

            {__DEV__ && (
              <Button
                title="Preencher dados de teste"
                onPress={handleFillDevData}
                variant="ghost"
                fullWidth
                style={styles.devButton}
              />
            )}

            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Nome completo"
                  placeholder="Digite seu nome e sobrenome"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.name?.message}
                  autoCapitalize="words"
                  autoCorrect={false}
                  textContentType="name"
                  autoComplete="name"
                  importantForAutofill="yes"
                  returnKeyType="next"
                />
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email profissional"
                  placeholder="seu.email@medpro.com"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  autoComplete="email"
                  importantForAutofill="yes"
                  returnKeyType="next"
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Senha"
                  placeholder="Crie uma senha"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  autoComplete="password-new"
                  importantForAutofill="yes"
                  returnKeyType="next"
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirme a senha"
                  placeholder="Repita a senha"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.confirmPassword?.message}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  autoComplete="password-new"
                  importantForAutofill="yes"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit(onSubmit)}
                />
              )}
            />

            {error && <Text style={styles.errorText}>{error}</Text>}

            {backendStatus !== 'online' && (
              <Text style={styles.helperText}>
                Aguarde a conexão com o servidor antes de finalizar o cadastro.
              </Text>
            )}

            <Button
              title="Criar conta"
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              disabled={!isValid || backendStatus !== 'online' || isLoading}
              fullWidth
              style={styles.submitButton}
            />

            <Button
              title="Já tenho conta"
              onPress={handleGoToLogin}
              variant="ghost"
              fullWidth
            />
          </Card>
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
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: theme.spacing.sm,
  },
  statusOnline: {
    backgroundColor: theme.colors.success,
  },
  statusOffline: {
    backgroundColor: theme.colors.error,
  },
  statusChecking: {
    backgroundColor: theme.colors.warning,
  },
  statusText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  formCard: {
    marginTop: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.error,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  helperText: {
    ...theme.typography.caption,
    color: theme.colors.warning,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  submitButton: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  devButton: {
    marginBottom: theme.spacing.md,
  },
});
