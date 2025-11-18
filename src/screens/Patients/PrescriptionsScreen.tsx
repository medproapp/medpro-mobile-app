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
import { useAuthStore } from '@store/authStore';
import { PatientsStackParamList } from '@/types/navigation';

type PrescriptionsRouteProp = RouteProp<PatientsStackParamList, 'Prescriptions'>;

interface MedicationRecord {
  medId: string;
  medPatient: string;
  medType: string;
  medCategory?: string;
  medDate: string;
  medStatus: string;
  Practitioner?: string;
  practName?: string;
  metadata?: any;
  medRequestItens?: any[]; // API returns this field name (camelCase with capital I)
  Identifier?: string; // Encounter ID
  medMetadata?: any; // Contains renewed_from, renewal_date, etc.
}

const HEADER_TOP_PADDING = Platform.OS === 'android'
  ? (StatusBar.currentHeight || 44)
  : 52;

const RECORD_TYPES = [
  { key: 'all', label: 'Todos', icon: 'list' },
  { key: 'medication', label: 'Medicação', icon: 'medkit' },
  { key: 'cosmetic', label: 'Cosmético', icon: 'flask' },
  { key: 'food', label: 'Alimento', icon: 'cutlery' },
];

export const PrescriptionsScreen: React.FC = () => {
  const route = useRoute<PrescriptionsRouteProp>();
  const navigation = useNavigation();
  const { patientCpf, patientName } = route.params;

  const [allRecords, setAllRecords] = useState<MedicationRecord[]>([]); // Store all records
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, any[]>>({});
  const [loadingAttachments, setLoadingAttachments] = useState<Record<string, boolean>>({});
  const [downloadingAttachment, setDownloadingAttachment] = useState<Record<string, boolean>>({});
  const [renewingPrescription, setRenewingPrescription] = useState<Record<string, boolean>>({});
  const [signingPrescription, setSigningPrescription] = useState<Record<string, boolean>>({});
  const [concludingPrescription, setConcludingPrescription] = useState<Record<string, boolean>>({});

  // Filter records client-side based on selected type
  const records = React.useMemo(() => {
    if (selectedType === 'all') {
      return allRecords;
    }
    return allRecords.filter(record => {
      const category = record.medCategory || record.medType;
      return category?.toLowerCase() === selectedType.toLowerCase();
    });
  }, [allRecords, selectedType]);

  const loadMedicationRecords = async (pageNum: number = 1, append: boolean = false) => {
    try {
      const ITEMS_PER_PAGE = 10;

      const options: any = {
        page: pageNum,
        limit: ITEMS_PER_PAGE,
      };

      const response = await api.getPatientMedicationRecords(patientCpf, options);

      if (!response?.data || !Array.isArray(response.data)) {
        setAllRecords(append ? allRecords : []);
        setHasMore(false);
        setTotalRecords(0);
        return;
      }

      // Sort records by date (most recent first)
      const sortedRecords = [...response.data].sort((a, b) =>
        new Date(b.medDate).getTime() - new Date(a.medDate).getTime()
      );

      if (append) {
        setAllRecords(prev => [...prev, ...sortedRecords]);
      } else {
        setAllRecords(sortedRecords);
      }

      // Update total count and pagination state
      setTotalRecords(response.total || 0);
      setHasMore(response.data.length === ITEMS_PER_PAGE);
      setPage(pageNum);

    } catch (error) {
      console.error('[Prescriptions] Error loading medication records:', error);

      // Stop pagination on error to prevent infinite loops
      setHasMore(false);
      setLoadingMore(false);

      // Only show error on initial load, not on pagination
      if (!append) {
        Alert.alert('Erro', 'Não foi possível carregar as prescrições');
      }
    }
  };

  const loadData = async () => {
    setLoading(true);
    await loadMedicationRecords(1, false);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadMedicationRecords(1, false);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || loading) return;

    setLoadingMore(true);
    try {
      await loadMedicationRecords(page + 1, true);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTypeFilter = (type: string) => {
    // Just update the filter - no API call needed, filtering is done client-side
    setSelectedType(type);
  };

  const loadAttachments = async (medId: string) => {
    if (loadingAttachments[medId] || attachmentsMap[medId]) {
      return;
    }

    setLoadingAttachments(prev => ({ ...prev, [medId]: true }));
    try {
      const response = await api.getAttachmentsByContext(medId);
      // API returns a direct array, not wrapped in an object
      const normalized = Array.isArray(response) ? response : [];
      setAttachmentsMap(prev => ({ ...prev, [medId]: normalized }));
    } catch (error) {
      console.error('[Prescriptions] Error loading attachments:', error);
      setAttachmentsMap(prev => ({ ...prev, [medId]: [] }));
    } finally {
      setLoadingAttachments(prev => ({ ...prev, [medId]: false }));
    }
  };

  const handleRenewPrescription = async (record: MedicationRecord) => {
    Alert.alert(
      'Renovar Prescrição',
      'Deseja criar uma cópia desta prescrição? Uma nova prescrição será criada como rascunho e o PDF será gerado.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Confirmar',
          onPress: async () => {
            setRenewingPrescription(prev => ({ ...prev, [record.medId]: true }));
            try {
              // Step 1: Renew prescription (creates DB record)
              console.log('[Prescriptions] Renewing prescription:', record.medId);
              const renewResult = await api.renewPrescription(record.medId);
              const renewedPrescription = renewResult.data;

              // The renewed prescription has different field names than the list view
              const renewedId = renewedPrescription.identifier || renewedPrescription.medId;
              const renewedItems = renewedPrescription.requestitens || renewedPrescription.medRequestItens || [];

              console.log('[Prescriptions] Renewed prescription:', renewedId);
              console.log('[Prescriptions] Renewed prescription items:', renewedItems.length);

              // Step 2: Fetch patient data
              console.log('[Prescriptions] Fetching patient data for:', record.medPatient);
              const patientData = await api.getPatientDetails(record.medPatient);

              // Step 3: Get practitioner data from auth store
              const { user } = useAuthStore.getState();

              // Step 4: Prepare PDF generation payload
              const pdfParams = {
                category: record.medCategory || 'medication',
                pract: {
                  name: user?.name || '',
                  email: user?.email || '',
                  crm: user?.crm,
                  phone: user?.phone,
                  specialty: user?.specialty,
                },
                patient: {
                  name: patientData.nome || patientData.name || '',
                  cpf: record.medPatient,
                  birthDate: patientData.dataNasc || patientData.birthDate,
                  phone: patientData.telefone || patientData.phone,
                  email: patientData.email,
                },
                header: {
                  identifier: renewedId,
                  medicationRequestReceita: renewedPrescription.metadata?.medicationRequestReceita || record.medMetadata?.medicationRequestReceita || 'simples',
                  medicationRequestStatus: 'draft',
                  medicationRequestCategory: record.medCategory || 'medication',
                  medicationRequestNote: renewedPrescription.metadata?.medicationRequestNote || record.medMetadata?.medicationRequestNote || '',
                  medicationRequestPatientInstructions: renewedPrescription.metadata?.medicationRequestPatientInstructions || record.medMetadata?.medicationRequestPatientInstructions || '',
                  encounter: record.Identifier,
                  subject: record.medPatient,
                  practitioner: user?.email || '',
                },
                items: renewedItems.map((item: any) => ({
                  produto: item.medication || '',
                  substancia: item.principioAtivo || '',
                  apresentacao: item.apresentacao || 'PENDING_APRESENTACAO_SOURCE',
                  registro: item.registro || 'PENDING_REGISTRO_SOURCE',
                  mododeuso: item.mododeuso || '',
                  note: item.note || '',
                  medication: item.medication || '',
                  activeIngredient: item.principioAtivo || '',
                  presentation: item.apresentacao || 'PENDING_APRESENTACAO_SOURCE',
                  posology: item.mododeuso || '',
                  groupIdentifier: renewedId,
                })),
              };

              console.log('[Prescriptions] PDF params items count:', pdfParams.items.length);

              console.log('[Prescriptions] Generating PDF for renewed prescription');

              // Step 5: Generate PDF
              await api.generatePrescriptionPdf(pdfParams);

              console.log('[Prescriptions] PDF generated successfully');

              // Step 6: Success
              Alert.alert(
                'Prescrição Renovada',
                'A prescrição foi renovada com sucesso e o PDF foi gerado!',
                [
                  {
                    text: 'OK',
                    onPress: async () => {
                      // Refresh the prescription list
                      await onRefresh();
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error('[Prescriptions] Error renewing prescription:', error);

              // More specific error messages
              let errorMessage = 'Não foi possível renovar a prescrição. Por favor, tente novamente.';

              if (error?.message?.includes('patient')) {
                errorMessage = 'Erro ao buscar dados do paciente. Por favor, tente novamente.';
              } else if (error?.message?.includes('PDF')) {
                errorMessage = 'Prescrição renovada, mas falha ao gerar PDF. Tente gerar o PDF novamente.';
              }

              Alert.alert('Erro', errorMessage);
            } finally {
              setRenewingPrescription(prev => ({ ...prev, [record.medId]: false }));
            }
          },
        },
      ]
    );
  };

  const handleSignPrescription = async (record: MedicationRecord) => {
    Alert.alert(
      'Assinar Prescrição',
      'A funcionalidade de assinatura digital será implementada em breve.',
      [{ text: 'OK' }]
    );
  };

  const handleConcludePrescription = async (record: MedicationRecord) => {
    Alert.alert(
      'Concluir sem Assinatura',
      'Deseja concluir esta prescrição sem assinatura digital? O PDF será gerado e anexado à prescrição.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Confirmar',
          onPress: async () => {
            setConcludingPrescription(prev => ({ ...prev, [record.medId]: true }));
            try {
              console.log('[Prescriptions] Concluding prescription without signature:', record.medId);

              // Step 1: Fetch patient data
              console.log('[Prescriptions] Fetching patient data for:', record.medPatient);
              const patientData = await api.getPatientDetails(record.medPatient);

              // Step 2: Get practitioner data from auth store
              const { user } = useAuthStore.getState();

              // Step 3: Prepare prescription data for status update
              console.log('[Prescriptions] Updating prescription status to completed');
              const metadata = record.medMetadata || record.metadata || {};
              const requestitens = record.medRequestItens || [];
              const prescriptionUpdateData = {
                identifier: record.medId,
                status: 'completed',
                category: record.medCategory || 'medication',
                patient: record.medPatient,
                encounter: record.Identifier || '',
                date: record.medDate,
                type: record.medType,
                metadata: JSON.stringify(metadata), // Stringify for MySQL JSON column
                requestitens: JSON.stringify(requestitens), // Stringify for MySQL JSON column
              };

              if (__DEV__) {
                console.log('[Prescriptions] Prescription update payload:', {
                  ...prescriptionUpdateData,
                  metadata: '(stringified)',
                  requestitens: `(stringified - ${requestitens.length} items)`,
                });
              }

              // Step 4: Update prescription status to "completed"
              await api.updatePrescriptionStatus(prescriptionUpdateData);
              console.log('[Prescriptions] Prescription status updated to completed');

              // Step 5: Prepare PDF generation payload
              const pdfParams = {
                category: record.medCategory || 'medication',
                pract: {
                  name: user?.name || '',
                  email: user?.email || '',
                  crm: user?.crm,
                  phone: user?.phone,
                  specialty: user?.specialty,
                },
                patient: {
                  name: patientData.nome || patientData.name || '',
                  cpf: record.medPatient,
                  birthDate: patientData.dataNasc || patientData.birthDate,
                  phone: patientData.telefone || patientData.phone,
                  email: patientData.email,
                },
                header: {
                  identifier: record.medId,
                  medicationRequestReceita: record.medMetadata?.medicationRequestReceita || record.metadata?.medicationRequestReceita || 'simples',
                  medicationRequestStatus: 'completed',
                  medicationRequestCategory: record.medCategory || 'medication',
                  medicationRequestNote: record.medMetadata?.medicationRequestNote || record.metadata?.medicationRequestNote || '',
                  medicationRequestPatientInstructions: record.medMetadata?.medicationRequestPatientInstructions || record.metadata?.medicationRequestPatientInstructions || '',
                  encounter: record.Identifier,
                  subject: record.medPatient,
                  practitioner: user?.email || '',
                },
                items: (record.medRequestItens || []).map((item: any) => ({
                  produto: item.medication || '',
                  substancia: item.principioAtivo || '',
                  apresentacao: item.apresentacao || 'PENDING_APRESENTACAO_SOURCE',
                  registro: item.registro || 'PENDING_REGISTRO_SOURCE',
                  mododeuso: item.mododeuso || '',
                  note: item.note || '',
                  medication: item.medication || '',
                  activeIngredient: item.principioAtivo || '',
                  presentation: item.apresentacao || 'PENDING_APRESENTACAO_SOURCE',
                  posology: item.mododeuso || '',
                  groupIdentifier: record.medId,
                })),
              };

              console.log('[Prescriptions] Generating PDF for prescription:', record.medId);
              console.log('[Prescriptions] PDF params items count:', pdfParams.items.length);

              // Step 6: Generate PDF as base64
              const pdfData = await api.generatePrescriptionPdfBlob(pdfParams);
              console.log('[Prescriptions] PDF generated, base64 length:', pdfData.base64.length);

              // Step 7: Save PDF to temp file
              const fileUri = `${FileSystem.documentDirectory}${pdfData.fileName}`;
              console.log('[Prescriptions] Saving PDF to file:', fileUri);

              await FileSystem.writeAsStringAsync(fileUri, pdfData.base64, {
                encoding: FileSystem.EncodingType.Base64,
              });
              console.log('[Prescriptions] PDF saved successfully');

              // Step 8: Upload PDF to Azure with attachment record
              console.log('[Prescriptions] Uploading PDF to Azure with type MEDREQUEST and context:', record.medId);
              const uploadResult = await api.uploadPrescriptionPdf(
                fileUri,
                pdfData.fileName,
                record.medId, // prescription ID - links attachment to prescription via context field
                record.Identifier || '',
                record.medPatient
              );

              console.log('[Prescriptions] PDF uploaded successfully:', uploadResult);
              console.log('[Prescriptions] Attachment created with ID:', uploadResult.fileid);

              // Step 9: Success
              Alert.alert(
                'Prescrição Concluída',
                'A prescrição foi concluída sem assinatura e o PDF foi anexado!',
                [
                  {
                    text: 'OK',
                    onPress: async () => {
                      // Refresh the prescription list
                      await onRefresh();
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error('[Prescriptions] Error concluding prescription:', error);

              // More specific error messages
              let errorMessage = 'Não foi possível concluir a prescrição. Por favor, tente novamente.';

              if (error?.message?.includes('patient')) {
                errorMessage = 'Erro ao buscar dados do paciente. Por favor, tente novamente.';
              } else if (error?.message?.includes('PDF')) {
                errorMessage = 'Erro ao gerar o PDF. Por favor, tente novamente.';
              } else if (error?.message?.includes('upload') || error?.message?.includes('attach')) {
                errorMessage = 'Prescrição atualizada, mas falha ao fazer upload do PDF. Tente novamente.';
              } else if (error?.message?.includes('status') || error?.message?.includes('save')) {
                errorMessage = 'Erro ao atualizar o status da prescrição. Por favor, tente novamente.';
              }

              Alert.alert('Erro', errorMessage);
            } finally {
              setConcludingPrescription(prev => ({ ...prev, [record.medId]: false }));
            }
          },
        },
      ]
    );
  };

  const ANDROID_READ_PERMISSION_FLAG = 1;

  const handleAttachmentPress = async (attachment: any, record: MedicationRecord) => {
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
            title: 'Prescrição',
          });
        }
      } else {
        Alert.alert('Erro', 'Informações do anexo incompletas');
      }
    } catch (error) {
      console.error('[Prescriptions] Error opening attachment:', error);
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

  const getStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'signed':
      case 'active':
      case 'completed':
        return theme.colors.success;
      case 'draft':
      case 'pending':
        return theme.colors.warning;
      case 'cancelled':
      case 'expired':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'signed':
        return 'Assinado';
      case 'active':
        return 'Ativo';
      case 'completed':
        return 'Concluído';
      case 'draft':
        return 'Rascunho';
      case 'pending':
        return 'Pendente';
      case 'cancelled':
        return 'Cancelado';
      case 'expired':
        return 'Expirado';
      default:
        return status || 'Desconhecido';
    }
  };

  const getRecordTypeLabel = (record: MedicationRecord): string => {
    // Use medCategory for display, falling back to medType
    const category = record.medCategory || record.medType;

    switch (category?.toLowerCase()) {
      case 'medication':
        return 'Medicação';
      case 'cosmetic':
        return 'Cosmético';
      case 'food':
        return 'Alimento';
      default:
        return category || 'Prescrição';
    }
  };

  const renderMedicationCard = ({ item: record }: { item: MedicationRecord }) => {
    const hasItems = record.medRequestItens && record.medRequestItens.length > 0;

    return (
      <View style={styles.recordCard}>
        {/* Record Header */}
        <View style={styles.recordHeader}>
          <View style={styles.recordHeaderLeft}>
            <View style={[styles.recordIconContainer, { backgroundColor: theme.colors.success }]}>
              <FontAwesome name="file-text" size={16} color={theme.colors.white} />
            </View>
            <View style={styles.recordMainInfo}>
              <Text style={styles.recordType}>{getRecordTypeLabel(record)}</Text>
              <Text style={styles.recordId}>#{record.medId}</Text>
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(record.medStatus) }]}>
            <Text style={styles.statusText}>{getStatusLabel(record.medStatus)}</Text>
          </View>
        </View>

        {/* Record Details */}
        <View style={styles.recordDetails}>
          <View style={styles.recordDetailRow}>
            <FontAwesome name="calendar" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.recordDetailText}>{formatDateTime(record.medDate)}</Text>
          </View>

          {record.Identifier && (
            <View style={styles.recordDetailRow}>
              <FontAwesome name="user-md" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.recordDetailText}>Encontro: {record.Identifier}</Text>
            </View>
          )}

          {record.practName && (
            <View style={styles.recordDetailRow}>
              <FontAwesome name="stethoscope" size={12} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.recordDetailText}>{record.practName}</Text>
            </View>
          )}
        </View>

        {/* Medication Items */}
        {hasItems && (
          <View style={styles.itemsContainer}>
            <Text style={styles.itemsTitle}>Medicamentos prescritos:</Text>
            {record.medRequestItens!.map((item: any, index: number) => {
              const isLastItem = index === record.medRequestItens!.length - 1;
              return (
                <View
                  key={index}
                  style={[
                    styles.medicationItem,
                    isLastItem && { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 }
                  ]}
                >
                  <FontAwesome name="medkit" size={10} color={theme.colors.success} style={{ marginRight: 6, marginTop: 4 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medicationItemText}>
                      {item.medication || item.procedimento || 'Medicamento'}
                    </Text>
                    {item.principioAtivo && (
                      <Text style={styles.medicationItemSubtext}>
                        {item.principioAtivo}
                      </Text>
                    )}
                    {item.mododeuso && (
                      <Text style={styles.medicationItemDosage}>
                        {item.mododeuso}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Attachments Section */}
        <View style={styles.attachmentsSection}>
          <TouchableOpacity
            style={styles.attachmentsButton}
            onPress={() => loadAttachments(record.medId)}
          >
            <FontAwesome name="paperclip" size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.attachmentsButtonText}>Ver Anexos</Text>
            {loadingAttachments[record.medId] && (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 8 }} />
            )}
          </TouchableOpacity>

          {attachmentsMap[record.medId] && (
            <View style={styles.attachmentsList}>
              {attachmentsMap[record.medId].length > 0 ? (
                attachmentsMap[record.medId].map((attachment: any, index: number) => {
                  // Determine file icon and color based on type
                  const getFileIconAndColor = (attachment: any) => {
                    // Check if it's an external link first
                    if (attachment.externallink) {
                      return { icon: 'external-link', color: theme.colors.info || '#3498db' };
                    }

                    const filetype = attachment.filetype?.toLowerCase() || '';

                    // PDF files
                    if (filetype.includes('pdf')) {
                      return { icon: 'file-pdf-o', color: '#e74c3c' };
                    }

                    // Image files
                    if (filetype.includes('image') || filetype.includes('jpg') || filetype.includes('jpeg') ||
                        filetype.includes('png') || filetype.includes('gif') || filetype.includes('bmp') ||
                        filetype.includes('svg') || filetype.includes('webp')) {
                      return { icon: 'file-image-o', color: '#9b59b6' };
                    }

                    // Word documents
                    if (filetype.includes('word') || filetype.includes('msword') ||
                        filetype.includes('officedocument.wordprocessing') || filetype.includes('.doc')) {
                      return { icon: 'file-word-o', color: '#2980b9' };
                    }

                    // Excel spreadsheets
                    if (filetype.includes('excel') || filetype.includes('spreadsheet') ||
                        filetype.includes('.xls') || filetype.includes('ms-excel')) {
                      return { icon: 'file-excel-o', color: '#27ae60' };
                    }

                    // PowerPoint presentations
                    if (filetype.includes('powerpoint') || filetype.includes('presentation') ||
                        filetype.includes('.ppt')) {
                      return { icon: 'file-powerpoint-o', color: '#e67e22' };
                    }

                    // Text files
                    if (filetype.includes('text') || filetype.includes('txt') || filetype.includes('plain')) {
                      return { icon: 'file-text-o', color: '#7f8c8d' };
                    }

                    // Audio files
                    if (filetype.includes('audio') || filetype.includes('mp3') || filetype.includes('wav') ||
                        filetype.includes('ogg') || filetype.includes('m4a')) {
                      return { icon: 'file-audio-o', color: '#16a085' };
                    }

                    // Video files
                    if (filetype.includes('video') || filetype.includes('mp4') || filetype.includes('avi') ||
                        filetype.includes('mov') || filetype.includes('wmv')) {
                      return { icon: 'file-video-o', color: '#c0392b' };
                    }

                    // Archive files
                    if (filetype.includes('zip') || filetype.includes('rar') || filetype.includes('7z') ||
                        filetype.includes('tar') || filetype.includes('gz') || filetype.includes('compressed')) {
                      return { icon: 'file-archive-o', color: '#f39c12' };
                    }

                    // Code files
                    if (filetype.includes('json') || filetype.includes('xml') || filetype.includes('html') ||
                        filetype.includes('javascript') || filetype.includes('css')) {
                      return { icon: 'file-code-o', color: '#34495e' };
                    }

                    // Default file icon
                    return { icon: 'file-o', color: theme.colors.textSecondary };
                  };

                  // Format file size
                  const formatFileSize = (bytes: number) => {
                    if (!bytes) return '';
                    if (bytes < 1024) return `${bytes} B`;
                    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                  };

                  const { icon, color } = getFileIconAndColor(attachment);
                  const displayName = attachment.blobname || attachment.identifier || `Anexo ${index + 1}`;
                  const fileSize = formatFileSize(attachment.file_size);
                  const isSigned = attachment.type === 'MEDREQUEST-SIGNED';
                  const isExternalLink = !!attachment.externallink;
                  const attachmentId = attachment.identifier || attachment.blobname || `${index}`;
                  const isDownloading = downloadingAttachment[attachmentId];

                  return (
                    <TouchableOpacity
                      key={attachment.identifier || index}
                      style={styles.attachmentItem}
                      onPress={() => handleAttachmentPress(attachment, record)}
                      disabled={isDownloading}
                    >
                      <FontAwesome
                        name={icon}
                        size={14}
                        color={isSigned ? theme.colors.success : color}
                        style={{ marginRight: 8 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.attachmentName} numberOfLines={1}>
                          {displayName}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                          {isSigned && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                              <FontAwesome name="check-circle" size={10} color={theme.colors.success} style={{ marginRight: 4 }} />
                              <Text style={[styles.attachmentMeta, { color: theme.colors.success }]}>Assinado</Text>
                            </View>
                          )}
                          {isExternalLink && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                              <FontAwesome name="globe" size={10} color={theme.colors.info || '#3498db'} style={{ marginRight: 4 }} />
                              <Text style={[styles.attachmentMeta, { color: theme.colors.info || '#3498db' }]}>Link externo</Text>
                            </View>
                          )}
                          {fileSize && <Text style={styles.attachmentMeta}>{fileSize}</Text>}
                        </View>
                      </View>
                      {isDownloading ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 8 }} />
                      ) : (
                        <FontAwesome name="chevron-right" size={10} color={theme.colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.noAttachmentsText}>Nenhum anexo disponível</Text>
              )}
            </View>
          )}
        </View>

        {/* Renewal Section */}
        {(record.medStatus === 'completed' || record.medStatus === 'active') && (
          <View style={styles.renewalSection}>
            <TouchableOpacity
              style={[
                styles.renewButton,
                renewingPrescription[record.medId] && styles.renewButtonDisabled
              ]}
              onPress={() => handleRenewPrescription(record)}
              disabled={renewingPrescription[record.medId]}
            >
              {renewingPrescription[record.medId] ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 8 }} />
              ) : (
                <FontAwesome name="refresh" size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.renewButtonText}>Renovar Prescrição</Text>
                <Text style={styles.renewButtonHelper}>Criar nova prescrição rascunho</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Sign & Conclude Buttons - ONLY for Draft Prescriptions */}
        {record.medStatus === 'draft' && (
          <View style={styles.draftActionsSection}>
            {/* Sign Button */}
            <TouchableOpacity
              style={[
                styles.draftActionButton,
                styles.signButton,
                signingPrescription[record.medId] && styles.draftActionButtonDisabled
              ]}
              onPress={() => handleSignPrescription(record)}
              disabled={signingPrescription[record.medId]}
            >
              {signingPrescription[record.medId] ? (
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 3 }} />
              ) : (
                <FontAwesome name="edit" size={14} color="#fff" style={{ marginRight: 3 }} />
              )}
              <Text style={[styles.signButtonText, { marginLeft: 3 }]}>Assinar Prescrição</Text>
            </TouchableOpacity>

            {/* Conclude Button */}
            <TouchableOpacity
              style={[
                styles.draftActionButton,
                styles.concludeButton,
                concludingPrescription[record.medId] && styles.draftActionButtonDisabled
              ]}
              onPress={() => handleConcludePrescription(record)}
              disabled={concludingPrescription[record.medId]}
            >
              {concludingPrescription[record.medId] ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 3 }} />
              ) : (
                <FontAwesome name="check-circle" size={14} color={theme.colors.primary} style={{ marginRight: 3 }} />
              )}
              <Text style={[styles.concludeButtonText, { marginLeft: 3 }]}>Concluir sem Assinatura</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => {
    let icon = 'folder-open';
    let iconColor = theme.colors.textSecondary;
    let title = 'Nenhum Registro Encontrado';
    let description = 'Não há registros disponíveis para este paciente.';

    switch (selectedType) {
      case 'medication':
        icon = 'medkit';
        iconColor = theme.colors.success;
        title = 'Nenhuma Medicação';
        description = 'Este paciente ainda não possui medicações registradas.';
        break;
      case 'cosmetic':
        icon = 'flask';
        iconColor = theme.colors.primary;
        title = 'Nenhum Cosmético';
        description = 'Não há produtos cosméticos registrados para este paciente.';
        break;
      case 'food':
        icon = 'cutlery';
        iconColor = theme.colors.warning;
        title = 'Nenhum Alimento';
        description = 'Não há alimentos registrados para este paciente.';
        break;
      case 'all':
      default:
        icon = 'file-text';
        iconColor = theme.colors.textSecondary;
        title = 'Nenhum Registro';
        description = 'Este paciente ainda não possui registros de medicação, cosméticos ou alimentos.';
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
            <Text style={styles.emptyStateButtonText}>Ver Todos os Registros</Text>
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
        <Text style={styles.loadingText}>Carregando prescrições...</Text>
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
              <Text style={styles.headerTitle}>Prescrições</Text>
              <Text style={styles.headerSubtitle}>{patientName}</Text>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{records.length}</Text>
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
            {RECORD_TYPES.map((type) => (
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
          renderItem={renderMedicationCard}
          keyExtractor={(item) => item.medId}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
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
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  filterContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundSecondary,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  listContainer: {
    padding: 16,
  },
  recordCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  recordType: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  recordId: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    color: theme.colors.white,
    fontWeight: '600',
  },
  recordDetails: {
    marginTop: 4,
  },
  recordDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordDetailText: {
    fontSize: 13,
    color: theme.colors.text,
  },
  itemsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
  },
  itemsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  medicationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '30',
  },
  medicationItemText: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 4,
  },
  medicationItemSubtext: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 4,
  },
  medicationItemDosage: {
    fontSize: 12,
    color: theme.colors.text,
    lineHeight: 16,
    fontStyle: 'italic',
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
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyStateIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
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
  attachmentsSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  attachmentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  attachmentsButtonText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  attachmentsList: {
    marginTop: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
    marginBottom: 6,
  },
  attachmentName: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '500',
  },
  attachmentMeta: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  noAttachmentsText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  renewalSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  renewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '08',
  },
  renewButtonDisabled: {
    opacity: 0.6,
    borderColor: theme.colors.textSecondary,
  },
  renewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 2,
  },
  renewButtonHelper: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  draftActionsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: 'row',
    gap: 8,
  },
  draftActionButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signButton: {
    backgroundColor: theme.colors.primary,
    borderWidth: 0,
  },
  signButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  concludeButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  concludeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  draftActionButtonDisabled: {
    opacity: 0.6,
  },
});
