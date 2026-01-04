import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button, Card, Input } from '@components/common';
import { theme } from '@theme/index';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '@/types/navigation';
import api from '@services/api';
import { logger } from '@/utils/logger';

interface ForgotPasswordFormData {
  email: string;
}

type ForgotPasswordNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'ForgotPassword'
>;

const forgotPasswordSchema = yup.object({
  email: yup
    .string()
    .email('Email inválido')
    .required('Email é obrigatório'),
});

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<ForgotPasswordNavigationProp>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ForgotPasswordFormData>({
    resolver: yupResolver(forgotPasswordSchema) as any,
    defaultValues: { email: '' },
    mode: 'onChange',
  });

  const handlePasswordReset = async ({ email }: ForgotPasswordFormData) => {
    const normalizedEmail = email.trim();
    setIsSubmitting(true);

    try {
      await api.requestPasswordReset(normalizedEmail);

      Alert.alert(
        'Solicitação enviada',
        'Se o email informado estiver cadastrado no Medpro.app, você receberá um email com instruções para redefinir sua senha.',
        [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Login', { email: normalizedEmail }),
        },
        ],
      );
    } catch (error) {
      logger.error('[ForgotPassword] erro ao solicitar redefinição de senha:', error);
      Alert.alert(
        'Não foi possível enviar',
        'Ocorreu um problema ao solicitar a redefinição de senha. Tente novamente em instantes.'
      );
    } finally {
      setIsSubmitting(false);
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
            <Text style={styles.title}>Esqueci minha senha</Text>
            <Text style={styles.subtitle}>
              Informe o email cadastrado para receber o link de redefinição.
            </Text>
          </View>

          <Card>
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
                />
              )}
            />

            <Text style={styles.helperText}>
              Você receberá um email com instruções para concluir a redefinição da senha.
            </Text>

            <Button
              title="Enviar instruções"
              onPress={handleSubmit(handlePasswordReset)}
              loading={isSubmitting}
              disabled={!isValid || isSubmitting}
              fullWidth
              style={styles.submitButton}
            />

            <Button
              title="Voltar para o login"
              onPress={() => navigation.navigate('Login')}
              variant="ghost"
              fullWidth
              style={styles.backButton}
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
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  helperText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  submitButton: {
    marginTop: theme.spacing.lg,
  },
  backButton: {
    marginTop: theme.spacing.sm,
  },
});

export default ForgotPasswordScreen;
