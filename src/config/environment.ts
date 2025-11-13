import Constants from 'expo-constants';

type MaybeString = string | null | undefined;

const FALLBACK_API_BASE_URL = 'https://medproapp.ngrok.dev';

const readExtra = (): Record<string, unknown> => {
  const expoConfig = (Constants as any)?.expoConfig ?? (Constants as any)?.manifest;
  if (expoConfig && typeof expoConfig === 'object' && expoConfig.extra && typeof expoConfig.extra === 'object') {
    return expoConfig.extra as Record<string, unknown>;
  }
  return {};
};

const normalizeUrl = (value: MaybeString): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/\/+$/, '');
};

const extra = readExtra();
const envApiBaseUrl = normalizeUrl(process.env.EXPO_PUBLIC_API_BASE_URL as MaybeString);
const extraApiBaseUrl = normalizeUrl(extra?.apiBaseUrl as MaybeString);

export const API_BASE_URL = envApiBaseUrl || extraApiBaseUrl || FALLBACK_API_BASE_URL;

export const getApiUrl = (path = ''): string => {
  if (!path) {
    return API_BASE_URL;
  }
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

export const getConfig = () => ({
  apiBaseUrl: API_BASE_URL,
});
