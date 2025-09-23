import React, { useCallback, useMemo, useState } from 'react';
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
import { apiService, API_BASE_URL } from '@services/api';
import { useAuthStore } from '@store/authStore';
import { PractitionerProfile, PractitionerProfileField } from '@/types/practitioner';

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

  const loadProfile = useCallback(async () => {
    if (!email) {
      return;
    }

    try {
      console.log('[MyProfileScreen] Loading practitioner profile for:', email);
      setLoading(true);
      const profile = await apiService.getMyPractitionerProfile(email);
      console.log('[MyProfileScreen] Raw profile payload:', profile);

      setFormValues({
        name: profile.name || user?.name || '',
        cpf: profile.cpf || '',
        phone: profile.phone || '',
        gender: profile.gender || '',
        birthDate: profile.birthDate || '',
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
      setPhotoAvailable(true);
    } catch (error) {
      console.error('[MyProfileScreen] Failed to load profile. Raw error:', error);
      Alert.alert('Erro', 'Não foi possível carregar seus dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [email, user?.name]);

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
        updatedFields[key] = value;
      }
    });

    try {
      console.log('[MyProfileScreen] Saving profile with payload:', updatedFields);
      setSaving(true);
      await apiService.saveMyPractitionerProfile(updatedFields);
      Alert.alert('Sucesso', 'Suas informações foram atualizadas.');
    } catch (error) {
      console.error('[MyProfileScreen] Failed to save profile. Raw error:', error);
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
      console.log('[MyProfileScreen] Uploading new profile photo. Mime type:', mimeType, 'Base64 length:', asset.base64?.length);
      await apiService.saveMyPractitionerPhoto(email, dataURL);
      setPhotoAvailable(true);
      setPhotoVersion(prev => prev + 1);
      Alert.alert('Sucesso', 'Foto atualizada com sucesso.');
    } catch (error) {
      console.error('[MyProfileScreen] Failed to update photo. Raw error:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a foto. Tente novamente.');
    } finally {
      setPhotoUploading(false);
    }
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
              <Text style={styles.sectionTitle}>Foto e identificação</Text>
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
              {renderInput('CPF', 'cpf', {
                placeholder: '000.000.000-00',
                keyboardType: 'numeric',
                maxLength: 14,
              })}
              {renderInput('Telefone', 'phone', {
                placeholder: '+55 11 99999-0000',
                keyboardType: 'phone-pad',
              })}
              {renderInput('Gênero', 'gender', {
                placeholder: 'Masculino, Feminino, Outro',
              })}
              {renderInput('Data de nascimento', 'birthDate', {
                placeholder: 'DD/MM/AAAA',
              })}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Endereço</Text>
              {renderInput('CEP', 'cep', {
                placeholder: '00000-000',
                keyboardType: 'numeric',
                maxLength: 9,
              })}
              {renderInput('Estado', 'state', {
                placeholder: 'UF',
                maxLength: 2,
              })}
              {renderInput('Cidade', 'cityname', {
                placeholder: 'Cidade',
              })}
              {renderInput('Endereço completo', 'address', {
                placeholder: 'Rua, número e complemento',
              })}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Informações profissionais</Text>
              {renderInput('CRM', 'crm', {
                placeholder: 'Número do CRM',
              })}
              {renderInput('CNPJ', 'cnpj', {
                placeholder: '00.000.000/0000-00',
                keyboardType: 'numeric',
              })}
              {renderInput('Especialidade médica', 'qualification', {
                placeholder: 'Selecione sua especialidade',
              })}
              {renderInput('Qualificações', 'qualifications', {
                placeholder: 'Formações, cursos e experiências relevantes',
                multiline: true,
              })}
              {renderInput('Certificações', 'certifications', {
                placeholder: 'Certificações profissionais',
                multiline: true,
              })}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Presença online</Text>
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
          </ScrollView>
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
  },
  readOnlyCard: {
    backgroundColor: theme.colors.primary + '08',
    borderColor: theme.colors.primary + '30',
    padding: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.h3,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
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
  },
  textArea: {
    minHeight: 120,
    paddingTop: theme.spacing.md,
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
