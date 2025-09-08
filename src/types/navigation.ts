import { NavigatorScreenParams } from '@react-navigation/native';

// Auth Stack
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

// Main Tab Navigator
export type MainTabParamList = {
  Dashboard: undefined;
  Patients: undefined;
  Chat: undefined;
  Messages: undefined;
  More: undefined;
};

// Dashboard Stack
export type DashboardStackParamList = {
  DashboardHome: undefined;
  AppointmentDetails: { appointmentId: string };
  PatientDetails: { patientId: string };
  EncounterList: { filterStatus?: 'OPEN' | 'ALL' };
  EncounterView: { 
    encounterId: string; 
    patientName: string;
    patientCpf: string;
  };
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
  EncounterDetails: { encounterId: string; patientName: string };
  AddPatient: undefined;
  EditPatient: { patientId: string };
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
  Main: NavigatorScreenParams<MainTabParamList>;
  Modal: { screen: string; params?: any };
};

// Navigation prop types
export type AuthNavigationProp = any; // Will be properly typed later
export type MainNavigationProp = any; // Will be properly typed later