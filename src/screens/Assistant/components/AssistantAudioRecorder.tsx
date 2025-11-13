import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  Vibration,
} from 'react-native';
import {
  useAudioPlayer,
  useAudioRecorder,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../../theme';
import { useAssistantStore } from '../../../store/assistantStore';

interface AssistantAudioRecorderProps {
  onAudioRecorded: (audioUri: string) => void;
  onTranscriptionComplete: (text: string) => void;
  onAudioMessage?: (audioUri: string) => Promise<void>;
  disabled?: boolean;
  style?: any;
}

// Helper function to generate beep sounds
const generateBeepSound = (frequency: number, duration: number): string => {
  // Generate a simple sine wave beep sound as data URI
  const sampleRate = 44100;
  const samples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples * 2, true);

  // Generate sine wave
  let offset = 44;
  for (let i = 0; i < samples; i++) {
    const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3; // 30% volume
    view.setInt16(offset, sample * 32767, true);
    offset += 2;
  }

  // Convert to base64 data URI
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:audio/wav;base64,${base64}`;
};

export const AssistantAudioRecorder: React.FC<AssistantAudioRecorderProps> = ({
  onAudioRecorded,
  onTranscriptionComplete,
  onAudioMessage,
  disabled = false,
  style,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [durationInterval, setDurationInterval] = useState<NodeJS.Timeout | null>(null);

  // Animated values for visual feedback
  const pulseAnim = new Animated.Value(1);
  const scaleAnim = new Animated.Value(1);

  // Generate beep sound URIs
  const startBeepUri = React.useMemo(() => generateBeepSound(800, 0.1), []); // 800Hz, 0.1s
  const stopBeepUri = React.useMemo(() => generateBeepSound(400, 0.2), []); // 400Hz, 0.2s

  // Audio feedback sounds using expo-audio
  const startSoundPlayer = useAudioPlayer({ uri: startBeepUri });
  const stopSoundPlayer = useAudioPlayer({ uri: stopBeepUri });

  // Audio recorder hook
  const recorder = useAudioRecorder(
    RecordingPresets.HIGH_QUALITY,
    (status) => {
      console.log('[AssistantAudioRecorder] Recording status:', status);
    }
  );

  // Audio player hook for playback
  const player = useAudioPlayer(recordingUri ? { uri: recordingUri } : undefined);

  useEffect(() => {
    checkPermissions();
    setAudioMode();

    return () => {
      if (durationInterval) {
        clearInterval(durationInterval);
      }
    };
  }, []);

  const setAudioMode = async () => {
    try {
      // Set audio mode to allow playback during recording using expo-audio
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    } catch (error) {
      console.error('[AssistantAudioRecorder] Error setting audio mode:', error);
    }
  };

  // Audio and haptic feedback functions
  const playStartFeedback = async () => {
    try {
      console.log('[AssistantAudioRecorder] Playing start feedback');

      // Audio feedback - high pitched beep using expo-audio
      startSoundPlayer.play();

      // Haptic feedback for start (double tap)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 100);

    } catch (error) {
      console.error('[AssistantAudioRecorder] Error playing start feedback:', error);
    }
  };

  const playStopFeedback = async () => {
    try {
      console.log('[AssistantAudioRecorder] Playing stop feedback');

      // Audio feedback - low pitched beep using expo-audio
      stopSoundPlayer.play();

      // Haptic feedback for stop (single strong tap)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    } catch (error) {
      console.error('[AssistantAudioRecorder] Error playing stop feedback:', error);
    }
  };

  // Pulse animation for recording state
  useEffect(() => {
    if (isRecording) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      
      return () => pulseAnimation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const checkPermissions = async () => {
    try {
      const { status } = await getRecordingPermissionsAsync();
      
      if (status !== 'granted') {
        const { status: newStatus } = await requestRecordingPermissionsAsync();
        setHasPermission(newStatus === 'granted');
        
        if (newStatus !== 'granted') {
          Alert.alert(
            'Permissão necessária',
            'Este aplicativo precisa de permissão para acessar o microfone para gravação de áudio.',
            [{ text: 'OK' }]
          );
        }
      } else {
        setHasPermission(true);
      }
    } catch (error) {
      console.error('[AssistantAudioRecorder] Error checking permissions:', error);
      setHasPermission(false);
    }
  };

  const startRecording = async () => {
    if (!hasPermission) {
      await checkPermissions();
      return;
    }

    if (disabled) return;

    try {
      console.log('[AssistantAudioRecorder] Starting recording...');
      
      // Reset state
      setRecordingDuration(0);
      setRecordingUri(null);
      setIsTranscribing(false);
      
      // Play start feedback
      await playStartFeedback();

      // Start recording
      await recorder.record();
      setIsRecording(true);

      // Start duration timer
      const interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1000);
      }, 1000);
      setDurationInterval(interval);

      // Scale animation when starting
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 150,
        useNativeDriver: true,
      }).start();

      console.log('[AssistantAudioRecorder] Recording started successfully');
    } catch (error) {
      console.error('[AssistantAudioRecorder] Error starting recording:', error);
      Alert.alert('Erro', 'Não foi possível iniciar a gravação de áudio.');
    }
  };

  const stopRecording = async () => {
    if (!recorder) return;

    try {
      console.log('[AssistantAudioRecorder] Stopping recording...');
      
      // Stop duration timer
      if (durationInterval) {
        clearInterval(durationInterval);
        setDurationInterval(null);
      }

      // Stop recording
      await recorder.stop();
      
      // Play stop feedback
      await playStopFeedback();
      
      // Get URI from recorder object
      const uri = recorder.uri;
      
      setIsRecording(false);
      setRecordingUri(uri);

      // Reset scale animation
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();

      console.log('[AssistantAudioRecorder] Recording stopped, URI:', uri);

      // Automatically process the recording
      if (uri) {
        await processRecording(uri);
      }
    } catch (error) {
      console.error('[AssistantAudioRecorder] Error stopping recording:', error);
      Alert.alert('Erro', 'Não foi possível parar a gravação.');
    }
  };

  const processRecording = async (uri: string) => {
    try {
      setIsTranscribing(true);
      
      // Notify parent about the audio
      onAudioRecorded(uri);
      
      // If onAudioMessage is provided, send the audio directly
      if (onAudioMessage) {
        await onAudioMessage(uri);
        setIsTranscribing(false);
        return;
      }
      
      // Otherwise, just transcribe for the input
      try {
        const transcription = await useAssistantStore.getState().transcribeAudio(uri);
        onTranscriptionComplete(transcription);
      } catch (transcriptionError) {
        console.error('[AssistantAudioRecorder] Transcription failed:', transcriptionError);
        // Show error to user but don't crash
        Alert.alert('Erro', 'Não foi possível transcrever o áudio. Verifique sua conexão com a internet.');
        onTranscriptionComplete(''); // Empty transcription on error
      }
      
      setIsTranscribing(false);
    } catch (error) {
      console.error('[AssistantAudioRecorder] Error processing recording:', error);
      setIsTranscribing(false);
      Alert.alert('Erro', 'Não foi possível processar a gravação.');
    }
  };

  const cancelRecording = async () => {
    if (isRecording) {
      try {
        await recorder.stop();
        setIsRecording(false);
        setRecordingDuration(0);
        setRecordingUri(null);
        
        if (durationInterval) {
          clearInterval(durationInterval);
          setDurationInterval(null);
        }

        // Reset animations
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      } catch (error) {
        console.error('[AssistantAudioRecorder] Error canceling recording:', error);
      }
    }
  };

  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getButtonIcon = () => {
    if (isTranscribing) return 'loader';
    if (isRecording) return 'square';
    return 'mic';
  };

  const getButtonColor = () => {
    if (isTranscribing) return theme.colors.info;
    if (isRecording) return theme.colors.error;
    if (disabled || hasPermission === false) return theme.colors.textSecondary;
    return theme.colors.primary;
  };

  const handlePress = () => {
    if (isTranscribing) return;
    
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleLongPress = () => {
    if (isRecording) {
      cancelRecording();
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Recording indicator */}
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <Animated.View
            style={[
              styles.recordingDot,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <Text style={styles.recordingText}>
            {formatDuration(recordingDuration)}
          </Text>
        </View>
      )}

      {/* Transcription indicator */}
      {isTranscribing && (
        <View style={styles.transcriptionIndicator}>
          <Text style={styles.transcriptionText}>
            Transcrevendo...
          </Text>
        </View>
      )}

      {/* Audio button */}
      <TouchableOpacity
        style={[
          styles.audioButton,
          isRecording && styles.audioButtonRecording,
          (disabled || hasPermission === false) && styles.audioButtonDisabled,
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        disabled={disabled || hasPermission === false}
        delayLongPress={1000}
      >
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
          }}
        >
          <Feather
            name={getButtonIcon()}
            size={20}
            color={getButtonColor()}
          />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.error + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
  },
  recordingText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.error,
    fontFamily: 'monospace',
  },
  transcriptionIndicator: {
    backgroundColor: theme.colors.info + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  transcriptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.info,
    fontStyle: 'italic',
  },
  audioButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  audioButtonRecording: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.error + '10',
  },
  audioButtonDisabled: {
    borderColor: theme.colors.textSecondary,
    backgroundColor: theme.colors.background,
    opacity: 0.6,
  },
});