// Assistant Types for MedPro Mobile App
// Based on web frontend assistant implementation

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'action' | 'error' | 'audio';
  metadata?: {
    actions?: ActionButton[];
    attachments?: Attachment[];
    context?: ContextInfo;
    audio?: {
      uri: string;
      duration: number;
      transcription?: string;
      confidence?: number;
    };
  };
}

export interface AssistantResponse {
  text: string;
  context?: {
    patientId?: string;
    encounterId?: string;
    prescription?: {
      justcreated: boolean;
      pdfBase64?: string;
      id?: string;
    };
  };
  actions?: ActionButton[];
  shouldUpdateContext?: boolean;
}

export interface ActionButton {
  type: 'prescription-sign' | 'prescription-send' | 'navigate-patient' | 'navigate-encounter' | 'analyze-document';
  text: string;
  icon: string;
  style: 'primary' | 'secondary' | 'outline' | 'danger';
  onPress: () => void;
}

export interface Patient {
  id: string;
  name: string;
  cpf?: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  date: string;
  status: 'OPEN' | 'CLOSED' | 'IN_PROGRESS';
  type?: string;
  notes?: string;
}

export interface ContextInfo {
  patient?: Patient;
  encounter?: Encounter;
  timestamp: Date;
  source: 'api' | 'navigation' | 'user';
}

export interface ConversationSession {
  id: string;
  messages: AssistantMessage[];
  context?: ContextInfo;
  createdAt: Date;
  updatedAt: Date;
  title?: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  uri: string;
  uploadProgress?: number;
}

export interface AnalysisResult {
  id: string;
  text: string;
  confidence: number;
  tags: string[];
  summary?: string;
}

// API Request/Response types (matching web frontend)
export interface AskPractitionerRequest {
  question: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
  }[];
}

export interface AskPractitionerResponse {
  result: {
    text: string;
  };
  context?: {
    patientId?: string;
    encounterId?: string;
    prescription?: {
      justcreated: boolean;
      pdfBase64?: string;
      id?: string;
    };
  };
}

export interface PatientDetailsResponse {
  id: string;
  name: string;
  cpf?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  address?: string;
  medicalHistory?: string;
}

export interface DocumentAnalysisRequest {
  attachment: FormData;
  context?: {
    patientId?: string;
    encounterId?: string;
  };
}

export interface DocumentAnalysisResponse {
  text: string;
  analysis: AnalysisResult;
  suggestions?: string[];
}

// Store State Types
export interface AssistantState {
  // Conversation
  messages: AssistantMessage[];
  isLoading: boolean;
  isTyping: boolean;
  
  // Context
  currentPatient?: Patient;
  currentEncounter?: Encounter;
  contextHistory: ContextInfo[];
  
  // UI State
  showContextCard: boolean;
  inputHeight: number;
  keyboardVisible: boolean;
  
  // Audio State
  isTranscribing: boolean;
  lastAudioUri?: string;
  
  // Persistence
  conversationSessions: ConversationSession[];
  lastSessionId?: string;
  
  // Error handling
  lastError?: string;
  retryCount: number;
}

export interface AssistantActions {
  // Messages
  addMessage: (message: Omit<AssistantMessage, 'id'>) => void;
  updateLastMessage: (update: Partial<AssistantMessage>) => void;
  removeMessage: (messageId: string) => void;
  clearMessages: () => void;
  
  // Conversation
  sendMessage: (content: string) => Promise<void>;
  resetConversation: () => void;
  loadConversation: (sessionId: string) => void;
  saveConversation: () => void;
  
  // Context
  setPatientContext: (patient: Patient) => void;
  setEncounterContext: (encounter: Encounter) => void;
  clearContext: () => void;
  updateContextFromResponse: (context: any) => void;
  
  // UI
  setLoading: (loading: boolean) => void;
  setTyping: (typing: boolean) => void;
  toggleContextCard: () => void;
  setKeyboardVisible: (visible: boolean) => void;
  
  // Special Actions
  handlePrescriptionSign: (pdfBase64: string) => Promise<void>;
  handlePrescriptionSend: (prescriptionId: string) => Promise<void>;
  handleDocumentAnalysis: (attachment: FormData) => Promise<void>;
  navigateToPatient: (patientId: string) => void;
  navigateToEncounter: (encounterId: string) => void;
  
  // Audio Actions
  transcribeAudio: (audioUri: string) => Promise<string>;
  sendAudioMessage: (audioUri: string, transcription?: string) => Promise<void>;
  setTranscribing: (transcribing: boolean) => void;
  
  // Error handling
  setError: (error: string) => void;
  clearError: () => void;
  retry: () => Promise<void>;
}

// Navigation Types
export interface AssistantNavigationContext {
  type: 'patient' | 'encounter';
  id: string;
  name?: string;
  initialMessage?: string;
}

// Component Props Types
export interface MessageBubbleProps {
  message: AssistantMessage;
  onActionPress: (action: ActionButton) => void;
  onLongPress?: (message: AssistantMessage) => void;
}

export interface ContextCardProps {
  patient?: Patient;
  encounter?: Encounter;
  visible: boolean;
  onPatientPress?: () => void;
  onEncounterPress?: () => void;
  onDismiss?: () => void;
}

export interface MessageInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export interface PrescriptionViewerProps {
  pdfBase64: string;
  prescriptionId?: string;
  onSign: () => Promise<void>;
  onSend: () => Promise<void>;
  onClose: () => void;
  visible: boolean;
}

// Utility Types
export type MessageRole = 'user' | 'assistant';
export type MessageType = 'text' | 'action' | 'error';
export type ActionButtonStyle = 'primary' | 'secondary' | 'outline' | 'danger';
export type ContextSource = 'api' | 'navigation' | 'user';
export type EncounterStatus = 'OPEN' | 'CLOSED' | 'IN_PROGRESS';

// Error Types
export interface AssistantError {
  code: string;
  message: string;
  details?: string;
  timestamp: Date;
  retryable: boolean;
}

export interface ApiError {
  status: number;
  message: string;
  details?: any;
}

// Constants
export const MESSAGE_TYPES = {
  TEXT: 'text' as const,
  ACTION: 'action' as const,
  ERROR: 'error' as const,
  AUDIO: 'audio' as const,
};

export const ACTION_TYPES = {
  PRESCRIPTION_SIGN: 'prescription-sign' as const,
  PRESCRIPTION_SEND: 'prescription-send' as const,
  NAVIGATE_PATIENT: 'navigate-patient' as const,
  NAVIGATE_ENCOUNTER: 'navigate-encounter' as const,
  ANALYZE_DOCUMENT: 'analyze-document' as const,
};

export const ACTION_STYLES = {
  PRIMARY: 'primary' as const,
  SECONDARY: 'secondary' as const,
  OUTLINE: 'outline' as const,
  DANGER: 'danger' as const,
};

export const CONTEXT_SOURCES = {
  API: 'api' as const,
  NAVIGATION: 'navigation' as const,
  USER: 'user' as const,
};

export const ENCOUNTER_STATUS = {
  OPEN: 'OPEN' as const,
  CLOSED: 'CLOSED' as const,
  IN_PROGRESS: 'IN_PROGRESS' as const,
};