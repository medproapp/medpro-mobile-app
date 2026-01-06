import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@config/environment';
import {
  AuthState,
  User,
  LoginCredentials,
  RegisterData,
  RegisterResponse,
} from '../types/auth';
import { Organization } from '../types/api';
import { secureStorage } from '../utils/secureStorage';
import { logger } from '@/utils/logger';
import {
  logLogin,
  logLogout,
  setAnalyticsUserId,
  setUserProperties,
} from '@services/analytics';

const AUTH_API_BASE_URL = API_BASE_URL;

interface AuthStore extends AuthState {
  // Last login email (persists across logouts)
  lastLoginEmail: string | null;
  // Token refresh state
  isRefreshing: boolean;
  lastRefreshAttempt: number | null;
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<RegisterResponse>;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  clearError: () => void;
  refreshAccessToken: () => Promise<boolean>;
  shouldRefreshToken: () => boolean;
  ensureValidToken: () => Promise<boolean>;
  refreshUserData: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      refreshToken: null,
      tokenExpiresAt: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      lastLoginEmail: null,
      isRefreshing: false,
      lastRefreshAttempt: null,

      // Actions
      login: async (credentials: LoginCredentials) => {
        logger.info('Login attempt initiated');
        set({ isLoading: true, error: null });

        try {
          // TODO: Replace with actual API call
          logger.logApiRequest('POST', `${AUTH_API_BASE_URL}/login`);
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

          logger.logApiResponse('/login', response.status);

          if (!response.ok) {
            const errorText = await response.text();
            logger.error('Login failed:', response.status);
            // Use generic error message - don't expose HTTP status codes
            if (response.status === 401 || response.status === 403) {
              throw new Error('Email ou senha incorretos. Verifique suas credenciais e tente novamente.');
            } else if (response.status >= 500) {
              throw new Error('Serviço temporariamente indisponível. Tente novamente em alguns instantes.');
            } else {
              throw new Error('Não foi possível realizar o login. Verifique suas credenciais e tente novamente.');
            }
          }

          const data = await response.json();
          logger.info('Login successful');

          // Track login event in analytics
          logLogin('email');

          // Calculate token expiration (default 1 hour if not provided)
          const expiresIn = data.expiresIn || data.expires_in || 3600; // seconds
          const tokenExpiresAt = Date.now() + expiresIn * 1000;

          // Create initial user object with basic login info
          const inferredFirstLogin =
            typeof data.first_login === 'number'
              ? data.first_login === 1
              : typeof data.firstLogin === 'boolean'
              ? data.firstLogin
              : false;

          const inferredOrganization =
            typeof data.organization === 'string' && data.organization.trim().length > 0
              ? data.organization.trim()
              : typeof data.organizationName === 'string' && data.organizationName.trim().length > 0
              ? data.organizationName.trim()
              : '';

          let user: User = {
            id: data.user || credentials.email,
            email: credentials.email,
            username: credentials.email,
            name: credentials.email, // Will be updated with real name
            role: data.role === 'pract' ? 'practitioner' : data.role,
            organization: inferredOrganization,
            firstLogin: inferredFirstLogin,
            isAdmin: data.role === 'admin' || data.admin === 1 || data.admin === '1',
            userRole: data.role,
          };

          // Set initial state with token and save email for future logins
          set({
            user,
            token: data.token,
            refreshToken: data.refreshToken || data.refresh_token || null,
            tokenExpiresAt,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            lastLoginEmail: credentials.email,
          });

          // Fetch detailed user info in the background
          try {
            logger.debug('Fetching detailed user info');
            const apiModule = await import('../services/api');
            const api = apiModule.default;

            const userInfo = await api.getUserInfo(credentials.email);
            if (userInfo) {
              logger.debug('User info received');
              logger.debug('User fullname:', userInfo.fullname);

              // Update user with real information
              user = {
                ...user,
                name: userInfo.fullname || credentials.email,
                role:
                  userInfo.role === 'pract' ? 'practitioner' : userInfo.role,
                userRole:
                  typeof userInfo.role === 'string' && userInfo.role.trim().length > 0
                    ? userInfo.role
                    : user.userRole,
                firstLogin:
                  typeof userInfo.first_login === 'number'
                    ? userInfo.first_login === 1
                    : typeof userInfo.firstLogin === 'boolean'
                    ? userInfo.firstLogin
                    : user.firstLogin,
                organizationLogoUrl:
                  userInfo.organizationLogoUrl ||
                  userInfo.org_logo ||
                  userInfo.org_logo_horizontal,
                isAdmin:
                  typeof userInfo.admin !== 'undefined'
                    ? Number(userInfo.admin) === 1 || userInfo.admin === true
                    : user.isAdmin,
              };

              // Try to get organization info
              try {
                const orgData = await api.getUserToOrg(credentials.email);
                if (orgData && orgData.length > 0) {
                  const org = orgData.find((o: Organization) => o?.groupStatus === 'active') || orgData[0];
                  user.organization =
                    (typeof org.org_name === 'string' && org.org_name.trim().length > 0 && org.org_name.trim()) ||
                    (typeof org.group_name === 'string' && org.group_name.trim().length > 0 && org.group_name.trim()) ||
                    user.organization;
                  user.organizationId =
                    (typeof org.managingEntity === 'string' && org.managingEntity.trim().length > 0 && org.managingEntity.trim()) ||
                    user.organizationId;
                  user.groupId = typeof org.groupId === 'string' ? org.groupId : user.groupId;
                  user.groupRole =
                    (typeof org.group_role === 'string' && org.group_role.trim().length > 0 && org.group_role.trim()) ||
                    user.groupRole;
                  user.userRole =
                    (typeof org.user_role === 'string' && org.user_role.trim().length > 0 && org.user_role.trim()) ||
                    user.userRole;
                  if (typeof org.admin !== 'undefined') {
                    user.isAdmin =
                      user.isAdmin || Number(org.admin) === 1 || org.admin === true;
                  }
                  logger.debug('Organization info processed successfully');
                }
              } catch (orgError) {
                logger.warn('Could not fetch organization info:', orgError);
              }

              // Update state with complete user info
              set({ user });
              logger.info('User profile updated successfully');

              // Set analytics user ID and properties
              setAnalyticsUserId(user.id);
              setUserProperties({
                user_role: user.role || null,
                organization: user.organization || null,
              });
            }
          } catch (userInfoError) {
            logger.warn('Could not fetch detailed user info:', userInfoError);
            // Continue with basic user info, don't fail the login
          }
        } catch (error) {
          logger.error('Login error:', error);
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
            logger.error('Registration failed:', response.status);
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
              logger.warn('Could not parse registration error response');
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
            logger.warn('Could not parse registration response');
          }

          set({ isLoading: false, error: null });
          return result;
        } catch (error) {
          logger.error('Registration error:', error);
          set({
            isLoading: false,
            error:
              error instanceof Error ? error.message : 'Falha ao cadastrar profissional',
          });
          throw error;
        }
      },

      logout: () => {
        logger.info('Logout initiated');

        // Track logout event and clear user ID in analytics
        logLogout();
        setAnalyticsUserId(null);

        set({
          user: null,
          token: null,
          refreshToken: null,
          tokenExpiresAt: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });

        const keysToClear = ['medpro-auth', 'medpro-onboarding', 'assistant-storage'];
        logger.debug('Clearing persisted storage keys');
        AsyncStorage.multiRemove(keysToClear).catch(error => {
          logger.warn('Failed to clear persisted storage', error);
        });

        import('../services/messagingService')
          .then(module => {
            module.messagingService?.resetCache?.();
          })
          .catch(error => {
            logger.warn('Failed to clear messaging cache', error);
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

      refreshAccessToken: async () => {
        const state = get();
        const currentRefreshToken = state.refreshToken;
        const { logout, isRefreshing, lastRefreshAttempt } = state;

        // Don't refresh if no refresh token
        if (!currentRefreshToken) {
          return false;
        }

        // Prevent concurrent refresh attempts
        if (isRefreshing) {
          return false;
        }

        // Debounce: Don't refresh if we tried less than 30 seconds ago
        if (lastRefreshAttempt && Date.now() - lastRefreshAttempt < 30000) {
          return false;
        }

        try {
          set({ isRefreshing: true, lastRefreshAttempt: Date.now() });
          logger.debug('Refreshing access token');

          const response = await fetch(`${AUTH_API_BASE_URL}/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken: currentRefreshToken }),
          });

          if (!response.ok) {
            logger.error('Token refresh failed:', response.status);
            // Force logout if refresh fails
            logout();
            return false;
          }

          const data = await response.json();

          // Calculate new token expiration
          const expiresIn = data.expiresIn || data.expires_in || 3600;
          const tokenExpiresAt = Date.now() + expiresIn * 1000;

          set({
            token: data.token,
            refreshToken: data.refreshToken || data.refresh_token || currentRefreshToken,
            tokenExpiresAt,
            isRefreshing: false,
          });

          logger.info('Token refreshed successfully');
          return true;
        } catch (error) {
          logger.error('Token refresh error:', error);
          set({ isRefreshing: false });
          logout();
          return false;
        }
      },

      // Check if token needs refresh (5 minutes before expiration)
      shouldRefreshToken: () => {
        const { tokenExpiresAt } = get();
        if (!tokenExpiresAt) return false;

        const fiveMinutes = 5 * 60 * 1000;
        return Date.now() >= tokenExpiresAt - fiveMinutes;
      },

      // Ensure token is valid before making API calls
      ensureValidToken: async () => {
        const { shouldRefreshToken, refreshAccessToken, isAuthenticated, refreshToken } = get();

        if (!isAuthenticated) {
          return false;
        }

        // Only attempt refresh if:
        // 1. Token needs refresh
        // 2. We have a refresh token available
        if (shouldRefreshToken() && refreshToken) {
          logger.debug('Token expiring soon, refreshing automatically');
          return await refreshAccessToken();
        }

        return true;
      },

      // Refresh user data from API (organization, etc.)
      refreshUserData: async () => {
        const { user, isAuthenticated } = get();

        if (!isAuthenticated || !user?.email) {
          return;
        }

        try {
          const apiModule = await import('../services/api');
          const api = apiModule.default;

          // Fetch fresh organization data
          const orgData = await api.getUserToOrg(user.email);
          if (orgData && orgData.length > 0) {
            const org = orgData.find((o: Organization) => o?.groupStatus === 'active') || orgData[0];
            const updatedUser = {
              ...user,
              organization:
                (typeof org.org_name === 'string' && org.org_name.trim().length > 0 && org.org_name.trim()) ||
                (typeof org.group_name === 'string' && org.group_name.trim().length > 0 && org.group_name.trim()) ||
                user.organization,
              organizationId:
                (typeof org.managingEntity === 'string' && org.managingEntity.trim().length > 0 && org.managingEntity.trim()) ||
                user.organizationId,
              groupId: typeof org.groupId === 'string' ? org.groupId : user.groupId,
              groupRole:
                (typeof org.group_role === 'string' && org.group_role.trim().length > 0 && org.group_role.trim()) ||
                user.groupRole,
              userRole:
                (typeof org.user_role === 'string' && org.user_role.trim().length > 0 && org.user_role.trim()) ||
                user.userRole,
              isAdmin:
                user.isAdmin || (typeof org.admin !== 'undefined' && (Number(org.admin) === 1 || org.admin === true)),
            };
            set({ user: updatedUser });
            logger.debug('User data refreshed successfully');
          }
        } catch (error) {
          logger.warn('Could not refresh user data:', error);
        }
      },
    }),
    {
      name: 'medpro-auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: state => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        tokenExpiresAt: state.tokenExpiresAt,
        isAuthenticated: state.isAuthenticated,
        lastLoginEmail: state.lastLoginEmail,
      }),
    }
  )
);
