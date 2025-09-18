export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: 'practitioner' | 'admin' | 'assistant';
  organization: string;
  avatar?: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  language: 'pt' | 'en';
  notifications: {
    push: boolean;
    email: boolean;
    appointments: boolean;
    messages: boolean;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string;
  specialty?: string;
}

export interface RegisterResponse {
  fullname: string;
  email: string;
  role: string;
  billing?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}
