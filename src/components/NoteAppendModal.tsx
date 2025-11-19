import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { logger } from '@/utils/logger';

interface NoteAppendModalProps {
  visible: boolean;
  onClose: () => void;
  onNoteSave: (noteText: string) => Promise<void>;
}

export const NoteAppendModal: React.FC<NoteAppendModalProps> = ({
  visible,
  onClose,
  onNoteSave,
}) => {
  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!noteText.trim()) {
      Alert.alert('Atenção', 'Por favor, digite uma nota antes de salvar.');
      return;
    }

    try {
      setIsSaving(true);
      await onNoteSave(noteText.trim());

      // Success - reset and close
      setNoteText('');
      setIsSaving(false);
      onClose();
    } catch (error) {
      logger.error('[NoteAppendModal] Error saving note:', error);
      setIsSaving(false);
      // Don't close modal on error - let user try again
      Alert.alert('Erro', 'Não foi possível salvar a nota. Tente novamente.');
    }
  };

  const handleClose = () => {
    if (noteText.trim() && !isSaving) {
      Alert.alert(
        'Descartar nota?',
        'Você tem uma nota não salva. Deseja descartar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Descartar',
            style: 'destructive',
            onPress: () => {
              setNoteText('');
              onClose();
            },
          },
        ]
      );
    } else {
      setNoteText('');
      onClose();
    }
  };

  const characterCount = noteText.length;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton} disabled={isSaving}>
              <FontAwesome name="times" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Adicionar Nota</Text>
            <View style={styles.headerRight} />
          </View>

          {/* Content */}
          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.instructionText}>
              Digite ou cole o texto da nota abaixo. A nota será adicionada ao prontuário do encontro com data e hora.
            </Text>

            <TextInput
              style={styles.textInput}
              placeholder="Digite sua nota aqui..."
              placeholderTextColor={theme.colors.textSecondary}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={10}
              textAlignVertical="top"
              editable={!isSaving}
              autoFocus
            />

            <Text style={styles.characterCount}>
              {characterCount} caractere{characterCount !== 1 ? 's' : ''}
            </Text>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={isSaving}
            >
              <Text style={[styles.cancelButtonText, isSaving && styles.buttonTextDisabled]}>
                Cancelar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving || !noteText.trim()}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text style={styles.saveButtonText}>Salvar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  content: {
    marginBottom: 20,
  },
  instructionText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  textInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
    minHeight: 200,
    maxHeight: 300,
  },
  characterCount: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.textSecondary,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextDisabled: {
    opacity: 0.5,
  },
});
