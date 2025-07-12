import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthState, User, LoginCredentials, RegisterData } from '../types/auth';

interface AuthStore extends AuthState {
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
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
          console.log('📡 Calling API:', 'https://16e8e8e1dbf2.ngrok-free.app/login');
          const response = await fetch('https://16e8e8e1dbf2.ngrok-free.app/login', {
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
          
          // Mock user data - replace with actual API response
          const user: User = {
            id: '1',
            email: credentials.email,
            username: credentials.email,
            name: 'Dr. Fabio Garcia',
            role: 'practitioner',
            organization: 'ORG-000006',
          };

          set({
            user,
            token: data.token || 'mock-token',
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
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
          // TODO: Implement registration API call
          await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
          
          // Auto-login after registration
          await get().login({
            email: data.email,
            password: data.password,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Registration failed',
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
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);