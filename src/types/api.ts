/**
 * API Type Definitions
 * Comprehensive type definitions for all API responses and data structures
 */

// ============================================================================
// Service and Appointment Types
// ============================================================================

export interface Service {
  id: string;
  name: string;
  price: number;
  duration?: number | null;
  category?: string;
  type?: string;
  description?: string;
}

export interface ServiceCoverageStatus {
  serviceId?: string;
  serviceName?: string;
  covered?: boolean;
  coveragePercentage?: number;
  requiresAuthorization?: boolean;
  copay?: number;
  planId?: string;
  planName?: string;
  planCode?: string;
  operatorName?: string;
}

// ============================================================================
// Patient Types
// ============================================================================

export interface RecentPatient {
  cpf: string;
  name: string;
  phone?: string;
  lastVisit?: string;
  encounterCount?: number;
}

export interface PatientDetails {
  cpf: string;
  name: string;
  phone?: string;
  email?: string;
  birthDate?: string;
  gender?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  emergencyContact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
}

// ============================================================================
// Clinical Records Types
// ============================================================================

export interface ClinicalRecord {
  id: string;
  encounterId: string;
  type: string;
  date: string;
  practitionerId: string;
  practitionerName?: string;
  description?: string;
  notes?: string;
  category?: string;
  status?: 'active' | 'completed' | 'cancelled';
  createdAt?: string;
  updatedAt?: string;
}

export interface Medication {
  id: string;
  encounterId: string;
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
  prescribedDate: string;
  practitionerId: string;
  practitionerName?: string;
  instructions?: string;
  status?: 'active' | 'completed' | 'discontinued';
  refills?: number;
  pharmacy?: string;
}

export interface Diagnostic {
  id: string;
  encounterId: string;
  code: string;
  description: string;
  type: string;
  diagnosedDate: string;
  practitionerId: string;
  practitionerName?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  status?: 'active' | 'resolved' | 'chronic';
  notes?: string;
}

export interface MedicalImage {
  id: string;
  encounterId: string;
  type: 'x-ray' | 'mri' | 'ct-scan' | 'ultrasound' | 'photo' | 'other';
  url: string;
  thumbnailUrl?: string;
  description?: string;
  capturedDate: string;
  uploadedBy: string;
  uploadedByName?: string;
  bodyPart?: string;
  findings?: string;
  fileSize?: number;
  mimeType?: string;
}

export interface Attachment {
  id: string;
  encounterId: string;
  fileName: string;
  fileType: string;
  url: string;
  description?: string;
  uploadedDate: string;
  uploadedBy: string;
  uploadedByName?: string;
  fileSize?: number;
  mimeType?: string;
  category?: 'lab-result' | 'referral' | 'consent-form' | 'insurance' | 'other';
}

// ============================================================================
// Encounter Types
// ============================================================================

export interface EncounterBase {
  id: string;
  patientCpf: string;
  patientName?: string;
  practitionerId: string;
  practitionerName?: string;
  date: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  type?: string;
  reasonForVisit?: string;
  reasonCode?: string;
  locationId?: string;
  locationName?: string;
}

export interface EncounterDetails extends EncounterBase {
  clinicalRecords: ClinicalRecord[];
  medications: Medication[];
  diagnostics: Diagnostic[];
  images: MedicalImage[];
  attachments: Attachment[];
  clinicalCount?: number;
  medicationCount?: number;
  diagnosticCount?: number;
  imageCount?: number;
  attachmentCount?: number;
}

export interface EncounterServiceItem {
  id: string;
  name: string;
  price: number;
  professional?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  duration?: number;
}

export interface EncounterServicesData {
  encounterId: string;
  services: EncounterServiceItem[];
  totalPrice?: number;
  discount?: number;
  finalPrice?: number;
}

export interface PatientOverview {
  total: number;
  lastEncounter: EncounterBase | null;
  upcomingAppointments?: number;
  completedEncounters?: number;
}

// ============================================================================
// Organization Types
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  groupStatus?: 'active' | 'inactive' | 'pending';
  type?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  phone?: string;
  email?: string;
  taxId?: string;
  // API response properties
  org_name?: string;
  group_name?: string;
  managingEntity?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: Record<string, unknown> | FormData;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// File Upload Types
// ============================================================================

export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadedFile {
  id: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

// ============================================================================
// Assistant/Context Types
// ============================================================================

export interface AssistantContext {
  // Top-level IDs for quick access
  patientId?: string;
  encounterId?: string;
  // Nested context objects
  patient?: {
    cpf?: string;
    name?: string;
    age?: number;
    gender?: string;
  };
  encounter?: {
    id?: string;
    date?: string;
    type?: string;
    status?: string;
  };
  practitioner?: {
    id?: string;
    name?: string;
    specialty?: string;
  };
  organization?: {
    id?: string;
    name?: string;
  };
}

export interface ActionButton {
  id: string;
  label: string;
  action: string;
  icon?: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// Messaging Types
// ============================================================================

export interface RealtimeUpdate {
  type: 'message' | 'thread' | 'notification' | 'status';
  action: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: string;
}

export interface MessageStats {
  unread_count: number;
  total_threads?: number;
  last_message_time?: string;
}
