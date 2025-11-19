import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Pdf from 'react-native-pdf';
import * as Sharing from 'expo-sharing';
import { theme } from '@theme/index';
import { PatientsStackParamList } from '@/types/navigation';
import { logger } from '@/utils/logger';

type PdfViewerRouteProp = RouteProp<PatientsStackParamList, 'PdfViewer'>;

const HEADER_TOP_PADDING = Platform.OS === 'android'
  ? (StatusBar.currentHeight || 44)
  : 52;

export const PdfViewerScreen: React.FC = () => {
  const route = useRoute<PdfViewerRouteProp>();
  const navigation = useNavigation();
  const { fileUri, fileName, title } = route.params;

  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const handleLoadComplete = (numberOfPages: number) => {
    logger.debug('[PdfViewer] PDF loaded successfully, pages:', numberOfPages);
    setNumPages(numberOfPages);
    setLoading(false);
  };

  const handlePageChanged = (page: number, numberOfPages: number) => {
    setCurrentPage(page);
  };

  const handleError = (error: any) => {
    logger.error('[PdfViewer] Error loading PDF:', error);
    setError('Erro ao carregar o PDF');
    setLoading(false);
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      const isAvailable = await Sharing.isAvailableAsync();

      if (!isAvailable) {
        Alert.alert('Erro', 'Compartilhamento não disponível neste dispositivo');
        setSharing(false);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: fileName || 'Prescrição',
      });

      setSharing(false);
    } catch (error) {
      logger.error('[PdfViewer] Error sharing PDF:', error);
      Alert.alert('Erro', 'Não foi possível compartilhar o PDF');
      setSharing(false);
    }
  };

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
              <Text style={styles.headerTitle} numberOfLines={1}>{title || 'PDF'}</Text>
              {fileName && (
                <Text style={styles.headerSubtitle} numberOfLines={1}>{fileName}</Text>
              )}
            </View>
            <View style={styles.headerRight}>
              {numPages > 0 && (
                <Text style={styles.pageCounter}>
                  {currentPage} / {numPages}
                </Text>
              )}
              <TouchableOpacity
                onPress={handleShare}
                style={styles.shareButton}
                disabled={sharing || loading || !!error}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <FontAwesome name="share-alt" size={18} color={theme.colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* PDF Viewer */}
        {error ? (
          <View style={styles.errorContainer}>
            <FontAwesome name="file-pdf-o" size={64} color={theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
              <Text style={styles.retryButtonText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Pdf
            source={{ uri: fileUri }}
            style={styles.pdf}
            onLoadComplete={handleLoadComplete}
            onPageChanged={handlePageChanged}
            onError={handleError}
            trustAllCerts={false}
            enablePaging={true}
            spacing={10}
            maxScale={3.0}
            minScale={1.0}
            scale={1.0}
            horizontal={false}
            fitPolicy={0}
            renderActivityIndicator={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Carregando PDF...</Text>
              </View>
            )}
          />
        )}
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
    paddingBottom: 16,
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
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
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
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pageCounter: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.white,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  shareButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdf: {
    flex: 1,
    backgroundColor: '#e0e0e0',
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
    padding: 32,
  },
  errorText: {
    marginTop: 24,
    fontSize: 16,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
