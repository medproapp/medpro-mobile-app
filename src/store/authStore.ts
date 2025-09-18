import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthState,
  User,
  LoginCredentials,
  RegisterData,
  RegisterResponse,
} from '../types/auth';

const AUTH_API_BASE_URL = 'http://192.168.2.30:3000';

interface AuthStore extends AuthState {
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<RegisterResponse>;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  clearError: () => void;
  refreshToken: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (credentials: LoginCredentials) => {
        console.log('🔐 Login attempt:', credentials.email);
        set({ isLoading: true, error: null });

        try {
          // TODO: Replace with actual API call
          // console.log('📡 Calling API:', 'https://ae4c4558a808.ngrok-free.app/login');
          const response = await fetch(`${AUTH_API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: credentials.email,
              password: credentials.password,
            }),
          });

          console.log('📥 Response status:', response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Login failed:', response.status, errorText);
            throw new Error(`Login failed: ${response.status}`);
          }

          const data = await response.json();
          console.log('✅ Login successful, token received');

          // Create initial user object with basic login info
          let user: User = {
            id: data.user || credentials.email,
            email: credentials.email,
            username: credentials.email,
            name: credentials.email, // Will be updated with real name
            role: data.role === 'pract' ? 'practitioner' : data.role,
            organization: 'ORG-000006',
          };

          // Set initial state with token
          set({
            user,
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Fetch detailed user info in the background
          try {
            console.log('📡 Fetching detailed user info...');
            const { getUserInfo, getUserToOrg } = await import(
              '../services/api'
            );
            const api = (await import('../services/api')).default;

            const userInfo = await api.getUserInfo(credentials.email);
            if (userInfo) {
              console.log('👤 User info received:', userInfo.fullname);

              // Update user with real information
              user = {
                ...user,
                name: userInfo.fullname || credentials.email,
                role:
                  userInfo.role === 'pract' ? 'practitioner' : userInfo.role,
              };

              // Try to get organization info
              try {
                const orgData = await api.getUserToOrg(
                  credentials.email,
                  user.role === 'practitioner' ? 'member' : undefined
                );
                if (orgData && orgData.length > 0) {
                  const org = orgData[0];
                  user.organization = org.managingEntity || 'ORG-000006';
                  console.log('🏢 Organization info received:', org.org_name);
                }
              } catch (orgError) {
                console.warn('⚠️ Could not fetch organization info:', orgError);
              }

              // Update state with complete user info
              set({ user });
              console.log('✅ User profile updated successfully');
            }
          } catch (userInfoError) {
            console.warn(
              '⚠️ Could not fetch detailed user info:',
              userInfoError
            );
            // Continue with basic user info, don't fail the login
          }
        } catch (error) {
          console.error('🚨 Login error:', error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null });

        try {
          const payload = {
            fullname: data.name.trim(),
            email: data.email.trim().toLowerCase(),
            password: data.password,
            role: 'pract',
          };

          const response = await fetch(`${AUTH_API_BASE_URL}/login/registerfull`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          const responseText = await response.text();

          if (!response.ok) {
            console.error('❌ Registration failed:', response.status, responseText);
            let message = 'Não foi possível concluir o cadastro. Tente novamente.';

            if (response.status === 400 || response.status === 409) {
              message = 'Este email já está cadastrado. Utilize outro email.';
            }

            try {
              const parsed = responseText ? JSON.parse(responseText) : null;
              if (parsed && typeof parsed.message === 'string') {
                message = parsed.message;
              }
            } catch (parseError) {
              console.warn('⚠️ Could not parse registration error response:', parseError);
            }

            throw new Error(message);
          }

          let result: RegisterResponse = {
            fullname: payload.fullname,
            email: payload.email,
            role: payload.role,
          };

          try {
            result = responseText ? JSON.parse(responseText) : result;
          } catch (parseError) {
            console.warn('⚠️ Could not parse registration response:', parseError);
          }

          set({ isLoading: false, error: null });
          return result;
        } catch (error) {
          console.error('🚨 Registration error:', error);
          set({
            isLoading: false,
            error:
              error instanceof Error ? error.message : 'Falha ao cadastrar profissional',
          });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      setToken: (token: string) => {
        set({ token, isAuthenticated: true });
      },

      clearError: () => {
        set({ error: null });
      },

      refreshToken: async () => {
        // TODO: Implement token refresh logic
        console.log('Refreshing token...');
      },
    }),
    {
      name: 'medpro-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
