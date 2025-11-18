import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  FlatList,
  Image,
  Modal,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { theme } from '@theme/index';
import { api } from '@services/api';
import { useAuthStore } from '@store/authStore';
import { API_BASE_URL } from '@config/environment';
import { PatientsStackParamList } from '@/types/navigation';

type RecordingsRouteProp = RouteProp<PatientsStackParamList, 'Recordings'>;

interface TranscriptSegment {
  persona: string;
  speaker: string;
  textpart: string;
  timestamp: string;
}

interface RecordingRecord {
  enc_id: string;
  sequence: number;
  title: string;
  date: string;
  duration: number;
  rec_file: string;
  transcript?: TranscriptSegment[] | null;
  status: 'completed' | 'processing';
  encounterClass?: string;
  encounterStatus?: string;
  recordingId: string;
  url: string;
}

const HEADER_TOP_PADDING = Platform.OS === 'android'
  ? (StatusBar.currentHeight || 44)
  : 52;

const STATUS_FILTERS = [
  { key: 'all', label: 'Todas', icon: 'list' },
  { key: 'completed', label: 'Completas', icon: 'check-circle' },
  { key: 'processing', label: 'Processando', icon: 'spinner' },
];

export const RecordingsScreen: React.FC = () => {
  const route = useRoute<RecordingsRouteProp>();
  const navigation = useNavigation();
  const { patientCpf, patientName } = route.params;
  const { token } = useAuthStore();

  const [records, setRecords] = useState<RecordingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Audio playback state (using expo-audio hook)
  const audioPlayer = useAudioPlayer();
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState<string | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);

  // Transcript viewer state
  const [selectedTranscript, setSelectedTranscript] = useState<RecordingRecord | null>(null);

  const loadRecordings = async (pageNum: number = 1, append: boolean = false, status?: string) => {
    try {
      const ITEMS_PER_PAGE = 10;

      const options: any = {
        page: pageNum,
        limit: ITEMS_PER_PAGE,
      };

      const response = await api.getPatientRecordings(patientCpf, options);

      if (!response?.data || !Array.isArray(response.data)) {
        setRecords(append ? records : []);
        setHasMore(false);
        setTotalRecords(0);
        return;
      }

      // Filter by status if specified
      let filteredRecords = response.data;
      if (status && status !== 'all') {
        filteredRecords = response.data.filter((record: RecordingRecord) => record.status === status);
      }

      // Sort records by date (most recent first)
      const sortedRecords = [...filteredRecords].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      if (append) {
        setRecords(prev => [...prev, ...sortedRecords]);
      } else {
        setRecords(sortedRecords);
      }

      // Update total count and pagination state
      setTotalRecords(response.total || 0);
      setHasMore(response.data.length === ITEMS_PER_PAGE);
      setPage(pageNum);

    } catch (error) {
      console.error('[Recordings] Error loading recordings:', error);

      // Stop pagination on error to prevent infinite loops
      setHasMore(false);
      setLoadingMore(false);

      // Only show error on initial load, not on pagination
      if (!append) {
        Alert.alert('Erro', 'Não foi possível carregar as gravações');
      }
    }
  };

  const loadData = async () => {
    setLoading(true);
    await loadRecordings(1, false, selectedStatus);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadRecordings(1, false, selectedStatus);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || loading) return;

    setLoadingMore(true);
    try {
      await loadRecordings(page + 1, true, selectedStatus);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleStatusFilter = async (status: string) => {
    setSelectedStatus(status);
    setPage(1);
    setLoading(true);
    await loadRecordings(1, false, status);
    setLoading(false);
  };

  // Audio playback functions using expo-audio
  const playRecording = async (recording: RecordingRecord) => {
    try {
      setIsLoadingAudio(recording.recordingId);

      const audioUrl = `${API_BASE_URL}${recording.url}`;

      // Download audio file with auth headers if not already cached
      const fileName = `recording_${recording.recordingId}.wav`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      // Check if file exists in cache
      const fileInfo = await FileSystem.getInfoAsync(fileUri);

      if (!fileInfo.exists || currentAudioUrl !== audioUrl) {
        console.log('[Recordings] Downloading audio from:', audioUrl);

        // Download with auth headers
        const downloadResult = await FileSystem.downloadAsync(
          audioUrl,
          fileUri,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        console.log('[Recordings] Download complete:', downloadResult.uri);

        // Load the downloaded file into the player
        audioPlayer.replace(downloadResult.uri);
        setCurrentAudioUrl(audioUrl);
      } else if (currentAudioUrl !== audioUrl) {
        // File exists in cache, use it
        console.log('[Recordings] Using cached audio file:', fileUri);
        audioPlayer.replace(fileUri);
        setCurrentAudioUrl(audioUrl);
      }

      // Play the audio
      audioPlayer.play();
      setPlayingRecordingId(recording.recordingId);
      setIsLoadingAudio(null);
    } catch (error) {
      console.error('[Recordings] Error playing audio:', error);
      Alert.alert('Erro', 'Não foi possível reproduzir a gravação');
      setIsLoadingAudio(null);
    }
  };

  const pauseRecording = () => {
    audioPlayer.pause();
    setPlayingRecordingId(null);
  };

  const resumeRecording = (recordingId: string) => {
    audioPlayer.play();
    setPlayingRecordingId(recordingId);
  };

  const stopRecording = () => {
    audioPlayer.pause();
    audioPlayer.seekTo(0);
    setPlayingRecordingId(null);
  };

  // Monitor playback completion
  useEffect(() => {
    if (!audioStatus.playing && audioStatus.currentTime >= audioStatus.duration && audioStatus.duration > 0) {
      setPlayingRecordingId(null);
    }
  }, [audioStatus.playing, audioStatus.currentTime, audioStatus.duration]);

  useEffect(() => {
    loadData();
  }, [patientCpf]);

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatPlaybackTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return theme.colors.success;
      case 'processing':
        return theme.colors.warning;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'Completa';
      case 'processing':
        return 'Processando';
      default:
        return status;
    }
  };

  const getEncounterClassLabel = (encounterClass?: string): string => {
    switch (encounterClass) {
      case 'AMB':
        return 'Ambulatorial';
      case 'VR':
        return 'Virtual';
      case 'HH':
        return 'Domiciliar';
      default:
        return encounterClass || 'N/A';
    }
  };

  const renderRecordingCard = ({ item: record }: { item: RecordingRecord }) => {
    const statusColor = getStatusColor(record.status);
    const isProcessing = record.status === 'processing';

    return (
      <View style={styles.recordCard}>
        {/* Record Header */}
        <View style={styles.recordHeader}>
          <View style={styles.recordHeaderLeft}>
            <View style={[styles.recordIconContainer, { backgroundColor: statusColor }]}>
              <FontAwesome
                name={isProcessing ? 'spinner' : 'microphone'}
                size={16}
                color={theme.colors.white}
              />
            </View>
            <View style={styles.recordMainInfo}>
              <Text style={styles.recordTitle} numberOfLines={2}>
                {record.title}
              </Text>
              <Text style={styles.recordId}>#{record.recordingId}</Text>
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusBadgeText}>{getStatusLabel(record.status)}</Text>
          </View>
        </View>

        {/* Record Details */}
        <View style={styles.recordDetails}>
          <View style={styles.recordDetailRow}>
            <FontAwesome name="calendar" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.recordDetailText}>{formatDateTime(record.date)}</Text>
          </View>

          <View style={styles.recordDetailRow}>
            <FontAwesome name="clock-o" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.recordDetailText}>Duração: {formatDuration(record.duration)}</Text>
          </View>

          <View style={styles.recordDetailRow}>
            <FontAwesome name="stethoscope" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.recordDetailText}>Encontro: {record.enc_id}</Text>
          </View>

          {record.encounterClass && (
            <View style={styles.recordDetailRow}>
              <FontAwesome name="hospital-o" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.recordDetailText}>Tipo: {getEncounterClassLabel(record.encounterClass)}</Text>
            </View>
          )}

          {record.encounterStatus && (
            <View style={styles.recordDetailRow}>
              <FontAwesome name="info-circle" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.recordDetailText}>
                Status: {record.encounterStatus === 'finished' ? 'Finalizado' : 'Em andamento'}
              </Text>
            </View>
          )}
        </View>

        {/* Audio Playback Controls */}
        {record.status === 'completed' && (
          <View style={styles.playbackSection}>
            <View style={styles.playbackControls}>
              {isLoadingAudio === record.recordingId ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    if (playingRecordingId === record.recordingId) {
                      pauseRecording();
                    } else if (playingRecordingId && playingRecordingId !== record.recordingId) {
                      playRecording(record);
                    } else if (playingRecordingId) {
                      resumeRecording(record.recordingId);
                    } else {
                      playRecording(record);
                    }
                  }}
                  style={styles.playButton}
                >
                  <FontAwesome
                    name={playingRecordingId === record.recordingId ? 'pause' : 'play'}
                    size={18}
                    color={theme.colors.white}
                  />
                </TouchableOpacity>
              )}

              {playingRecordingId === record.recordingId && (
                <View style={styles.playbackInfo}>
                  <Text style={styles.playbackTime}>
                    {formatPlaybackTime(audioStatus.currentTime)} / {formatPlaybackTime(audioStatus.duration)}
                  </Text>
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${audioStatus.duration > 0 ? (audioStatus.currentTime / audioStatus.duration) * 100 : 0}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              )}

              {playingRecordingId === record.recordingId && (
                <TouchableOpacity onPress={stopRecording} style={styles.stopButton}>
                  <FontAwesome name="stop" size={16} color={theme.colors.error} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Transcript Preview Section */}
        {record.transcript && Array.isArray(record.transcript) && record.transcript.length > 0 && record.status === 'completed' && (
          <View style={styles.transcriptSection}>
            <View style={styles.transcriptHeader}>
              <FontAwesome name="file-text-o" size={12} color={theme.colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.transcriptHeaderText}>Transcrição:</Text>
            </View>
            <Text style={styles.transcriptText} numberOfLines={3}>
              {record.transcript.map(segment => segment.textpart).join(' ')}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedTranscript(record)}
              style={styles.viewTranscriptButton}
            >
              <Text style={styles.viewTranscriptButtonText}>Ver transcrição completa</Text>
              <FontAwesome name="chevron-right" size={12} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => {
    let icon = 'microphone';
    let iconColor = theme.colors.textSecondary;
    let title = 'Nenhuma Gravação Encontrada';
    let description = 'Não há gravações disponíveis para este paciente.';

    switch (selectedStatus) {
      case 'completed':
        icon = 'check-circle';
        iconColor = theme.colors.success;
        title = 'Nenhuma Gravação Completa';
        description = 'Este paciente não possui gravações completas.';
        break;
      case 'processing':
        icon = 'spinner';
        iconColor = theme.colors.warning;
        title = 'Nenhuma Gravação em Processamento';
        description = 'Não há gravações sendo processadas no momento.';
        break;
    }

    return (
      <View style={styles.emptyStateContainer}>
        <View style={[styles.emptyStateIconContainer, { backgroundColor: iconColor + '15' }]}>
          <FontAwesome name={icon} size={48} color={iconColor} />
        </View>
        <Text style={styles.emptyStateTitle}>{title}</Text>
        <Text style={styles.emptyStateText}>{description}</Text>
        {selectedStatus !== 'all' && (
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => handleStatusFilter('all')}
          >
            <FontAwesome name="list" size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.emptyStateButtonText}>Ver Todas as Gravações</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={[styles.footerLoaderText, { marginLeft: 8 }]}>Carregando mais...</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando gravações...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerBackground}>
          {/* Background Logo */}
          <Image
            source={require('../../assets/medpro-logo.png')}
            style={styles.backgroundLogo}
            resizeMode="contain"
          />
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Gravações</Text>
              <Text style={styles.headerSubtitle}>{patientName}</Text>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{totalRecords}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Filter Chips */}
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            {STATUS_FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.filterChip,
                  selectedStatus === filter.key && styles.filterChipActive,
                ]}
                onPress={() => handleStatusFilter(filter.key)}
              >
                <FontAwesome
                  name={filter.icon}
                  size={14}
                  color={selectedStatus === filter.key ? theme.colors.white : theme.colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[
                  styles.filterChipText,
                  selectedStatus === filter.key && styles.filterChipTextActive,
                ]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Records List */}
        <FlatList
          data={records}
          renderItem={renderRecordingCard}
          keyExtractor={(item) => item.recordingId}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyState}
        />
      </View>

      {/* Full Transcript Viewer Modal */}
      <Modal
        visible={selectedTranscript !== null}
        animationType="slide"
        onRequestClose={() => setSelectedTranscript(null)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeaderBackground}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setSelectedTranscript(null)}
                style={styles.modalCloseButton}
              >
                <FontAwesome name="times" size={20} color={theme.colors.white} />
              </TouchableOpacity>
              <View style={styles.modalHeaderContent}>
                <Text style={styles.modalTitle}>Transcrição Completa</Text>
                <Text style={styles.modalSubtitle}>{selectedTranscript?.title}</Text>
              </View>
            </View>
          </View>

          {/* Transcript Content */}
          <ScrollView style={styles.transcriptModal} contentContainerStyle={styles.transcriptModalContent}>
            {selectedTranscript?.transcript && Array.isArray(selectedTranscript.transcript) && (
              <>
                {selectedTranscript.transcript.map((segment, index) => (
                  <View key={index} style={styles.dialogueSegment}>
                    <View style={styles.dialogueHeader}>
                      <View style={[styles.speakerBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                        <FontAwesome name="user" size={12} color={theme.colors.primary} />
                        <Text style={styles.speakerName}>{segment.persona}</Text>
                      </View>
                      <Text style={styles.dialogueTimestamp}>
                        {new Date(segment.timestamp).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Text style={styles.dialogueText}>{segment.textpart}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerBackground: {
    backgroundColor: theme.colors.primary,
    paddingTop: HEADER_TOP_PADDING,
    paddingBottom: 20,
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backgroundLogo: {
    position: 'absolute',
    top: 20,
    right: -50,
    width: 200,
    height: 200,
    opacity: 0.1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.white,
    opacity: 0.9,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 40,
    alignItems: 'center',
  },
  countBadgeText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  filterContainer: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundSecondary,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
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
  recordCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recordHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  recordIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recordMainInfo: {
    flex: 1,
  },
  recordTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  recordId: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  recordDetails: {
    marginTop: 8,
  },
  recordDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  recordDetailText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  transcriptSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  transcriptHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  transcriptText: {
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyStateIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  emptyStateButtonText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerLoaderText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  // Playback controls styles
  playbackSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    padding: 8,
  },
  playbackInfo: {
    flex: 1,
  },
  playbackTime: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  viewTranscriptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 8,
    gap: 6,
  },
  viewTranscriptButtonText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeaderBackground: {
    backgroundColor: theme.colors.primary,
    paddingTop: HEADER_TOP_PADDING,
    paddingBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalCloseButton: {
    padding: 8,
    marginRight: 12,
  },
  modalHeaderContent: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  transcriptModal: {
    flex: 1,
  },
  transcriptModalContent: {
    padding: 16,
  },
  dialogueSegment: {
    marginBottom: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dialogueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  speakerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  speakerName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  dialogueTimestamp: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  dialogueText: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 22,
  },
});
