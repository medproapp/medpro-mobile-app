export type OnboardingStepKey = 'profile' | 'parameters' | 'ai';

export type OnboardingStepStatus = 'pending' | 'in-progress' | 'completed';

export interface OnboardingStepState {
  key: OnboardingStepKey;
  title: string;
  description: string;
  status: OnboardingStepStatus;
  disabled?: boolean;
  lastUpdatedAt?: string;
}

export interface OnboardingProgress {
  value: number;
  label: string;
}

export interface ServiceCategoryOption {
  id: string;
  name: string;
}

export interface ServiceTypeOption {
  id: string;
  name: string;
  categoryId?: string;
}

export interface SetupFormState {
  cpf: string;
  crm: string;
  phone: string;
  cep: string;
  addressLine: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  ibgeCode: string;
  price: string;
  duration: string;
  interval: string;
  specialties: string[];
  categories: string[];
  autoCreateService: boolean;
}

export interface ChecklistState {
  profileCompleted: boolean;
  parametersCompleted: boolean;
}

export interface OnboardingState {
  isInitialized: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  practitionerName: string;
  practitionerEmail: string;
  organizationName?: string;
  organizationLogoUrl?: string;
  progress: OnboardingProgress;
  steps: OnboardingStepState[];
  checklist: ChecklistState;
  form: SetupFormState;
  availableCategories: ServiceCategoryOption[];
  availableServiceTypes: ServiceTypeOption[];
  lastValidatedAt?: string;
  modalVisible: boolean;
  canManagePricing: boolean;
  activeStep: OnboardingStepKey;
}
