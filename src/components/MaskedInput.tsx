import React from 'react';
import { View, Text, StyleSheet, TextInput as RNTextInput, Platform } from 'react-native';
import MaskInput, { Mask } from 'react-native-mask-input';
import { theme } from '@theme/index';

const TEXT_INPUT_HEIGHT = Platform.select({ ios: 46, android: 48, default: 46 });

export type MaskType = 'cpf' | 'cnpj' | 'phone' | 'cep' | 'date';

const MASKS: Record<MaskType, Mask> = {
  cpf: [
    /\d/, /\d/, /\d/, '.', /\d/, /\d/, /\d/, '.', /\d/, /\d/, /\d/, '-', /\d/, /\d/,
  ],
  cnpj: [
    /\d/, /\d/, '.', /\d/, /\d/, /\d/, '.', /\d/, /\d/, /\d/, '/', /\d/, /\d/, /\d/, /\d/, '-', /\d/, /\d/,
  ],
  phone: [
    '(', /\d/, /\d/, ')', ' ', /\d/, /\d/, /\d/, /\d/, /\d/, '-', /\d/, /\d/, /\d/, /\d/,
  ],
  cep: [
    /\d/, /\d/, /\d/, /\d/, /\d/, '-', /\d/, /\d/, /\d/,
  ],
  date: [
    /\d/, /\d/, '/', /\d/, /\d/, '/', /\d/, /\d/, /\d/, /\d/,
  ],
};

interface MaskedInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  maskType: MaskType;
  placeholder?: string;
  error?: string;
  loading?: boolean;
  success?: boolean;
}

export const MaskedInput: React.FC<MaskedInputProps> = ({
  label,
  value,
  onChangeText,
  maskType,
  placeholder,
  error,
  loading,
  success,
}) => {
  const mask = MASKS[maskType];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <MaskInput
          value={value}
          onChangeText={onChangeText}
          mask={mask}
          style={[
            styles.input,
            error && styles.inputError,
            success && styles.inputSuccess,
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType="numeric"
        />
        {loading && (
          <View style={styles.statusIcon}>
            <Text style={styles.statusText}>⏳</Text>
          </View>
        )}
        {success && !loading && (
          <View style={styles.statusIcon}>
            <Text style={styles.statusTextSuccess}>✓</Text>
          </View>
        )}
        {error && !loading && (
          <View style={styles.statusIcon}>
            <Text style={styles.statusTextError}>✕</Text>
          </View>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: TEXT_INPUT_HEIGHT,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  inputSuccess: {
    borderColor: theme.colors.success,
  },
  statusIcon: {
    position: 'absolute',
    right: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
  },
  statusTextSuccess: {
    fontSize: 18,
    color: theme.colors.success,
    fontWeight: 'bold',
  },
  statusTextError: {
    fontSize: 18,
    color: theme.colors.error,
    fontWeight: 'bold',
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
});
