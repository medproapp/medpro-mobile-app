import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { RouteProp, useNavigation, useRoute, NavigationProp } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { PatientsStackParamList } from '@/types/navigation';
import {
  translateClinicalType,
  translateClinicalStatus,
  translateClinicalCategory,
  formatClinicalDateTime,
  getStatusBadgeStyle,
} from '@/utils/clinical';
import { api } from '@services/api';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';

const ANDROID_READ_PERMISSION_FLAG = 0x00000001; // FLAG_GRANT_READ_URI_PERMISSION

const HEADER_TOP_PADDING = Platform.OS === 'android'
  ? (StatusBar.currentHeight || 44)
  : 52;

type ClinicalRecordRouteProp = RouteProp<PatientsStackParamList, 'ClinicalRecordDetails'>;

interface ClinicalMetadataItem {
  procedimento?: string;
  grupo?: string;
  subgrupo?: string;
  capitulo?: string;
  itemNote?: string;
  dado1?: string;
  dado2?: string;
  dado3?: string;
  dado4?: string;
  dado5?: string;
  dado6?: string;
  dado7?: string;
  dado8?: string;
  dado9?: string;
  [key: string]: any;
}

export const ClinicalRecordDetailsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<PatientsStackParamList>>();
  const route = useRoute<ClinicalRecordRouteProp>();
  const { clinicalRecord, patientName, patientCpf } = route.params;

  const clinicalId = clinicalRecord?.clinicalId || clinicalRecord?.identifier;

  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState<boolean>(false);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);

  const metadata = useMemo(() => {
    const rawMetadata = clinicalRecord?.clinicalMetadata ?? clinicalRecord?.metadata ?? {};
    if (!rawMetadata) return {};

    if (typeof rawMetadata === 'string') {
      try {
        return JSON.parse(rawMetadata);
      } catch (error) {
        console.warn('[ClinicalRecordDetails] Failed to parse metadata string:', error);
        return {};
      }
    }

    return rawMetadata;
  }, [clinicalRecord]);

  const items: ClinicalMetadataItem[] = Array.isArray(metadata?.items) ? metadata.items : [];

  const typeLabel = translateClinicalType(clinicalRecord?.clinicalType || clinicalRecord?.type) || 'Solicitação';
  const statusLabel = translateClinicalStatus(clinicalRecord?.clinicalStatus || clinicalRecord?.status) || '—';
  const categoryLabel = translateClinicalCategory(
    metadata?.servicerequestCategory || metadata?.category || clinicalRecord?.clinicalCategory,
  );
  const authoredOn = formatClinicalDateTime(clinicalRecord?.clinicalDate || clinicalRecord?.date);

  const statusBadge = getStatusBadgeStyle(clinicalRecord?.clinicalStatus || clinicalRecord?.status);

  const translateGroupLabel = (value?: string | null): string | null => {
    if (!value) return null;
    const normalized = value.toString().trim().toUpperCase();
    const dictionary: Record<string, string> = {
      LAB: 'Laboratório',
      CLI: 'Clínico',
      PROC: 'Procedimentos',
      IMG: 'Imagem',
      IMAG: 'Imagem',
      EXA: 'Exames',
    };

    return dictionary[normalized] || value;
  };

  const translateModalityLabel = (value?: string | null): string | null => {
    if (!value) return null;
    const normalized = value.toString().trim().toUpperCase();
    const dictionary: Record<string, string> = {
      AMB: 'Ambulatorial',
      HOS: 'Hospitalar',
      DOM: 'Domiciliar',
      EMG: 'Emergencial',
      URG: 'Urgência',
      REF: 'Referência',
    };

    return dictionary[normalized] || value;
  };

  const formatContentTypeLabel = (contentType?: string | null, filename?: string | null): string | null => {
    const mime = (contentType || '').toLowerCase();
    const name = filename || '';

    const extensionMatch = name.match(/\.([a-z0-9]+)$/i);
    if (extensionMatch) {
      const ext = extensionMatch[1].toLowerCase();
      const extDictionary: Record<string, string> = {
        pdf: 'PDF',
        doc: 'Word',
        docx: 'Word',
        xls: 'Excel',
        xlsx: 'Excel',
        ppt: 'PowerPoint',
        pptx: 'PowerPoint',
        jpg: 'Imagem (JPG)',
        jpeg: 'Imagem (JPEG)',
        png: 'Imagem (PNG)',
        gif: 'Imagem (GIF)',
        bmp: 'Imagem (BMP)',
        tiff: 'Imagem (TIFF)',
        mp3: 'Áudio (MP3)',
        wav: 'Áudio (WAV)',
        mp4: 'Vídeo (MP4)',
        mov: 'Vídeo (MOV)',
        txt: 'Texto',
        json: 'JSON',
        xml: 'XML',
        zip: 'ZIP',
        rar: 'RAR',
      };

      if (extDictionary[ext]) {
        return extDictionary[ext];
      }
      return ext.toUpperCase();
    }

    const mimeDictionary: Record<string, string> = {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
      'application/msword': 'Word',
      'application/vnd.ms-excel': 'Excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
      'application/vnd.ms-powerpoint': 'PowerPoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
      'image/jpeg': 'Imagem (JPEG)',
      'image/png': 'Imagem (PNG)',
      'image/gif': 'Imagem (GIF)',
      'image/bmp': 'Imagem (BMP)',
      'image/tiff': 'Imagem (TIFF)',
      'audio/mpeg': 'Áudio (MP3)',
      'audio/wav': 'Áudio (WAV)',
      'video/mp4': 'Vídeo (MP4)',
      'video/quicktime': 'Vídeo (MOV)',
      'text/plain': 'Texto',
      'application/json': 'JSON',
      'application/xml': 'XML',
    };

    if (mime && mimeDictionary[mime]) {
      return mimeDictionary[mime];
    }

    return mime || null;
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const formatFileSize = (bytes?: number | null): string | null => {
    if (bytes === undefined || bytes === null) return null;
    const size = Number(bytes);
    if (Number.isNaN(size) || size <= 0) return null;

    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let value = size;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const resolveExtension = (attachment: any): string => {
    const fromFilename = attachment?.suggestedFilename || attachment?.blobname;
    if (fromFilename && fromFilename.includes('.')) {
      return fromFilename.slice(fromFilename.lastIndexOf('.'));
    }

    const mime = attachment?.contentType || attachment?.filetype;
    if (typeof mime === 'string') {
      const [, subtype] = mime.split('/');
      if (subtype) {
        return `.${subtype.split(';')[0]}`;
      }
    }

    return '.dat';
  };

  const handleAttachmentPress = async (attachment: any) => {
    try {
      if (attachment?.externallink) {
        await Linking.openURL(attachment.externallink);
        return;
      }

      if (attachment?.blob && attachment?.contentType) {
        const filename = attachment?.suggestedFilename
          || attachment?.blobname
          || `${attachment?.identifier || 'anexo'}${resolveExtension(attachment)}`;
        const extension = resolveExtension(attachment);
        const safeIdentifier = (attachment?.identifier || 'anexo')
          .toString()
          .replace(/[^a-zA-Z0-9-_]/g, '_');
        const filePath = `${FileSystem.cacheDirectory}${safeIdentifier}${extension}`;

        await FileSystem.writeAsStringAsync(filePath, attachment.blob, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (Platform.OS === 'android') {
          const contentUri = await FileSystem.getContentUriAsync(filePath);

          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            type: attachment.contentType,
            flags: ANDROID_READ_PERMISSION_FLAG,
          });
        } else {
          const sharingAvailable = await Sharing.isAvailableAsync();

          if (sharingAvailable) {
            await Sharing.shareAsync(filePath, {
              mimeType: attachment.contentType,
              dialogTitle: filename,
            });
          } else {
            const canOpen = await Linking.canOpenURL(filePath);
            if (canOpen) {
              await Linking.openURL(filePath);
            } else {
              Alert.alert('Anexo', 'Não foi possível abrir o arquivo neste dispositivo.');
            }
          }
        }
        return;
      }

      const errorMessage = attachment?.blobError
        ? `Arquivo indisponível: ${attachment.blobError}`
        : 'Arquivo indisponível para visualização.';
      Alert.alert('Anexo indisponível', errorMessage);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível abrir o anexo.');
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchAttachments = async () => {
      if (!clinicalId) {
        setAttachments([]);
        setAttachmentsError(null);
        return;
      }

      setAttachmentsLoading(true);
      setAttachmentsError(null);

      try {
        const response = await api.getClinicalRecordAttachments(clinicalId);
        if (!isMounted) return;

        const payload = response?.attachments ?? response?.data?.attachments ?? [];
        const normalized = Array.isArray(payload) ? payload : [];
        setAttachments(normalized);
      } catch (error: any) {
        if (!isMounted) return;

        const status = error?.response?.status;
        if (status === 404) {
          setAttachmentsError('Registro clínico não encontrado.');
          setAttachments([]);
        } else {
          const message = error?.response?.data?.error || 'Erro ao carregar anexos.';
          setAttachmentsError(message);
        }
      } finally {
        if (isMounted) {
          setAttachmentsLoading(false);
        }
      }
    };

    fetchAttachments();

    return () => {
      isMounted = false;
    };
  }, [clinicalId]);

  const renderMetaRow = (icon: string, label: string, value?: string | null) => {
    if (!value) return null;

    return (
      <View style={styles.metaRow}>
        <FontAwesome name={icon} size={14} color={theme.colors.textSecondary} />
        <Text style={styles.metaLabel}>{label}:</Text>
        <Text style={styles.metaValue}>{value}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.headerBackground}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <FontAwesome name="chevron-left" size={18} color={theme.colors.white} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{typeLabel} #{clinicalRecord?.clinicalId || clinicalRecord?.identifier}</Text>
            <Text style={styles.headerSubtitle}>{patientName} • CPF {patientCpf}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, statusBadge.container]}>
                <FontAwesome name={statusBadge.icon} size={12} color={statusBadge.iconColor} />
                <Text style={[styles.badgeText, { color: statusBadge.textColor }]}>
                  {statusLabel}
                </Text>
              </View>
              {categoryLabel ? (
                <View style={[styles.badge, styles.badgeNeutral]}>
                  <FontAwesome name="folder-open" size={12} color={theme.colors.primary} />
                  <Text style={styles.badgeText}>{categoryLabel}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Informações da Solicitação</Text>
          {renderMetaRow('calendar', 'Data', authoredOn)}
          {renderMetaRow('user-md', 'Profissional', clinicalRecord?.practitionerName)}
          {renderMetaRow('bookmark', 'Prioridade', metadata?.servicerequestPriority)}
          {renderMetaRow('bullseye', 'Intenção', metadata?.servicerequestIntent)}
          {renderMetaRow('clock-o', 'Agendamento', metadata?.servicerequestOccurrence)}
          {renderMetaRow('shield', 'Convênio', metadata?.servicerequestInsurance)}
        </View>

        {metadata?.servicerequestReason ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Justificativa</Text>
            <Text style={styles.paragraph}>{metadata.servicerequestReason}</Text>
          </View>
        ) : null}

        {metadata?.servicerequestNote ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Observações</Text>
            <Text style={styles.paragraph}>{metadata.servicerequestNote}</Text>
          </View>
        ) : null}

        {metadata?.servicerequestSupportinginfo ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Informações de Apoio</Text>
            <Text style={styles.paragraph}>{metadata.servicerequestSupportinginfo}</Text>
          </View>
        ) : null}

        {metadata?.servicerequestPatientinstructions ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Orientações ao Paciente</Text>
            <Text style={styles.paragraph}>{metadata.servicerequestPatientinstructions}</Text>
          </View>
        ) : null}

        {items.length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Itens Solicitados ({items.length})</Text>
            <View style={styles.itemList}>
              {items.map((item, index) => {
                const groupLabel = translateGroupLabel(item.grupo);
                const modalityLabel = translateModalityLabel(item.dado4);

                return (
                  <View key={`${item.hash || item.procedimento || index}`} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <FontAwesome name="file-text-o" size={16} color={theme.colors.primary} />
                      <View style={styles.itemHeaderContent}>
                        <Text style={styles.itemTitle}>{item.procedimento || 'Procedimento'}</Text>
                        {item.subgrupo ? (
                          <Text style={styles.itemSubtitle}>{item.subgrupo}</Text>
                        ) : null}
                      </View>
                    </View>

                    {(groupLabel || modalityLabel) ? (
                      <View style={styles.itemBadgeRow}>
                        {groupLabel ? (
                          <View style={[styles.itemBadge, styles.itemBadgeInfo]}>
                            <FontAwesome name="th-large" size={11} color={theme.colors.primary} />
                            <Text style={[styles.itemBadgeText, styles.itemBadgeTextInfo]}>{groupLabel}</Text>
                          </View>
                        ) : null}
                        {modalityLabel ? (
                          <View style={[styles.itemBadge, styles.itemBadgeNeutral]}>
                            <FontAwesome name="hospital-o" size={11} color={theme.colors.secondary} />
                            <Text style={styles.itemBadgeText}>{modalityLabel}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    <View style={styles.itemMetaGrid}>
                      {item.capitulo ? (
                        <View style={styles.itemMetaRow}>
                          <Text style={styles.itemMetaLabel}>Capítulo</Text>
                          <Text style={styles.itemMetaValue}>{item.capitulo}</Text>
                        </View>
                      ) : null}
                      {item.itemNote ? (
                        <View style={styles.itemMetaRowFull}>
                          <Text style={styles.itemMetaLabel}>Notas</Text>
                          <Text style={styles.itemMetaValue}>{item.itemNote}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Anexos da Solicitação</Text>
            {attachmentsLoading ? <ActivityIndicator size="small" color={theme.colors.primary} /> : null}
          </View>

          {attachmentsError ? (
            <Text style={styles.sectionError}>{attachmentsError}</Text>
          ) : attachments.length > 0 ? (
            <View style={styles.attachmentList}>
              {attachments.map((attachment: any, index: number) => {
                const filename = attachment?.suggestedFilename || attachment?.blobname || attachment?.identifier || `Anexo ${index + 1}`;
                const sizeLabel = formatFileSize(attachment?.contentLength ?? attachment?.fileSize);
                const dateLabel = formatClinicalDateTime(attachment?.date);
                const statusLabel = attachment?.status || attachment?.type;
                const typeLabel = formatContentTypeLabel(attachment?.contentType, filename);

                return (
                  <TouchableOpacity
                    key={attachment?.identifier || attachment?.blobname || index}
                    style={styles.attachmentCard}
                    activeOpacity={0.85}
                    onPress={() => handleAttachmentPress(attachment)}
                  >
                    <View style={styles.attachmentHeader}>
                      <View style={styles.attachmentHeaderLeft}>
                        <View style={styles.attachmentIconBadge}>
                          <FontAwesome name="paperclip" size={14} color={theme.colors.primary} />
                        </View>
                        <View style={styles.attachmentHeaderContent}>
                          <Text style={styles.attachmentTitle}>{filename}</Text>
                          <Text style={styles.attachmentSubtitle}>{statusLabel}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.attachmentMetaRow}>
                      {dateLabel ? (
                        <View style={styles.attachmentMetaChip}>
                          <FontAwesome name="calendar" size={11} color={theme.colors.textSecondary} />
                          <Text style={styles.attachmentMetaText}>{dateLabel}</Text>
                        </View>
                      ) : null}
                      {typeLabel ? (
                        <View style={styles.attachmentMetaChip}>
                          <FontAwesome name="file" size={11} color={theme.colors.textSecondary} />
                          <Text style={styles.attachmentMetaText}>{typeLabel}</Text>
                        </View>
                      ) : null}
                      {sizeLabel ? (
                        <View style={styles.attachmentMetaChip}>
                          <FontAwesome name="database" size={11} color={theme.colors.textSecondary} />
                          <Text style={styles.attachmentMetaText}>{sizeLabel}</Text>
                        </View>
                      ) : null}
                    </View>

                    {attachment?.blobError ? (
                      <Text style={styles.attachmentErrorText}>{attachment.blobError}</Text>
                    ) : (
                      <View style={styles.attachmentHintRow}>
                        <FontAwesome name="external-link" size={12} color={theme.colors.primary} />
                        <Text style={styles.attachmentHint}>Toque para visualizar ou compartilhar</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : attachmentsLoading ? null : (
            <Text style={styles.sectionPlaceholder}>Nenhum anexo disponível.</Text>
          )}
        </View>
      </ScrollView>
    </View>
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
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  headerContent: {
    flex: 1,
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  badgeNeutral: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderColor: theme.colors.borderLight,
  },
  badgeText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  contentContainer: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionError: {
    fontSize: 14,
    color: theme.colors.error,
  },
  sectionPlaceholder: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  metaValue: {
    fontSize: 14,
    color: theme.colors.text,
    flexShrink: 1,
  },
  paragraph: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 22,
  },
  itemList: {
    gap: 12,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: theme.colors.surface,
    gap: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemHeaderContent: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  itemSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  itemMetaGrid: {
    gap: 10,
  },
  itemBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  itemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  itemBadgeInfo: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  itemBadgeNeutral: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderColor: theme.colors.borderLight,
  },
  itemBadgeText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  itemBadgeTextInfo: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  itemMetaRow: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  itemMetaRowFull: {
    width: '100%',
    gap: 4,
  },
  itemMetaLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  itemMetaValue: {
    fontSize: 14,
    color: theme.colors.text,
    flexWrap: 'wrap',
    flexShrink: 1,
    width: '100%',
  },
  attachmentList: {
    gap: 12,
  },
  attachmentCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 14,
    backgroundColor: theme.colors.backgroundSecondary,
    gap: 10,
  },
  attachmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  attachmentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  attachmentIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  attachmentHeaderContent: {
    flex: 1,
    gap: 4,
  },
  attachmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  attachmentSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  attachmentMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  attachmentMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  attachmentMetaText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  attachmentErrorText: {
    fontSize: 13,
    color: theme.colors.warning,
  },
  attachmentHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attachmentHint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});

export default ClinicalRecordDetailsScreen;
