import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Modal, Pressable } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';

const TEXT_INPUT_HEIGHT = Platform.select({ ios: 46, android: 48, default: 46 });

interface DatePickerInputProps {
  label: string;
  value: string; // DD/MM/YYYY format
  onChangeDate: (dateString: string) => void;
  placeholder?: string;
  error?: string;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  label,
  value,
  onChangeDate,
  placeholder = 'DD/MM/AAAA',
  error,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);

  // Convert DD/MM/YYYY to Date object
  const parseDate = (dateStr: string): Date => {
    if (!dateStr || dateStr.length < 10) {
      // Default to a reasonable birth date (30 years ago) instead of today
      const defaultDate = new Date();
      defaultDate.setFullYear(defaultDate.getFullYear() - 30);
      return defaultDate;
    }
    try {
      const [day, month, year] = dateStr.split('/').map(s => parseInt(s.trim(), 10));
      if (isNaN(day) || isNaN(month) || isNaN(year)) {
        const defaultDate = new Date();
        defaultDate.setFullYear(defaultDate.getFullYear() - 30);
        return defaultDate;
      }
      // Use local timezone for consistent behavior (not UTC)
      // This creates a date at noon to avoid timezone edge cases
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    } catch {
      const defaultDate = new Date();
      defaultDate.setFullYear(defaultDate.getFullYear() - 30);
      return defaultDate;
    }
  };

  // Convert Date object to DD/MM/YYYY
  const formatDate = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const currentDate = value ? parseDate(value) : new Date();

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // Android closes automatically
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && selectedDate) {
        const formattedDate = formatDate(selectedDate);
        onChangeDate(formattedDate);
      }
    } else {
      // iOS - store temp date
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const handlePress = () => {
    setTempDate(currentDate);
    setShowPicker(true);
  };

  const handleIOSConfirm = () => {
    if (tempDate) {
      const formattedDate = formatDate(tempDate);
      onChangeDate(formattedDate);
    }
    setShowPicker(false);
    setTempDate(null);
  };

  const handleIOSCancel = () => {
    setShowPicker(false);
    setTempDate(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.inputButton, error && styles.inputButtonError]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Text style={[styles.inputText, !value && styles.placeholder]}>
          {value || placeholder}
        </Text>
        <FontAwesome name="calendar" size={16} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Android Native Picker */}
      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate || currentDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      {/* iOS Modal Picker */}
      {showPicker && Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={handleIOSCancel}
        >
          <Pressable style={styles.modalOverlay} onPress={handleIOSCancel}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity onPress={handleIOSCancel}>
                  <Text style={styles.iosPickerButtonCancel}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleIOSConfirm}>
                  <Text style={styles.iosPickerButton}>Confirmar</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.pickerWrapper}>
                <DateTimePicker
                  value={tempDate || currentDate}
                  mode="date"
                  display="inline"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  locale="pt-BR"
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
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
  inputButton: {
    height: TEXT_INPUT_HEIGHT,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  placeholder: {
    color: theme.colors.textSecondary,
  },
  inputButtonError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  pickerWrapper: {
    height: 350,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iosPickerButton: {
    color: theme.colors.primary,
    fontSize: 17,
    fontWeight: '600',
  },
  iosPickerButtonCancel: {
    color: theme.colors.textSecondary,
    fontSize: 17,
  },
});
