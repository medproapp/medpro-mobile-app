import { useAuthStore } from '../store/authStore';
import { AppointmentData } from '../store/appointmentStore';
import { Buffer } from 'buffer';
import { PractitionerProfile } from '@/types/practitioner';
import { API_BASE_URL } from '@config/environment';
import {
  NewMessageData,
  MessagingApiResponse,
  MessageThread,
  Message,
  Contact,
  MessageStats,
  PaginationParams,
  ThreadsFilter,
  ContactsFilter
} from '../types/messaging';
import {
  PreAppointmentApiResponse,
  FormDetailApiResponse,
  PreAppointmentFormStatus,
} from '../types/preAppointment';
import { logger } from '../utils/logger';

interface ApiConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: Record<string, unknown> | FormData | string | object;
}

class ApiService {
  private getAuthHeaders(): Record<string, string> {
    const { token } = useAuthStore.getState();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private getOrgHeaders(practId?: string): Record<string, string> {
    const { user } = useAuthStore.getState();
    return {
      'managingorg': user?.organization || '',
      'practid': practId || user?.email || '',
    };
  }

  private async request<T = any>(endpoint: string, config: ApiConfig = {}): Promise<T> {
    // Ensure token is valid before making request (auto-refresh if needed)
    await useAuthStore.getState().ensureValidToken();

    const url = `${API_BASE_URL}${endpoint}`;
    const { method = 'GET', body } = config;

    const headers = {
      ...this.getAuthHeaders(),
      ...config.headers,
    };

    // console.log('[API] Making request:', {
    //   method,
    //   url,
    //   headers: {
    //     ...headers,
    //     Authorization: headers.Authorization ? '[REDACTED]' : undefined
    //   }
    // });

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // console.log('[API] Response status:', response.status, response.statusText);

    if (!response.ok) {
      // Handle 404 as empty data for patient history endpoints
      if (response.status === 404) {
        const url = response.url || '';
        if (url.includes('/encounter/') || url.includes('/clinical/') || url.includes('/medication/') ||
            url.includes('/diagnostic/') || url.includes('/attach/') || url.includes('/images/')) {
          logger.debug('404 response treated as empty data for endpoint');
          return [] as unknown as T; // Return empty array for 404s on history endpoints
        }
      }

      const errorText = await response.text();
      logger.error('API error response:', response.status);

      // Handle token expiration - automatically logout
      if (response.status === 401) {
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error_code === 'TOKEN_EXPIRED') {
            logger.info('Token expired - logging out user');
            useAuthStore.getState().logout();
            throw new Error('Sua sessão expirou. Por favor, faça login novamente.');
          }
        } catch (parseError) {
          // If we can't parse the error, still check if it's a 401
          logger.warn('Could not parse 401 error response');
        }
        throw new Error('Não autorizado. Verifique suas credenciais.');
      }

      // Use generic error messages - don't expose internal details
      logger.error('API Error:', response.status, response.statusText, errorText);

      if (response.status === 403) {
        throw new Error('Acesso negado. Você não tem permissão para esta operação.');
      } else if (response.status === 404) {
        throw new Error('Recurso não encontrado.');
      } else if (response.status >= 500) {
        throw new Error('Erro no servidor. Tente novamente em alguns instantes.');
      } else if (response.status === 429) {
        throw new Error('Muitas requisições. Aguarde alguns instantes e tente novamente.');
      } else {
        throw new Error('Erro ao processar sua solicitação. Tente novamente.');
      }
    }

    const result = await response.json();
    // console.log('[API] Response data:', result);
    return result as T;
  }

  // Auth endpoints
  async login(credentials: { username: string; password: string }) {
    return this.request('/login', {
      method: 'POST',
      body: credentials,
    });
  }

  async requestPasswordReset(email: string) {
    const trimmedEmail = email.trim();
    return this.request<{ message: string }>('/login/forgot-password', {
      method: 'POST',
      body: { email: trimmedEmail },
    });
  }

  async checkHealth(): Promise<boolean> {
    const url = `${API_BASE_URL}/health`;

    try {
      const response = await fetch(url);
      return response.ok;
    } catch (error) {
      logger.warn('Health check failed:', error);
      return false;
    }
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

  async getPractitionerScheduleSummary(email: string, days: number = 10) {
    if (!email) {
      throw new Error('Email is required to fetch schedule summary.');
    }

    const query = new URLSearchParams();
    if (days) {
      query.set('days', String(days));
    }

    const basePath = `/schedule-summary/practitioner/${encodeURIComponent(email)}/next-10-days`;
    const url = query.toString() ? `${basePath}?${query.toString()}` : basePath;

    try {
      logger.debug('Fetching practitioner schedule summary');
      return await this.request(url);
    } catch (error) {
      logger.error('getPractitionerScheduleSummary error:', error);
      throw error;
    }
  }

  // Get user info (used by web app after login)
  async getUserInfo(email: string) {
    return this.request(`/login/getUserInfo?email=${encodeURIComponent(email)}`);
  }

  // Get user to organization mapping
  async getUserToOrg(email: string, role?: string) {
    const queryParam = role ? `?role=${encodeURIComponent(role)}` : '';
    const encodedEmail = encodeURIComponent(email);
    return this.request(`/login/getusertoorg/${encodedEmail}${queryParam}`);
  }

  // Get next appointments for practitioner
  async getNextAppointments(email: string, days: number = 7) {
    return this.request(`/appointment/getnextappointments/${email}?days=${days}`, {
      headers: this.getOrgHeaders(email),
    });
  }

  // Get appointment details by ID
  async getAppointmentById(appointmentId: string) {
    // console.log('[API] getAppointmentById called with ID:', appointmentId);
    return this.request(`/appointment/getappointmentbyid/${appointmentId}`, {
      headers: this.getOrgHeaders(),
    });
  }

  // Get patient details by CPF
  async getPatientDetails(cpf: string) {
    // console.log('[API] getPatientDetails called with CPF:', cpf);
    // console.log('[API] User context:', { organization: user?.organization, email: user?.email });

    try {
      const result = await this.request(`/patient/getpatientdetails/${cpf}`, {
        headers: this.getOrgHeaders(),
      });
      // console.log('[API] getPatientDetails success:', result);
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getPatientDetails error:', error);
      }
      throw error;
    }
  }

  // Get lead details by ID
  async getLeadDetails(leadId: string) {
    if (__DEV__) {
      console.log('[API] getLeadDetails called with ID:', leadId);
    }

    try {
      const result = await this.request(`/patient/lead/${leadId}`, {
        headers: this.getOrgHeaders(),
      });
      if (__DEV__) {
        console.log('[API] getLeadDetails success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getLeadDetails error:', error);
      }
      throw error;
    }
  }

  // List patients for practitioner
  async getPatients(practId: string, page: number = 1, limit: number = 20, search: string = '') {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      filter: search,
      orderBy: 'name',
      order: 'ASC'
    });

    return this.request(`/patient/listpatients/${practId}?${params}`, {
      headers: this.getOrgHeaders(practId),
    });
  }

  // Search patients for appointment booking - using the same endpoint as web frontend
  async searchPatients(searchTerm: string, searchType: 'name' | 'cpf' | 'phone', page: number = 1, limit: number = 10) {
    const { user } = useAuthStore.getState();
    const userEmail = user?.email || '';
    // console.log('[API] searchPatients called with term:', searchTerm, 'type:', searchType);

    try {
      // Use the same endpoint as web frontend: /patient/getpatientbyname/${practId}
      const params = new URLSearchParams({
        name: searchTerm.trim(), // The backend uses 'name' parameter for search
        page: page.toString(),
        limit: limit.toString(),
      });

      const result = await this.request(`/patient/getpatientbyname/${userEmail}?${params}`, {
        headers: this.getOrgHeaders(),
      });
      // console.log('[API] searchPatients success:', result);
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] searchPatients error:', error);
      }
      throw error;
    }
  }

  // Get patient appointments
  async getPatientAppointments(patientCpf: string) {
    // console.log('[API] getPatientAppointments called with CPF:', patientCpf);

    try {
      const result = await this.request(`/appointment/getnextpatientappointments/${patientCpf}`, {
        headers: this.getOrgHeaders(),
      });
      // console.log('[API] getPatientAppointments success:', result);
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getPatientAppointments error:', error);
      }
      throw error;
    }
  }

  // Get patient photo (returns blob data, not JSON)
  async getPatientPhoto(patientCpf: string) {
    const { token } = useAuthStore.getState();

    if (__DEV__) {
      console.log('[API] getPatientPhoto called for CPF:', patientCpf);
    }

    const url = `${API_BASE_URL}/patient/getpatientphoto?patientCpf=${patientCpf}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.getOrgHeaders(),
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    if (__DEV__) {
      console.log('[API] Fetching patient photo from:', url);
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (__DEV__) {
        console.log('[API] Patient photo response status:', response.status);
        console.log('[API] Patient photo response headers:', Object.fromEntries(response.headers.entries()));
      }

      if (response.status === 404) {
        if (__DEV__) {
          console.log('[API] Patient photo not found (404)');
        }
        return null;
      }

      if (!response.ok) {
        throw new Error(`Photo API Error: ${response.status} ${response.statusText}`);
      }

      // Check if response has content
      const contentLength = response.headers.get('content-length');
      if (__DEV__) {
        console.log('[API] Photo content length:', contentLength);
      }

      if (contentLength === '0' || contentLength === null) {
        if (__DEV__) {
          console.log('[API] No photo data available (empty response)');
        }
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        if (__DEV__) {
          console.log('[API] No photo data available (empty buffer)');
        }
        return null;
      }

      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const dataUri = `data:${contentType};base64,${base64}`;
      if (__DEV__) {
        console.log('[API] Photo converted to base64, length:', dataUri.length);
      }
      return dataUri;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] Error fetching patient photo:', error);
      }
      throw error;
    }
  }

  // Get encounters with in-progress or on-hold status for practitioner
  async getInProgressEncounters(practId: string) {
    const statusFilter = {
      filter1: 'in-progress',
      filter2: 'on-hold',
      filter3: ''
    };

    const params = new URLSearchParams({
      page: '1',
      limit: '10',
      status: JSON.stringify(statusFilter)
    });

    if (__DEV__) {
      console.log('[API] getInProgressEncounters called for practitioner:', practId);
    }

    try {
      const result = await this.request(`/encounter/getencounters/practitioner/${practId}?${params}`, {
        headers: this.getOrgHeaders(practId),
      });
      if (__DEV__) {
        console.log('[API] getInProgressEncounters success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getInProgressEncounters error:', error);
      }
      throw error;
    }
  }

  // Patient History/Encounters APIs
  async getPatientEncounters(patientCpf: string, options: { page?: number; limit?: number; fromDate?: string; toDate?: string } = {}) {
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
      ...(options.fromDate && { fromdate: options.fromDate }),
      ...(options.toDate && { todate: options.toDate })
    });

    return this.request(`/encounter/getencounters/patient/${patientCpf}?${params}`, {
      headers: this.getOrgHeaders(),
    });
  }

  async getPatientLastEncounterSummary(patientCpf: string, currentEncounterId?: string) {
    const query = currentEncounterId ? `?curEnc=${encodeURIComponent(currentEncounterId)}` : '';

    return this.request(`/encounter/patient/lastencounter/${patientCpf}${query}`, {
      headers: this.getOrgHeaders(),
    });
  }

  async getEncounterInfoById(encounterId: string) {
    return this.request(`/encounter/getencounterinfobyid/${encounterId}`, {
      headers: this.getOrgHeaders(),
    });
  }

  // async getEncounterInfoById(encounterId: string) {
  //   const { user } = useAuthStore.getState();

  //   return this.request(`/encounter/getencounterinfobyid/${encounterId}`, {
  //     headers: {
  //       'managingorg': user?.organization,
  //       'practid': user?.email || '',
  //     },
  //   });
  // }

  // Update encounter status (pause/resume)
  async updateEncounterStatus(encounterId: string, status: string) {
    if (__DEV__) {
      console.log('[API] updateEncounterStatus called with:', { encounterId, status });
    }

    try {
      const result = await this.request(`/encounter/updateencounterstatus/${encounterId}?status=${status}`, {
        method: 'POST',
        headers: this.getOrgHeaders()
      });
      if (__DEV__) {
        console.log('[API] updateEncounterStatus success:', result);
      }
      return result;
    } catch (error: unknown) {
      if (__DEV__) {
        console.error('[API] updateEncounterStatus error:', error);
      }
      throw error;
    }
  }

  // Append mobile note (uses separate MobileNotes field to avoid conflicts with web app)
  async appendMobileNote(encounterId: string, noteText: string) {
    if (__DEV__) {
      console.log('[API] appendMobileNote called with:', { encounterId, noteTextLength: noteText.length });
    }

    try {
      const result = await this.request(`/encounter/append-mobile-note/${encounterId}`, {
        method: 'POST',
        headers: this.getOrgHeaders(),
        body: {
          noteText: noteText,
        },
      });
      if (__DEV__) {
        console.log('[API] appendMobileNote success:', result);
      }
      return result;
    } catch (error: unknown) {
      if (__DEV__) {
        console.error('[API] appendMobileNote error:', error);
      }
      throw error;
    }
  }

  async getEncounterClinicalRecords(encounterId: string, options: { page?: number; limit?: number; type?: string } = {}) {
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
      ...(options.type && { type: options.type })
    });

    const response = await this.request(`/clinical/records/encounter/${encounterId}?${params}`, {
      headers: this.getOrgHeaders(),
    });

    // console.log('[API] getEncounterClinicalRecords response:', JSON.stringify(response, null, 2));

    return response;
  }

  async getPatientClinicalRecords(patientCpf: string, options: { page?: number; limit?: number; type?: string; category?: string; pract?: string; encounter?: string } = {}) {
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
      ...(options.type && { type: options.type }),
      ...(options.category && { category: options.category }),
      ...(options.pract && { pract: options.pract }),
      ...(options.encounter && { encounter: options.encounter })
    });

    if (__DEV__) {
      console.log('[API] getPatientClinicalRecords called with CPF:', patientCpf, 'options:', options);
    }

    try {
      const response = await this.request(`/clinical/records/${patientCpf}?${params}`, {
        headers: this.getOrgHeaders(),
      });

      if (__DEV__) {
        console.log('[API] getPatientClinicalRecords response:', JSON.stringify(response, null, 2));
      }

      return response;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getPatientClinicalRecords error:', error);
      }
      throw error;
    }
  }

  async getPatientMedicationRecords(patientCpf: string, options: { page?: number; limit?: number; type?: string; pract?: string; encounter?: string } = {}) {
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
      ...(options.type && { type: options.type }),
      ...(options.pract && { pract: options.pract }),
      ...(options.encounter && { encounter: options.encounter })
    });

    if (__DEV__) {
      console.log('[API] getPatientMedicationRecords called with CPF:', patientCpf, 'options:', options);
    }

    try {
      const response = await this.request(`/medication/records/${patientCpf}?${params}`, {
        headers: this.getOrgHeaders(),
      });

      if (__DEV__) {
        console.log('[API] getPatientMedicationRecords response:', JSON.stringify(response, null, 2));
      }

      return response;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getPatientMedicationRecords error:', error);
      }
      throw error;
    }
  }

  async getPatientDiagnosticRecords(patientCpf: string, options: { page?: number; limit?: number; type?: string; category?: string; code?: string } = {}) {
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
      ...(options.type && { type: options.type }),
      ...(options.category && { category: options.category }),
      ...(options.code && { code: options.code })
    });

    if (__DEV__) {
      console.log('[API] getPatientDiagnosticRecords called with CPF:', patientCpf, 'options:', options);
    }

    try {
      const response = await this.request(`/diagnostic/records/${patientCpf}?${params}`, {
        headers: this.getOrgHeaders(),
      });

      if (__DEV__) {
        console.log('[API] getPatientDiagnosticRecords response:', JSON.stringify(response, null, 2));
      }

      return response;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getPatientDiagnosticRecords error:', error);
      }
      throw error;
    }
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
      headers: this.getOrgHeaders(),
    });
  }

  async getEncounterDiagnostics(encounterId: string) {
    return this.request(`/diagnostic/encounter/${encounterId}`, {
      headers: this.getOrgHeaders(),
    });
  }

  async getEncounterImages(encounterId: string) {
    return this.request(`/images/encounter/${encounterId}`, {
      headers: this.getOrgHeaders(),
    });
  }

  async getEncounterAttachments(encounterId: string) {
    return this.request(`/attach/getbyencounter/${encounterId}`, {
      headers: this.getOrgHeaders(),
    });
  }

  async getClinicalRecordAttachments(clinicalId: string) {
    const response = await this.request(`/clinical/record/${clinicalId}/attachments`, {
      headers: this.getOrgHeaders(),
    });

    if (__DEV__) {
      console.log('[API] getClinicalRecordAttachments response:', JSON.stringify(response, null, 2));
    }

    return response;
  }

  async getEncounterServices(encounterId: string) {
    return this.request(`/encounter/getencounterservices/${encounterId}`, {
      headers: this.getOrgHeaders(),
    });
  }

  async getEncounterFinancials(encounterId: string) {
    return this.request(`/encounter/getencounterfinancials/${encounterId}`, {
      headers: this.getOrgHeaders(),
    });
  }

  // === MESSAGING ENDPOINTS ===

  // Get user's message threads
  async getMessageThreads(params: ThreadsFilter & PaginationParams = {}): Promise<MessagingApiResponse<MessageThread[]>> {
    const queryParams = new URLSearchParams({
      filter: params.filter || 'all',
      limit: (params.limit || 20).toString(),
      offset: (params.offset || 0).toString(),
    });

    return this.request(`/api/internal-comm/messages/threads?${queryParams}`);
  }

  // Get messages in a specific thread
  async getThreadMessages(threadId: string, params: PaginationParams = {}): Promise<MessagingApiResponse<{ messages: Message[]; thread_info: MessageThread }>> {
    const queryParams = new URLSearchParams({
      limit: (params.limit || 50).toString(),
      offset: (params.offset || 0).toString(),
    });

    if (__DEV__) {
      console.log('[API] getThreadMessages -> request', {
      threadId,
      params,
      query: queryParams.toString(),
      });
    }

    const response = await this.request(`/api/internal-comm/messages/thread/${threadId}?${queryParams}`);

    if (__DEV__) {
      console.log('[API] getThreadMessages <- response', response);
    }

    return response;
  }

  async getThreadParticipants(threadId: string): Promise<any> {
    if (__DEV__) {
      console.log('[API] getThreadParticipants -> request', { threadId });
    }
    const response = await this.request(`/api/internal-comm/messages/thread/${threadId}/participants`);
    if (__DEV__) {
      console.log('[API] getThreadParticipants <- response', response);
    }
    return response;
  }

  // Send a new message or reply
  async sendMessage(data: NewMessageData): Promise<MessagingApiResponse<{ message_id: string; thread_id: string }>> {
    return this.request('/api/internal-comm/messages', {
      method: 'POST',
      body: data,
    });
  }

  // Mark message as read
  async markMessageAsRead(messageId: string): Promise<MessagingApiResponse<void>> {
    return this.request(`/api/internal-comm/messages/${messageId}/read`, {
      method: 'PUT',
    });
  }

  // Get available contacts
  async getContacts(params: ContactsFilter & PaginationParams = {}): Promise<MessagingApiResponse<Contact[]>> {
    const queryParams = new URLSearchParams({
      limit: (params.limit || 50).toString(),
      offset: (params.offset || 0).toString(),
      ...(params.search && { search: params.search }),
    });

    return this.request(`/api/internal-comm/contacts?${queryParams}`);
  }

  // Get messaging statistics
  async getMessagingStats(): Promise<MessagingApiResponse<MessageStats>> {
    return this.request('/api/internal-comm/stats');
  }

  // Search messages and users
  async searchMessages(query: string, type: 'all' | 'messages' | 'users' = 'all', limit: number = 20): Promise<MessagingApiResponse<any[]>> {
    const queryParams = new URLSearchParams({
      query,
      type,
      limit: limit.toString(),
    });

    return this.request(`/api/internal-comm/search?${queryParams}`);
  }

  // Upload attachment for messages
  async uploadMessageAttachment(file: FormData): Promise<MessagingApiResponse<{ attachment_id: string; attachment_url: string }>> {
    const { token } = useAuthStore.getState();
    
    return fetch(`${API_BASE_URL}/api/internal-comm/upload-attachment`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        // Don't set Content-Type for FormData, let the browser set it
      },
      body: file,
    }).then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      return response.json();
    });
  }

  // Delete a message
  async deleteMessage(messageId: string): Promise<MessagingApiResponse<void>> {
    return this.request(`/api/internal-comm/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  // === PUSH NOTIFICATION ENDPOINTS ===

  // Register push notification token
  async registerPushToken(tokenData: {
    token: string;
    platform: 'ios' | 'android';
    app: 'practitioner' | 'patient';
    device_name?: string;
  }): Promise<MessagingApiResponse<void>> {
    return this.request('/api/notifications/device', {
      method: 'POST',
      body: tokenData,
    });
  }

  // Unregister push notification token
  async unregisterPushToken(tokenData: {
    token: string;
    app: 'practitioner' | 'patient';
  }): Promise<MessagingApiResponse<void>> {
    return this.request('/api/notifications/device', {
      method: 'DELETE',
      body: tokenData,
    });
  }

  // === NOTIFICATION CENTER ===

  async listNotifications(params: {
    page?: number;
    limit?: number;
    status?: 'delivered' | 'read' | 'archived' | 'all';
  } = {}): Promise<any> {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.status && params.status !== 'all') {
      query.set('status', params.status);
    }

    const queryString = query.toString();
    const endpoint = queryString ? `/api/notifications?${queryString}` : '/api/notifications';
    return this.request(endpoint);
  }

  async acknowledgeNotifications(ids: number[]): Promise<any> {
    if (!ids.length) {
      return { affected: 0 };
    }

    return this.request('/api/notifications/ack', {
      method: 'POST',
      body: { ids },
    });
  }

  async archiveNotification(id: number): Promise<any> {
    return this.request(`/api/notifications/${id}`, {
      method: 'DELETE',
    });
  }

  // Upload attachment
  async uploadAttachment(
    filePath: string,
    fileName: string,
    fileType: string,
    encounterId: string,
    patientCpf: string,
    practitionerId: string
  ): Promise<{ message: string; attachmentId: string }> {
    const { user, token } = useAuthStore.getState();

    const formData = new FormData();
    // Field name must be 'attach_file' to match backend multer config
    formData.append('attach_file', {
      uri: filePath,
      type: fileType,
      name: fileName,
    } as unknown as Blob);

    // Add metadata fields to FormData body (matching web app format)
    formData.append('patient', patientCpf);
    formData.append('encounter', encounterId);
    formData.append('type', 'general'); // Attachment type
    formData.append('context', encounterId); // Link to encounter
    formData.append('date', new Date().toISOString().split('T')[0]); // YYYY-MM-DD
    formData.append('status', 'active');
    formData.append('filetype', fileType);
    formData.append('datasource', 'medpro-mobile');

    const headers = {
      'Content-Type': 'multipart/form-data',
    };

    if (__DEV__) {
      console.log('[API] uploadAttachment called with:', {
      filePath,
      fileName,
      fileType,
      encounterId,
      patientCpf,
      practitionerId,
      });
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          if (__DEV__) {
            console.log(`[API] Attachment upload progress: ${percentComplete.toFixed(1)}%`);
          }
        }
      });

      xhr.addEventListener('load', () => {
        if (__DEV__) {
          console.log('[API] Attachment upload response status:', xhr.status);
        }
        if (__DEV__) {
          console.log('[API] Attachment upload response text:', xhr.responseText);
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            if (__DEV__) {
              console.error('[API] Error parsing attachment response:', error);
            }
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Attachment upload failed with status: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        if (__DEV__) {
          console.error('[API] Attachment upload network error');
        }
        reject(new Error('Network error during attachment upload'));
      });

      xhr.addEventListener('abort', () => {
        if (__DEV__) {
          console.log('[API] Attachment upload was aborted');
        }
        reject(new Error('Attachment upload was aborted'));
      });

      // Use /uploadToAzure endpoint (matches web app)
      xhr.open('POST', `${API_BASE_URL}/attach/uploadToAzure`);

      // Add auth headers
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      // Add additional headers
      Object.entries(headers).forEach(([key, value]) => {
        if (key !== 'Content-Type') { // Let browser set Content-Type for FormData
          xhr.setRequestHeader(key, value);
        }
      });

      xhr.send(formData);
    });
  }

  // Helper function to generate file hash (matching web app implementation)
  private generateFileHash(fileName: string, fileSize: number): string {
    const str = fileName + fileSize.toString();
    let hash = 0;

    if (str.length === 0) return hash.toString();

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString();
  }

  // Upload image
  async uploadImage(
    imagePath: string,
    fileName: string,
    encounterId: string,
    patientCpf: string,
    practitionerId: string,
    fileSize?: number
  ): Promise<{ message: string; imageId: string }> {
    const { user, token } = useAuthStore.getState();

    const formData = new FormData();
    formData.append('img_file', {
      uri: imagePath,
      type: 'image/jpeg',
      name: fileName,
    } as unknown as Blob);

    // Add metadata fields (matching web app format)
    // Generate hash from filename and size (if available, otherwise use timestamp as fallback)
    const imageHash = fileSize
      ? this.generateFileHash(fileName, fileSize)
      : Date.now().toString();
    formData.append('encounter', encounterId);
    formData.append('title', '');
    formData.append('description', '');
    formData.append('hash', imageHash);

    const headers = {
      'Content-Type': 'multipart/form-data',
    };

    if (__DEV__) {
      console.log('[API] uploadImage called with:', {
      imagePath,
      fileName,
      encounterId,
      patientCpf,
      practitionerId,
      });
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          if (__DEV__) {
            console.log(`[API] Image upload progress: ${percentComplete.toFixed(1)}%`);
          }
        }
      });
      
      xhr.addEventListener('load', () => {
        if (__DEV__) {
          console.log('[API] Image upload response status:', xhr.status);
        }
        if (__DEV__) {
          console.log('[API] Image upload response text:', xhr.responseText);
        }
        
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            if (__DEV__) {
              console.error('[API] Error parsing image response:', error);
            }
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Image upload failed with status: ${xhr.status}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        if (__DEV__) {
          console.error('[API] Image upload network error');
        }
        reject(new Error('Network error during image upload'));
      });
      
      xhr.addEventListener('abort', () => {
        if (__DEV__) {
          console.log('[API] Image upload was aborted');
        }
        reject(new Error('Image upload was aborted'));
      });
      
      xhr.open('POST', `${API_BASE_URL}/images/upload/${encounterId}`);
      
      // Add auth headers
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      
      // Add additional headers
      Object.entries(headers).forEach(([key, value]) => {
        if (key !== 'Content-Type') { // Let browser set Content-Type for FormData
          xhr.setRequestHeader(key, value);
        }
      });
      
      xhr.send(formData);
    });
  }

  // Upload audio recording (Legacy single-blob upload)
  async uploadAudioRecording(
    audioPath: string,
    encounterId: string,
    patientCpf: string,
    practitionerId: string,
    sequence: number = 1
  ): Promise<{ message: string; audioId: string }> {
    const { user, token } = useAuthStore.getState();

    if (__DEV__) {
      console.log('[API] === UPLOAD AUDIO RECORDING DEBUG START ===');
    }
    if (__DEV__) {
      console.log('[API] Input parameters:', {
      audioPath,
      encounterId,
      patientCpf,
      practitionerId,
      sequence,
      });
    }
    if (__DEV__) {
      console.log('[API] Auth store state:', {
      hasToken: !!token,
      tokenLength: token?.length,
      userEmail: user?.email,
      userOrganization: user?.organization,
      userName: user?.name,
      });
    }

    const fileName = `recording_${Date.now()}.mp4`;
    const audioFile = {
      uri: audioPath,
      type: 'audio/mp4',
      name: fileName,
    };

    if (__DEV__) {
      console.log('[API] Audio file object:', audioFile);
    }

    const formData = new FormData();
    formData.append('audio', audioFile as unknown as Blob);

    const headers = {
      'Content-Type': 'multipart/form-data',
      'patient': patientCpf,
      'pract': practitionerId,
      'encid': encounterId,
      'sequence': sequence.toString(),
      'subentitytype': 'none',
      'subentity': 'none',
      'entity': 'encounter',
      'organization': user?.organization,
    };

    if (__DEV__) {
      console.log('[API] Request headers (will be sent):', {
      ...headers,
      'Authorization': token ? `Bearer ${token.substring(0, 10)}...` : 'MISSING',
      });
    }
    if (__DEV__) {
      console.log('[API] Request URL:', `${API_BASE_URL}/audio/uploadAudio`);
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          if (__DEV__) {
            console.log(`[API] Upload progress: ${percentComplete.toFixed(1)}%`);
          }
        }
      });

      xhr.addEventListener('load', () => {
        if (__DEV__) {
          console.log('[API] === UPLOAD RESPONSE RECEIVED ===');
        }
        if (__DEV__) {
          console.log('[API] Response status:', xhr.status);
        }
        if (__DEV__) {
          console.log('[API] Response status text:', xhr.statusText);
        }
        if (__DEV__) {
          console.log('[API] Response headers:', xhr.getAllResponseHeaders());
        }
        if (__DEV__) {
          console.log('[API] Response body:', xhr.responseText);
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (__DEV__) {
              console.log('[API] === UPLOAD SUCCESS ===');
            }
            if (__DEV__) {
              console.log('[API] Parsed response:', response);
            }
            resolve(response);
          } catch (error) {
            if (__DEV__) {
              console.error('[API] === UPLOAD ERROR: Invalid Response ===');
            }
            if (__DEV__) {
              console.error('[API] Error parsing response:', error);
            }
            if (__DEV__) {
              console.error('[API] Raw response text:', xhr.responseText);
            }
            reject(new Error('Invalid response format'));
          }
        } else {
          if (__DEV__) {
            console.error('[API] === UPLOAD ERROR: Bad Status ===');
          }
          if (__DEV__) {
            console.error('[API] Status code:', xhr.status);
          }
          if (__DEV__) {
            console.error('[API] Status text:', xhr.statusText);
          }
          if (__DEV__) {
            console.error('[API] Error response body:', xhr.responseText);
          }

          let errorMessage = `Upload failed with status: ${xhr.status}`;
          try {
            const errorData = JSON.parse(xhr.responseText);
            if (__DEV__) {
              console.error('[API] Parsed error data:', errorData);
            }
            if (errorData.message) {
              errorMessage += ` - ${errorData.message}`;
            }
            if (errorData.error) {
              errorMessage += ` (${errorData.error})`;
            }
          } catch (e) {
            if (__DEV__) {
              console.error('[API] Could not parse error response as JSON');
            }
          }

          reject(new Error(errorMessage));
        }
      });

      xhr.addEventListener('error', (event) => {
        if (__DEV__) {
          console.error('[API] === UPLOAD ERROR: Network Error ===');
        }
        if (__DEV__) {
          console.error('[API] Network error event:', event);
        }
        if (__DEV__) {
          console.error('[API] XHR status:', xhr.status);
        }
        if (__DEV__) {
          console.error('[API] XHR ready state:', xhr.readyState);
        }
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        if (__DEV__) {
          console.warn('[API] === UPLOAD ABORTED ===');
        }
        reject(new Error('Upload was aborted'));
      });

      xhr.open('POST', `${API_BASE_URL}/audio/uploadAudio`);
      if (__DEV__) {
        console.log('[API] XHR opened, setting headers...');
      }

      // Add auth headers
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        if (__DEV__) {
          console.log('[API] Authorization header set (Bearer token)');
        }
      } else {
        if (__DEV__) {
          console.warn('[API] WARNING: No auth token available!');
        }
      }

      // Add additional headers
      if (__DEV__) {
        console.log('[API] Setting custom headers...');
      }
      Object.entries(headers).forEach(([key, value]) => {
        if (key !== 'Content-Type' && typeof value === 'string') { // Let browser set Content-Type for FormData
          xhr.setRequestHeader(key, value);
          if (__DEV__) {
            console.log(`[API] Header set: ${key} = ${value}`);
          }
        }
      });

      if (__DEV__) {
        console.log('[API] Sending FormData with audio file...');
      }
      if (__DEV__) {
        console.log('[API] === UPLOAD REQUEST SENT ===');
      }
      xhr.send(formData);
    });
  }

  // === CHUNKED AUDIO UPLOAD ENDPOINTS ===

  /**
   * Create a new chunked audio upload session
   * @param options Session configuration
   * @returns Session ID and metadata
   */
  async createChunkedSession(options: {
    encounterId: string;
    patientCpf: string;
    practitionerId: string;
    sequence: number;
    chunkExpected: number;
    maxChunkDurationSeconds: number;
    fileName?: string;
  }): Promise<{ sessionId: string; status: string }> {
    const { user, token } = useAuthStore.getState();

    if (__DEV__) {
      console.log('[API] createChunkedSession called with:', options);
    }

    try {
      const result = await this.request('/chunked-audio/sessions', {
        method: 'POST',
        headers: {
          'patient': options.patientCpf,
          'pract': options.practitionerId,
          'encid': options.encounterId,
          'sequence': options.sequence.toString(),
          'subentitytype': 'none',
          'entity': 'encounter',
          'organization': user?.organization || '',
        },
        body: {
          chunkExpected: options.chunkExpected,
          maxChunkDurationSeconds: options.maxChunkDurationSeconds,
          fileName: options.fileName || `recording_${Date.now()}.mp4`,
        },
      });
      if (__DEV__) {
        console.log('[API] createChunkedSession success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] createChunkedSession error:', error);
      }
      throw error;
    }
  }

  /**
   * Upload a single chunk to an existing session
   * @param sessionId The session ID from createChunkedSession
   * @param chunkBlob The audio chunk data
   * @param chunkIndex Zero-based chunk index
   * @param onProgress Optional progress callback
   * @returns Upload result
   */
  async uploadChunk(
    sessionId: string,
    chunkBlob: Blob | FormData,
    chunkIndex: number,
    onProgress?: (percent: number) => void
  ): Promise<{ success: boolean; message?: string }> {
    const { token } = useAuthStore.getState();

    if (__DEV__) {
      console.log('[API] uploadChunk called with:', { sessionId, chunkIndex });
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress(percentComplete);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (__DEV__) {
          console.log('[API] Chunk upload response status:', xhr.status);
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            if (__DEV__) {
              console.error('[API] Error parsing chunk response:', error);
            }
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Chunk upload failed with status: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        if (__DEV__) {
          console.error('[API] Chunk upload network error');
        }
        reject(new Error('Network error during chunk upload'));
      });

      xhr.addEventListener('abort', () => {
        if (__DEV__) {
          console.log('[API] Chunk upload was aborted');
        }
        reject(new Error('Chunk upload was aborted'));
      });

      xhr.open('POST', `${API_BASE_URL}/chunked-audio/sessions/${sessionId}/chunks`);

      // Add auth headers
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      // Set chunk index header
      xhr.setRequestHeader('X-Chunk-Index', chunkIndex.toString());

      // Send the chunk (either as FormData or Blob)
      xhr.send(chunkBlob);
    });
  }

  /**
   * Complete a chunked upload session and finalize the recording
   * @param sessionId The session ID
   * @returns Completion result with recording info
   */
  async completeChunkedSession(sessionId: string): Promise<{
    success: boolean;
    recordingId?: string;
    message?: string;
  }> {
    const { token } = useAuthStore.getState();

    if (__DEV__) {
      console.log('[API] completeChunkedSession called with:', sessionId);
    }

    try {
      const result = await this.request(`/chunked-audio/sessions/${sessionId}/complete`, {
        method: 'POST',
      });
      if (__DEV__) {
        console.log('[API] completeChunkedSession success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] completeChunkedSession error:', error);
      }
      throw error;
    }
  }

  /**
   * Cancel a chunked upload session
   * @param sessionId The session ID
   */
  async cancelChunkedSession(sessionId: string): Promise<{ success: boolean }> {
    if (__DEV__) {
      console.log('[API] cancelChunkedSession called with:', sessionId);
    }

    try {
      const result = await this.request(`/chunked-audio/sessions/${sessionId}/cancel`, {
        method: 'POST',
      });
      if (__DEV__) {
        console.log('[API] cancelChunkedSession success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] cancelChunkedSession error:', error);
      }
      throw error;
    }
  }

  /**
   * Get the status of a chunked upload session
   * @param sessionId The session ID
   * @returns Session status information
   */
  async getSessionStatus(sessionId: string): Promise<{
    status: string;
    chunksReceived: number;
    chunkExpected: number;
    sessionId: string;
  }> {
    if (__DEV__) {
      console.log('[API] getSessionStatus called with:', sessionId);
    }

    try {
      const result = await this.request(`/chunked-audio/sessions/${sessionId}/status`);
      if (__DEV__) {
        console.log('[API] getSessionStatus success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getSessionStatus error:', error);
      }
      throw error;
    }
  }

  // Get offerings (services/procedures) for appointment creation
  async getOfferings(offeringType: string = 'SERVICE', isActive: boolean = true) {
    const params = new URLSearchParams({
      offering_type: offeringType,
      is_active: isActive.toString(),
    });

    if (__DEV__) {
      console.log('[API] getOfferings called with:', { offeringType, isActive });
    }

    try {
      const result = await this.request(`/offerings?${params}`, {
        headers: this.getOrgHeaders()
      });
      if (__DEV__) {
        console.log('[API] getOfferings success:', result);
      }
      // The offerings endpoint returns the array directly, unlike other endpoints
      return Array.isArray(result) ? result : [];
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getOfferings error:', error);
      }
      throw error;
    }
  }

  // Get patient care plans for appointment creation
  async getPatientCarePlans(patientCpf: string, practitionerId: string) {
    if (__DEV__) {
      console.log('[API] getPatientCarePlans called with:', { patientCpf, practitionerId });
    }

    try {
      const result = await this.request(`/careplan/patient/${encodeURIComponent(patientCpf)}/careplans?practitionerId=${encodeURIComponent(practitionerId)}`, {
        headers: this.getOrgHeaders()
      });
      if (__DEV__) {
        console.log('[API] getPatientCarePlans success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getPatientCarePlans error:', error);
      }
      throw error;
    }
  }

  // Get practitioner locations for appointment creation
  async getPractitionerLocations(practitionerEmail: string) {
    if (__DEV__) {
      console.log('[API] getPractitionerLocations called with:', { practitionerEmail });
    }

    try {
      const result = await this.request(`/location/getpractlocationsbyemail/${encodeURIComponent(practitionerEmail)}/?status=active`, {
        headers: this.getOrgHeaders()
      });
      if (__DEV__) {
        console.log('[API] getPractitionerLocations success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getPractitionerLocations error:', error);
      }
      throw error;
    }
  }

  async getLocationById(locationId: string, practitionerEmail?: string) {
    if (!locationId) {
      throw new Error('Location ID is required');
    }

    const params = new URLSearchParams();
    if (practitionerEmail) {
      params.append('email', practitionerEmail);
    }

    const url = `/location/getlocationbyid/${encodeURIComponent(locationId)}${
      params.toString() ? `?${params.toString()}` : ''
    }`;

    if (__DEV__) {
      console.log('[API] getLocationById called with:', { locationId, practitionerEmail });
    }

    try {
      const result = await this.request(url, {
        headers: this.getOrgHeaders(),
      });
      if (__DEV__) {
        console.log('[API] getLocationById success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getLocationById error:', error);
      }
      throw error;
    }
  }

  // Get available dates for appointment scheduling
  async getAvailableDates(practitionerId: string, locationId: string, year: number, month: number, duration: number = 60) {
    const params = new URLSearchParams({
      practitionerId,
      locationId,
      year: year.toString(),
      month: month.toString(),
      duration: duration.toString(),
    });

    if (__DEV__) {
      console.log('[API] getAvailableDates called with:', { practitionerId, locationId, year, month, duration });
    }

    try {
      const result = await this.request(`/appointment/available-dates?${params}`, {
        headers: this.getOrgHeaders()
      });
      if (__DEV__) {
        console.log('[API] getAvailableDates success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getAvailableDates error:', error);
      }
      throw error;
    }
  }

  // Get available times for a specific date
  async getAvailableTimes(practitionerId: string, locationId: string, date: string, duration: number = 60) {
    const params = new URLSearchParams({
      practitionerId,
      locationId,
      date,
      duration: duration.toString(),
    });

    if (__DEV__) {
      console.log('[API] getAvailableTimes called with:', { practitionerId, locationId, date, duration });
    }

    try {
      const result = await this.request(`/appointment/available-times?${params}`, {
        headers: this.getOrgHeaders()
      });
      if (__DEV__) {
        console.log('[API] getAvailableTimes success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getAvailableTimes error:', error);
      }
      throw error;
    }
  }

  // Get next five available slots
  async getNextFiveSlots(practitionerId: string, locationId: string, duration: number = 60) {
    const params = new URLSearchParams({
      practitionerId,
      locationId,
      duration: duration.toString(),
    });

    if (__DEV__) {
      console.log('[API] getNextFiveSlots called with:', { practitionerId, locationId, duration });
    }

    try {
      const result = await this.request(`/appointment/next-five-slots?${params}`, {
        headers: this.getOrgHeaders()
      });
      if (__DEV__) {
        console.log('[API] getNextFiveSlots success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getNextFiveSlots error:', error);
      }
      throw error;
    }
  }

  // Get practitioner appointments to check for conflicts
  async getPractitionerAppointments(practId: string, options: { page?: number; limit?: number; future?: string } = {}) {
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 100).toString(), // Get more appointments to check conflicts
      ...(options.future && { future: options.future })
    });

    if (__DEV__) {
      console.log('[API] getPractitionerAppointments called with:', { practId, options });
    }

    try {
      const result = await this.request(`/appointment/getappointments/${practId}?${params}`, {
        headers: this.getOrgHeaders()
      });
      if (__DEV__) {
        console.log('[API] getPractitionerAppointments success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getPractitionerAppointments error:', error);
      }
      throw error;
    }
  }

  // Create appointment
  async createAppointment(appointmentData: Partial<AppointmentData> | Record<string, unknown>) {
    if (__DEV__) {
      console.log('[API] createAppointment called with:', appointmentData);
    }

    try {
      if (__DEV__) {
        console.log('[API] About to make POST request to /appointment/create-appointment');
      }
      const result = await this.request('/appointment/create-appointment', {
        method: 'POST',
        headers: this.getOrgHeaders(),
        body: appointmentData
      });
      if (__DEV__) {
        console.log('[API] createAppointment success:', result);
      }
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      if (__DEV__) {
        console.error('[API] createAppointment error:', errorMessage);
      }
      if (__DEV__) {
        console.error('[API] Error details:', {
        message: errorMessage,
        stack: errorStack
        });
      }
      throw error;
    }
  }

  // Cancel appointment
  async cancelAppointment(appointmentId: string) {
    if (__DEV__) {
      console.log('[API] cancelAppointment called with:', appointmentId);
    }

    try {
      const result = await this.request(`/appointment/cancel/${appointmentId}`, {
        method: 'POST',
        headers: this.getOrgHeaders()
      });
      if (__DEV__) {
        console.log('[API] cancelAppointment success:', result);
      }
      return result;
    } catch (error: unknown) {
      if (__DEV__) {
        console.error('[API] cancelAppointment error:', error);
      }
      // Re-throw with more context for error handling
      if (error && typeof error === 'object' && 'response' in error) {
        const errorResponse = error as { response?: { status?: number } };
        const status = errorResponse.response?.status;
        if (status === 404) {
          throw new Error('Agendamento não encontrado.');
        } else if (status === 403) {
          throw new Error('Você não tem permissão para cancelar este agendamento.');
        } else if (status === 409) {
          throw new Error('Este agendamento já foi cancelado.');
        }
      }
      throw new Error('Erro ao cancelar agendamento. Tente novamente.');
    }
  }

  // Step 6 API methods
  async getServiceCategories() {
    try {
      if (__DEV__) {
        console.log('[API] getServiceCategories called');
      }
      const result = await this.request('/pract/getservicecategory');
      if (__DEV__) {
        console.log('[API] getServiceCategories success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getServiceCategories error:', error);
      }
      throw error;
    }
  }

  async getPractServiceCategories(practId: string) {
    try {
      if (__DEV__) {
        console.log('[API] getPractServiceCategories called with practId:', practId);
      }
      const result = await this.request(`/pract/getpractservicecategories/${practId}`);
      if (__DEV__) {
        console.log('[API] getPractServiceCategories success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getPractServiceCategories error:', error);
      }
      throw error;
    }
  }

  async getServiceTypes() {
    try {
      if (__DEV__) {
        console.log('[API] getServiceTypes called');
      }
      const result = await this.request('/pract/getservicetypes');
      if (__DEV__) {
        console.log('[API] getServiceTypes success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getServiceTypes error:', error);
      }
      throw error;
    }
  }

  async getServiceDescriptions(categoryId?: string | null, typeId?: string | null) {
    if (!categoryId && !typeId) {
      if (__DEV__) {
        console.log('[API] getServiceDescriptions skipped (no ids provided)');
      }
      return { category: null, type: null };
    }

    const params = new URLSearchParams();
    if (categoryId) {
      params.append('categoryId', categoryId);
    }
    if (typeId) {
      params.append('typeId', typeId);
    }

    const url = `/pract/getservicedescriptions?${params.toString()}`;

    if (__DEV__) {
      console.log('[API] getServiceDescriptions called with:', { categoryId, typeId });
    }

    try {
      const result = await this.request(url, {
        headers: this.getOrgHeaders(),
      });
      if (__DEV__) {
        console.log('[API] getServiceDescriptions success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getServiceDescriptions error:', error);
      }
      throw error;
    }
  }

  async getPractServiceTypes(practId: string) {
    try {
      if (__DEV__) {
        console.log('[API] getPractServiceTypes called with practId:', practId);
      }
      const result = await this.request(`/pract/getpractservicetypes/${practId}`);
      if (__DEV__) {
        console.log('[API] getPractServiceTypes success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getPractServiceTypes error:', error);
      }
      throw error;
    }
  }

  async getAppointmentTypes(practId: string) {
    try {
      if (__DEV__) {
        console.log('[API] getAppointmentTypes called with practId:', practId);
      }
      const result = await this.request(`/pract/config/${practId}`);
      if (__DEV__) {
        console.log('[API] getAppointmentTypes success:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getAppointmentTypes error:', error);
      }
      throw error;
    }
  }

  // === PRACTITIONER PROFILE ===
  async getMyPractitionerProfile(email: string) {
    if (!email) {
      throw new Error('Email is required to fetch practitioner profile.');
    }

    try {
      if (__DEV__) {
        console.log('[API] getMyPractitionerProfile request email:', email);
      }
      const result = await this.request<PractitionerProfile>(
        `/pract/getmydata?email=${encodeURIComponent(email)}`
      );
      if (__DEV__) {
        console.log('[API] getMyPractitionerProfile response:', result);
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getMyPractitionerProfile error:', error);
      }
      throw error;
    }
  }

  async saveMyPractitionerProfile(updatedFields: Record<string, unknown>) {
    if (!updatedFields || typeof updatedFields !== 'object') {
      throw new Error('Invalid profile payload.');
    }

    try {
      if (__DEV__) {
        console.log('[API] saveMyPractitionerProfile payload:', updatedFields);
      }
      return await this.request('/pract/savemydata', {
        method: 'POST',
        body: { updatedFields },
      });
    } catch (error) {
      if (__DEV__) {
        console.error('[API] saveMyPractitionerProfile error:', error);
      }
      throw error;
    }
  }

  async saveMyPractitionerPhoto(email: string, dataURL: string) {
    if (!email || !dataURL) {
      throw new Error('Email and photo data are required.');
    }

    try {
      if (__DEV__) {
        console.log('[API] saveMyPractitionerPhoto email:', email, 'payloadLength:', dataURL.length);
      }
      return await this.request('/pract/savemyphoto', {
        method: 'POST',
        body: { email, dataURL },
      });
    } catch (error) {
      if (__DEV__) {
        console.error('[API] saveMyPractitionerPhoto error:', error);
      }
      throw error;
    }
  }

  // === COMMUNICATION USAGE (UC) ===
  async getCommUsageLedger(params: { thread_id: string; from?: string; to?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    query.set('thread_id', params.thread_id);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.offset !== undefined) query.set('offset', String(params.offset));
    return this.request(`/api/comm-usage/ledger?${query.toString()}`);
  }

  async getCommUsageSummary(params: { practitioner: string; patient: string; from?: string; to?: string }) {
    const query = new URLSearchParams();
    query.set('practitioner', params.practitioner);
    query.set('patient', params.patient);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    return this.request(`/api/comm-usage/summary?${query.toString()}`);
  }

  // === PRE-APPOINTMENT FORMS ===

  /**
   * Get pre-appointment form status for a specific appointment
   * @param appointmentId - The appointment identifier
   * @returns Form status data including progress, completion status, etc.
   */
  async getPreAppointmentFormStatus(appointmentId: string): Promise<PreAppointmentFormStatus | null> {
    try {
      if (__DEV__) {
        console.log('[API] getPreAppointmentFormStatus called for appointment:', appointmentId);
      }

      // Query the API with appointmentId filter
      const query = new URLSearchParams({
        appointmentId: appointmentId,
        page: '1',
        pageSize: '1'
      });

      const response = await this.request<PreAppointmentApiResponse>(
        `/api/forms/pre-appointment/manage?${query.toString()}`,
        {
          headers: this.getOrgHeaders(),
        }
      );

      if (__DEV__) {
        console.log('[API] getPreAppointmentFormStatus response:', response);
      }

      // Return the first result if available and appointmentId matches
      if (response.success && response.data && response.data.length > 0) {
        const form = response.data[0];
        // Only return if appointmentId matches the request
        if (form.appointmentId === appointmentId) {
          return form;
        }
      }

      return null;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getPreAppointmentFormStatus error:', error);
      }
      // Return null instead of throwing - form might not exist for this appointment
      return null;
    }
  }

  /**
   * Get detailed pre-appointment form data with patient responses
   * @param trackingId - The tracking ID for the form
   * @returns Detailed form data with sections and answers
   */
  async getPreAppointmentFormDetails(trackingId: string): Promise<FormDetailApiResponse> {
    try {
      if (__DEV__) {
        console.log('[API] getPreAppointmentFormDetails called for tracking:', trackingId);
      }

      const response = await this.request<FormDetailApiResponse>(
        `/api/forms/pre-appointment/manage/${trackingId}`,
        {
          headers: this.getOrgHeaders(),
        }
      );

      if (__DEV__) {
        console.log('[API] getPreAppointmentFormDetails response:', response);
      }
      return response;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] getPreAppointmentFormDetails error:', error);
      }
      throw error;
    }
  }
}

export const api = new ApiService();
export const apiService = api;
export { API_BASE_URL };
export default api;
