import { NavigatorScreenParams } from '@react-navigation/native';

// Auth Stack
export type AuthStackParamList = {
  Login: { email?: string } | undefined;
  Register: undefined;
  RegistrationSuccess: { name: string; email: string };
  RegistrationWelcome: { name: string; email: string };
  ForgotPassword: undefined;
};

// Onboarding Stack
export type OnboardingStackParamList = {
  OnboardingHome: undefined;
};

// Main Tab Navigator
export type MainTabParamList = {
  Dashboard: undefined;
  Patients: undefined;
  Chat: undefined;
  Messages: undefined;
  More: undefined;
};

// More Stack
export type MoreStackParamList = {
  MoreHome: undefined;
  MyProfile: undefined;
  About: undefined;
  HelpSupport: undefined;
};

// Dashboard Stack
export type DashboardStackParamList = {
  DashboardHome: undefined;
  AppointmentList: undefined;
  AppointmentCalendar: undefined;
  AppointmentDetails: { appointmentId: string };
  FormResponse: {
    trackingId: string;
    patientName: string;
    appointmentDate: string;
  };
  PatientDetails: { patientId: string };
  EncounterList: { filterStatus?: 'OPEN' | 'ALL' };
  EncounterView: {
    encounterId: string;
    patientName: string;
    patientCpf: string;
  };
  Notifications: undefined;
  // Appointment Creation Flow
  AppointmentStep1: undefined;
  AppointmentStep2: undefined;
  AppointmentStep3: undefined;
  AppointmentStep4: undefined;
  AppointmentStep5: undefined;
  AppointmentStep6: undefined;
  AppointmentReview: undefined;
};

// Patients Stack
export type PatientsStackParamList = {
  PatientsList: undefined;
  PatientProfile: { patientId: string };
  PatientDashboard: { patientCpf: string; patientName: string };
  PatientHistory: { patientCpf: string; patientName: string };
  ClinicalRecords: { patientCpf: string; patientName: string };
  Prescriptions: { patientCpf: string; patientName: string };
  Diagnostics: { patientCpf: string; patientName: string };
  Images: { patientCpf: string; patientName: string };
  Attachments: { patientCpf: string; patientName: string };
  Recordings: { patientCpf: string; patientName: string };
  EncounterDetails: { encounterId: string; patientName: string; patientCpf: string };
  ClinicalRecordDetails: {
    encounterId: string;
    patientCpf: string;
    patientName: string;
    clinicalRecord: any;
  };
  PdfViewer: { fileUri: string; fileName: string; title?: string };
  AddPatient: undefined;
  EditPatient: { patientId: string };
  LeadDetails: { leadId: number; name: string };
  LeadCreate: undefined;
};

// Chat Stack
export type ChatStackParamList = {
  ChatList: undefined;
  ChatRoom: { chatId: string; patientName: string };
};

// Messages Stack
export type MessagesStackParamList = {
  MessagesList: undefined;
  Conversation: { threadId: string; threadSubject: string };
  NewMessage: undefined;
  ContactSelect: { onContactsSelected: (contacts: any[]) => void };
};

// Root Navigator
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Modal: { screen: string; params?: any };
};

// Navigation prop types
export type AuthNavigationProp = any; // Will be properly typed later
export type MainNavigationProp = any; // Will be properly typed later
