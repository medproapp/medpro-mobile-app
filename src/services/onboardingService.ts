import { API_BASE_URL } from './api';
import { useAuthStore } from '@store/authStore';
import { logger } from '@/utils/logger';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

type RequestOptions = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  rawResponse?: boolean;
};

const buildHeaders = (extraHeaders?: Record<string, string>) => {
  const { token } = useAuthStore.getState();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
};

const jsonFetch = async <T>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
  const { method = 'GET', body, headers, rawResponse } = options;

  try {
    logger.debug('🔄 [OnboardingService] Request →', {
      url: `${API_BASE_URL}${endpoint}`,
      endpoint,
      method,
      body,
    });

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: buildHeaders(headers),
      body: body ? JSON.stringify(body) : undefined,
    });

    logger.debug('🔄 [OnboardingService] Response ←', {
      endpoint,
      status: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error('⛔ [OnboardingService] Error payload', { endpoint, status: response.status, text });
      throw new Error(`Request failed [${response.status}]: ${text}`);
    }

    if (rawResponse) {
      return response as unknown as T;
    }

    if (response.status === 204) {
      logger.debug('✅ [OnboardingService] Parsed data', { endpoint, data: {} });
      return {} as T;
    }

    const data = (await response.json()) as T;
    logger.debug('✅ [OnboardingService] Parsed data', { endpoint, data });
    return data;
  } catch (error) {
    logger.error('💥 [OnboardingService] Request failed fatally', { endpoint, error });
    throw error;
  }
};

const externalJsonFetch = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`External request failed [${response.status}]: ${text}`);
  }
  return (await response.json()) as T;
};

export const onboardingService = {
  getPractConfig(practId: string) {
    return jsonFetch(`/pract/config/${practId}`);
  },
  savePractConfig(payload: Record<string, unknown>) {
    return jsonFetch('/pract/config/save', {
      method: 'POST',
      body: payload,
    });
  },
  getOrganizationLogo(orgId: string, format: 'horizontal' | 'square' = 'horizontal') {
    return jsonFetch(`/organization/getlogo/${orgId}?format=${format}`, {
      rawResponse: true,
    });
  },
  getOrganizationLocations() {
    return jsonFetch('/location/getlocations');
  },
  getPractitionerLinkedLocations(email: string, role: 'linked' | 'managed' = 'linked') {
    return jsonFetch(`/location/getpractlocationsbyemail/${encodeURIComponent(email)}/?role=${role}`);
  },
  getServiceCategories() {
    return jsonFetch('/pract/getservicecategory').then(result => {
      logger.debug('[OnboardingService] RAW /pract/getservicecategory:', result);
      return result;
    });
  },
  getServiceTypes() {
    return jsonFetch('/pract/getservicetypes').then(result => {
      logger.debug('[OnboardingService] RAW /pract/getservicetypes:', result);
      return result;
    });
  },
  savePractitionerProfile(payload: Record<string, unknown>) {
    logger.debug('💾 [OnboardingService] Saving practitioner profile with payload:', payload);
    const returnValue =
      jsonFetch('/pract/savemydata', {
        method: 'POST',
        body: payload,
      });
    return returnValue;
  },
  savePractitionerServiceCategories(payload: Record<string, unknown>) {
    return jsonFetch('/pract/savepractservicecategory', {
      method: 'POST',
      body: payload,
    });
  },
  savePractitionerServiceTypes(payload: Record<string, unknown>) {
    return jsonFetch('/pract/savepractservicetypes', {
      method: 'POST',
      body: payload,
    });
  },
  saveSchedulingDefaults(practId: string, payload: Record<string, unknown>) {
    const encodedId = encodeURIComponent(practId);
    return jsonFetch(`/pract/updatedata/${encodedId}`, {
      method: 'POST',
      body: payload,
    });
  },
  getPractitionerOrganization(practId: string) {
    return jsonFetch(`/pract/getpractorg/${encodeURIComponent(practId)}`);
  },
  saveLocation(payload: Record<string, unknown>, headers?: Record<string, string>) {
    return jsonFetch('/location/saveLocation', {
      method: 'POST',
      body: payload,
      headers,
    });
  },
  createOffering(payload: Record<string, unknown>) {
    return jsonFetch('/offerings', {
      method: 'POST',
      body: payload,
    });
  },
  saveSchedule(payload: Record<string, unknown>, headers?: Record<string, string>) {
    return jsonFetch('/schedule/saveSchedule', {
      method: 'POST',
      body: payload,
      headers,
    });
  },
  getSchedules(email: string) {
    return jsonFetch(`/schedule/getschedules/${encodeURIComponent(email)}`);
  },
  saveScheduleSlot(payload: Record<string, unknown>) {
    return jsonFetch('/schedule/savescheduleslot', {
      method: 'POST',
      body: payload,
    });
  },
  setFirstLogin(email: string, firstLogin: 0 | 1) {
    return jsonFetch(`/login/setfirstlogin/${encodeURIComponent(email)}?firstlogin=${firstLogin}`, {
      method: 'POST',
    });
  },
  async getPractitionerData(email: string) {
    const endpoint = `/pract/getmydata?email=${encodeURIComponent(email)}`;
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: buildHeaders(),
      });

      if (response.status === 404) {
        if (__DEV__) {
          logger.warn('[OnboardingService] Practitioner not found, returning empty profile');
        }
        return {} as Record<string, unknown>;
      }

      if (!response.ok) {
        const text = await response.text();
        logger.error('⛔ [OnboardingService] Error payload', { endpoint, status: response.status, text });
        throw new Error(`Request failed [${response.status}]: ${text}`);
      }

      const data = (await response.json()) as Record<string, unknown>;
      logger.debug('✅ [OnboardingService] Parsed data', { endpoint, data });
      return data;
    } catch (error) {
      logger.error('💥 [OnboardingService] Request failed fatally', { endpoint, error });
      throw error;
    }
  },
  getPractitionerServiceCategories(email: string) {
    return jsonFetch(`/pract/getpractservicecategories/${encodeURIComponent(email)}`);
  },
  getPractitionerLocations(email: string) {
    return jsonFetch(`/location/getpractlocationsbyemail/${encodeURIComponent(email)}`);
  },
  getPractitionerSchedules(email: string) {
    return jsonFetch(`/schedule/getschedules/${encodeURIComponent(email)}`);
  },
  lookupCep(cep: string) {
    return externalJsonFetch(`https://viacep.com.br/ws/${cep}/json/`);
  },
  lookupMunicipalities(uf: string) {
    return externalJsonFetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
  },
};

export type OnboardingService = typeof onboardingService;
