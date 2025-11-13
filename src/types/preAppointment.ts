// Pre-Appointment Form Types

export type FormStatus = 'completed' | 'partial' | 'pending' | 'overdue' | 'dismissed' | 'expired';

export interface PreAppointmentFormStatus {
  trackingId: string;
  formId: string;
  appointmentId: string;
  patientName: string;
  patientEmail?: string;
  patientId: string;
  appointmentDate: string;
  appointmentTime: string;
  practitionerId: string;
  formStatus: 'submitted' | 'started' | 'pending' | 'expired' | 'dismissed';
  formStartedAt?: string;
  formProgressAt?: string;
  formSubmittedAt?: string;
  formExpiresAt?: string;
  formToken?: string;
  totalFormsCount: number;
  progressPercentage: number;
  deliveryStatus?: 'sent' | 'delivered' | 'failed';
  trackingCreatedAt: string;
  trackingUpdatedAt: string;
  trackingMetadata?: Record<string, any>;
  formMetadata?: Record<string, any>;
}

export interface FormField {
  id: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'textarea' | 'file' | 'checkbox' | 'radio';
  label: string;
  value?: any;
  required?: boolean;
  completed?: boolean;
  options?: Array<{ label: string; value: string }>;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  subsections?: FormSection[];
  completed?: boolean;
  required?: boolean;
}

export interface FormResponse {
  trackingId: string;
  formId: string;
  formName: string;
  appointmentId: string;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  status: FormStatus;
  progressPercentage: number;
  sections: FormSection[];
  submittedAt?: string;
  startedAt?: string;
  lastActivity?: string;
  metadata?: Record<string, any>;
}

export interface PreAppointmentApiResponse {
  success: boolean;
  data: PreAppointmentFormStatus[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    pages: number;
  };
  statistics?: {
    totalAppointments: number;
    completedForms: number;
    partialForms: number;
    pendingForms: number;
  };
}

export interface FormDetailApiResponse {
  success: boolean;
  data: {
    form: {
      form: {
        id: number;
        name: string;
        description?: string;
      };
      sections: FormSection[];
    };
    patient: {
      cpf: string;
      name: string;
      email?: string;
      phone?: string;
    };
    tracking: {
      id: number;
      appointmentId: string;
      patientId: string;
      practitionerId: string;
      formStatus: 'submitted' | 'started' | 'pending' | 'expired' | 'dismissed';
      formStartedAt?: string;
      formProgressAt?: string;
      formSubmittedAt?: string;
      formExpiresAt?: string;
      formToken: string;
      deliveryChannel?: string;
      deliveryStatus?: string;
      createdAt: string;
      updatedAt: string;
      metadata?: Record<string, any>;
    };
  };
}
