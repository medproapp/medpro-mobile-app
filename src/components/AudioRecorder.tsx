import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {
  useAudioPlayer,
  useAudioRecorder,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  RecordingPresets,
} from 'expo-audio';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';

interface AudioRecorderProps {
  visible: boolean;
  onClose: () => void;
  onRecordingComplete: (audioUri: string) => void;
  onUploadComplete?: (success: boolean) => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  visible,
  onClose,
  onRecordingComplete,
  onUploadComplete,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [durationInterval, setDurationInterval] = useState<NodeJS.Timeout | null>(null);

  // Audio recorder hook
  const recorder = useAudioRecorder(
    RecordingPresets.HIGH_QUALITY,
    (status) => {
      // Recording status updates
      console.log('Recording status:', status);
    }
  );

  // Audio player hook (will be initialized when we have a recording)
  const player = useAudioPlayer(recordingUri ? { uri: recordingUri } : undefined);

  useEffect(() => {
    checkPermissions();
    
    return () => {
      // Cleanup
      if (durationInterval) {
        clearInterval(durationInterval);
      }
    };
  }, []);

  const checkPermissions = async () => {
    try {
      const { status } = await getRecordingPermissionsAsync();
      
      if (status !== 'granted') {
        const { status: newStatus } = await requestRecordingPermissionsAsync();
        setHasPermission(newStatus === 'granted');
        
        if (newStatus !== 'granted') {
          Alert.alert(
            'Permissão necessária',
            'Este aplicativo precisa de permissão para acessar o microfone.',
            [{ text: 'OK' }]
          );
        }
      } else {
        setHasPermission(true);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      setHasPermission(false);
    }
  };

  const startRecording = async () => {
    if (!hasPermission) {
      await checkPermissions();
      return;
    }

    try {
      console.log('Starting recording...');
      
      // Reset state
      setRecordingDuration(0);
      setRecordingUri(null);
      
      // Start recording
      await recorder.record();
      setIsRecording(true);

      // Start duration timer
      const interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1000);
      }, 1000);
      setDurationInterval(interval);

      console.log('Recording started successfully');
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Erro', 'Não foi possível iniciar a gravação.');
    }
  };

  const stopRecording = async () => {
    if (!recorder) return;

    try {
      console.log('Stopping recording...');
      
      // Stop duration timer
      if (durationInterval) {
        clearInterval(durationInterval);
        setDurationInterval(null);
      }

      // Stop recording
      await recorder.stop();
      
      // Get URI from recorder object
      const uri = recorder.uri;
      
      setIsRecording(false);
      setRecordingUri(uri);

      console.log('Recording stopped, URI:', uri);
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Erro', 'Não foi possível parar a gravação.');
    }
  };

  const playRecording = async () => {
    if (!player || !recordingUri) return;

    try {
      console.log('Playing recording...');
      player.play();
    } catch (error) {
      console.error('Error playing recording:', error);
      Alert.alert('Erro', 'Não foi possível reproduzir a gravação.');
    }
  };

  const stopPlaying = async () => {
    if (!player) return;

    try {
      player.pause();
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  };

  const deleteRecording = () => {
    Alert.alert(
      'Excluir gravação',
      'Tem certeza que deseja excluir esta gravação?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            setRecordingUri(null);
            setRecordingDuration(0);
            setIsRecording(false);
          },
        },
      ]
    );
  };

  const saveRecording = async () => {
    if (!recordingUri) {
      Alert.alert('Erro', 'Nenhuma gravação para salvar.');
      return;
    }

    try {
      setIsUploading(true);
      
      // Call the parent component's callback
      onRecordingComplete(recordingUri);
      
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsUploading(false);
      onUploadComplete?.(true);
      
      Alert.alert(
        'Sucesso',
        'Gravação salva com sucesso!',
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      console.error('Error saving recording:', error);
      setIsUploading(false);
      onUploadComplete?.(false);
      Alert.alert('Erro', 'Não foi possível salvar a gravação.');
    }
  };

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    if (player?.playing) {
      stopPlaying();
    }
    if (durationInterval) {
      clearInterval(durationInterval);
    }
    onClose();
  };

  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    if (isRecording) return 'Gravando...';
    if (recordingUri) return 'Gravação concluída';
    return 'Pronto para gravar';
  };

  const isPlaying = player?.playing || false;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <FontAwesome name="times" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Gravação de Áudio</Text>
            <View style={styles.headerRight} />
          </View>

          {/* Recording Status */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusIndicator, isRecording && styles.statusRecording]}>
              <FontAwesome 
                name={isRecording ? "microphone" : "microphone-slash"} 
                size={32} 
                color={isRecording ? theme.colors.error : theme.colors.textSecondary} 
              />
            </View>
            
            <Text style={styles.timeDisplay}>
              {formatDuration(recordingDuration)}
            </Text>
            
            <Text style={styles.statusText}>
              {getStatusText()}
            </Text>
          </View>

          {/* Controls */}
          <View style={styles.controlsContainer}>
            {!recordingUri ? (
              // Recording controls
              <TouchableOpacity 
                style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                onPress={isRecording ? stopRecording : startRecording}
                disabled={hasPermission === false}
              >
                <FontAwesome 
                  name={isRecording ? "stop" : "microphone"} 
                  size={24} 
                  color={theme.colors.white} 
                />
                <Text style={styles.recordButtonText}>
                  {isRecording ? 'Parar' : 'Gravar'}
                </Text>
              </TouchableOpacity>
            ) : (
              // Playback and save controls
              <View style={styles.playbackControls}>
                <TouchableOpacity 
                  style={styles.playButton}
                  onPress={isPlaying ? stopPlaying : playRecording}
                >
                  <FontAwesome 
                    name={isPlaying ? "pause" : "play"} 
                    size={20} 
                    color={theme.colors.primary} 
                  />
                </TouchableOpacity>
                
                <View style={styles.playbackInfo}>
                  <Text style={styles.playbackTime}>
                    {formatDuration(player?.currentTime || 0)}
                  </Text>
                  <Text style={styles.playbackDuration}>
                    / {formatDuration(recordingDuration)}
                  </Text>
                </View>

                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={deleteRecording}
                >
                  <FontAwesome name="trash" size={20} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          {recordingUri && (
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.discardButton}
                onPress={deleteRecording}
              >
                <Text style={styles.discardButtonText}>Descartar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.saveButton, isUploading && styles.saveButtonDisabled]}
                onPress={saveRecording}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Salvar</Text>
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
    marginBottom: 30,
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
  statusContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  statusIndicator: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: theme.colors.border,
  },
  statusRecording: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.error + '10',
  },
  timeDisplay: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  controlsContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 120,
    justifyContent: 'center',
  },
  recordButtonActive: {
    backgroundColor: theme.colors.error,
  },
  recordButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playbackInfo: {
    flex: 1,
    alignItems: 'center',
  },
  playbackTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  playbackDuration: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  deleteButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.error + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  discardButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  discardButtonText: {
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
});