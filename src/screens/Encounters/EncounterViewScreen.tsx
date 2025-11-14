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
  Image,
  RefreshControl,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { DashboardStackParamList } from '@/types/navigation';
import { AudioRecorder } from '@components/AudioRecorder';
import { AttachmentPicker } from '@components/AttachmentPicker';
import { ImagePickerComponent } from '@components/ImagePicker';
import { AudioFilePicker } from '@components/AudioFilePicker';
import { NoteAppendModal } from '@components/NoteAppendModal';
import { useAuthStore } from '@store/authStore';
import { apiService } from '@services/api';

type EncounterViewRouteProp = RouteProp<DashboardStackParamList, 'EncounterView'>;

interface EncounterBasicInfo {
  id: string;
  patientName: string;
  patientCpf: string;
  date: string;
  status: string;
  actualStart?: string;
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
  const [audioFilePickerVisible, setAudioFilePickerVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingAudioFile, setIsUploadingAudioFile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadEncounterBasicInfo();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEncounterBasicInfo();
    setRefreshing(false);
  };

  const translateStatus = (status: string): string => {
    switch (status) {
      case 'in-progress':
        return 'Em Andamento';
      case 'on-hold':
        return 'Pausado';
      case 'completed':
        return 'Finalizado';
      case 'cancelled':
        return 'Cancelado';
      case 'entered-in-error':
        return 'Erro de Entrada';
      default:
        return status || 'N/A';
    }
  };

  const getStatusColor = (status: string): string => {
    // Get the original status from translated text for color mapping
    const statusLower = status.toLowerCase();
    if (statusLower.includes('andamento')) return theme.colors.info;
    if (statusLower.includes('pausado')) return theme.colors.warning;
    if (statusLower.includes('finalizado')) return theme.colors.success;
    if (statusLower.includes('cancelado')) return theme.colors.error;
    return theme.colors.textSecondary;
  };


  const loadEncounterBasicInfo = async () => {
    try {
      console.log('[EncounterView] Loading encounter info for ID:', encounterId);

      // Fetch real encounter data from API
      const response = await apiService.getEncounterInfoById(encounterId);
      console.log('[EncounterView] API response:', response);

      // Extract encounter data (API returns array)
      const encounterData = Array.isArray(response) ? response[0] : response;

      if (!encounterData) {
        throw new Error('Encounter not found');
      }

      // Format the date from actualStart field
      let formattedDate = 'N/A';
      if (encounterData.actualStart) {
        try {
          const date = new Date(encounterData.actualStart);
          formattedDate = date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (dateError) {
          console.error('[EncounterView] Error formatting date:', dateError);
        }
      }

      // Map backend fields to our interface
      const encounterInfo: EncounterBasicInfo = {
        id: encounterData.Identifier || encounterId,
        patientName: patientName, // Already passed from route params
        patientCpf: encounterData.Subject || patientCpf, // Use from API or route params
        date: formattedDate,
        status: translateStatus(encounterData.Status), // Translated status
        actualStart: encounterData.actualStart, // For duration calculation
      };

      console.log('[EncounterView] Mapped encounter info:', encounterInfo);
      setEncounter(encounterInfo);
    } catch (error) {
      console.error('[EncounterView] Error loading encounter:', error);
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

  const handleImageSelected = async (imageUri: string, fileName: string, fileSize?: number) => {
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
        user.email,
        fileSize
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

  const handleUploadRecording = () => {
    setAudioFilePickerVisible(true);
  };

  const handleAudioFileSelected = async (fileUri: string, fileName: string, fileType: string) => {
    console.log('[EncounterView] === AUDIO FILE UPLOAD DEBUG START ===');
    console.log('[EncounterView] File details:', {
      fileUri,
      fileName,
      fileType,
    });
    console.log('[EncounterView] Encounter context:', {
      encounterId,
      patientCpf,
      patientName,
    });
    console.log('[EncounterView] User context:', {
      email: user?.email,
      organization: user?.organization,
      name: user?.name,
    });

    if (!user?.email) {
      console.error('[EncounterView] ERROR: User not authenticated');
      Alert.alert('Erro', 'Usuário não autenticado.');
      return;
    }

    try {
      setIsUploadingAudioFile(true);

      console.log('[EncounterView] Calling apiService.uploadAudioRecording with params:', {
        audioPath: fileUri,
        encounterId,
        patientCpf,
        practitionerId: user.email,
        sequence: 1,
      });

      const response = await apiService.uploadAudioRecording(
        fileUri,
        encounterId,
        patientCpf,
        user.email,
        1 // sequence number
      );

      console.log('[EncounterView] Audio file upload successful:', response);
      console.log('[EncounterView] === AUDIO FILE UPLOAD DEBUG END (SUCCESS) ===');

      // Close modal and show success message
      setAudioFilePickerVisible(false);

      Alert.alert(
        'Sucesso',
        'Arquivo de áudio enviado com sucesso!',
        [{ text: 'OK' }]
      );

    } catch (error: any) {
      console.error('[EncounterView] === AUDIO FILE UPLOAD DEBUG END (ERROR) ===');
      console.error('[EncounterView] Error details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
      });

      // Close modal on error too
      setAudioFilePickerVisible(false);

      Alert.alert(
        'Erro',
        'Não foi possível enviar o arquivo de áudio. Tente novamente.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsUploadingAudioFile(false);
    }
  };

  const handleAudioFilePickerClose = () => {
    setAudioFilePickerVisible(false);
  };

  const handleAddNote = () => {
    setNoteModalVisible(true);
  };

  const handleNoteSave = async (noteText: string) => {
    if (!user?.email) {
      Alert.alert('Erro', 'Usuário não autenticado.');
      throw new Error('User not authenticated');
    }

    try {
      console.log('[EncounterView] === MOBILE NOTE APPEND START ===');
      console.log('[EncounterView] Note text length:', noteText.length);

      // Backend handles fetching current notes, appending with timestamp, and updating
      await apiService.appendMobileNote(encounterId, noteText);

      console.log('[EncounterView] === MOBILE NOTE APPEND SUCCESS ===');

      Alert.alert('Sucesso', 'Nota adicionada com sucesso!');
    } catch (error: any) {
      console.error('[EncounterView] === MOBILE NOTE APPEND ERROR ===');
      console.error('[EncounterView] Error details:', {
        message: error?.message,
        name: error?.name,
      });
      throw error; // Re-throw so modal can handle it
    }
  };

  const handleNoteModalClose = () => {
    setNoteModalVisible(false);
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
        {/* Header with gradient background - same as other screens */}
        <View style={styles.headerBackground}>
          {/* Background Logo */}
          <Image
            source={require('../../assets/medpro-logo.png')}
            style={styles.backgroundLogo}
            resizeMode="contain"
          />
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.greeting}>Encontro</Text>
              <Text style={styles.patientNameHeader}>{encounter?.patientName}</Text>
              <Text style={styles.dateText}>{encounter?.date}</Text>
              <View style={styles.badgesRow}>
                <View style={styles.idBadgeHeader}>
                  <Text style={styles.idText}>#{encounter?.id}</Text>
                </View>
                <View style={[
                  styles.statusBadgeHeader,
                  { backgroundColor: getStatusColor(encounter?.status || '') + '25' }
                ]}>
                  <Text style={[
                    styles.statusTextHeader,
                    { color: getStatusColor(encounter?.status || '') }
                  ]}>
                    {encounter?.status}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        >

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <Text style={styles.actionsTitle}>Ações Disponíveis</Text>

            {/* Add Attachment Button */}
            <TouchableOpacity
              style={[styles.actionButton, (isUploadingAttachment || encounter?.status === 'Finalizado' || encounter?.status === 'Cancelado') && styles.actionButtonDisabled]}
              onPress={handleAddAttachment}
              disabled={isUploadingAttachment || encounter?.status === 'Finalizado' || encounter?.status === 'Cancelado'}
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
              style={[styles.actionButton, (isUploadingImage || encounter?.status === 'Finalizado' || encounter?.status === 'Cancelado') && styles.actionButtonDisabled]}
              onPress={handleAddImage}
              disabled={isUploadingImage || encounter?.status === 'Finalizado' || encounter?.status === 'Cancelado'}
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
              style={[styles.actionButton, (isUploadingAudio || encounter?.status === 'Finalizado' || encounter?.status === 'Cancelado') && styles.actionButtonDisabled]}
              onPress={handleStartRecording}
              disabled={isUploadingAudio || encounter?.status === 'Finalizado' || encounter?.status === 'Cancelado'}
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

            {/* Upload Recording Button */}
            <TouchableOpacity
              style={[styles.actionButton, (isUploadingAudioFile || encounter?.status === 'Finalizado' || encounter?.status === 'Cancelado') && styles.actionButtonDisabled]}
              onPress={handleUploadRecording}
              disabled={isUploadingAudioFile || encounter?.status === 'Finalizado' || encounter?.status === 'Cancelado'}
            >
              <View style={styles.actionButtonContent}>
                <FontAwesome name="file-audio-o" size={24} color={theme.colors.primary} />
                <View style={styles.actionButtonText}>
                  <Text style={styles.actionButtonTitle}>Upload de Gravação</Text>
                  <Text style={styles.actionButtonSubtitle}>Arquivos de áudio existentes</Text>
                </View>
                {isUploadingAudioFile ? (
                  <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                ) : (
                  <FontAwesome name="chevron-right" size={16} color={theme.colors.textSecondary} />
                )}
              </View>
            </TouchableOpacity>

            {/* Add Note Button */}
            <TouchableOpacity
              style={[styles.actionButton, (encounter?.status === 'Finalizado' || encounter?.status === 'Cancelado') && styles.actionButtonDisabled]}
              onPress={handleAddNote}
              disabled={encounter?.status === 'Finalizado' || encounter?.status === 'Cancelado'}
            >
              <View style={styles.actionButtonContent}>
                <FontAwesome name="sticky-note-o" size={24} color={theme.colors.primary} />
                <View style={styles.actionButtonText}>
                  <Text style={styles.actionButtonTitle}>Adicionar Nota</Text>
                  <Text style={styles.actionButtonSubtitle}>Anotações e observações</Text>
                </View>
                <FontAwesome name="chevron-right" size={16} color={theme.colors.textSecondary} />
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
          encounterId={encounterId}
          patientCpf={patientCpf}
          practitionerId={user?.email}
          sequence={1}
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

        {/* Audio File Picker Modal */}
        <AudioFilePicker
          visible={audioFilePickerVisible}
          onClose={handleAudioFilePickerClose}
          onAudioFileSelected={handleAudioFileSelected}
          onUploadComplete={(success) => {
            if (success) {
              setAudioFilePickerVisible(false);
            }
          }}
        />

        {/* Note Append Modal */}
        <NoteAppendModal
          visible={noteModalVisible}
          onClose={handleNoteModalClose}
          onNoteSave={handleNoteSave}
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
  headerBackground: {
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: theme.spacing.lg,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
    zIndex: 1,
  },
  backgroundLogo: {
    position: 'absolute',
    right: -20,
    top: '50%',
    width: 120,
    height: 120,
    opacity: 0.1,
    transform: [{ translateY: -60 }],
    tintColor: theme.colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  backButton: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.white + '20',
    borderRadius: 8,
    marginRight: theme.spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    ...theme.typography.caption,
    color: theme.colors.white + 'CC',
    fontSize: 13,
  },
  patientNameHeader: {
    ...theme.typography.h1,
    color: theme.colors.white,
    fontSize: 20,
    fontWeight: '700',
    marginTop: theme.spacing.xs,
  },
  dateText: {
    ...theme.typography.caption,
    color: theme.colors.white + 'AA',
    fontSize: 12,
    marginTop: theme.spacing.xs,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  idBadgeHeader: {
    backgroundColor: theme.colors.white + '25',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.white + '40',
    marginRight: 8,
  },
  statusBadgeHeader: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.white + '40',
  },
  statusTextHeader: {
    fontSize: 12,
    color: theme.colors.white,
    fontWeight: '600',
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
  idBadge: {
    backgroundColor: theme.colors.info + '15',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.info + '30',
    flex: 1,
  },
  idText: {
    fontSize: 12,
    color: theme.colors.white,
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