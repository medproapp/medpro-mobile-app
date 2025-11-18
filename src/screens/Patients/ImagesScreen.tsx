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
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import ImageViewing from 'react-native-image-viewing';
import { theme } from '@theme/index';
import { api } from '@services/api';
import { PatientsStackParamList } from '@/types/navigation';

type ImagesRouteProp = RouteProp<PatientsStackParamList, 'Images'>;

interface ImageRecord {
  Identifier: string;
  img_seq: number;
  subject: string;
  enc_id?: string;
  date: string;
  title: string;
  description?: string;
  Practitioner?: string;
  file: string; // Blobname for the image file
}

const HEADER_TOP_PADDING = Platform.OS === 'android'
  ? (StatusBar.currentHeight || 44)
  : 52;

export const ImagesScreen: React.FC = () => {
  const route = useRoute<ImagesRouteProp>();
  const navigation = useNavigation();
  const { patientCpf, patientName } = route.params;

  const [records, setRecords] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [imageCache, setImageCache] = useState<{ [key: number]: string | null }>({});
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImageIndex, setViewerImageIndex] = useState(0);

  const loadImageRecords = async (pageNum: number = 1, append: boolean = false) => {
    try {
      const ITEMS_PER_PAGE = 10;

      const options: any = {
        page: pageNum,
        limit: ITEMS_PER_PAGE,
      };

      const response = await api.getPatientImageRecords(patientCpf, options);

      if (!response?.data || !Array.isArray(response.data)) {
        setRecords(append ? records : []);
        setHasMore(false);
        setTotalRecords(0);
        return;
      }

      // Sort records by date (most recent first)
      const sortedRecords = [...response.data].sort((a, b) =>
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
      console.error('[Images] Error loading image records:', error);

      // Stop pagination on error to prevent infinite loops
      setHasMore(false);
      setLoadingMore(false);

      // Only show error on initial load, not on pagination
      if (!append) {
        Alert.alert('Erro', 'Não foi possível carregar as imagens');
      }
    }
  };

  const loadData = async () => {
    setLoading(true);
    await loadImageRecords(1, false);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadImageRecords(1, false);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || loading) return;

    setLoadingMore(true);
    try {
      await loadImageRecords(page + 1, true);
    } finally {
      setLoadingMore(false);
    }
  };

  const downloadImage = async (record: ImageRecord) => {
    // Skip if already cached (including null = failed)
    if (imageCache[record.img_seq] !== undefined) {
      return;
    }

    // Skip if no file/blobname
    if (!record.file) {
      setImageCache(prev => ({ ...prev, [record.img_seq]: null }));
      return;
    }

    try {
      const imageUri = await api.downloadImageBlob(record.file);
      setImageCache(prev => ({ ...prev, [record.img_seq]: imageUri }));
    } catch (error) {
      console.error('[Images] Error downloading image:', record.file, error);
      setImageCache(prev => ({ ...prev, [record.img_seq]: null }));
    }
  };

  // Download images for visible records
  useEffect(() => {
    records.forEach(record => {
      downloadImage(record);
    });
  }, [records]);

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

  const renderImageCard = ({ item: record, index }: { item: ImageRecord; index: number }) => {
    const imageUri = imageCache[record.img_seq];
    const isLoading = imageUri === undefined;
    const hasFailed = imageUri === null;

    return (
      <TouchableOpacity
        style={styles.recordCard}
        onPress={() => {
          if (imageUri && imageUri !== null) {
            setViewerImageIndex(index);
            setViewerVisible(true);
          }
        }}
        activeOpacity={0.7}
        disabled={!imageUri || imageUri === null}
      >
        {/* Image Preview */}
        <View style={styles.imagePreviewContainer}>
          {isLoading && (
            <View style={styles.imageLoadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.imageLoadingText}>Carregando imagem...</Text>
            </View>
          )}

          {hasFailed && (
            <View style={styles.imageErrorContainer}>
              <FontAwesome name="image" size={48} color={theme.colors.textSecondary} />
              <Text style={styles.imageErrorText}>Imagem não disponível</Text>
            </View>
          )}

          {imageUri && imageUri !== null && (
            <Image
              source={{ uri: imageUri }}
              style={styles.imagePreview}
              resizeMode="cover"
            />
          )}
        </View>

        {/* Record Header */}
        <View style={styles.recordHeader}>
          <View style={styles.recordHeaderLeft}>
            <View style={[styles.recordIconContainer, { backgroundColor: theme.colors.info }]}>
              <FontAwesome name="image" size={16} color={theme.colors.white} />
            </View>
            <View style={styles.recordMainInfo}>
              <Text style={styles.recordTitle} numberOfLines={2}>{record.title || 'Imagem'}</Text>
              <Text style={styles.recordId}>#{record.Identifier}</Text>
            </View>
          </View>
        </View>

        {/* Record Details */}
        <View style={styles.recordDetails}>
          <View style={styles.recordDetailRow}>
            <FontAwesome name="calendar" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.recordDetailText}>{formatDateTime(record.date)}</Text>
          </View>

          {record.enc_id && (
            <View style={styles.recordDetailRow}>
              <FontAwesome name="user-md" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.recordDetailText}>Encontro: {record.enc_id}</Text>
            </View>
          )}

          {record.Practitioner && (
            <View style={styles.recordDetailRow}>
              <FontAwesome name="stethoscope" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.recordDetailText}>{record.Practitioner}</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {record.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionTitle}>Descrição:</Text>
            <Text style={styles.descriptionText}>{record.description}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyStateContainer}>
        <View style={[styles.emptyStateIconContainer, { backgroundColor: theme.colors.info + '15' }]}>
          <FontAwesome name="image" size={48} color={theme.colors.info} />
        </View>
        <Text style={styles.emptyStateTitle}>Nenhuma Imagem</Text>
        <Text style={styles.emptyStateText}>
          Este paciente ainda não possui imagens registradas.
        </Text>
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
        <Text style={styles.loadingText}>Carregando imagens...</Text>
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
              <Text style={styles.headerTitle}>Imagens</Text>
              <Text style={styles.headerSubtitle}>{patientName}</Text>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{totalRecords}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Records List */}
        <FlatList
          data={records}
          renderItem={renderImageCard}
          keyExtractor={(item) => item.img_seq.toString()}
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

      {/* Full-Size Image Viewer with Zoom */}
      <ImageViewing
        images={records
          .map(record => {
            const uri = imageCache[record.img_seq];
            return uri && uri !== null ? { uri } : null;
          })
          .filter((img): img is { uri: string } => img !== null)}
        imageIndex={viewerImageIndex}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
        FooterComponent={({ imageIndex }) => {
          const record = records[imageIndex];
          return record ? (
            <View style={styles.viewerFooter}>
              <Text style={styles.viewerTitle}>{record.title || 'Imagem'}</Text>
              {record.description && (
                <Text style={styles.viewerDescription}>{record.description}</Text>
              )}
              <Text style={styles.viewerDate}>{formatDateTime(record.date)}</Text>
            </View>
          ) : null;
        }}
      />
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
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  recordId: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  imagePreviewContainer: {
    width: '100%',
    height: 200,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageLoadingContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  imageLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  imageErrorContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  imageErrorText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textSecondary,
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
  descriptionContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  descriptionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
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
  viewerFooter: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  viewerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 8,
  },
  viewerDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
    lineHeight: 20,
  },
  viewerDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
