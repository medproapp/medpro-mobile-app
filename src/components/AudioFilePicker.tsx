import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { logger } from '@/utils/logger';

interface AudioFilePickerProps {
  visible: boolean;
  onClose: () => void;
  onAudioFileSelected: (fileUri: string, fileName: string, fileType: string) => void;
  onUploadComplete?: (success: boolean) => void;
}

interface SelectedAudioFile {
  uri: string;
  name: string;
  type: string;
  size: number;
}

export const AudioFilePicker: React.FC<AudioFilePickerProps> = ({
  visible,
  onClose,
  onAudioFileSelected,
  onUploadComplete,
}) => {
  const [selectedFile, setSelectedFile] = useState<SelectedAudioFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        // Check file size (limit to 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size && file.size > maxSize) {
          Alert.alert(
            'Arquivo muito grande',
            'O arquivo de áudio selecionado é muito grande. O tamanho máximo permitido é 10MB.',
            [{ text: 'OK' }]
          );
          return;
        }

        setSelectedFile({
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'audio/mp4',
          size: file.size || 0,
        });
      }
    } catch (error) {
      logger.error('Error picking audio file:', error);
      Alert.alert('Erro', 'Não foi possível selecionar o arquivo de áudio.');
    }
  };

  const removeFile = () => {
    Alert.alert(
      'Remover áudio',
      'Tem certeza que deseja remover o arquivo de áudio selecionado?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => setSelectedFile(null),
        },
      ]
    );
  };

  const uploadFile = async () => {
    if (!selectedFile) {
      Alert.alert('Erro', 'Nenhum arquivo de áudio selecionado.');
      return;
    }

    try {
      setIsUploading(true);

      // Call the parent component's callback - parent will handle upload and show success/error
      onAudioFileSelected(selectedFile.uri, selectedFile.name, selectedFile.type);
    } catch (error) {
      logger.error('Error selecting audio file:', error);
      setIsUploading(false);
      onUploadComplete?.(false);
      Alert.alert('Erro', 'Não foi possível processar o arquivo de áudio.');
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setIsUploading(false);
    onClose();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getAudioFormatLabel = (type: string): string => {
    if (type.includes('mp4') || type.includes('m4a')) return 'MP4/M4A';
    if (type.includes('mp3') || type.includes('mpeg')) return 'MP3';
    if (type.includes('wav')) return 'WAV';
    if (type.includes('aac')) return 'AAC';
    return 'AUDIO';
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <FontAwesome name="times" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Upload de Gravação</Text>
            <View style={styles.headerRight} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            {!selectedFile ? (
              // File selection
              <View style={styles.selectionContainer}>
                <View style={styles.iconContainer}>
                  <FontAwesome name="file-audio-o" size={48} color={theme.colors.primary} />
                </View>

                <Text style={styles.instructionText}>
                  Selecione um arquivo de áudio para upload
                </Text>

                <Text style={styles.supportedFormats}>
                  Formatos suportados: MP4, M4A, MP3, WAV, AAC
                </Text>

                <Text style={styles.fileSizeLimit}>
                  Tamanho máximo: 10MB
                </Text>

                <TouchableOpacity style={styles.selectButton} onPress={pickAudioFile}>
                  <FontAwesome name="folder-open" size={20} color={theme.colors.white} />
                  <Text style={styles.selectButtonText}>Selecionar Arquivo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // File preview
              <View style={styles.previewContainer}>
                <View style={styles.fileInfo}>
                  <View style={styles.fileIconContainer}>
                    <FontAwesome
                      name="file-audio-o"
                      size={32}
                      color={theme.colors.primary}
                    />
                  </View>

                  <View style={styles.fileDetails}>
                    <Text style={styles.fileName} numberOfLines={2}>
                      {selectedFile.name}
                    </Text>
                    <Text style={styles.fileSize}>
                      {formatFileSize(selectedFile.size)}
                    </Text>
                    <Text style={styles.fileType}>
                      {getAudioFormatLabel(selectedFile.type)}
                    </Text>
                  </View>

                  <TouchableOpacity onPress={removeFile} style={styles.removeButton}>
                    <FontAwesome name="trash" size={20} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          {selectedFile && (
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
                onPress={uploadFile}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.uploadButtonText}>Enviar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
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
    maxWidth: 400,
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
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
  selectionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  instructionText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '500',
  },
  supportedFormats: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  fileSizeLimit: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  selectButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  previewContainer: {
    paddingVertical: 10,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fileIconContainer: {
    marginRight: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  fileType: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  removeButton: {
    padding: 8,
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
  uploadButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: theme.colors.textSecondary,
  },
  uploadButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
