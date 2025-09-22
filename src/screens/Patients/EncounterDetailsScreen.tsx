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
  Linking,
  Image,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { api } from '@services/api';
import { PatientsStackParamList } from '@/types/navigation';

type EncounterDetailsRouteProp = RouteProp<PatientsStackParamList, 'EncounterDetails'>;

interface EncounterDetails {
  encounter: any;
  clinicalRecords: any[];
  medications: any[];
  diagnostics: any[];
  images: any[];
  attachments: any[];
}

export const EncounterDetailsScreen: React.FC = () => {
  const route = useRoute<EncounterDetailsRouteProp>();
  const navigation = useNavigation();
  const { encounterId, patientName } = route.params;

  const [encounterDetails, setEncounterDetails] = useState<EncounterDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'clinical' | 'medications' | 'diagnostics' | 'images' | 'attachments'>('clinical');

  const loadEncounterDetails = async () => {
    try {
      console.log('[EncounterDetails] Loading details for encounter:', encounterId);
      
      // Load all encounter data in parallel - handle errors gracefully
      const [clinicalResponse, medicationResponse, diagnosticResponse, imageResponse, attachmentResponse] = await Promise.allSettled([
        api.getEncounterClinicalRecords(encounterId, { limit: 50 }).catch(() => ({ data: [] })),
        api.getEncounterMedications('', encounterId, { limit: 50 }).catch(() => ({ data: [] })), // CPF not needed for this call
        api.getEncounterDiagnostics(encounterId).catch(() => []),
        api.getEncounterImages(encounterId).catch(() => []),
        api.getEncounterAttachments(encounterId).catch(() => []),
      ]);

      // Extract data from settled promises - all should be successful now
      const clinicalRecords = clinicalResponse.status === 'fulfilled' ? (clinicalResponse.value?.data || []) : [];
      const medications = medicationResponse.status === 'fulfilled' ? (medicationResponse.value?.data || []) : [];
      const diagnostics = diagnosticResponse.status === 'fulfilled' ? (Array.isArray(diagnosticResponse.value) ? diagnosticResponse.value : []) : [];
      const images = imageResponse.status === 'fulfilled' ? (Array.isArray(imageResponse.value) ? imageResponse.value : []) : [];
      const attachments = attachmentResponse.status === 'fulfilled' ? (Array.isArray(attachmentResponse.value) ? attachmentResponse.value : []) : [];

      // Get encounter basic info from the first available source
      const encounter = clinicalRecords[0] || medications[0] || diagnostics[0] || images[0] || { Identifier: encounterId };

      const details: EncounterDetails = {
        encounter,
        clinicalRecords,
        medications,
        diagnostics,
        images,
        attachments,
      };

      console.log('[EncounterDetails] Loaded encounter details:', {
        clinical: clinicalRecords.length,
        medications: medications.length,
        diagnostics: diagnostics.length,
        images: images.length,
        attachments: attachments.length,
      });

      setEncounterDetails(details);
    } catch (error) {
      console.error('[EncounterDetails] Error loading encounter details:', error);
      Alert.alert('Erro', 'Não foi possível carregar os detalhes do encontro');
    }
  };

  const loadData = async () => {
    setLoading(true);
    await loadEncounterDetails();
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEncounterDetails();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [encounterId]);

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

  const handleAttachmentPress = async (attachment: any) => {
    if (attachment.externallink) {
      try {
        await Linking.openURL(attachment.externallink);
      } catch (error) {
        Alert.alert('Erro', 'Não foi possível abrir o anexo');
      }
    } else {
      Alert.alert('Aviso', 'Link do anexo não disponível');
    }
  };

  const renderTabContent = () => {
    if (!encounterDetails) return null;

    switch (activeTab) {
      case 'clinical':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Registros Clínicos ({encounterDetails.clinicalRecords.length})</Text>
            {encounterDetails.clinicalRecords.length > 0 ? (
              encounterDetails.clinicalRecords.map((record: any, index: number) => (
                <View key={index} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <FontAwesome name="file-text-o" size={16} color={theme.colors.info} />
                    <Text style={styles.itemTitle}>
                      {record.clinicalType || 'ServiceRequest'} #{record.clinicalId}
                    </Text>
                  </View>
                  <Text style={styles.itemDate}>{formatDateTime(record.clinicalDate)}</Text>
                  <Text style={styles.itemStatus}>Status: {record.clinicalStatus}</Text>
                  {record.clinicalMetadata?.servicerequestCategory && (
                    <Text style={styles.itemCategory}>Categoria: {record.clinicalMetadata.servicerequestCategory}</Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.emptyMessage}>Nenhum registro clínico encontrado</Text>
            )}
          </View>
        );

      case 'medications':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Medicações ({encounterDetails.medications.length})</Text>
            {encounterDetails.medications.length > 0 ? (
              encounterDetails.medications.map((med: any, index: number) => (
                <View key={index} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <FontAwesome name="medkit" size={16} color={theme.colors.success} />
                    <Text style={styles.itemTitle}>Prescrição #{med.medId}</Text>
                  </View>
                  <Text style={styles.itemDate}>{formatDateTime(med.medDate)}</Text>
                  <Text style={styles.itemStatus}>Status: {med.medStatus}</Text>
                  {med.medRequestItens && med.medRequestItens.length > 0 && (
                    <View style={styles.medicationItems}>
                      {med.medRequestItens.map((item: any, itemIndex: number) => (
                        <View key={itemIndex} style={styles.medicationItem}>
                          <Text style={styles.medicationName}>{item.productName}</Text>
                          <Text style={styles.medicationDosage}>Posologia: {item.posology}</Text>
                          <Text style={styles.medicationRegistry}>Registro: {item.registry}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.emptyMessage}>Nenhuma medicação encontrada</Text>
            )}
          </View>
        );

      case 'diagnostics':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Diagnósticos ({encounterDetails.diagnostics.length})</Text>
            {encounterDetails.diagnostics.length > 0 ? (
              encounterDetails.diagnostics.map((diag: any, index: number) => (
                <View key={index} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <FontAwesome name="stethoscope" size={16} color={theme.colors.warning} />
                    <Text style={styles.itemTitle}>Diagnóstico #{diag.identifier}</Text>
                  </View>
                  <Text style={styles.itemDate}>{formatDateTime(diag.effectiveDateTime)}</Text>
                  <Text style={styles.itemStatus}>Status: {diag.status}</Text>
                  <Text style={styles.itemCategory}>Categoria: {diag.category_code}</Text>
                  {diag.conclusion && (
                    <View style={styles.conclusionContainer}>
                      <Text style={styles.conclusionTitle}>Conclusão:</Text>
                      <Text style={styles.conclusionText}>{diag.conclusion}</Text>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.emptyMessage}>Nenhum diagnóstico encontrado</Text>
            )}
          </View>
        );

      case 'images':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Imagens ({encounterDetails.images.length})</Text>
            {encounterDetails.images.length > 0 ? (
              encounterDetails.images.map((image: any, index: number) => (
                <View key={index} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <FontAwesome name="picture-o" size={16} color={theme.colors.primary} />
                    <Text style={styles.itemTitle}>{image.file}</Text>
                  </View>
                  <Text style={styles.itemDate}>{formatDateTime(image.date)}</Text>
                  {image.title && <Text style={styles.imageTitle}>Título: {image.title}</Text>}
                  {image.description && <Text style={styles.imageDescription}>Descrição: {image.description}</Text>}
                </View>
              ))
            ) : (
              <Text style={styles.emptyMessage}>Nenhuma imagem encontrada</Text>
            )}
          </View>
        );

      case 'attachments':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Anexos ({encounterDetails.attachments.length})</Text>
            {encounterDetails.attachments.length > 0 ? (
              encounterDetails.attachments.map((attachment: any, index: number) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.itemCard}
                  onPress={() => handleAttachmentPress(attachment)}
                >
                  <View style={styles.itemHeader}>
                    <FontAwesome name="paperclip" size={16} color={theme.colors.textSecondary} />
                    <Text style={styles.itemTitle}>{attachment.identifier}</Text>
                    {attachment.externallink && (
                      <FontAwesome name="external-link" size={12} color={theme.colors.primary} />
                    )}
                  </View>
                  <Text style={styles.itemDate}>{formatDateTime(attachment.date)}</Text>
                  <Text style={styles.itemType}>Tipo: {attachment.type}</Text>
                  <Text style={styles.itemFileType}>Formato: {attachment.filetype}</Text>
                  {attachment.file_size && (
                    <Text style={styles.itemSize}>Tamanho: {(attachment.file_size / 1024).toFixed(1)} KB</Text>
                  )}
                  {attachment.metadata?.aiAnalysis?.summary && (
                    <View style={styles.aiAnalysisContainer}>
                      <Text style={styles.aiAnalysisTitle}>Análise IA:</Text>
                      <Text style={styles.aiAnalysisText}>{attachment.metadata.aiAnalysis.summary}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyMessage}>Nenhum anexo encontrado</Text>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Image 
          source={require('../../assets/medpro-logo.png')} 
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loadingSpinner} />
        <Text style={styles.loadingText}>Carregando detalhes do encontro...</Text>
      </View>
    );
  }

  const tabs = [
    { key: 'clinical', label: 'Clínicos', icon: 'file-text-o', count: encounterDetails?.clinicalRecords.length || 0 },
    { key: 'medications', label: 'Medicações', icon: 'medkit', count: encounterDetails?.medications.length || 0 },
    { key: 'diagnostics', label: 'Diagnósticos', icon: 'stethoscope', count: encounterDetails?.diagnostics.length || 0 },
    { key: 'images', label: 'Imagens', icon: 'picture-o', count: encounterDetails?.images.length || 0 },
    { key: 'attachments', label: 'Anexos', icon: 'paperclip', count: encounterDetails?.attachments.length || 0 },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <FontAwesome name="arrow-left" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Encontro #{encounterId}</Text>
          <Text style={styles.headerSubtitle}>{patientName}</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView 
        horizontal 
        style={styles.tabsContainer} 
        showsHorizontalScrollIndicator={false}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <FontAwesome 
              name={tab.icon} 
              size={16} 
              color={activeTab === tab.key ? theme.colors.white : theme.colors.textSecondary} 
            />
            <Text style={[
              styles.tabText,
              activeTab === tab.key && styles.activeTabText
            ]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[styles.tabBadge, activeTab === tab.key && styles.activeTabBadge]}>
                <Text style={[styles.tabBadgeText, activeTab === tab.key && styles.activeTabBadgeText]}>
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderTabContent()}
      </ScrollView>
    </View>
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
  loadingLogo: {
    width: 80,
    height: 80,
    marginBottom: 24,
  },
  loadingSpinner: {
    marginVertical: 16,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  tabsContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    backgroundColor: theme.colors.primary,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  activeTabText: {
    color: theme.colors.white,
  },
  tabBadge: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  activeTabBadge: {
    backgroundColor: theme.colors.white,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  activeTabBadgeText: {
    color: theme.colors.primary,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  tabTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 16,
  },
  itemCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  itemDate: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  itemStatus: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  itemType: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  itemFileType: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  itemSize: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  medicationItems: {
    marginTop: 8,
    gap: 8,
  },
  medicationItem: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: 12,
    borderRadius: 6,
  },
  medicationName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  medicationDosage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  medicationRegistry: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: 'monospace',
  },
  conclusionContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 6,
  },
  conclusionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  conclusionText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  imageTitle: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 4,
  },
  imageDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  aiAnalysisContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  aiAnalysisTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  aiAnalysisText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  emptyMessage: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 40,
    fontStyle: 'italic',
  },
});