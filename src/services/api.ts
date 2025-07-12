import { useAuthStore } from '../store/authStore';

const API_BASE_URL = 'https://16e8e8e1dbf2.ngrok-free.app';

interface ApiConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
}

class ApiService {
  private getAuthHeaders(): Record<string, string> {
    const { token } = useAuthStore.getState();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async request<T>(endpoint: string, config: ApiConfig = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const { method = 'GET', body } = config;
    
    const headers = {
      ...this.getAuthHeaders(),
      ...config.headers,
    };

    console.log('[API] Making request:', {
      method,
      url,
      headers: {
        ...headers,
        Authorization: headers.Authorization ? '[REDACTED]' : undefined
      }
    });

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    console.log('[API] Response status:', response.status, response.statusText);

    if (!response.ok) {
      // Handle 404 as empty data for patient history endpoints
      if (response.status === 404) {
        const url = response.url || '';
        if (url.includes('/encounter/') || url.includes('/clinical/') || url.includes('/medication/') || 
            url.includes('/diagnostic/') || url.includes('/attach/') || url.includes('/images/')) {
          console.log('[API] 404 response treated as empty data for:', url);
          return []; // Return empty array for 404s on history endpoints
        }
      }
      
      const errorText = await response.text();
      console.error('[API] Error response:', errorText);
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[API] Response data:', result);
    return result;
  }

  // Auth endpoints
  async login(credentials: { username: string; password: string }) {
    return this.request('/login', {
      method: 'POST',
      body: credentials,
    });
  }

  // Dashboard endpoints
  async getDashboardAppointments(email: string) {
    return this.request(`/api/dashboard/stats/appointments/${email}`);
  }

  async getDashboardPatients(email: string) {
    return this.request(`/api/dashboard/stats/patients/${email}`);
  }

  async getDashboardRevenue(email: string) {
    return this.request(`/api/dashboard/stats/revenue/${email}`);
  }

  async getDashboardSatisfaction(email: string) {
    return this.request(`/api/dashboard/stats/satisfaction/${email}`);
  }

  // Get next appointments for practitioner
  async getNextAppointments(email: string, days: number = 7) {
    const { user } = useAuthStore.getState();
    return this.request(`/appointment/getnextappointments/${email}?days=${days}`, {
      headers: {
        'managingorg': user?.organization || 'ORG-000006',
        'practid': email,
      }
    });
  }

  // Get patient details by CPF
  async getPatientDetails(cpf: string) {
    const { user } = useAuthStore.getState();
    console.log('[API] getPatientDetails called with CPF:', cpf);
    console.log('[API] User context:', { organization: user?.organization, email: user?.email });
    
    try {
      const result = await this.request(`/patient/getpatientdetails/${cpf}`, {
        headers: {
          'managingorg': user?.organization || 'ORG-000006',
          'practid': user?.email || '',
        }
      });
      console.log('[API] getPatientDetails success:', result);
      return result;
    } catch (error) {
      console.error('[API] getPatientDetails error:', error);
      throw error;
    }
  }

  // List patients for practitioner
  async getPatients(practId: string, page: number = 1, limit: number = 20, search: string = '') {
    const { user } = useAuthStore.getState();
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      search,
      orderBy: 'name',
      order: 'ASC'
    });

    return this.request(`/patient/listpatients/${practId}?${params}`, {
      headers: {
        'managingorg': user?.organization || 'ORG-000006',
        'practid': practId,
      }
    });
  }

  // Get patient appointments
  async getPatientAppointments(patientCpf: string) {
    const { user } = useAuthStore.getState();
    console.log('[API] getPatientAppointments called with CPF:', patientCpf);
    
    try {
      const result = await this.request(`/appointment/getnextpatientappointments/${patientCpf}`, {
        headers: {
          'managingorg': user?.organization || 'ORG-000006',
          'practid': user?.email || '',
        }
      });
      console.log('[API] getPatientAppointments success:', result);
      return result;
    } catch (error) {
      console.error('[API] getPatientAppointments error:', error);
      throw error;
    }
  }

  // Get patient photo
  async getPatientPhoto(patientCpf: string) {
    const { user } = useAuthStore.getState();
    return this.request(`/patient/getpatientphoto?patientCpf=${patientCpf}`, {
      headers: {
        'managingorg': user?.organization || 'ORG-000006',
        'practid': user?.email || '',
      }
    });
  }

  // Patient History/Encounters APIs
  async getPatientEncounters(patientCpf: string, options: { page?: number; limit?: number; fromDate?: string; toDate?: string } = {}) {
    const { user } = useAuthStore.getState();
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
      ...(options.fromDate && { fromdate: options.fromDate }),
      ...(options.toDate && { todate: options.toDate })
    });

    return this.request(`/encounter/getencounters/patient/${patientCpf}?${params}`, {
      headers: {
        'managingorg': user?.organization || 'ORG-000006',
        'practid': user?.email || '',
      }
    });
  }

  async getEncounterClinicalRecords(encounterId: string, options: { page?: number; limit?: number; type?: string } = {}) {
    const { user } = useAuthStore.getState();
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
      ...(options.type && { type: options.type })
    });

    return this.request(`/clinical/records/encounter/${encounterId}?${params}`, {
      headers: {
        'managingorg': user?.organization || 'ORG-000006',
        'practid': user?.email || '',
      }
    });
  }

  async getEncounterMedications(patientCpf: string, encounterId: string, options: { page?: number; limit?: number; type?: string } = {}) {
    const { user } = useAuthStore.getState();
    const params = new URLSearchParams({
      encounter: encounterId,
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
      ...(options.type && { type: options.type }),
      pract: user?.email || ''
    });

    return this.request(`/medication/records/${patientCpf}?${params}`, {
      headers: {
        'managingorg': user?.organization || 'ORG-000006',
        'practid': user?.email || '',
      }
    });
  }

  async getEncounterDiagnostics(encounterId: string) {
    const { user } = useAuthStore.getState();
    return this.request(`/diagnostic/encounter/${encounterId}`, {
      headers: {
        'managingorg': user?.organization || 'ORG-000006',
        'practid': user?.email || '',
      }
    });
  }

  async getEncounterImages(encounterId: string) {
    const { user } = useAuthStore.getState();
    return this.request(`/images/encounter/${encounterId}`, {
      headers: {
        'managingorg': user?.organization || 'ORG-000006',
        'practid': user?.email || '',
      }
    });
  }

  async getEncounterAttachments(encounterId: string) {
    const { user } = useAuthStore.getState();
    return this.request(`/attach/getbyencounter/${encounterId}`, {
      headers: {
        'managingorg': user?.organization || 'ORG-000006',
        'practid': user?.email || '',
      }
    });
  }
}

export const api = new ApiService();
export const apiService = new ApiService();