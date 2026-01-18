import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '@theme/index';
import { ResponsiveContainer } from '@components/common';
import { apiService, API_BASE_URL } from '@services/api';
import { useAuthStore } from '@store/authStore';
import { PractitionerProfile, PractitionerProfileField } from '@/types/practitioner';
import { SelectionModal, SelectionOption } from '@/components/SelectionModal';
import { MaskedInput } from '@/components/MaskedInput';
import { DatePickerInput } from '@/components/DatePickerInput';
import { validateCPF, validatePhone } from '@/utils/validation';
import { convertIsoToDisplayDate, convertDisplayDateToIso } from '@/utils/dateHelpers';
import { logger } from '@/utils/logger';

const TEXT_INPUT_HEIGHT = Platform.select({ ios: 46, android: 48, default: 46 });

export const MyProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, token } = useAuthStore();
  const email = user?.email || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoAvailable, setPhotoAvailable] = useState(true);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [formValues, setFormValues] = useState<Partial<PractitionerProfile>>({});

  // Selection modals state
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);

  // Location data
  const [states, setStates] = useState<Array<{ id: number; sigla: string; nome: string }>>([]);
  const [cities, setCities] = useState<Array<{ id: number; nome: string }>>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  // CEP lookup state
  const [cepLoading, setCepLoading] = useState(false);
  const [cepSuccess, setCepSuccess] = useState(false);
  const [cepError, setCepError] = useState<string | undefined>();

  // Validation errors
  const [cpfError, setCpfError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [birthDateError, setBirthDateError] = useState<string | undefined>();

  const userTypeLabel = useMemo(() => {
    const roleSource = user?.userRole || user?.role;
    if (!roleSource) {
      return 'Não informado';
    }

    const normalized = roleSource.toLowerCase();
    const roleMap: Record<string, string> = {
      pract: 'Profissional de saúde',
      practitioner: 'Profissional de saúde',
      assist: 'Assistente',
      assistant: 'Assistente',
      admin: 'Administrador',
    };

    return roleMap[normalized] || roleSource;
  }, [user?.role, user?.userRole]);

  const photoUri = useMemo(() => {
    if (!email || !token) {
      return null;
    }
    return `${API_BASE_URL}/pract/getmyphoto?email=${encodeURIComponent(email)}&t=${photoVersion}`;
  }, [email, photoVersion, token]);

  // Gender options (matching web app)
  const genderOptions: SelectionOption[] = [
    { label: 'Prefiro não informar', value: '' },
    { label: 'Masculino', value: 'male' },
    { label: 'Feminino', value: 'female' },
    { label: 'Outro', value: 'other' },
  ];

  // Convert states to selection options
  const stateOptions: SelectionOption[] = useMemo(
    () => states.map(s => ({ label: `${s.nome} (${s.sigla})`, value: s.sigla })),
    [states]
  );

  // Convert cities to selection options
  const cityOptions: SelectionOption[] = useMemo(
    () => cities.map(c => ({ label: c.nome, value: String(c.id) })),
    [cities]
  );

  // Load states on mount
  useEffect(() => {
    const loadStates = async () => {
      try {
        const statesData = await apiService.getStates();
        setStates(statesData);
      } catch (error) {
        logger.error('Failed to load states:', error);
      }
    };
    loadStates();
  }, []);

  // Load cities when state changes
  const loadCities = useCallback(async (stateCode: string) => {
    if (!stateCode) {
      setCities([]);
      return;
    }

    try {
      setLoadingCities(true);
      const citiesData = await apiService.getCities(stateCode);
      setCities(citiesData);
    } catch (error) {
      logger.error('Failed to load cities:', error);
      Alert.alert('Erro', 'Não foi possível carregar as cidades.');
    } finally {
      setLoadingCities(false);
    }
  }, []);

  // Handle CEP auto-lookup
  const handleCEPChange = useCallback(async (cep: string) => {
    setFormValues(prev => ({ ...prev, cep }));
    setCepError(undefined);
    setCepSuccess(false);

    // Remove formatting
    const cleanCEP = cep.replace(/\D/g, '');
    if (cleanCEP.length !== 8) {
      return;
    }

    try {
      setCepLoading(true);
      const result = await apiService.lookupCEP(cep);

      // Auto-fill fields
      setFormValues(prev => ({
        ...prev,
        state: result.uf,
        cityname: result.localidade,
        address: result.logradouro
          ? `${result.logradouro}${result.bairro ? `, ${result.bairro}` : ''}${result.complemento ? `, ${result.complemento}` : ''}`
          : prev.address,
      }));

      // Load cities for the state
      await loadCities(result.uf);

      setCepSuccess(true);
      setTimeout(() => setCepSuccess(false), 3000);
    } catch (error: any) {
      setCepError(error.message || 'Erro ao consultar CEP');
    } finally {
      setCepLoading(false);
    }
  }, [loadCities]);

  const loadProfile = useCallback(async () => {
    if (!email) {
      return;
    }

    try {
      setLoading(true);
      const profile = await apiService.getMyPractitionerProfile(email);

      setFormValues({
        name: profile.name || user?.name || '',
        cpf: profile.cpf || '',
        phone: profile.phone || '',
        gender: profile.gender || '',
        birthDate: profile.birthDate ? convertIsoToDisplayDate(profile.birthDate) : '',
        crm: profile.crm || '',
        cnpj: profile.cnpj || '',
        qualification: profile.qualification || profile.category || '',
        qualifications: profile.qualifications || '',
        certifications: profile.certifications || '',
        medsite: profile.medsite || '',
        address: profile.address || '',
        cep: profile.cep || '',
        cityname: profile.cityname || profile.city || '',
        state: profile.state || '',
        bio: profile.bio || '',
      });

      // Load cities if state is set
      if (profile.state) {
        await loadCities(profile.state);
      }

      setPhotoAvailable(true);
    } catch (error) {
      logger.error('Failed to load practitioner profile:', error);
      Alert.alert('Erro', 'Não foi possível carregar seus dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [email, user?.name, loadCities]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent?.();
      parent?.setOptions({ tabBarStyle: { display: 'none' } });

      return () => {
        parent?.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation])
  );

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleChange = (field: PractitionerProfileField, value: string) => {
    setFormValues(prev => ({
      ...prev,
      [field]: field === 'state' ? value.toUpperCase() : value,
    }));
  };

  const handleSave = async () => {
    if (!email) {
      Alert.alert('Erro', 'Não foi possível identificar o usuário.');
      return;
    }

    const updatedFields: Record<string, unknown> = { email };

    (Object.entries(formValues) as [PractitionerProfileField, unknown][]).forEach(([key, value]) => {
      if (typeof value !== 'undefined') {
        // Convert birthDate from DD/MM/YYYY to ISO format for API
        if (key === 'birthDate' && typeof value === 'string' && value) {
          // Convert date format for API (keep camelCase to match API response)
          updatedFields['birthDate'] = convertDisplayDateToIso(value);
        } else {
          updatedFields[key] = value;
        }
      }
    });

    try {
      setSaving(true);
      await apiService.saveMyPractitionerProfile(updatedFields);

      // Reload profile to confirm data was saved
      await loadProfile();

      Alert.alert('Sucesso', 'Suas informações foram atualizadas.');
    } catch (error) {
      logger.error('Failed to save practitioner profile:', error);
      Alert.alert('Erro', 'Não foi possível salvar as alterações. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const requestPhotoPermissions = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permissão necessária',
        'Precisamos de acesso às suas fotos para atualizar a imagem do perfil.'
      );
      return false;
    }
    return true;
  };

  const handleSelectPhoto = async () => {
    if (!email) {
      Alert.alert('Erro', 'Não foi possível identificar o usuário.');
      return;
    }

    const hasPermission = await requestPhotoPermissions();
    if (!hasPermission) {
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];

      if (!asset.base64) {
        Alert.alert('Erro', 'Não foi possível ler a imagem selecionada.');
        return;
      }

      const mimeType = asset.mimeType || 'image/jpeg';
      const dataURL = `data:${mimeType};base64,${asset.base64}`;

      setPhotoUploading(true);
      await apiService.saveMyPractitionerPhoto(email, dataURL);
      setPhotoAvailable(true);
      setPhotoVersion(prev => prev + 1);
      Alert.alert('Sucesso', 'Foto atualizada com sucesso.');
    } catch (error) {
      logger.error('Failed to update profile photo:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a foto. Tente novamente.');
    } finally {
      setPhotoUploading(false);
    }
  };

  // Selection handlers
  const handleGenderSelect = (value: string) => {
    setFormValues(prev => ({ ...prev, gender: value }));
  };

  const handleStateSelect = async (value: string) => {
    setFormValues(prev => ({ ...prev, state: value, cityname: '' })); // Reset city when state changes
    await loadCities(value);
  };

  const handleCitySelect = (value: string) => {
    // Find city name from ID
    const city = cities.find(c => String(c.id) === value);
    setFormValues(prev => ({ ...prev, cityname: city?.nome || value }));
  };

  // Validation handlers
  const handleCPFChange = (text: string) => {
    setFormValues(prev => ({ ...prev, cpf: text }));
    setCpfError(undefined);

    const cleanCPF = text.replace(/\D/g, '');
    if (cleanCPF.length === 11) {
      if (!validateCPF(text)) {
        setCpfError('CPF inválido');
      }
    }
  };

  const handlePhoneChange = (text: string) => {
    setFormValues(prev => ({ ...prev, phone: text }));
    setPhoneError(undefined);

    const cleanPhone = text.replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      if (!validatePhone(text)) {
        setPhoneError('Telefone inválido');
      }
    }
  };

  const handleBirthDateChange = (dateString: string) => {
    setFormValues(prev => ({ ...prev, birthDate: dateString }));
    setBirthDateError(undefined);

    // Validate date format DD/MM/YYYY
    if (dateString && dateString.length === 10) {
      try {
        const [day, month, year] = dateString.split('/').map(s => parseInt(s, 10));

        // Basic validation
        if (isNaN(day) || isNaN(month) || isNaN(year)) {
          setBirthDateError('Data inválida');
          return;
        }

        // Create date at noon to avoid timezone issues
        const selectedDate = new Date(year, month - 1, day, 12, 0, 0, 0);
        const today = new Date();
        const minDate = new Date();
        minDate.setFullYear(today.getFullYear() - 120); // Max 120 years old

        // Check if date is in the future
        if (selectedDate > today) {
          setBirthDateError('Data não pode ser futura');
          return;
        }

        // Check if date is too old
        if (selectedDate < minDate) {
          setBirthDateError('Data muito antiga');
          return;
        }

        // Calculate age
        const age = today.getFullYear() - year;
        if (age < 0) {
          setBirthDateError('Data inválida');
          return;
        }

      } catch (error) {
        setBirthDateError('Data inválida');
      }
    }
  };

  // Render a selection input field
  const renderSelectionInput = (
    label: string,
    value: string | undefined,
    placeholder: string,
    onPress: () => void,
    disabled: boolean = false
  ) => {
    const displayValue = value || placeholder;
    const hasValue = Boolean(value);

    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TouchableOpacity
          style={[styles.selectionButton, disabled && styles.selectionButtonDisabled]}
          onPress={onPress}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={[styles.selectionButtonText, !hasValue && styles.selectionButtonPlaceholder]}>
            {displayValue}
          </Text>
          <FontAwesome name="chevron-down" size={14} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderInput = (
    label: string,
    field: PractitionerProfileField,
    options?: {
      placeholder?: string;
      keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'url';
      multiline?: boolean;
      maxLength?: number;
    }
  ) => {
    const { placeholder, keyboardType = 'default', multiline = false, maxLength } = options || {};
    const rawValue = formValues[field];
    const value = rawValue === null || typeof rawValue === 'undefined' ? '' : String(rawValue);

    return (
      <View style={styles.fieldContainer} key={field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={text => handleChange(field, text)}
          style={[styles.textInput, multiline && styles.textArea]}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          maxLength={maxLength}
          textAlignVertical={multiline ? 'top' : 'center'}
          scrollEnabled={multiline}
        />
      </View>
    );
  };

  const renderReadOnlyField = (
    label: string,
    value?: string | null,
    options?: {
      variant?: 'badge';
      tone?: 'primary' | 'success' | 'muted';
    }
  ) => {
    const resolvedValue = value && value.trim().length ? value : 'Não informado';
    const isBadge = options?.variant === 'badge';

    return (
      <View style={styles.readOnlyField} key={label}>
        <Text style={styles.readOnlyLabel}>{label}</Text>
        {isBadge ? (
          <View
            style={[
              styles.badge,
              options?.tone === 'success' && styles.badgeSuccess,
              options?.tone === 'muted' && styles.badgeMuted,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                options?.tone === 'muted' && styles.badgeTextMuted,
              ]}
            >
              {resolvedValue}
            </Text>
          </View>
        ) : (
          <Text style={styles.readOnlyValue}>{resolvedValue}</Text>
        )}
      </View>
    );
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.container}>
        <View style={styles.headerBackground}>
          <Image
            source={require('../../assets/medpro-logo.png')}
            style={styles.backgroundLogo}
            resizeMode="contain"
          />
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleGoBack}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <FontAwesome name="chevron-left" size={18} color={theme.colors.white} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.greeting}>Meu Perfil</Text>
              <Text style={styles.subheading}>Atualize suas informações profissionais</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Carregando dados...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ResponsiveContainer>
            <View style={[styles.card, styles.readOnlyCard]}>
              <View style={styles.readOnlyHeader}>
                <View style={styles.readOnlyIconWrapper}>
                  <FontAwesome name="id-card" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.readOnlyHeaderText}>
                  <Text style={styles.sectionTitle}>Informações do usuário</Text>
                  <View style={styles.badgeRow}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{userTypeLabel}</Text>
                    </View>
                    {user?.isAdmin && (
                      <View style={[styles.badge, styles.badgeSuccess]}>
                        <Text style={styles.badgeText}>Admin</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.readOnlyGrid}>
                {renderReadOnlyField('Email', user?.email)}
                {renderReadOnlyField('Organização', user?.organization)}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconWrapper}>
                  <FontAwesome name="user-circle" size={20} color={theme.colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Foto e identificação</Text>
              </View>
              <View style={styles.photoRow}>
                <View style={styles.photoWrapper}>
                  {photoUri && photoAvailable ? (
                    <Image
                      source={{
                        uri: photoUri,
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                      }}
                      style={styles.avatar}
                      onError={() => setPhotoAvailable(false)}
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>
                        {(formValues.name || user?.name || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {photoUploading && (
                    <View style={styles.avatarOverlay}>
                      <ActivityIndicator size="small" color={theme.colors.white} />
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={handleSelectPhoto}
                  activeOpacity={0.7}
                  disabled={photoUploading}
                >
                  <FontAwesome name="camera" size={16} color={theme.colors.primary} />
                  <Text style={styles.photoButtonText}>
                    {photoUploading ? 'Atualizando...' : 'Alterar foto'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cardDivider} />

              {renderInput('Nome completo', 'name', {
                placeholder: 'Como deseja ser chamado(a)',
              })}

              <MaskedInput
                label="CPF"
                value={formValues.cpf || ''}
                onChangeText={handleCPFChange}
                maskType="cpf"
                placeholder="000.000.000-00"
                error={cpfError}
              />

              <MaskedInput
                label="Telefone"
                value={formValues.phone || ''}
                onChangeText={handlePhoneChange}
                maskType="phone"
                placeholder="(00) 00000-0000"
                error={phoneError}
              />

              {renderSelectionInput(
                'Gênero',
                genderOptions.find(g => g.value === formValues.gender)?.label,
                'Selecione o gênero',
                () => setShowGenderModal(true)
              )}

              <DatePickerInput
                label="Data de nascimento"
                value={formValues.birthDate || ''}
                onChangeDate={handleBirthDateChange}
                placeholder="DD/MM/AAAA"
                error={birthDateError}
              />
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconWrapper}>
                  <FontAwesome name="map-marker" size={20} color={theme.colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Endereço</Text>
              </View>

              <MaskedInput
                label="CEP"
                value={formValues.cep || ''}
                onChangeText={handleCEPChange}
                maskType="cep"
                placeholder="00000-000"
                loading={cepLoading}
                success={cepSuccess}
                error={cepError}
              />

              {renderSelectionInput(
                'Estado',
                formValues.state ? stateOptions.find(s => s.value === formValues.state)?.label : undefined,
                'Selecione o estado',
                () => setShowStateModal(true)
              )}

              {renderSelectionInput(
                'Cidade',
                formValues.cityname,
                loadingCities ? 'Carregando cidades...' : 'Selecione a cidade',
                () => setShowCityModal(true),
                !formValues.state || loadingCities
              )}

              {renderInput('Endereço completo', 'address', {
                placeholder: 'Rua, número e complemento',
              })}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconWrapper}>
                  <FontAwesome name="user-md" size={20} color={theme.colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Dados profissionais</Text>
              </View>
              {renderInput('CRM', 'crm', {
                placeholder: 'Número do CRM',
              })}
              {renderInput('Qualificações e Certificações', 'qualifications', {
                placeholder: 'Descreva suas qualificações, certificações e especializações...',
                multiline: true,
              })}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconWrapper}>
                  <FontAwesome name="globe" size={20} color={theme.colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Presença online</Text>
              </View>
              {renderInput('Site profissional', 'medsite', {
                placeholder: 'https://',
                keyboardType: 'url',
              })}
              {renderInput('Biografia profissional', 'bio', {
                placeholder: 'Conte um pouco sobre sua experiência...',
                multiline: true,
              })}
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              activeOpacity={0.7}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <>
                  <FontAwesome name="check" size={16} color={theme.colors.white} />
                  <Text style={styles.saveButtonText}>Salvar alterações</Text>
                </>
              )}
            </TouchableOpacity>
            </ResponsiveContainer>
          </ScrollView>
        )}

        {/* Selection Modals */}
        <SelectionModal
          visible={showGenderModal}
          title="Selecione o gênero"
          options={genderOptions}
          selectedValue={formValues.gender}
          onSelect={handleGenderSelect}
          onClose={() => setShowGenderModal(false)}
        />

        <SelectionModal
          visible={showStateModal}
          title="Selecione o estado"
          options={stateOptions}
          selectedValue={formValues.state}
          onSelect={handleStateSelect}
          onClose={() => setShowStateModal(false)}
        />

        <SelectionModal
          visible={showCityModal}
          title="Selecione a cidade"
          options={cityOptions}
          selectedValue={cities.find(c => c.nome === formValues.cityname)?.id.toString()}
          onSelect={handleCitySelect}
          onClose={() => setShowCityModal(false)}
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
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: theme.spacing.lg,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
    zIndex: 1,
  },
  backgroundLogo: {
    position: 'absolute',
    right: -20,
    top: '50%',
    width: 120,
    height: 120,
    opacity: 0.1,
    transform: [{ translateY: -60 }],
    tintColor: theme.colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.white + '22',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    ...theme.typography.h1,
    color: theme.colors.white,
    fontSize: 24,
    fontWeight: '700',
  },
  subheading: {
    ...theme.typography.caption,
    color: theme.colors.white + 'AA',
    fontSize: 14,
    marginTop: theme.spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.textSecondary,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
    overflow: 'hidden',
  },
  readOnlyCard: {
    backgroundColor: theme.colors.primary + '08',
    borderColor: theme.colors.primary + '30',
    padding: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  cardIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.h3,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  readOnlyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  readOnlyIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  readOnlyHeaderText: {
    flex: 1,
  },
  readOnlySubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoWrapper: {
    position: 'relative',
    marginRight: theme.spacing.lg,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
    backgroundColor: theme.colors.primary + '70',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.primary + '20',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    ...theme.typography.h1,
    fontSize: 32,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 999,
    backgroundColor: theme.colors.primary + '15',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  photoButtonText: {
    marginLeft: theme.spacing.sm,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  readOnlyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -theme.spacing.xs,
  },
  readOnlyField: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 140,
    paddingHorizontal: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  readOnlyLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  readOnlyValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    flexWrap: 'wrap',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: theme.borderRadius.round,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.primary + '18',
  },
  badgeSuccess: {
    backgroundColor: theme.colors.success + '20',
  },
  badgeMuted: {
    backgroundColor: theme.colors.border + '40',
  },
  badgeText: {
    ...theme.typography.bodySmall,
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  badgeTextMuted: {
    color: theme.colors.textSecondary,
  },
  fieldContainer: {
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  fieldLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    height: TEXT_INPUT_HEIGHT,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    width: '100%',
  },
  textArea: {
    height: undefined, // Remove fixed height for multiline
    minHeight: 120,
    maxHeight: 200,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    width: '100%',
  },
  selectionButton: {
    height: TEXT_INPUT_HEIGHT,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionButtonDisabled: {
    opacity: 0.5,
  },
  selectionButtonText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  selectionButtonPlaceholder: {
    color: theme.colors.textSecondary,
  },
  cardDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontWeight: '700',
    marginLeft: theme.spacing.sm,
  },
});
