import React, { useState, useEffect, useRef } from 'react';
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
  useAudioRecorder,
  createAudioPlayer,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  RecordingPresets,
  setAudioModeAsync,
  AudioPlayer,
  AudioStatus,
} from 'expo-audio';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import * as FileSystem from 'expo-file-system/legacy';
import { theme } from '@theme/index';
import { apiService } from '@services/api';

interface AudioRecorderProps {
  visible: boolean;
  onClose: () => void;
  onRecordingComplete: (audioUri: string) => void;
  onUploadComplete?: (success: boolean) => void;
  // Encounter details for chunked upload
  encounterId?: string;
  patientCpf?: string;
  practitionerId?: string;
  sequence?: number;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  visible,
  onClose,
  onRecordingComplete,
  onUploadComplete,
  encounterId,
  patientCpf,
  practitionerId,
  sequence = 1,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [durationInterval, setDurationInterval] = useState<NodeJS.Timeout | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<AudioStatus | null>(null);

  const playerRef = useRef<AudioPlayer | null>(null);
  const playerStatusSubscription = useRef<{ remove: () => void } | null>(null);

  // Audio recorder hook
  const recorder = useAudioRecorder(
    RecordingPresets.HIGH_QUALITY,
    (status) => {
      // Recording status updates
      console.log('Recording status:', status);
    }
  );

  useEffect(() => {
    checkPermissions();

    return () => {
      if (durationInterval) {
        clearInterval(durationInterval);
      }
      if (playerRef.current) {
        playerRef.current.pause();
      }
    };
  }, [durationInterval]);

  const checkPermissions = async () => {
    try {
      // Configure audio mode for iOS
      if (Platform.OS === 'ios') {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
          interruptionModeAndroid: 'duckOthers',
          allowsRecording: true,
          shouldPlayInBackground: false,
          shouldRouteThroughEarpiece: false,
        });
      }

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
      console.log('[START] No permission, checking...');
      await checkPermissions();
      return;
    }

    try {
      console.log('[START] ========== STARTING RECORDING ==========');
      console.log('[START] Recorder object:', recorder);

      console.log('[START] Configuring audio mode for recording...');
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        interruptionModeAndroid: 'duckOthers',
        allowsRecording: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      console.log('[START] Audio mode configured');

      console.log('[START] Preparing recorder...');
      await recorder.prepareToRecordAsync();
      console.log('[START] Recorder prepared');

      // Reset state
      console.log('[START] Resetting state...');
      setRecordingDuration(0);
      setRecordingUri(null);

      // Start recording
      console.log('[START] Calling recorder.record()...');
      await recorder.record();
      console.log('[START] recorder.record() completed');

      setIsRecording(true);

      // Start duration timer
      const interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1000);
      }, 1000);
      setDurationInterval(interval);

      console.log('[START] Recording started successfully');
    } catch (error) {
      console.error('[START] ERROR starting recording:', error);
      console.error('[START] Error details:', JSON.stringify(error, null, 2));
      Alert.alert('Erro', 'Não foi possível iniciar a gravação.');
    }
  };

  const stopRecording = async () => {
    if (!recorder) return;

    try {
      console.log('[STOP] Stopping recording...');

      // Stop duration timer
      if (durationInterval) {
        clearInterval(durationInterval);
        setDurationInterval(null);
      }

      // Stop recording
      console.log('[STOP] Calling recorder.stop()...');
      await recorder.stop();
      console.log('[STOP] recorder.stop() completed');

    // Get URI from recorder object
    const uri = recorder.uri;
    console.log('[STOP] Got URI from recorder:', uri);

    if (!uri) {
      console.error('[STOP] ERROR: No URI received from recorder');
      Alert.alert('Erro', 'Nenhum arquivo de gravação');
      return;
    }

    // Verify file exists and has size
    try {
      const fileInfo: any = await FileSystem.getInfoAsync(uri);
      const fileSize = typeof fileInfo?.size === 'number' ? fileInfo.size : 0;
      console.log('[STOP] File info:', {
        exists: fileInfo.exists,
        size: fileSize,
        uri,
      });

      if (!fileInfo.exists) {
        console.error('[STOP] ERROR: File does not exist');
        Alert.alert('Erro', 'Arquivo de gravação não foi criado');
        return;
      }

      if (!fileSize) {
        console.error('[STOP] ERROR: File is empty (0 bytes)');
        Alert.alert('Erro', 'Gravação está vazia');
        return;
      }

      console.log('[STOP] File verified OK - size(bytes):', fileSize);
    } catch (fileError) {
      console.error('[STOP] ERROR reading file info:', fileError);
    }

      setIsRecording(false);
      setRecordingUri(uri);

      // Apply preferred playback route after recording stops
      console.log('[STOP] Applying playback route after recording (speaker)');
      await configurePlaybackRoute();

      console.log('[STOP] Recording stopped successfully, URI:', uri);
    } catch (error) {
      console.error('[STOP] ERROR stopping recording:', error);
      Alert.alert('Erro', 'Não foi possível parar a gravação.');
    }
  };

  const playRecording = async () => {
    if (!recordingUri) {
      console.error('[PLAY] ERROR: No recording URI');
      return;
    }

    try {
      console.log('[PLAY] ========== STARTING PLAYBACK ==========');
      console.log('[PLAY] Recording URI:', recordingUri);

      try {
        const fileInfo: any = await FileSystem.getInfoAsync(recordingUri);
        const fileSize = typeof fileInfo?.size === 'number' ? fileInfo.size : 0;
        console.log('[PLAY] File check before playback:', {
          exists: fileInfo.exists,
          size: fileSize,
          uri: recordingUri,
        });

        if (!fileInfo.exists || !fileSize) {
          console.error('[PLAY] ERROR: File missing or empty');
          Alert.alert('Erro', 'Arquivo de gravação não encontrado');
          return;
        }
      } catch (fileError) {
        console.error('[PLAY] ERROR reading file info before playback:', fileError);
      }

      console.log('[PLAY] Configuring audio route (speaker)');
      await configurePlaybackRoute();
      console.log('[PLAY] Audio route configured');

      const currentPlayer = playerRef.current;
      if (!currentPlayer) {
        console.error('[PLAY] ERROR: No player instance available');
        return;
      }

      await currentPlayer.seekTo(0);
      currentPlayer.play();
      console.log('[PLAY] Player started');
    } catch (error) {
      console.error('[PLAY] ERROR playing recording:', error);
      console.error('[PLAY] Error details:', JSON.stringify(error, null, 2));
      Alert.alert('Erro', `Não foi possível reproduzir a gravação: ${error}`);
    }
  };

  const stopPlaying = async () => {
    try {
      if (playerRef.current) {
        playerRef.current.pause();
        await playerRef.current.seekTo(0);
      }
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  };

  const cleanupPlayer = () => {
    if (playerStatusSubscription.current) {
      playerStatusSubscription.current.remove();
      playerStatusSubscription.current = null;
    }
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.seekTo(0);
        playerRef.current.remove();
      } catch (error) {
        console.warn('[PLAY] Error cleaning up player:', error);
      }
      playerRef.current = null;
    }
  };

  useEffect(() => {
    if (!recordingUri) {
      cleanupPlayer();
      setPlaybackStatus(null);
      return;
    }

    cleanupPlayer();
    console.log('[PLAY] Initializing new player for URI:', recordingUri);
    const newPlayer = createAudioPlayer({ uri: recordingUri });
    playerRef.current = newPlayer;
    setPlaybackStatus(null);

    playerStatusSubscription.current = newPlayer.addListener('playbackStatusUpdate', (status) => {
      setPlaybackStatus(status ?? null);
      console.log('[PLAY][STATUS]', {
        id: status?.id,
        playing: status?.playing,
        duration: status?.duration,
        currentTime: status?.currentTime,
        isLoaded: status?.isLoaded,
        didJustFinish: status?.didJustFinish,
        isBuffering: status?.isBuffering,
      });
    });

    return () => {
      cleanupPlayer();
    };
  }, [recordingUri]);

  const buildAudioModeConfig = () => ({
    playsInSilentMode: true,
    interruptionMode: 'duckOthers' as const,
    interruptionModeAndroid: 'duckOthers' as const,
    allowsRecording: false,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  });

  const configurePlaybackRoute = async () => {
    try {
      console.log('[PLAY][ROUTE] Configuring route for speaker playback');
      await setAudioModeAsync(buildAudioModeConfig());
      console.log('[PLAY][ROUTE] Audio mode applied');
    } catch (error) {
      console.error('[PLAY][ROUTE] Failed to configure audio route:', error);
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
            if (playerRef.current) {
              playerRef.current.pause();
              playerRef.current.seekTo(0);
            }
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

    // Check if we have encounter details for upload
    const hasEncounterDetails = !!(encounterId && patientCpf && practitionerId);

    try {
      setIsUploading(true);

      if (hasEncounterDetails) {
        // Use simple direct upload (same as file upload)
        console.log('[AudioRecorder] Starting audio upload...');
        console.log('[AudioRecorder] Upload params:', {
          audioPath: recordingUri,
          encounterId,
          patientCpf,
          practitionerId,
          sequence,
        });

        const response = await apiService.uploadAudioRecording(
          recordingUri,
          encounterId!,
          patientCpf!,
          practitionerId!,
          sequence || 1
        );

        console.log('[AudioRecorder] Upload completed:', response);

        setIsUploading(false);
        onUploadComplete?.(true);

        Alert.alert(
          'Sucesso',
          'Gravação enviada com sucesso!',
          [{ text: 'OK', onPress: onClose }]
        );
      } else {
        // Legacy: Just call the callback (parent handles upload)
        console.log('[AudioRecorder] Using legacy upload callback...');
        onRecordingComplete(recordingUri);

        setIsUploading(false);
        onUploadComplete?.(true);

        Alert.alert(
          'Sucesso',
          'Gravação salva com sucesso!',
          [{ text: 'OK', onPress: onClose }]
        );
      }
    } catch (error: any) {
      console.error('[AudioRecorder] Error saving recording:', error);
      setIsUploading(false);
      onUploadComplete?.(false);
      Alert.alert(
        'Erro',
        error.message || 'Não foi possível salvar a gravação.'
      );
    }
  };

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    if (isPlaying) {
      stopPlaying();
    }
    if (durationInterval) {
      clearInterval(durationInterval);
    }
    cleanupPlayer();
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

  const isPlaying = playbackStatus?.playing ?? false;
  const playbackPositionMs = Math.max(0, Math.floor((playbackStatus?.currentTime ?? 0) * 1000));
  const playbackDurationMs =
    playbackStatus && playbackStatus.duration > 0
      ? Math.floor(playbackStatus.duration * 1000)
      : recordingDuration;

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
                    {formatDuration(playbackPositionMs)}
                  </Text>
                  <Text style={styles.playbackDuration}>
                    / {formatDuration(playbackDurationMs)}
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
            {recordingUri && (
              <Text style={styles.routeNote}>
                O áudio sempre sai pelo alto-falante padrão do aparelho. Para usar um dispositivo Bluetooth ou outro
                alto-falante externo, conecte-o primeiro nas configurações do sistema.
              </Text>
            )}
          </View>

          {/* Action Buttons */}
          {recordingUri && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.discardButton}
                onPress={deleteRecording}
                disabled={isUploading}
              >
                <Text style={[styles.discardButtonText, isUploading && styles.buttonTextDisabled]}>
                  Descartar
                </Text>
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
  routeNote: {
    marginTop: 16,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
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
  buttonTextDisabled: {
    opacity: 0.5,
  },
});
