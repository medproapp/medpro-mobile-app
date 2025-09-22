import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onboardingService } from '@services/onboardingService';
import { useAuthStore } from '@store/authStore';
import {
  OnboardingState,
  OnboardingStepKey,
  OnboardingStepState,
  SetupFormState,
  ServiceCategoryOption,
  ServiceTypeOption,
} from '@types/onboarding';

const createInitialForm = (): SetupFormState => ({
  cpf: '',
  crm: '',
  phone: '',
  cep: '',
  addressLine: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  ibgeCode: '',
  price: '150',
  duration: '30',
  interval: '0',
  specialties: [],
  categories: [],
  autoCreateService: true,
});

const INITIAL_STEPS: OnboardingStepState[] = [
  {
    key: 'profile',
    title: 'Dados do consultório',
    description: 'CPF/CRM, telefone e CEP para localizarmos seu consultório.',
    status: 'pending',
  },
  {
    key: 'parameters',
    title: 'Parâmetros de atendimento',
    description: 'Escolha tipos de atendimento, especialidades e (se disponível) duração/valor.',
    status: 'pending',
  },
  {
    key: 'ai',
    title: 'Assistente IA (opcional)',
    description: 'Descubra como a IA MedPro pode ajudar em breve.',
    status: 'pending',
    disabled: true,
  },
];

const ONBOARDING_STORAGE_KEY = 'medpro-onboarding';

const debugLog = (...args: unknown[]) => {
  if (__DEV__) {
    console.log('[OnboardingStore]', ...args);
  }
};

interface InitializeOptions {
  reloadCatalog?: boolean;
}

interface OnboardingStore extends OnboardingState {
  initialize: (options?: InitializeOptions) => Promise<void>;
  refreshChecklist: () => Promise<void>;
  openModal: (step: OnboardingStepKey) => void;
  closeModal: () => void;
  updateForm: (values: Partial<SetupFormState>) => void;
  submitSetup: () => Promise<void>;
  reset: () => void;
  setCanManagePricing: (value: boolean) => void;
}

const extractArray = (raw: unknown, seen = new Set<object>()): unknown[] => {
  if (Array.isArray(raw)) {
    return raw as unknown[];
  }

  if (raw === null || typeof raw !== 'object') {
    return [];
  }

  const reference = raw as object;

  if (seen.has(reference)) {
    return [];
  }
  seen.add(reference);

  const obj = reference as Record<string, unknown>;
  const candidateKeys = [
    'data',
    'items',
    'results',
    'list',
    'value',
    'values',
    'content',
    'serviceCategoryList',
    'serviceCategories',
    'serviceTypeList',
    'serviceTypes',
  ];

  for (const key of candidateKeys) {
    if (key in obj) {
      const extracted = extractArray(obj[key], seen);
      if (extracted.length > 0) {
        return extracted;
      }
    }
  }

  for (const value of Object.values(obj)) {
    const extracted = extractArray(value, seen);
    if (extracted.length > 0) {
      return extracted;
    }
  }

  return [];
};

const computeProgress = (steps: OnboardingStepState[]): { value: number; label: string } => {
  const requiredKeys: OnboardingStepKey[] = ['profile', 'parameters'];
  const total = requiredKeys.length;
  const completed = steps.filter(step => requiredKeys.includes(step.key) && step.status === 'completed').length;
  const percentage = Math.round((completed / total) * 100);
  const label = completed === total ? 'Onboarding completo' : `${completed} de ${total} etapas concluídas`;
  return { value: percentage, label };
};

const calculateStatus = (
  checklist: Partial<{ profileCompleted: boolean; parametersCompleted: boolean }>,
  steps: OnboardingStepState[]
) => {
  const nextSteps = steps.map(step => {
    if (step.key === 'profile' && checklist.profileCompleted !== undefined) {
      const status: 'completed' | 'pending' = checklist.profileCompleted ? 'completed' : 'pending';
      return { ...step, status };
    }
    if (step.key === 'parameters' && checklist.parametersCompleted !== undefined) {
      const status: 'completed' | 'pending' = checklist.parametersCompleted ? 'completed' : 'pending';
      return { ...step, status };
    }
    return step;
  });

  const anyInProgress = nextSteps.some(step => step.status === 'in-progress');
  if (!anyInProgress) {
    const firstPendingIndex = nextSteps.findIndex(step => step.status === 'pending' && !step.disabled);
    if (firstPendingIndex >= 0) {
      nextSteps[firstPendingIndex] = {
        ...nextSteps[firstPendingIndex],
        status: 'in-progress',
      };
    }
  }

  const progress = computeProgress(nextSteps);

  return { steps: nextSteps, progress };
};

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      isInitialized: false,
      isLoading: false,
      isSubmitting: false,
      error: null,
      practitionerName: '',
      practitionerEmail: '',
      organizationName: undefined,
      organizationLogoUrl: undefined,
      progress: { value: 0, label: '0 de 2 etapas concluídas' },
      steps: INITIAL_STEPS.map(step => ({ ...step })),
      checklist: {
        profileCompleted: false,
        parametersCompleted: false,
      },
      form: createInitialForm(),
      availableCategories: [],
      availableServiceTypes: [],
      lastValidatedAt: undefined,
      modalVisible: false,
      activeStep: 'profile',
      canManagePricing: false,

      reset: () => {
        debugLog('reset() called');
        set({
          isInitialized: false,
          isLoading: false,
          isSubmitting: false,
          error: null,
          practitionerName: '',
          practitionerEmail: '',
          organizationName: undefined,
          organizationLogoUrl: undefined,
          steps: INITIAL_STEPS.map(step => ({ ...step })),
          progress: { value: 0, label: '0 de 2 etapas concluídas' },
          checklist: {
            profileCompleted: false,
            parametersCompleted: false,
          },
          form: createInitialForm(),
          availableCategories: [],
          availableServiceTypes: [],
          lastValidatedAt: undefined,
          modalVisible: false,
          activeStep: 'profile',
          canManagePricing: false,
        });
        AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY)
          .then(() => debugLog('AsyncStorage cleared for onboarding'))
          .catch(error => {
            console.warn('[OnboardingStore] Falha ao limpar armazenamento persistido', error);
          });
      },

      setCanManagePricing: value => {
        set(state => ({
          canManagePricing: value,
          form: {
            ...state.form,
            autoCreateService: value ? state.form.autoCreateService : false,
          },
        }));
      },

      initialize: async (options: InitializeOptions = {}) => {
        debugLog('initialize()', options);
        const { reloadCatalog = false } = options;
        console.log('[Onboarding] Initialization started', { reloadCatalog });
        const { user } = useAuthStore.getState();
        if (!user) {
          debugLog('initialize() aborting: no authenticated user');
          throw new Error('Usuário não autenticado');
        }

        const state = get();
        const wasInitialized = state.isInitialized;
        const previousCategories = state.availableCategories;
        const previousServiceTypes = state.availableServiceTypes;
        const shouldFetchCategories = reloadCatalog || !wasInitialized || previousCategories.length === 0;
        const shouldFetchServiceTypes = reloadCatalog || !wasInitialized || previousServiceTypes.length === 0;

        debugLog('initialize() → set loading');
        set({ isLoading: true, error: null });

        try {
          const [categories, serviceTypes] = await Promise.all([
            shouldFetchCategories
              ? onboardingService.getServiceCategories().catch(error => {
                  console.error('[Onboarding] Erro ao buscar categorias', error);
                  return previousCategories;
                })
              : Promise.resolve(previousCategories),
            shouldFetchServiceTypes
              ? onboardingService.getServiceTypes().catch(error => {
                  console.error('[Onboarding] Erro ao buscar tipos de serviço', error);
                  return previousServiceTypes;
                })
              : Promise.resolve(previousServiceTypes),
          ]);

          if (__DEV__) {
            console.log('[Onboarding] getServiceCategories raw response:', categories);
            console.log('[Onboarding] getServiceTypes raw response:', serviceTypes);
          }

          const organizationLogoUrl = user.organizationLogoUrl;
          const organizationName = user.organization;
          const canManagePricing = Boolean(user.role === 'admin' || user.isAdmin);

          const { steps, progress } = wasInitialized
            ? { steps: state.steps, progress: state.progress }
            : calculateStatus(state.checklist, INITIAL_STEPS.map(step => ({ ...step })));

          const normalizedCategories = extractArray(categories) as ServiceCategoryOption[];
          const normalizedServiceTypes = extractArray(serviceTypes) as ServiceTypeOption[];

          const nextForm = wasInitialized
            ? {
                ...state.form,
                autoCreateService: canManagePricing ? state.form.autoCreateService : false,
              }
            : {
                ...createInitialForm(),
                autoCreateService: canManagePricing,
              };

          set({
            isInitialized: true,
            practitionerName: user.name,
            practitionerEmail: user.email,
            organizationName,
            organizationLogoUrl,
            availableCategories: normalizedCategories,
            availableServiceTypes: normalizedServiceTypes,
            steps,
            progress,
            isLoading: false,
            error: null,
            canManagePricing,
            form: nextForm,
          });
          debugLog('initialize() finished', {
            practitionerEmail: user.email,
            categories: normalizedCategories.length,
            serviceTypes: normalizedServiceTypes.length,
          });
        } catch (error) {
          console.error('Onboarding initialization failed', error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Falha ao iniciar onboarding',
          });
          debugLog('initialize() failed');
        }
      },

      refreshChecklist: async () => {
        const state = get();
        if (!state.practitionerEmail) {
          debugLog('refreshChecklist() skipped: practitionerEmail missing');
          return;
        }

        try {
          debugLog('refreshChecklist() fetching data for', state.practitionerEmail);
          const [profile, serviceCategories, locations, schedules] = await Promise.all([
            onboardingService.getPractitionerData(state.practitionerEmail).catch(error => {
              if (__DEV__) {
                console.error('[Onboarding] Erro ao buscar dados do profissional', error);
              }
              return {};
            }),
            onboardingService
              .getPractitionerServiceCategories(state.practitionerEmail)
              .catch(() => []),
            onboardingService.getPractitionerLocations(state.practitionerEmail).catch(() => []),
            onboardingService.getPractitionerSchedules(state.practitionerEmail).catch(() => []),
          ]);

          const profileData = profile as Record<string, any>;

          if (__DEV__) {
            console.log('[Onboarding] Perfil recebido:', profileData);
          }

          const normalizeValue = (value: unknown) => {
            if (value === null || value === undefined) {
              return '';
            }
            const text = String(value).trim();
            if (!text || text.toLowerCase() === 'none' || text.toLowerCase() === 'null') {
              return '';
            }
            return text;
          };

          const phoneValue = normalizeValue(
            profileData.phone ||
            profileData.phoneNumber ||
            profileData.phone_number ||
            profileData.telefone
          );

          const crmValue = normalizeValue(
            profileData.crm || profileData.CRM || profileData.Crm || profileData.crmNumber
          );
          const cpfValue = normalizeValue(profileData.cpf || profileData.CPF || profileData.Cpf);

          const normalizedCategories = extractArray(serviceCategories);
          const normalizedLocations = extractArray(locations);
          const normalizedSchedules = extractArray(schedules);

          const profileCompleted = Boolean(profileData && cpfValue && crmValue && phoneValue);

          const parametersCompleted = normalizedCategories.length > 0;

          const locationsCompleted = normalizedLocations.length > 0 && normalizedSchedules.length > 0;

          const checklist = {
            profileCompleted,
            parametersCompleted,
            locationsCompleted,
          };

          const { steps, progress } = calculateStatus(
            { profileCompleted, parametersCompleted },
            state.steps
          );

          set({
            checklist,
            steps,
            progress,
            lastValidatedAt: new Date().toISOString(),
            error: null,
          });
          debugLog('refreshChecklist() updated', {
            profileCompleted,
            parametersCompleted,
            locationsCompleted,
            schedules: normalizedSchedules.length,
          });
        } catch (error) {
          console.error('Checklist refresh failed', error);
          set({
            error: error instanceof Error ? error.message : 'Falha ao validar progresso',
          });
          debugLog('refreshChecklist() failed');
        }
      },

      openModal: step => {
        debugLog('openModal()', step);
        set({ modalVisible: true, activeStep: step });
      },
      closeModal: () => {
        debugLog('closeModal()');
        set({ modalVisible: false });
      },

      updateForm: values => {
        debugLog('updateForm()', Object.keys(values));
        set(state => ({
          form: {
            ...state.form,
            ...values,
          },
        }));
      },

      submitSetup: async () => {
        const state = get();
        const { user } = useAuthStore.getState();
        if (!user) {
          throw new Error('Usuário não autenticado');
        }
        const email = state.practitionerEmail || user.email;
        const canManagePricing = state.canManagePricing;
        const currentStep = state.activeStep;

        debugLog('submitSetup() started', { step: currentStep, canManagePricing });
        set({ isSubmitting: true, error: null });

        try {
          const form = state.form;

          const cpfDigits = form.cpf.replace(/\D/g, '');
          const cepDigits = form.cep.replace(/\D/g, '');
          const phoneDigits = form.phone.replace(/\D/g, '');

          const cityCode = form.ibgeCode ? form.ibgeCode.replace(/\D/g, '') : '';
          const cleanedState = form.state?.trim().toUpperCase() ?? '';

          const addressText = [form.addressLine?.trim(), form.number?.trim()].filter(Boolean).join(', ');

          const profilePayload = {
            email,
            name: user.name,
            cpf: cpfDigits,
            crm: form.crm?.trim(),
            phone: phoneDigits,
            address: addressText || null,
            cep: cepDigits,
            city: cityCode || null,
            cityname: form.city?.trim() || null,
            state: cleanedState || null,
            gender: 'unknown',
            birthDate: null,
            cnpj: null,
            category: null,
            qualification: '',
            medsite: '',
            bio: '',
            ibge: cityCode || null,
            ibgeCode: cityCode || null,
          };

          if (__DEV__) {
            const debugPayload = {
              ...profilePayload,
              cpf: profilePayload.cpf ? `${profilePayload.cpf.slice(0, 3)}******${profilePayload.cpf.slice(-2)}` : null,
              phone: profilePayload.phone ? `${profilePayload.phone.slice(0, 2)}******${profilePayload.phone.slice(-2)}` : null,
            };
            console.log('🛠️ [Onboarding] Enviando dados do consultório', debugPayload);
          }

          await onboardingService.savePractitionerProfile({ updatedFields: profilePayload });

          if (currentStep === 'profile') {
            await get().refreshChecklist();
            set({
              modalVisible: false,
              isSubmitting: false,
              activeStep: 'parameters',
            });
            debugLog('submitSetup() profile step finished');
            return;
          }

          const targetPractId = state.practitionerEmail || email;

          if (!targetPractId) {
            throw new Error('Practitioner email indisponível para finalizar o onboarding.');
          }

          const categoryIds = form.categories
            .map(value => Number.parseInt(String(value), 10))
            .filter(id => Number.isFinite(id));

          if (categoryIds.length) {
            if (__DEV__) {
              console.log('🛠️ [Onboarding] Salvando categorias', {
                endpoint: '/pract/savepractservicecategory',
                practId: targetPractId,
                serviceCategoryList: categoryIds,
              });
            }
            try {
              await onboardingService.savePractitionerServiceCategories({
                practId: targetPractId,
                serviceCategoryList: categoryIds,
              });
            } catch (categoryError) {
              console.error('[Onboarding] Falha ao salvar categorias', categoryError);
              throw categoryError;
            }
          }

          const serviceTypeIds = form.specialties
            .map(value => Number.parseInt(String(value), 10))
            .filter(id => Number.isFinite(id));
          if (serviceTypeIds.length) {
            if (__DEV__) {
              console.log('🛠️ [Onboarding] Salvando tipos de serviço', {
                endpoint: '/pract/savepractservicetypes',
                practId: targetPractId,
                serviceTypeList: serviceTypeIds,
              });
            }
            try {
              await onboardingService.savePractitionerServiceTypes({
                practId: targetPractId,
                serviceTypeList: serviceTypeIds,
              });
            } catch (serviceTypeError) {
              console.error('[Onboarding] Falha ao salvar tipos de serviço', serviceTypeError);
              throw serviceTypeError;
            }
          }

          const priceNumeric = parseFloat(
            (form.price || '0')
              .replace(/\./g, '')
              .replace(',', '.')
          );
          const priceValue = canManagePricing ? (Number.isFinite(priceNumeric) ? priceNumeric : 0) : 0;
          const durationValue = canManagePricing ? Number(form.duration || 30) : 30;
          const intervalValue = 15;

          if (__DEV__) {
            console.log('🛠️ [Onboarding] Salvando parâmetros', {
              endpoint: `/pract/updatedata/${targetPractId}`,
              priceValue,
              durationValue,
              intervalValue,
              canManagePricing,
            });
          }

          try {
            await onboardingService.saveSchedulingDefaults(targetPractId, {
              valoratendimento: priceValue,
              tempoatendimento: durationValue,
              intervaloatendimentos: intervalValue,
            });
          } catch (scheduleError) {
            console.error('[Onboarding] Falha ao salvar parâmetros de agenda', scheduleError);
            throw scheduleError;
          }

          let locationId: string | undefined;

          if (!canManagePricing) {
            const linkedLocations = await onboardingService
              .getPractitionerLocations(targetPractId)
              .catch(() => [] as any[]);
            if (Array.isArray(linkedLocations) && linkedLocations.length > 0) {
              const firstLocation = linkedLocations[0] as Record<string, any>;
              locationId = firstLocation.id || firstLocation.location_id || firstLocation.locationId;
            }

            if (!locationId) {
              const orgLocations = await onboardingService.getOrganizationLocations().catch(() => [] as any[]);
              if (Array.isArray(orgLocations) && orgLocations.length > 0) {
                const orgLocation = orgLocations[0] as Record<string, any>;
                locationId = orgLocation.id || orgLocation.location_id || orgLocation.locationId;
              }
            }
          }

          if (!locationId) {
            const org = await onboardingService.getPractitionerOrganization(targetPractId).catch(() => null);
            const organizationId = org?.managing_entity || org?.managingEntity || org?.orgId;

            const fullAddress = [
              form.addressLine?.trim(),
              form.number?.trim(),
              form.complement?.trim(),
              form.neighborhood?.trim(),
              form.city?.trim() && form.state?.trim() ? `${form.city.trim()}/${form.state.trim()}` : form.city?.trim(),
              cepDigits ? `CEP ${cepDigits}` : null,
            ]
              .filter(Boolean)
              .join(', ');

            const locationPayload = {
              status: 'active',
              name: 'Consultório Principal',
              alias: 'Principal',
              description: 'Local padrão de atendimento',
              contact: phoneDigits || form.phone,
              address: fullAddress,
              googlemaps: '',
              managingOrganization: organizationId,
            };

            const locationResponse = await onboardingService.saveLocation(locationPayload, {
              operation: 'NEW',
            });

            locationId =
              locationResponse?.id ||
              (locationResponse as Record<string, any>)?.location_id ||
              (locationResponse as Record<string, any>)?.locationId;
          }

          if (canManagePricing) {
            if (__DEV__) {
              console.log('🛠️ [Onboarding] Criando serviço padrão', {
                endpoint: '/offerings',
                name: 'Consulta Médica',
                duration: durationValue,
                price: priceValue,
                practitionerEmail: targetPractId,
              });
            }
            try {
              await onboardingService.createOffering({
                offering_type: 'SERVICE',
                name: 'Consulta Médica',
                duration_minutes: durationValue,
                price: priceValue,
                currency: 'BRL',
              });
            } catch (offeringError) {
              console.error('[Onboarding] Falha ao criar serviço padrão', offeringError);
              throw offeringError;
            }
          }

          let scheduleId: string | undefined;
          const existingSchedules = await onboardingService.getSchedules(targetPractId).catch(() => [] as any[]);
          if (Array.isArray(existingSchedules) && existingSchedules.length > 0) {
            const schedule = existingSchedules[0] as Record<string, any>;
            scheduleId = schedule.id || schedule.schedule_id || schedule.scheduleId;
          }

          if (!scheduleId) {
            const schedulePayload = {
              active: 1,
              name: 'Horário Padrão',
              location_id: locationId,
              pract_email: targetPractId,
              comment: 'Horário padrão criado automaticamente',
            };

            if (__DEV__) {
              console.log('🛠️ [Onboarding] Criando agenda padrão', {
                endpoint: '/schedule/saveSchedule',
                payload: schedulePayload,
              });
            }

            const scheduleResponse = await onboardingService.saveSchedule(schedulePayload, {
              operation: 'New',
            });

            scheduleId =
              scheduleResponse?.id ||
              (scheduleResponse as Record<string, any>)?.schedule_id ||
              (scheduleResponse as Record<string, any>)?.scheduleId ||
              (scheduleResponse as Record<string, any>)?.schedule?.id;
          }

          if (scheduleId) {
            const today = new Date();
            for (let offset = 0; offset < 5; offset += 1) {
              const slotDate = new Date(today);
              slotDate.setDate(today.getDate() + offset);
              const dateStr = slotDate.toISOString().split('T')[0];

              const slotPayloads = [
                {
                  schedule_id: scheduleId,
                  status: 2,
                  startDate: dateStr,
                  endDate: dateStr,
                  startTime: '08:00:00',
                  endTime: '12:00:00',
                  comment: 'Horário matutino padrão',
                },
                {
                  schedule_id: scheduleId,
                  status: 2,
                  startDate: dateStr,
                  endDate: dateStr,
                  startTime: '13:00:00',
                  endTime: '18:00:00',
                  comment: 'Horário vespertino padrão',
                },
              ];

              for (const slotPayload of slotPayloads) {
                try {
                  if (__DEV__) {
                    console.log('🛠️ [Onboarding] Criando slot padrão', {
                      endpoint: '/schedule/savescheduleslot',
                      payload: slotPayload,
                    });
                  }
                  await onboardingService.saveScheduleSlot(slotPayload);
                } catch (slotError) {
                  console.error('[Onboarding] Falha ao criar slot padrão', slotError);
                }
              }
            }
          }

          await onboardingService.setFirstLogin(targetPractId, 0);

          debugLog('submitSetup() firstLogin flag updated, refreshing checklist');
          await get().refreshChecklist();

          set({
            modalVisible: false,
            isSubmitting: false,
          });
          debugLog('submitSetup() completed successfully');
        } catch (error) {
          console.error('Submit setup failed', error);
          set({
            isSubmitting: false,
            error: error instanceof Error ? error.message : 'Falha ao concluir configuração',
          });
          debugLog('submitSetup() error');
          throw error;
        }
      },
    }),
    {
      name: 'medpro-onboarding',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        isInitialized: state.isInitialized,
        practitionerName: state.practitionerName,
        practitionerEmail: state.practitionerEmail,
        organizationName: state.organizationName,
        organizationLogoUrl: state.organizationLogoUrl,
        steps: state.steps,
        progress: state.progress,
        checklist: state.checklist,
        form: state.form,
        availableCategories: state.availableCategories,
        availableServiceTypes: state.availableServiceTypes,
        canManagePricing: state.canManagePricing,
        activeStep: state.activeStep,
      }),
    }
  )
);

useAuthStore.subscribe(
  state => state.user,
  (user, previousUser) => {
    if (!user && previousUser) {
      debugLog('Auth user cleared; resetting onboarding store');
      useOnboardingStore.getState().reset();
    }
  }
);
