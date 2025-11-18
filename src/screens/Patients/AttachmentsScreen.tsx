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
  Linking,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { theme } from '@theme/index';
import { api } from '@services/api';
import { PatientsStackParamList } from '@/types/navigation';

type AttachmentsRouteProp = RouteProp<PatientsStackParamList, 'Attachments'>;

interface AttachmentRecord {
  identifier: string;
  patient: string;
  encounter?: string;
  type: string;
  date: string;
  blobname: string | null;
  filetype: string | null;
  context?: string;
  status: string;
  externallink?: string | null;
}

const HEADER_TOP_PADDING = Platform.OS === 'android'
  ? (StatusBar.currentHeight || 44)
  : 52;

// Filter categories (only base types for UI filters)
const ATTACHMENT_FILTER_CATEGORIES = [
  { key: 'all', label: 'Todos', icon: 'list' },
  { key: 'MEDREQUEST', label: 'Prescrição', icon: 'medkit' },
  { key: 'REQUEST', label: 'Solicitação', icon: 'file-text-o' },
  { key: 'REFERRAL', label: 'Encaminhamento', icon: 'share' },
  { key: 'ATESTADO', label: 'Atestado', icon: 'certificate' },
  { key: 'EXAM_RESULT', label: 'Resultado de Exame', icon: 'flask' },
  { key: 'LAB-RESULT', label: 'Resultado Lab', icon: 'flask' },
  { key: 'EXAM-REPORT', label: 'Relatório', icon: 'file-text-o' },
  { key: 'MEDICAL-CERTIFICATE', label: 'Atestado Médico', icon: 'certificate' },
  { key: 'EVB-JPG', label: 'Imagem', icon: 'image' },
  { key: 'EVB-PDF', label: 'PDF Externo', icon: 'file-pdf-o' },
  { key: 'MANUAL', label: 'Manual', icon: 'hand-o-up' },
];

// All attachment types including -SIGNED variants (for label lookups)
const ALL_ATTACHMENT_TYPES: { [key: string]: string } = {
  'MEDREQUEST': 'Prescrição',
  'MEDREQUEST-SIGNED': 'Prescrição',
  'REQUEST': 'Solicitação',
  'REQUEST-SIGNED': 'Solicitação',
  'REFERRAL': 'Encaminhamento',
  'REFERRAL-SIGNED': 'Encaminhamento',
  'ATESTADO': 'Atestado',
  'ATESTADO-SIGNED': 'Atestado',
  'EXAM_RESULT': 'Resultado de Exame',
  'LAB-RESULT': 'Resultado Lab',
  'EXAM-REPORT': 'Relatório',
  'MEDICAL-CERTIFICATE': 'Atestado Médico',
  'EVB-JPG': 'Imagem',
  'EVB-PDF': 'PDF Externo',
  'MANUAL': 'Manual',
};

export const AttachmentsScreen: React.FC = () => {
  const route = useRoute<AttachmentsRouteProp>();
  const navigation = useNavigation();
  const { patientCpf, patientName } = route.params;

  const [records, setRecords] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [downloadingAttachment, setDownloadingAttachment] = useState<{ [key: string]: boolean }>({});

  const ANDROID_READ_PERMISSION_FLAG = 1;

  const loadAttachments = async (pageNum: number = 1, append: boolean = false, type?: string) => {
    try {
      const ITEMS_PER_PAGE = 10;

      const options: any = {
        page: pageNum,
        limit: ITEMS_PER_PAGE,
      };

      const response = await api.getPatientAttachments(patientCpf, options);

      if (!response?.data || !Array.isArray(response.data)) {
        setRecords(append ? records : []);
        setHasMore(false);
        setTotalRecords(0);
        return;
      }

      // Filter by type if specified (include both base and -SIGNED variants)
      let filteredRecords = response.data;
      if (type && type !== 'all') {
        filteredRecords = response.data.filter((record: AttachmentRecord) => {
          // Match exact type or the signed variant
          return record.type === type || record.type === `${type}-SIGNED`;
        });
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
      console.error('[Attachments] Error loading attachments:', error);

      // Stop pagination on error to prevent infinite loops
      setHasMore(false);
      setLoadingMore(false);

      // Only show error on initial load, not on pagination
      if (!append) {
        Alert.alert('Erro', 'Não foi possível carregar os anexos');
      }
    }
  };

  const loadData = async () => {
    setLoading(true);
    await loadAttachments(1, false, selectedType);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadAttachments(1, false, selectedType);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || loading) return;

    setLoadingMore(true);
    try {
      await loadAttachments(page + 1, true, selectedType);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTypeFilter = async (type: string) => {
    setSelectedType(type);
    setPage(1);
    setLoading(true);
    await loadAttachments(1, false, type);
    setLoading(false);
  };

  const handleAttachmentPress = async (attachment: AttachmentRecord) => {
    const attachmentId = attachment.identifier || attachment.blobname || `${Date.now()}`;

    try {
      // Handle external links
      if (attachment?.externallink) {
        await Linking.openURL(attachment.externallink);
        return;
      }

      // Download and open blob files
      if (attachment?.blobname && attachment?.filetype) {
        // Set loading state
        setDownloadingAttachment(prev => ({ ...prev, [attachmentId]: true }));

        // Fetch the blob from the API
        const blobData = await api.downloadAttachmentBlob({
          blobname: attachment.blobname,
          type: attachment.type,
          filetype: attachment.filetype,
        });

        if (!blobData) {
          Alert.alert('Erro', 'Não foi possível baixar o anexo');
          setDownloadingAttachment(prev => ({ ...prev, [attachmentId]: false }));
          return;
        }

        // Save the file locally
        const filename = attachment.blobname || attachment.identifier || `attachment-${Date.now()}.pdf`;
        const fileUri = `${FileSystem.documentDirectory}${filename}`;

        await FileSystem.writeAsStringAsync(fileUri, blobData, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Clear loading state before navigation
        setDownloadingAttachment(prev => ({ ...prev, [attachmentId]: false }));

        // Open the file based on platform
        if (Platform.OS === 'android') {
          const contentUri = await FileSystem.getContentUriAsync(fileUri);
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: ANDROID_READ_PERMISSION_FLAG,
            type: attachment.filetype,
          });
        } else {
          // iOS: Navigate to PDF viewer screen
          navigation.navigate('PdfViewer' as any, {
            fileUri,
            fileName: filename,
            title: 'Anexo',
          });
        }
      } else {
        Alert.alert('Erro', 'Informações do anexo incompletas');
      }
    } catch (error) {
      console.error('[Attachments] Error opening attachment:', error);
      setDownloadingAttachment(prev => ({ ...prev, [attachmentId]: false }));
      Alert.alert('Erro', 'Não foi possível abrir o anexo');
    }
  };

  useEffect(() => {
    loadData();
  }, [patientCpf]);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFileIcon = (filetype: string | null): string => {
    if (!filetype) return 'file-o';

    const type = filetype.toLowerCase();

    // PDF
    if (type.includes('pdf')) return 'file-pdf-o';

    // Images
    if (type.includes('image') || type.includes('jpg') || type.includes('jpeg') ||
        type.includes('png') || type.includes('gif') || type.includes('bmp') ||
        type.includes('webp') || type.includes('tiff')) {
      return 'file-image-o';
    }

    // Documents
    if (type.includes('word') || type.includes('document') || type.includes('doc')) {
      return 'file-word-o';
    }

    // Spreadsheets
    if (type.includes('excel') || type.includes('spreadsheet') || type.includes('xls')) {
      return 'file-excel-o';
    }

    // Text files
    if (type.includes('text') || type.includes('txt') || type.includes('plain')) {
      return 'file-text-o';
    }

    // Videos
    if (type.includes('video') || type.includes('mp4') || type.includes('avi') ||
        type.includes('mov') || type.includes('wmv')) {
      return 'file-video-o';
    }

    // Audio
    if (type.includes('audio') || type.includes('mp3') || type.includes('wav') ||
        type.includes('ogg') || type.includes('flac')) {
      return 'file-audio-o';
    }

    // Archives
    if (type.includes('zip') || type.includes('rar') || type.includes('7z') ||
        type.includes('tar') || type.includes('gz')) {
      return 'file-archive-o';
    }

    // Code files
    if (type.includes('html') || type.includes('xml') || type.includes('json') ||
        type.includes('javascript') || type.includes('css')) {
      return 'file-code-o';
    }

    // URL/Links
    if (type.includes('url') || type === 'url') {
      return 'link';
    }

    return 'file-o';
  };

  const getFileTypeColor = (filetype: string | null): string => {
    if (!filetype) return theme.colors.textSecondary;

    const type = filetype.toLowerCase();

    // PDF - Red
    if (type.includes('pdf')) return '#dc3545'; // danger/red

    // Images - Cyan/Blue
    if (type.includes('image') || type.includes('jpg') || type.includes('jpeg') ||
        type.includes('png') || type.includes('gif') || type.includes('bmp') ||
        type.includes('webp') || type.includes('tiff')) {
      return '#17a2b8'; // info/cyan
    }

    // Documents - Blue
    if (type.includes('word') || type.includes('document') || type.includes('doc')) {
      return '#007bff'; // primary/blue
    }

    // Spreadsheets - Green
    if (type.includes('excel') || type.includes('spreadsheet') || type.includes('xls')) {
      return '#28a745'; // success/green
    }

    // Text files - Gray
    if (type.includes('text') || type.includes('txt') || type.includes('plain')) {
      return '#6c757d'; // secondary/gray
    }

    // Videos - Purple
    if (type.includes('video') || type.includes('mp4') || type.includes('avi') ||
        type.includes('mov') || type.includes('wmv')) {
      return '#6f42c1'; // purple
    }

    // Audio - Orange
    if (type.includes('audio') || type.includes('mp3') || type.includes('wav') ||
        type.includes('ogg') || type.includes('flac')) {
      return '#fd7e14'; // orange
    }

    // Archives - Dark Gray
    if (type.includes('zip') || type.includes('rar') || type.includes('7z') ||
        type.includes('tar') || type.includes('gz')) {
      return '#495057'; // dark gray
    }

    // Code files - Teal
    if (type.includes('html') || type.includes('xml') || type.includes('json') ||
        type.includes('javascript') || type.includes('css')) {
      return '#20c997'; // teal
    }

    // URL/Links - Primary Blue
    if (type.includes('url') || type === 'url') {
      return theme.colors.primary;
    }

    return theme.colors.textSecondary;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'MEDREQUEST':
      case 'MEDREQUEST-SIGNED':
        return theme.colors.primary;
      case 'REQUEST':
      case 'REQUEST-SIGNED':
      case 'EXAM-REPORT':
        return theme.colors.warning;
      case 'REFERRAL':
      case 'REFERRAL-SIGNED':
      case 'EVB-JPG':
        return theme.colors.info;
      case 'ATESTADO':
      case 'ATESTADO-SIGNED':
      case 'MEDICAL-CERTIFICATE':
        return theme.colors.textSecondary;
      case 'EXAM_RESULT':
      case 'LAB-RESULT':
        return theme.colors.success;
      case 'EVB-PDF':
        return theme.colors.error;
      case 'MANUAL':
        return theme.colors.textSecondary;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getTypeLabel = (type: string): string => {
    return ALL_ATTACHMENT_TYPES[type] || type;
  };

  const getFileTypeLabel = (filetype: string | null): string => {
    if (!filetype) return 'Tipo desconhecido';

    // Parse MIME types (e.g., "application/pdf" → "PDF")
    let normalizedType = filetype.toUpperCase();
    if (filetype.includes('/')) {
      // It's a MIME type
      const parts = filetype.split('/');
      const subtype = parts[1] || parts[0];
      normalizedType = subtype.toUpperCase();

      // Handle special cases
      if (normalizedType === 'MSWORD' || normalizedType.includes('WORDPROCESSINGML')) {
        return 'Documento Word';
      } else if (normalizedType === 'VND.MS-EXCEL' || normalizedType.includes('SPREADSHEETML')) {
        return 'Planilha Excel';
      } else if (normalizedType === 'OCTET-STREAM') {
        return 'Arquivo binário';
      } else if (normalizedType.includes('VND.') || normalizedType.includes('X-')) {
        // Clean up vendor-specific prefixes
        normalizedType = normalizedType.replace(/^(VND\.|X-)/, '');
      }
    }

    // Translate common formats to Portuguese
    const translations: { [key: string]: string } = {
      'PDF': 'PDF',
      'JPG': 'Imagem JPG',
      'JPEG': 'Imagem JPEG',
      'PNG': 'Imagem PNG',
      'GIF': 'Imagem GIF',
      'BMP': 'Imagem BMP',
      'WEBP': 'Imagem WEBP',
      'TIFF': 'Imagem TIFF',
      'TXT': 'Texto',
      'TEXT': 'Texto',
      'PLAIN': 'Texto',
      'HTML': 'HTML',
      'XML': 'XML',
      'JSON': 'JSON',
      'DOC': 'Documento Word',
      'DOCX': 'Documento Word',
      'XLS': 'Planilha Excel',
      'XLSX': 'Planilha Excel',
      'URL': 'Link externo',
      'ZIP': 'Arquivo ZIP',
      'RAR': 'Arquivo RAR',
      'MP4': 'Vídeo MP4',
      'AVI': 'Vídeo AVI',
      'MOV': 'Vídeo MOV',
      'MP3': 'Áudio MP3',
      'WAV': 'Áudio WAV',
    };

    return translations[normalizedType] || normalizedType;
  };

  const renderAttachmentCard = ({ item: record }: { item: AttachmentRecord }) => {
    const fileIcon = getFileIcon(record.filetype);
    const fileTypeColor = getFileTypeColor(record.filetype);
    const typeColor = getTypeColor(record.type);
    const attachmentId = record.identifier || record.blobname || '';
    const isDownloading = downloadingAttachment[attachmentId] || false;

    return (
      <TouchableOpacity
        style={styles.recordCard}
        onPress={() => handleAttachmentPress(record)}
        disabled={isDownloading}
        activeOpacity={0.7}
      >
        {/* Record Header */}
        <View style={styles.recordHeader}>
          <View style={styles.recordHeaderLeft}>
            <View style={[styles.recordIconContainer, { backgroundColor: fileTypeColor }]}>
              <FontAwesome name={fileIcon} size={16} color={theme.colors.white} />
            </View>
            <View style={styles.recordMainInfo}>
              <Text style={styles.recordTitle}>{record.identifier}</Text>
            </View>
          </View>

          <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
            <Text style={styles.typeBadgeText}>{getTypeLabel(record.type)}</Text>
          </View>
        </View>

        {/* Record Details */}
        <View style={styles.recordDetails}>
          <View style={styles.recordDetailRow}>
            <FontAwesome name="calendar" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.recordDetailText}>{formatDateTime(record.date)}</Text>
          </View>

          <View style={styles.recordDetailRow}>
            <FontAwesome name={getFileIcon(record.filetype)} size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.recordDetailText}>{getFileTypeLabel(record.filetype)}</Text>
          </View>

          {record.encounter && (
            <View style={styles.recordDetailRow}>
              <FontAwesome name="user-md" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.recordDetailText}>Encontro: {record.encounter}</Text>
            </View>
          )}

          {record.context && (
            <View style={styles.recordDetailRow}>
              <FontAwesome name="info-circle" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.recordDetailText}>Contexto: {record.context}</Text>
            </View>
          )}
        </View>

        {/* Loading Indicator */}
        {isDownloading && (
          <View style={styles.downloadingOverlay}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.downloadingText}>Baixando...</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    let icon = 'paperclip';
    let iconColor = theme.colors.textSecondary;
    let title = 'Nenhum Anexo Encontrado';
    let description = 'Não há anexos disponíveis para este paciente.';

    switch (selectedType) {
      case 'MEDREQUEST':
        icon = 'medkit';
        iconColor = theme.colors.primary;
        title = 'Nenhuma Prescrição';
        description = 'Este paciente não possui prescrições anexadas.';
        break;
      case 'REQUEST':
        icon = 'file-text-o';
        iconColor = theme.colors.warning;
        title = 'Nenhuma Solicitação';
        description = 'Este paciente não possui solicitações anexadas.';
        break;
      case 'REFERRAL':
        icon = 'share';
        iconColor = theme.colors.info;
        title = 'Nenhum Encaminhamento';
        description = 'Não há encaminhamentos registrados para este paciente.';
        break;
      case 'ATESTADO':
        icon = 'certificate';
        iconColor = theme.colors.textSecondary;
        title = 'Nenhum Atestado';
        description = 'Este paciente não possui atestados anexados.';
        break;
      case 'EXAM_RESULT':
        icon = 'flask';
        iconColor = theme.colors.success;
        title = 'Nenhum Resultado de Exame';
        description = 'Não há resultados de exames anexados.';
        break;
      case 'LAB-RESULT':
        icon = 'flask';
        iconColor = theme.colors.success;
        title = 'Nenhum Resultado Lab';
        description = 'Não há resultados laboratoriais anexados.';
        break;
      case 'EXAM-REPORT':
        icon = 'file-text-o';
        iconColor = theme.colors.warning;
        title = 'Nenhum Relatório';
        description = 'Não há relatórios anexados.';
        break;
      case 'MEDICAL-CERTIFICATE':
        icon = 'certificate';
        iconColor = theme.colors.textSecondary;
        title = 'Nenhum Atestado Médico';
        description = 'Não há atestados médicos anexados.';
        break;
      case 'EVB-JPG':
        icon = 'image';
        iconColor = theme.colors.info;
        title = 'Nenhuma Imagem';
        description = 'Não há imagens anexadas.';
        break;
      case 'EVB-PDF':
        icon = 'file-pdf-o';
        iconColor = theme.colors.error;
        title = 'Nenhum PDF Externo';
        description = 'Não há arquivos PDF externos anexados.';
        break;
      case 'MANUAL':
        icon = 'hand-o-up';
        iconColor = theme.colors.textSecondary;
        title = 'Nenhum Anexo Manual';
        description = 'Não há anexos manuais registrados.';
        break;
    }

    return (
      <View style={styles.emptyStateContainer}>
        <View style={[styles.emptyStateIconContainer, { backgroundColor: iconColor + '15' }]}>
          <FontAwesome name={icon} size={48} color={iconColor} />
        </View>
        <Text style={styles.emptyStateTitle}>{title}</Text>
        <Text style={styles.emptyStateText}>{description}</Text>
        {selectedType !== 'all' && (
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => handleTypeFilter('all')}
          >
            <FontAwesome name="list" size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.emptyStateButtonText}>Ver Todos os Anexos</Text>
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
        <Text style={styles.loadingText}>Carregando anexos...</Text>
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
              <Text style={styles.headerTitle}>Anexos</Text>
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
            {ATTACHMENT_FILTER_CATEGORIES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.filterChip,
                  selectedType === type.key && styles.filterChipActive,
                ]}
                onPress={() => handleTypeFilter(type.key)}
              >
                <FontAwesome
                  name={type.icon}
                  size={14}
                  color={selectedType === type.key ? theme.colors.white : theme.colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[
                  styles.filterChipText,
                  selectedType === type.key && styles.filterChipTextActive,
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Records List */}
        <FlatList
          data={records}
          renderItem={renderAttachmentCard}
          keyExtractor={(item) => item.identifier}
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
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
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
  downloadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
  },
  downloadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
