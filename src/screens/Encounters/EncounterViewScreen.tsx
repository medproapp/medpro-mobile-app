import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { DashboardStackParamList } from '@types/navigation';
import { AudioRecorder } from '@components/AudioRecorder';
import { AttachmentPicker } from '@components/AttachmentPicker';
import { ImagePickerComponent } from '@components/ImagePicker';
import { useAuthStore } from '@store/authStore';
import { apiService } from '@services/api';

type EncounterViewRouteProp = RouteProp<DashboardStackParamList, 'EncounterView'>;

interface EncounterBasicInfo {
  id: string;
  patientName: string;
  patientCpf: string;
  date: string;
  status: string;
  duration?: string;
}

export const EncounterViewScreen: React.FC = () => {
  const route = useRoute<EncounterViewRouteProp>();
  const navigation = useNavigation();
  const { encounterId, patientName, patientCpf } = route.params;
  const { user } = useAuthStore();

  const [encounter, setEncounter] = useState<EncounterBasicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioRecorderVisible, setAudioRecorderVisible] = useState(false);
  const [attachmentPickerVisible, setAttachmentPickerVisible] = useState(false);
  const [imagePickerVisible, setImagePickerVisible] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    loadEncounterBasicInfo();
  }, []);

  const loadEncounterBasicInfo = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockEncounter: EncounterBasicInfo = {
        id: encounterId,
        patientName,
        patientCpf,
        date: new Date().toLocaleDateString('pt-BR'),
        status: 'Em andamento',
        duration: '15 min'
      };
      
      setEncounter(mockEncounter);
    } catch (error) {
      console.error('Error loading encounter:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados do encontro.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAttachment = () => {
    setAttachmentPickerVisible(true);
  };

  const handleAddImage = () => {
    setImagePickerVisible(true);
  };

  const handleStartRecording = () => {
    setAudioRecorderVisible(true);
  };

  const handleAudioRecordingComplete = async (audioUri: string) => {
    if (!user?.email) {
      Alert.alert('Erro', 'Usuário não autenticado.');
      return;
    }

    try {
      setIsUploadingAudio(true);
      
      const response = await apiService.uploadAudioRecording(
        audioUri,
        encounterId,
        patientCpf,
        user.email,
        1 // sequence number
      );
      
      console.log('Audio upload successful:', response);
      
      Alert.alert(
        'Sucesso',
        'Gravação de áudio enviada com sucesso!',
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('Audio upload error:', error);
      Alert.alert(
        'Erro',
        'Não foi possível enviar a gravação de áudio. Tente novamente.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const handleAttachmentSelected = async (fileUri: string, fileName: string, fileType: string) => {
    if (!user?.email) {
      Alert.alert('Erro', 'Usuário não autenticado.');
      return;
    }

    try {
      setIsUploadingAttachment(true);
      
      const response = await apiService.uploadAttachment(
        fileUri,
        fileName,
        fileType,
        encounterId,
        patientCpf,
        user.email
      );
      
      console.log('Attachment upload successful:', response);
      
      Alert.alert(
        'Sucesso',
        'Anexo enviado com sucesso!',
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('Attachment upload error:', error);
      Alert.alert(
        'Erro',
        'Não foi possível enviar o anexo. Tente novamente.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleImageSelected = async (imageUri: string, fileName: string) => {
    if (!user?.email) {
      Alert.alert('Erro', 'Usuário não autenticado.');
      return;
    }

    try {
      setIsUploadingImage(true);
      
      const response = await apiService.uploadImage(
        imageUri,
        fileName,
        encounterId,
        patientCpf,
        user.email
      );
      
      console.log('Image upload successful:', response);
      
      Alert.alert(
        'Sucesso',
        'Imagem enviada com sucesso!',
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('Image upload error:', error);
      Alert.alert(
        'Erro',
        'Não foi possível enviar a imagem. Tente novamente.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleAudioRecorderClose = () => {
    setAudioRecorderVisible(false);
  };

  const handleAttachmentPickerClose = () => {
    setAttachmentPickerVisible(false);
  };

  const handleImagePickerClose = () => {
    setImagePickerVisible(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando encontro...</Text>
      </View>
    );
  }

  if (!encounter) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome name="exclamation-triangle" size={50} color={theme.colors.error} />
        <Text style={styles.errorText}>Erro ao carregar encontro</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadEncounterBasicInfo}>
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Encontro</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollContainer}>
          {/* Encounter Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <FontAwesome name="user-md" size={24} color={theme.colors.primary} />
              <Text style={styles.infoHeaderText}>Informações do Encontro</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Paciente:</Text>
              <Text style={styles.infoValue}>{encounter.patientName}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Data:</Text>
              <Text style={styles.infoValue}>{encounter.date}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{encounter.status}</Text>
              </View>
            </View>
            
            {encounter.duration && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Duração:</Text>
                <Text style={styles.infoValue}>{encounter.duration}</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <Text style={styles.actionsTitle}>Ações Disponíveis</Text>
            
            {/* Add Attachment Button */}
            <TouchableOpacity 
              style={[styles.actionButton, isUploadingAttachment && styles.actionButtonDisabled]} 
              onPress={handleAddAttachment}
              disabled={isUploadingAttachment}
            >
              <View style={styles.actionButtonContent}>
                <FontAwesome name="paperclip" size={24} color={theme.colors.primary} />
                <View style={styles.actionButtonText}>
                  <Text style={styles.actionButtonTitle}>Adicionar Anexo</Text>
                  <Text style={styles.actionButtonSubtitle}>Documentos, PDFs, arquivos</Text>
                </View>
                {isUploadingAttachment ? (
                  <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                ) : (
                  <FontAwesome name="chevron-right" size={16} color={theme.colors.textSecondary} />
                )}
              </View>
            </TouchableOpacity>

            {/* Add Image Button */}
            <TouchableOpacity 
              style={[styles.actionButton, isUploadingImage && styles.actionButtonDisabled]} 
              onPress={handleAddImage}
              disabled={isUploadingImage}
            >
              <View style={styles.actionButtonContent}>
                <FontAwesome name="camera" size={24} color={theme.colors.primary} />
                <View style={styles.actionButtonText}>
                  <Text style={styles.actionButtonTitle}>Adicionar Imagem</Text>
                  <Text style={styles.actionButtonSubtitle}>Fotos, capturas de tela</Text>
                </View>
                {isUploadingImage ? (
                  <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                ) : (
                  <FontAwesome name="chevron-right" size={16} color={theme.colors.textSecondary} />
                )}
              </View>
            </TouchableOpacity>

            {/* Start Recording Button */}
            <TouchableOpacity 
              style={[styles.actionButton, isUploadingAudio && styles.actionButtonDisabled]} 
              onPress={handleStartRecording}
              disabled={isUploadingAudio}
            >
              <View style={styles.actionButtonContent}>
                <FontAwesome name="microphone" size={24} color={theme.colors.primary} />
                <View style={styles.actionButtonText}>
                  <Text style={styles.actionButtonTitle}>Iniciar Gravação</Text>
                  <Text style={styles.actionButtonSubtitle}>Áudio, notas de voz</Text>
                </View>
                {isUploadingAudio ? (
                  <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                ) : (
                  <FontAwesome name="chevron-right" size={16} color={theme.colors.textSecondary} />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
        
        {/* Audio Recorder Modal */}
        <AudioRecorder
          visible={audioRecorderVisible}
          onClose={handleAudioRecorderClose}
          onRecordingComplete={handleAudioRecordingComplete}
          onUploadComplete={(success) => {
            if (success) {
              setAudioRecorderVisible(false);
            }
          }}
        />

        {/* Attachment Picker Modal */}
        <AttachmentPicker
          visible={attachmentPickerVisible}
          onClose={handleAttachmentPickerClose}
          onAttachmentSelected={handleAttachmentSelected}
          onUploadComplete={(success) => {
            if (success) {
              setAttachmentPickerVisible(false);
            }
          }}
        />

        {/* Image Picker Modal */}
        <ImagePickerComponent
          visible={imagePickerVisible}
          onClose={handleImagePickerClose}
          onImageSelected={handleImageSelected}
          onUploadComplete={(success) => {
            if (success) {
              setImagePickerVisible(false);
            }
          }}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: theme.colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.white,
    textAlign: 'center',
    marginLeft: -32, // Compensate for back button
  },
  headerRight: {
    width: 32,
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginLeft: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    width: 80,
  },
  infoValue: {
    fontSize: 16,
    color: theme.colors.text,
    flex: 1,
  },
  statusBadge: {
    backgroundColor: theme.colors.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    color: theme.colors.success,
    fontWeight: '600',
  },
  actionsContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  actionButton: {
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  actionButtonText: {
    flex: 1,
    marginLeft: 16,
  },
  actionButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  actionButtonSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
});