import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { StackNavigationProp } from '@react-navigation/stack';
import { theme } from '@theme/index';
import { PatientsStackParamList } from '@/types/navigation';
import { apiService } from '@services/api';
import { logger } from '@/utils/logger';

type NavigationProp = StackNavigationProp<PatientsStackParamList, 'LeadCreate'>;

export const LeadCreateScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Dados incompletos', 'Informe o nome do lead.');
      return;
    }
    try {
      setSubmitting(true);
      await apiService.createLead({
        patient_name: name.trim(),
        patient_cpf: cpf.trim(),
        patient_phone: phone.trim(),
        patient_email: email.trim(),
        status: 'new',
        notes: notes.trim(),
      });
      Alert.alert('Sucesso', 'Lead criado com sucesso!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      logger.error('[LeadCreate] Failed to create lead', error);
      Alert.alert('Erro', 'Não foi possível criar o lead.');
    } finally {
      setSubmitting(false);
    }
  }, [cpf, email, name, navigation, notes, phone]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.headerBackground}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} disabled={submitting}>
            <FontAwesome name="arrow-left" size={18} color={theme.colors.white} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Novo Lead</Text>
            <Text style={styles.headerSubtitle}>Cadastrar oportunidade</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Informações principais</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nome *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome completo"
              placeholderTextColor={theme.colors.textSecondary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
              editable={!submitting}
            />
          </View>
          <View style={styles.rowFields}>
            <View style={[styles.fieldGroup, styles.half]}>
              <Text style={styles.label}>CPF / ID</Text>
              <TextInput
              style={styles.input}
              placeholder="CPF ou identificador"
              placeholderTextColor={theme.colors.textSecondary}
              value={cpf}
              onChangeText={setCpf}
              keyboardType="number-pad"
              textContentType="none"
              editable={!submitting}
            />
            </View>
            <View style={[styles.fieldGroup, styles.half]}>
              <Text style={styles.label}>Telefone</Text>
              <TextInput
                style={styles.input}
                placeholder="Telefone"
                placeholderTextColor={theme.colors.textSecondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                editable={!submitting}
              />
            </View>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="email@exemplo.com"
              placeholderTextColor={theme.colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              editable={!submitting}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notas</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Contexto, observações, canal de contato..."
            placeholderTextColor={theme.colors.textSecondary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!submitting}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, submitting && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={submitting}
        >
          <Text style={styles.saveButtonText}>{submitting ? 'Salvando...' : 'Salvar lead'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerBackground: {
    backgroundColor: theme.colors.primary,
    paddingTop: StatusBar.currentHeight || 48,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white + '20',
    marginRight: theme.spacing.md,
  },
  headerTextContainer: { flex: 1 },
  headerTitle: { color: theme.colors.white, fontSize: 20, fontWeight: '700' },
  headerSubtitle: { color: theme.colors.white + 'CC', fontSize: 14, marginTop: 4 },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.sm },
  fieldGroup: { marginBottom: theme.spacing.sm },
  label: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  rowFields: { flexDirection: 'row', gap: theme.spacing.sm },
  half: { flex: 1 },
  notesInput: { minHeight: 100 },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default LeadCreateScreen;
