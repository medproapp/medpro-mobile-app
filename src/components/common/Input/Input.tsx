import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { theme } from '@theme/index';
import { DuotoneIcon } from '../DuotoneIcon';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  required?: boolean;
  variant?: 'outline' | 'filled';
  size?: 'small' | 'medium' | 'large';
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  labelStyle,
  required = false,
  variant = 'outline',
  size = 'medium',
  secureTextEntry,
  ...textInputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(secureTextEntry);

  const hasError = Boolean(error);
  const showPasswordToggle = secureTextEntry;

  const containerStyles = [
    styles.container,
    containerStyle,
  ];

  const inputContainerStyles = [
    styles.inputContainer,
    styles[variant],
    styles[size],
    isFocused && styles.focused,
    hasError && styles.error,
  ];

  const inputStyles = [
    styles.input,
    inputStyle,
  ];

  const labelStyles = [
    styles.label,
    hasError && styles.errorText,
    labelStyle,
  ];

  return (
    <View style={containerStyles}>
      {label && (
        <Text style={labelStyles}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      
      <View style={inputContainerStyles}>
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            {leftIcon}
          </View>
        )}
        
        <TextInput
          style={inputStyles}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isSecure}
          placeholderTextColor={theme.colors.textDisabled}
          selectionColor={theme.colors.primary}
          {...textInputProps}
        />
        
        {showPasswordToggle && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={() => setIsSecure(!isSecure)}
          >
            <DuotoneIcon
              name={isSecure ? 'eye' : 'eye-slash'}
              size={20}
              primaryColor={theme.colors.textSecondary}
              primaryOpacity={1}
              secondaryOpacity={0.3}
            />
          </TouchableOpacity>
        )}
        
        {rightIcon && !showPasswordToggle && (
          <View style={styles.rightIconContainer}>
            {rightIcon}
          </View>
        )}
      </View>
      
      {(error || helperText) && (
        <Text style={[styles.helperText, hasError && styles.errorText]}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.xs,
  },
  
  label: {
    ...theme.typography.label,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  
  required: {
    color: theme.colors.error,
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: theme.borderRadius.medium,
  },
  
  // Variants
  outline: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  
  filled: {
    backgroundColor: theme.colors.surfaceVariant,
    borderColor: 'transparent',
  },
  
  // Sizes
  small: {
    minHeight: 36,
    paddingHorizontal: theme.spacing.sm,
  },
  
  medium: {
    minHeight: 48,
    paddingHorizontal: theme.spacing.md,
  },
  
  large: {
    minHeight: 56,
    paddingHorizontal: theme.spacing.lg,
  },
  
  // States
  focused: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  
  error: {
    borderColor: theme.colors.error,
  },
  
  input: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.text,
    paddingVertical: 0, // Remove default padding for better control
  },
  
  leftIconContainer: {
    marginRight: theme.spacing.sm,
  },
  
  rightIconContainer: {
    marginLeft: theme.spacing.sm,
  },
  
  passwordToggle: {
    fontSize: 16,
  },
  
  helperText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  
  errorText: {
    color: theme.colors.error,
  },
});