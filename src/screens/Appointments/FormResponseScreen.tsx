import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { Card, Loading } from '@components/common';
import { theme } from '@theme/index';
import { apiService } from '@services/api';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DashboardStackParamList } from '@/types/navigation';
import { FormResponse, FormSection, FormField, FormStatus } from '@/types/preAppointment';
import { logger } from '@/utils/logger';

type FormResponseScreenProps = RouteProp<DashboardStackParamList, 'FormResponse'>;
type FormResponseNavigationProp = StackNavigationProp<DashboardStackParamList, 'FormResponse'>;

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return theme.colors.success;
    case 'partial': return theme.colors.warning;
    case 'pending': return theme.colors.textSecondary;
    case 'overdue': return theme.colors.error;
    default: return theme.colors.textSecondary;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return 'check-circle';
    case 'partial': return 'clock-o';
    case 'pending': return 'circle-o';
    case 'overdue': return 'exclamation-triangle';
    default: return 'circle-o';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'completed': return 'Completado';
    case 'partial': return 'Parcial';
    case 'pending': return 'Pendente';
    case 'overdue': return 'Atrasado';
    default: return status;
  }
};

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
};

const renderFieldValue = (field: FormField) => {
  if (field.value === undefined || field.value === null || field.value === '') {
    return <Text style={styles.fieldValueEmpty}>Não preenchido</Text>;
  }

  // Handle boolean values (regardless of field type)
  if (typeof field.value === 'boolean') {
    return (
      <View style={styles.booleanBadgeContainer}>
        <View style={[styles.booleanBadge, field.value ? styles.booleanBadgeYes : styles.booleanBadgeNo]}>
          <FontAwesome
            name={field.value ? 'check-circle' : 'times-circle'}
            size={14}
            color={field.value ? theme.colors.success : theme.colors.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.booleanBadgeText, field.value ? styles.booleanBadgeTextYes : styles.booleanBadgeTextNo]}>
            {field.value ? 'Sim' : 'Não'}
          </Text>
        </View>
      </View>
    );
  }

  // Handle different field types
  switch (field.type) {
    case 'checkbox':
      return (
        <View style={styles.checkboxContainer}>
          <FontAwesome
            name={field.value ? 'check-square-o' : 'square-o'}
            size={18}
            color={field.value ? theme.colors.success : theme.colors.textSecondary}
          />
          <Text style={styles.fieldValue}>{field.value ? 'Sim' : 'Não'}</Text>
        </View>
      );

    case 'multiselect':
      if (Array.isArray(field.value)) {
        return (
          <View style={styles.multiSelectContainer}>
            {field.value.map((item, idx) => (
              <View key={`${field.id}-option-${idx}`} style={styles.multiSelectItem}>
                <FontAwesome name="check" size={12} color={theme.colors.primary} />
                <Text style={styles.multiSelectText}>{String(item)}</Text>
              </View>
            ))}
          </View>
        );
      }
      return <Text style={styles.fieldValue}>{String(field.value)}</Text>;

    case 'file':
      return (
        <TouchableOpacity style={styles.fileContainer}>
          <FontAwesome name="file-o" size={16} color={theme.colors.primary} />
          <Text style={styles.fileText}>Ver anexo</Text>
        </TouchableOpacity>
      );

    case 'date':
      return <Text style={styles.fieldValue}>{formatDate(field.value)}</Text>;

    default:
      return <Text style={styles.fieldValue}>{String(field.value)}</Text>;
  }
};

const FormSectionComponent: React.FC<{ section: FormSection; level?: number }> = ({
  section,
  level = 0
}) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={[styles.sectionContainer, level > 0 && styles.subsectionContainer]}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.sectionTitleRow}>
          <FontAwesome
            name={expanded ? 'chevron-down' : 'chevron-right'}
            size={14}
            color={theme.colors.textSecondary}
            style={styles.chevronIcon}
          />
          <Text style={[styles.sectionTitle, level > 0 && styles.subsectionTitle]}>
            {section.title}
          </Text>
          {section.completed && (
            <View style={styles.completedBadge}>
              <FontAwesome name="check" size={10} color={theme.colors.success} />
            </View>
          )}
          {section.required && (
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredText}>Obrigatório</Text>
            </View>
          )}
        </View>
        {section.description && expanded && (
          <Text style={styles.sectionDescription}>{section.description}</Text>
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.sectionContent}>
          {section.fields.map((field) => (
            <View key={field.id} style={styles.fieldContainer}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                {field.required && <Text style={styles.fieldRequired}>*</Text>}
              </View>
              {renderFieldValue(field)}
            </View>
          ))}

          {section.subsections && section.subsections.length > 0 && (
            <View style={styles.subsectionsContainer}>
              {section.subsections.map((subsection) => (
                <FormSectionComponent
                  key={subsection.id}
                  section={subsection}
                  level={level + 1}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export const FormResponseScreen: React.FC = () => {
  const navigation = useNavigation<FormResponseNavigationProp>();
  const route = useRoute<FormResponseScreenProps>();
  const { trackingId, patientName, appointmentDate } = route.params;

  const [formData, setFormData] = useState<FormResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFormDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      logger.debug('Fetching form details for tracking ID:', trackingId);

      const response = await apiService.getPreAppointmentFormDetails(trackingId);

      if (response.success && response.data) {
        // Transform API response to match FormResponse type
        const apiData = response.data as any;

        // Map form status to display status
        const mapStatus = (status: string): FormStatus => {
          switch (status) {
            case 'submitted': return 'completed';
            case 'started': return 'partial';
            case 'pending': return 'pending';
            case 'expired': return 'overdue';
            default: return 'pending';
          }
        };

        // Calculate progress percentage
        const calculateProgress = (sections: any[]): number => {
          if (!sections || sections.length === 0) return 0;
          let totalFields = 0;
          let completedFields = 0;

          const countFields = (section: any) => {
            if (section.fields) {
              section.fields.forEach((field: any) => {
                totalFields++;
                if (field.value !== undefined && field.value !== null && field.value !== '') {
                  completedFields++;
                }
              });
            }
            if (section.subsections) {
              section.subsections.forEach(countFields);
            }
          };

          sections.forEach(countFields);
          return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
        };

        // Section title translation map (matching web app)
        const sectionTitleMap: Record<string, string> = {
          answers: 'Respostas',
          personal_info: 'Informações Pessoais',
          current_symptoms: 'Sintomas Atuais',
          additional_info: 'Informações Adicionais',
          authorizations: 'Autorizações',
          medical_history: 'Histórico Médico',
          medications: 'Medicamentos',
          allergies: 'Alergias',
          cardiac_symptoms: 'Sintomas Cardíacos',
          respiratory_symptoms: 'Sintomas Respiratórios',
          gastrointestinal_symptoms: 'Sintomas Gastrointestinais',
          neurological_symptoms: 'Sintomas Neurológicos',
          psychological_symptoms: 'Sintomas Psicológicos',
          lifestyle: 'Estilo de Vida',
          family_history: 'Histórico Familiar',
          surgical_history: 'Histórico Cirúrgico',
          immunizations: 'Imunizações',
          insurance: 'Convênio',
          emergency_contact: 'Contato de Emergência',
        };

        // Transform sections to match expected structure
        const transformSections = (apiSections: any[], parentPath = ''): FormSection[] => {
          if (!apiSections || !Array.isArray(apiSections)) return [];

          return apiSections.map((section, sectionIndex) => {
            // Try multiple properties for section ID
            // Nested sections use "key", parent sections use "section"
            const sectionId = section.key || section.section || section.id || section.name || `section-${sectionIndex}`;
            const currentPath = parentPath ? `${parentPath}.${sectionId}` : sectionId;

            // Check if this section has nested sections (like the "answers" parent section)
            const hasNestedSections = Array.isArray(section.nestedSections) && section.nestedSections.length > 0;

            // Transform fields from the values object
            // IMPORTANT: If section has nestedSections, skip parent fields (avoid duplicates)
            const fields: FormField[] = [];
            if (!hasNestedSections && section.fields && Array.isArray(section.fields)) {
              section.fields.forEach((field: any, fieldIndex: number) => {
                // Try multiple field key candidates (matching web app logic)
                const fieldKey = field.field_name || field.id || field.name || field.key || field.label;

                // Get value from section.values using the field key
                const fieldValue = fieldKey && section.values?.[fieldKey] !== undefined
                  ? section.values[fieldKey]
                  : field.value;

                // Create unique field ID using section path and field index
                const uniqueFieldId = field.id || `${currentPath}-field-${fieldIndex}`;

                fields.push({
                  id: uniqueFieldId,
                  type: field.type || 'text',
                  label: field.label || field.question || 'Campo',
                  value: fieldValue,
                  required: field.required || false,
                  completed: fieldValue !== undefined && fieldValue !== null && fieldValue !== '',
                  options: field.options,
                });
              });
            }

            // Transform nested sections recursively
            const subsections = hasNestedSections
              ? transformSections(section.nestedSections, currentPath)
              : undefined;

            // Get section title: EXACTLY matching web app logic
            const getSectionTitle = () => {
              // 1. Use title from backend if available (nested sections use "title", parent uses "sectionTitle")
              if (section.title) {
                return section.title;
              }
              if (section.sectionTitle) {
                return section.sectionTitle;
              }

              // 2. Get raw ID
              const rawId = section.key || section.section || section.id || section.name || 'Seção';

              // 3. Try translation map
              if (sectionTitleMap[rawId]) {
                return sectionTitleMap[rawId];
              }

              // 4. Fallback: format the ID (replace underscores, title case)
              return String(rawId).replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
            };

            return {
              id: currentPath,
              title: getSectionTitle(),
              description: section.description,
              fields,
              subsections,
              completed: section.completed || false,
              required: section.required || false,
            };
          });
        };

        const transformedData: FormResponse = {
          trackingId: String(apiData.tracking?.id || trackingId),
          formId: String(apiData.form?.form?.id || ''),
          formName: apiData.form?.form?.name || 'Formulário Pré-Consulta',
          appointmentId: String(apiData.tracking?.appointmentId || ''),
          patientName: apiData.patient?.name || patientName,
          appointmentDate: appointmentDate.split(' às ')[0] || '',
          appointmentTime: appointmentDate.split(' às ')[1] || '',
          status: mapStatus(apiData.tracking?.formStatus || 'pending'),
          progressPercentage: apiData.tracking?.formStatus === 'submitted'
            ? 100
            : calculateProgress(apiData.form?.sections || []),
          sections: transformSections(apiData.form?.sections || []),
          submittedAt: apiData.tracking?.formSubmittedAt,
          startedAt: apiData.tracking?.formStartedAt,
          lastActivity: apiData.tracking?.formProgressAt || apiData.tracking?.updatedAt,
          metadata: apiData.tracking?.metadata,
        };

        logger.debug('Transformed form data:', transformedData);
        setFormData(transformedData);
      } else {
        setError('Não foi possível carregar os dados do formulário');
      }
    } catch (err) {
      logger.error('Error fetching form details:', err);
      setError('Erro ao carregar o formulário');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFormDetails();
  }, [trackingId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFormDetails();
  };

  if (loading) {
    return <Loading text="Carregando formulário..." />;
  }

  if (error || !formData) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome name="exclamation-triangle" size={48} color={theme.colors.error} />
        <Text style={styles.errorTitle}>{error || 'Formulário não encontrado'}</Text>
        <Text style={styles.errorSubtitle}>
          Verifique se o formulário foi preenchido pelo paciente.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerBackground}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
              <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Respostas do Formulário</Text>
              <Text style={styles.headerSubtitle}>{patientName}</Text>
              <Text style={styles.headerDate}>{appointmentDate}</Text>
            </View>
          </View>
        </View>

        {/* Scrollable content */}
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        >
          {/* Status Card */}
          <Card style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={styles.statusInfo}>
                <Text style={styles.statusLabel}>Status</Text>
                <View style={styles.statusBadgeContainer}>
                  <FontAwesome
                    name={getStatusIcon(formData.status)}
                    size={16}
                    color={getStatusColor(formData.status)}
                    style={styles.statusIcon}
                  />
                  <Text style={[styles.statusText, { color: getStatusColor(formData.status) }]}>
                    {getStatusText(formData.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.progressInfo}>
                <Text style={styles.progressLabel}>Progresso</Text>
                <Text style={styles.progressValue}>{formData.progressPercentage}%</Text>
              </View>
            </View>

            {formData.submittedAt && (
              <View style={styles.timestampRow}>
                <FontAwesome name="check-circle" size={14} color={theme.colors.success} />
                <Text style={styles.timestampText}>
                  Enviado em {formatDate(formData.submittedAt)}
                </Text>
              </View>
            )}

            {formData.lastActivity && !formData.submittedAt && (
              <View style={styles.timestampRow}>
                <FontAwesome name="clock-o" size={14} color={theme.colors.warning} />
                <Text style={styles.timestampText}>
                  Última atividade em {formatDate(formData.lastActivity)}
                </Text>
              </View>
            )}
          </Card>

          {/* Form Sections */}
          <View style={styles.sectionsContainer}>
            {formData.sections.map((section) => (
              <FormSectionComponent key={section.id} section={section} />
            ))}
          </View>

          {formData.sections.length === 0 && (
            <Card style={styles.emptyCard}>
              <FontAwesome name="inbox" size={48} color={theme.colors.textSecondary} />
              <Text style={styles.emptyText}>Nenhuma resposta registrada</Text>
            </Card>
          )}
        </ScrollView>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  headerBackground: {
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: theme.spacing.lg,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  headerBackButton: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.white + '20',
    borderRadius: 8,
    marginRight: theme.spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...theme.typography.h2,
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    ...theme.typography.body,
    color: theme.colors.white + 'DD',
    fontSize: 14,
    marginTop: theme.spacing.xs,
  },
  headerDate: {
    ...theme.typography.caption,
    color: theme.colors.white + 'AA',
    fontSize: 12,
    marginTop: theme.spacing.xs,
  },
  statusCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: theme.spacing.xs,
  },
  statusBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: theme.spacing.sm,
  },
  statusText: {
    ...theme.typography.body,
    fontWeight: '600',
    fontSize: 16,
  },
  progressInfo: {
    alignItems: 'flex-end',
  },
  progressLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: theme.spacing.xs,
  },
  progressValue: {
    ...theme.typography.h2,
    color: theme.colors.primary,
    fontSize: 24,
    fontWeight: '700',
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  timestampText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
    fontSize: 12,
  },
  sectionsContainer: {
    gap: theme.spacing.md,
  },
  sectionContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  subsectionContainer: {
    backgroundColor: theme.colors.background,
    marginLeft: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  sectionHeader: {
    marginBottom: theme.spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevronIcon: {
    marginRight: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  subsectionTitle: {
    fontSize: 14,
  },
  sectionDescription: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    marginLeft: 26,
  },
  completedBadge: {
    backgroundColor: theme.colors.success + '20',
    borderRadius: 12,
    padding: 4,
    marginLeft: theme.spacing.sm,
  },
  requiredBadge: {
    backgroundColor: theme.colors.warning + '20',
    borderRadius: 8,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    marginLeft: theme.spacing.sm,
  },
  requiredText: {
    ...theme.typography.caption,
    color: theme.colors.warning,
    fontSize: 10,
    fontWeight: '600',
  },
  sectionContent: {
    marginTop: theme.spacing.sm,
  },
  subsectionsContainer: {
    marginTop: theme.spacing.sm,
  },
  fieldContainer: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '40',
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  fieldLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  fieldRequired: {
    color: theme.colors.error,
    marginLeft: 4,
    fontSize: 14,
  },
  fieldValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontSize: 14,
  },
  fieldValueEmpty: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  booleanBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  booleanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 16,
  },
  booleanBadgeYes: {
    backgroundColor: theme.colors.success + '15',
  },
  booleanBadgeNo: {
    backgroundColor: theme.colors.textSecondary + '15',
  },
  booleanBadgeText: {
    ...theme.typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
  booleanBadgeTextYes: {
    color: theme.colors.success,
  },
  booleanBadgeTextNo: {
    color: theme.colors.textSecondary,
  },
  multiSelectContainer: {
    gap: theme.spacing.sm,
  },
  multiSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '10',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  multiSelectText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    marginLeft: theme.spacing.xs,
    fontSize: 12,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '10',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  fileText: {
    ...theme.typography.button,
    color: theme.colors.primary,
    marginLeft: theme.spacing.sm,
    fontSize: 12,
  },
  emptyCard: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  errorTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  errorSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  backButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: 8,
  },
  backButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
});
