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
  Notifications: undefined;
  Profile: undefined;
};

// Dashboard Stack
export type DashboardStackParamList = {
  DashboardHome: undefined;
  AppointmentDetails: { appointmentId: string };
  PatientDetails: { patientId: string };
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

// Root Navigator
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Modal: { screen: string; params?: any };
};

// Navigation prop types
export type AuthNavigationProp = any; // Will be properly typed later
export type MainNavigationProp = any; // Will be properly typed later