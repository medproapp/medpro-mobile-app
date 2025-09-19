import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Button, Input, Card } from '@components/common';
import { theme } from '@theme/index';
import {
  OnboardingStepKey,
  SetupFormState,
  ServiceCategoryOption,
  ServiceTypeOption,
} from '@types/onboarding';
import { onboardingService } from '@services/onboardingService';

const generateCPF = ({ format = true }: { format?: boolean } = {}) => {
  const digitsBase = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));

  let sum1 = 0;
  for (let i = 0; i < 9; i += 1) {
    sum1 += digitsBase[i] * (10 - i);
  }
  const r1 = sum1 % 11;
  const d1 = r1 < 2 ? 0 : 11 - r1;

  let sum2 = 0;
  for (let i = 0; i < 9; i += 1) {
    sum2 += digitsBase[i] * (11 - i);
  }
  sum2 += d1 * 2;
  const r2 = sum2 % 11;
  const d2 = r2 < 2 ? 0 : 11 - r2;

  const digits = [...digitsBase, d1, d2].join('');
  if (!format) {
    return digits;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const randomChoice = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const generateRandomCep = () => {
  const prefixes = ['01001', '20010', '30130', '40020', '50030', '70040'];
  const suffix = String(Math.floor(Math.random() * 900) + 100).padStart(3, '0');
  return `${randomChoice(prefixes)}-${suffix}`;
};

const ADDRESS_SEEDS = [
  {
    addressLine: 'Av. Paulista',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
  },
  {
    addressLine: 'Rua da Consolação',
    neighborhood: 'Consolação',
    city: 'São Paulo',
    state: 'SP',
  },
  {
    addressLine: 'Av. Atlântica',
    neighborhood: 'Copacabana',
    city: 'Rio de Janeiro',
    state: 'RJ',
  },
  {
    addressLine: 'Rua Pernambuco',
    neighborhood: 'Funcionários',
    city: 'Belo Horizonte',
    state: 'MG',
  },
];

const generateRandomCrm = () => {
  const states = ['SP', 'RJ', 'MG', 'RS', 'SC', 'BA', 'PR', 'PE'];
  const number = String(Math.floor(Math.random() * 89999) + 10000);
  return `CRM/${randomChoice(states)} ${number}`;
};

const generateRandomPhone = () => {
  const ddds = ['11', '21', '31', '41', '51', '61'];
  const prefix = String(Math.floor(Math.random() * 90000) + 10000);
  const suffix = String(Math.floor(Math.random() * 9000) + 1000);
  return `(${randomChoice(ddds)}) 9${prefix}-${suffix}`;
};

const randomSubset = (ids: string[], max = 3) => {
  if (ids.length === 0) {
    return [];
  }
  const shuffled = [...ids].sort(() => Math.random() - 0.5);
  const count = Math.min(Math.max(1, Math.ceil(ids.length / 4)), Math.min(max, ids.length));
  return shuffled.slice(0, count);
};

const DURATION_OPTIONS = ['15', '30', '45', '60', '75', '90'];

interface SetupModalProps {
  visible: boolean;
  onClose: () => void;
  form: SetupFormState;
  updateForm: (values: Partial<SetupFormState>) => void;
  onSubmit: () => Promise<void>;
  submitting: boolean;
  categories: ServiceCategoryOption[];
  serviceTypes: ServiceTypeOption[];
  error?: string | null;
  canManagePricing: boolean;
  step: OnboardingStepKey;
}

export const SetupModal: React.FC<SetupModalProps> = ({
  visible,
  onClose,
  form,
  updateForm,
  onSubmit,
  submitting,
  categories,
  serviceTypes,
  error,
  canManagePricing,
  step,
}) => {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [durationSelectorVisible, setDurationSelectorVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      setDurationSelectorVisible(false);
    }
  }, [visible]);

  const isProfileStep = step === 'profile';
  const isParametersStep = step === 'parameters';

const normalizeOption = (raw: unknown, fallbackIndex: number) => {
  if (__DEV__) {
    console.log('[Onboarding] Raw option item:', raw);
  }

  if (raw == null) {
    return {
      id: `opt-${fallbackIndex}`,
      label: `Opção ${fallbackIndex + 1}`,
    };
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return normalizeOption(JSON.parse(trimmed), fallbackIndex);
      } catch (parseError) {
        if (__DEV__) {
          console.warn('[Onboarding] Não foi possível fazer parse do item de serviço/categoria:', trimmed, parseError);
        }
      }
    }
    return { id: `opt-${fallbackIndex}`, label: trimmed || `Opção ${fallbackIndex + 1}` };
  }

  if (typeof raw === 'number') {
    return { id: String(raw), label: String(raw) };
  }

  const item = raw as Record<string, any>;

  const idCandidate =
    item.id ??
    item.identifier ??
    item.value ??
    item.code ??
    item.slug ??
    item.categoryId ??
    item.category_id ??
    item.categoryid ??
    item.serviceTypeId ??
    item.serviceTypeID ??
    item.service_type_id ??
    item.serviceType ??
    item.tipo ??
    item.category ??
    item.nome ??
    item.name ??
    `opt-${fallbackIndex}`;

  const labelCandidate =
    item.label ??
    item.name ??
    item.nome ??
    item.title ??
    item.displayName ??
    item.description ??
    item.text ??
    item.categoryDesc ??
    item.categorydesc ??
    item.category_desc ??
    item.categoryName ??
    item.categoryname ??
    item.category_description ??
    item.categorydescription ??
    item.serviceTypeDesc ??
    item.serviceTypeDescription ??
    item.service_type_desc ??
    item.serviceTypeDescPt ??
    item.service_type_desc_pt ??
    item.servicetypeDesc ??
    item.servicetypeDescription ??
    item.serviceTypeName ??
    item.service_type_name ??
    item.serviceType ??
    item.service ??
    item.desc ??
    '';

  let label = String(labelCandidate ?? '').trim();
  if (!label && typeof item.categoryDesc === 'string') {
    label = item.categoryDesc.trim();
  }
  if (!label && typeof item.category_desc === 'string') {
    label = item.category_desc.trim();
  }
  if (!label && typeof item.serviceTypeDesc === 'string') {
    label = item.serviceTypeDesc.trim();
  }
  if (!label && typeof item.service_type_desc === 'string') {
    label = item.service_type_desc.trim();
  }
  if (!label && typeof item.serviceTypeName === 'string') {
    label = item.serviceTypeName.trim();
  }
  if (!label && typeof item.serviceType === 'string') {
    label = item.serviceType.trim();
  }
  if (!label && typeof item.service === 'string') {
    label = item.service.trim();
  }
  if (!label && typeof item.description === 'string') {
    label = item.description.trim();
  }

  return {
    id: String(idCandidate),
    label: label || `Opção ${fallbackIndex + 1}`,
  };
};

  const normalizedCategories = useMemo(() => {
    const mapped = categories.map((category, index) => normalizeOption(category as Record<string, any>, index));
    if (__DEV__) {
      console.log('[Onboarding] Categorias normalizadas:', mapped);
    }
    return mapped;
  }, [categories]);

  const normalizedServiceTypes = useMemo(() => {
    const mapped = serviceTypes.map((service, index) => normalizeOption(service as Record<string, any>, index));
    if (__DEV__) {
      console.log('[Onboarding] Tipos de serviço normalizados:', mapped);
    }
    return mapped;
  }, [serviceTypes]);

  const selectedCategoryIds = useMemo(() => new Set(form.categories), [form.categories]);
  const selectedServiceTypeIds = useMemo(() => new Set(form.specialties), [form.specialties]);

  const toggleCategory = useCallback(
    (id: string) => {
      const categoriesSet = new Set(form.categories);
      if (categoriesSet.has(id)) {
        categoriesSet.delete(id);
      } else {
        categoriesSet.add(id);
      }
      updateForm({ categories: Array.from(categoriesSet) });
    },
    [form.categories, updateForm]
  );

  const toggleServiceType = useCallback(
    (id: string) => {
      const serviceTypeSet = new Set(form.specialties);
      if (serviceTypeSet.has(id)) {
        serviceTypeSet.delete(id);
      } else {
        serviceTypeSet.add(id);
      }
      updateForm({ specialties: Array.from(serviceTypeSet) });
    },
    [form.specialties, updateForm]
  );

  const handleCepLookup = useCallback(async () => {
    if (!form.cep || form.cep.replace(/\D/g, '').length < 8) {
      setCepError('CEP inválido. Informe 8 dígitos.');
      return;
    }
    setCepLoading(true);
    setCepError(null);
    try {
      const cep = form.cep.replace(/\D/g, '');
      const result = (await onboardingService.lookupCep(cep)) as Record<string, any>;
      if (result?.erro) {
        setCepError('CEP não encontrado.');
      } else {
        updateForm({
          addressLine: result.logradouro || form.addressLine,
          neighborhood: result.bairro || form.neighborhood,
          city: result.localidade || form.city,
          state: (result.uf || form.state || '').toUpperCase(),
          ibgeCode: result.ibge || form.ibgeCode,
          number: form.number || 'S/N',
        });
      }
    } catch (lookupError) {
      console.error('CEP lookup failed', lookupError);
      setCepError('Não foi possível consultar o CEP.');
    } finally {
      setCepLoading(false);
    }
  }, [form.cep, form.addressLine, form.neighborhood, form.city, form.state, updateForm]);

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    try {
      await onSubmit();
    } catch (submitErr) {
      setSubmitError(submitErr instanceof Error ? submitErr.message : 'Não foi possível concluir o cadastro.');
    }
  }, [onSubmit]);

  const primaryActionLabel = useMemo(() => {
    if (submitting) {
      return 'Salvando...';
    }
    return isProfileStep ? 'Salvar e continuar' : 'Salvar e concluir';
  }, [isProfileStep, submitting]);

  const durationLabel = useMemo(() => {
    if (!form.duration) {
      return 'Selecione a duração';
    }
    return `${form.duration} minutos`;
  }, [form.duration]);

  const handlePriceChange = useCallback(
    (input: string) => {
      const sanitized = input.replace(/[^0-9.,]/g, '');
      updateForm({ price: sanitized });
    },
    [updateForm]
  );

  const handleDurationSelect = useCallback(
    (value: string) => {
      updateForm({ duration: value });
      setDurationSelectorVisible(false);
    },
    [updateForm]
  );

  const handleDevFill = useCallback(() => {
    if (!__DEV__) {
      return;
    }

    if (isProfileStep) {
      const cep = generateRandomCep();
      const cpf = generateCPF({ format: true });
      const crm = generateRandomCrm();
      const phone = generateRandomPhone();
      const addressSeed = randomChoice(ADDRESS_SEEDS);

      updateForm({
        cpf,
        crm,
        phone,
        cep,
        number: String(Math.floor(Math.random() * 900) + 100),
        addressLine: addressSeed.addressLine,
        neighborhood: addressSeed.neighborhood,
        city: addressSeed.city,
        state: addressSeed.state,
        ibgeCode: addressSeed.state === 'SP' ? '3550308' : addressSeed.state === 'RJ' ? '3304557' : '3106200',
      });
      return;
    }

    if (isParametersStep) {
      const categoryIds = normalizedCategories.map(item => item.id);
      const serviceTypeIds = normalizedServiceTypes.map(item => item.id);

      updateForm({
        categories: randomSubset(categoryIds, 4),
        specialties: randomSubset(serviceTypeIds, 6),
        price: '150',
        duration: form.duration || randomChoice(DURATION_OPTIONS),
        interval: '0',
        autoCreateService: true,
      });
    }
  }, [form.duration, isParametersStep, isProfileStep, normalizedCategories, normalizedServiceTypes, updateForm]);

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalContainer}
          >
            <Card style={styles.modalContent} padding="lg">
              <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={styles.topBar}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Fechar">
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalTitle}>
                {isProfileStep ? 'Dados do consultório' : 'Parâmetros de atendimento'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {isProfileStep
                  ? 'Informe CPF/CRM, telefone e endereço para ativarmos seu consultório.'
                  : 'Escolha categorias, especialidades e ajustes básicos das consultas.'}
              </Text>

              {__DEV__ && (
                <Button
                  title="Preencher com dados de teste"
                  variant="outline"
                  onPress={handleDevFill}
                  style={styles.devFillButton}
                />
              )}

              {isProfileStep && (
                <>
                  <Text style={styles.sectionTitle}>Informações profissionais</Text>
                  <Input
                    label="CPF"
                    value={form.cpf}
                    onChangeText={cpf => updateForm({ cpf })}
                    placeholder="000.000.000-00"
                    keyboardType="numeric"
                  />
                  <Input
                    label="CRM"
                    value={form.crm}
                    onChangeText={crm => updateForm({ crm })}
                    placeholder="CRM"
                  />
                  <Input
                    label="Telefone"
                    value={form.phone}
                    onChangeText={phone => updateForm({ phone })}
                    placeholder="(00) 00000-0000"
                    keyboardType="phone-pad"
                  />

                  <Text style={styles.sectionTitle}>CEP do consultório</Text>
                  <Input
                    label="CEP"
                    value={form.cep}
                    onChangeText={cep => updateForm({ cep })}
                    onBlur={handleCepLookup}
                    placeholder="00000-000"
                    keyboardType="numeric"
                    rightIcon={cepLoading ? <ActivityIndicator size="small" /> : undefined}
                  />
                  {cepError && <Text style={styles.errorText}>{cepError}</Text>}

                  <View style={styles.addressPreview}>
                    <Text style={styles.addressLabel}>Endereço detectado</Text>
                    {form.addressLine ? (
                      <Text style={styles.addressValue}>
                        {form.addressLine}
                        {form.neighborhood ? `, ${form.neighborhood}` : ''}
                        {form.city ? ` - ${form.city}/${form.state}` : ''}
                      </Text>
                    ) : (
                      <Text style={styles.addressPlaceholder}>
                        Informe o CEP para preencher automaticamente o endereço.
                      </Text>
                    )}
                  </View>
                </>
              )}

              {isParametersStep && (
                <>
                  {canManagePricing && (
                    <>
                      <Text style={styles.sectionTitle}>Parâmetros de atendimento</Text>
                      <View style={styles.inlineFields}>
                        <Input
                          label="Preço padrão"
                          value={form.price}
                          onChangeText={handlePriceChange}
                          placeholder="150"
                          keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                          containerStyle={styles.inlineInput}
                        />
                        <View style={styles.durationContainer}>
                          <Text style={styles.durationLabel}>Duração padrão</Text>
                          <TouchableOpacity
                            style={styles.durationField}
                            onPress={() => setDurationSelectorVisible(current => !current)}
                            accessibilityRole="button"
                            accessibilityLabel="Selecionar duração padrão"
                          >
                            <Text
                              style={[styles.durationValue, !form.duration && styles.durationPlaceholder]}
                            >
                              {durationLabel}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      {durationSelectorVisible && (
                        <View style={styles.selectorInline}>
                          {DURATION_OPTIONS.map(option => (
                            <TouchableOpacity
                              key={option}
                              style={[
                                styles.selectorOption,
                                form.duration === option && styles.selectorOptionActive,
                              ]}
                              onPress={() => handleDurationSelect(option)}
                            >
                              <Text
                                style={[
                                  styles.selectorOptionText,
                                  form.duration === option && styles.selectorOptionActiveText,
                                ]}
                              >
                                {`${option} minutos`}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </>
                  )}

                  <Text style={styles.sectionTitle}>Categorias</Text>
                  <View style={styles.chipContainer}>
                    {normalizedCategories.map(normalized => {
                      const isSelected = selectedCategoryIds.has(normalized.id);
                      return (
                        <TouchableOpacity
                          key={normalized.id}
                          style={[styles.chip, isSelected && styles.chipSelected]}
                          onPress={() => toggleCategory(normalized.id)}
                        >
                          <Text
                            style={[styles.chipText, isSelected && styles.chipTextSelected]}
                            numberOfLines={1}
                          >
                            {normalized.label || 'Opção'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.sectionTitle}>Tipos de serviço</Text>
                  <View style={styles.chipContainer}>
                    {normalizedServiceTypes.map(normalized => {
                      const isSelected = selectedServiceTypeIds.has(normalized.id);
                      return (
                        <TouchableOpacity
                          key={normalized.id}
                          style={[styles.chip, isSelected && styles.chipSelected]}
                          onPress={() => toggleServiceType(normalized.id)}
                        >
                          <Text
                            style={[styles.chipText, isSelected && styles.chipTextSelected]}
                            numberOfLines={1}
                          >
                            {normalized.label || 'Opção'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                </>
              )}

              {error && <Text style={styles.errorText}>{error}</Text>}
              {submitError && <Text style={styles.errorText}>{submitError}</Text>}

              <View style={styles.actionsRow}>
                <Button
                  title={primaryActionLabel}
                  onPress={handleSubmit}
                  fullWidth
                  loading={submitting}
                  disabled={submitting}
                  style={styles.actionButton}
                />
              </View>
            </ScrollView>
          </Card>
        </KeyboardAvoidingView>
      </View>
    </Modal>

    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  modalContent: {
    maxHeight: '90%',
  },
  scrollContent: {
    paddingBottom: theme.spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: theme.spacing.xs,
  },
  closeButton: {
    padding: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  closeIcon: {
    fontSize: 20,
    color: theme.colors.textSecondary,
  },
  modalTitle: {
    ...theme.typography.h2,
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  modalSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.h4,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  inlineFields: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  inlineInput: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  durationContainer: {
    flex: 1,
    marginRight: 0,
  },
  durationLabel: {
    ...theme.typography.label,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  durationField: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.medium,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  durationValue: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  durationPlaceholder: {
    color: theme.colors.textSecondary,
  },
  selectorInline: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.xs,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.sm,
  },
 chip: {
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    minHeight: 34,
    minWidth: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
  },
  chipText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    textAlign: 'center',
  },
  chipTextSelected: {
    color: theme.colors.surface,
  },
  devFillButton: {
    marginTop: theme.spacing.sm,
  },
  addressPreview: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  addressLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  addressValue: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  addressPlaceholder: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  selectorOption: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  selectorOptionText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  selectorOptionActive: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.borderRadius.medium,
    paddingHorizontal: theme.spacing.sm,
  },
  selectorOptionActiveText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
});
