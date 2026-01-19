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
import { logger } from '@/utils/logger';

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
    const isValid = await useAuthStore.getState().ensureValidToken();
    if (!isValid) {
      throw new Error('Usuário não autenticado');
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const { method = 'GET', body } = config;

    const headers = {
      ...this.getAuthHeaders(),
      ...config.headers,
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

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

  async get<T = any>(endpoint: string): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint);
    return { data };
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
        return this.request(`/appointment/getappointmentbyid/${appointmentId}`, {
      headers: this.getOrgHeaders(),
    });
  }

  // Get patient details by CPF
  async getPatientDetails(cpf: string) {
        
    try {
      const result = await this.request(`/patient/getpatientdetails/${cpf}`, {
        headers: this.getOrgHeaders(),
      });
            return result;
    } catch (error) {
      logger.error('Failed to get patient details:', error);
      throw error;
    }
  }

  // Get lead details by ID
  async getLeadDetails(leadId: string) {
    try {
      const result = await this.request(`/patient/lead/${leadId}`, {
        headers: this.getOrgHeaders(),
      });
      return result;
    } catch (error) {
      logger.error('Failed to get lead details:', error);
      throw error;
    }
  }

  // Create a new lead
  async createLead(payload: {
    patient_name: string;
    patient_cpf?: string;
    patient_phone?: string;
    patient_email?: string;
    status?: string;
    notes?: string;
  }) {
    return this.request('/patient/lead', {
      method: 'POST',
      headers: this.getOrgHeaders(),
      body: payload,
    });
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

  // List leads for practitioner
  async getLeads(page: number = 1, limit: number = 20, search: string = '') {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      filter: search,
    });

    return this.request(`/patient/leads?${params}`, {
      headers: this.getOrgHeaders(),
    });
  }

  // Search patients for appointment booking - using the same endpoint as web frontend
  async searchPatients(searchTerm: string, searchType: 'name' | 'cpf' | 'phone', page: number = 1, limit: number = 10) {
    const { user } = useAuthStore.getState();
    const userEmail = user?.email || '';
    
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
      return result;
    } catch (error) {
      logger.error('Failed to search patients:', error);
      throw error;
    }
  }

  // Get patient appointments
  async getPatientAppointments(patientCpf: string) {
    try {
      const result = await this.request(`/appointment/getnextpatientappointments/${patientCpf}`, {
        headers: this.getOrgHeaders(),
      });
      return result;
    } catch (error) {
      logger.error('Failed to get patient appointments:', error);
      throw error;
    }
  }

  // Get patient photo (returns blob data, not JSON)
  async getPatientPhoto(patientCpf: string) {
    const { token } = useAuthStore.getState();

    const url = `${API_BASE_URL}/patient/getpatientphoto?patientCpf=${patientCpf}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.getOrgHeaders(),
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Photo API Error: ${response.status} ${response.statusText}`);
      }

      // Check if response has content
      const contentLength = response.headers.get('content-length');

      if (contentLength === '0' || contentLength === null) {
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        return null;
      }

      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const dataUri = `data:${contentType};base64,${base64}`;
      return dataUri;
    } catch (error) {
      logger.error('Failed to fetch patient photo:', error);
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

    try {
      const result = await this.request(`/encounter/getencounters/practitioner/${practId}?${params}`, {
        headers: this.getOrgHeaders(practId),
      });
      return result;
    } catch (error) {
      logger.error('Failed to get in-progress encounters:', error);
      throw error;
    }
  }

  // Get all encounters for practitioner with optional status filter
  async getPractitionerEncounters(
    practId: string,
    options: {
      page?: number;
      limit?: number;
      statusFilter?: 'OPEN' | 'COMPLETED' | 'ALL';
    } = {}
  ) {
    const { page = 1, limit = 20, statusFilter = 'ALL' } = options;

    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    // Only add status filter if not fetching ALL
    if (statusFilter === 'OPEN') {
      params.append('status', JSON.stringify({
        filter1: 'in-progress',
        filter2: 'on-hold',
        filter3: ''
      }));
    } else if (statusFilter === 'COMPLETED') {
      params.append('status', JSON.stringify({
        filter1: 'finished',
        filter2: 'completed',
        filter3: ''
      }));
    }
    // For 'ALL', don't pass status filter - backend returns all encounters

    try {
      const result = await this.request(`/encounter/getencounters/practitioner/${practId}?${params}`, {
        headers: this.getOrgHeaders(practId),
      });
      return result;
    } catch (error) {
      logger.error('Failed to get practitioner encounters:', error);
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

  async getPractitionerPatientEncounters(patientCpf: string) {
    try {
      const response = await this.request(`/encounter/practitioner-encounters/${patientCpf}`, {
        headers: this.getOrgHeaders(),
      });

      return response;
    } catch (error) {
      logger.error('Failed to get practitioner patient encounters:', error);
      throw error;
    }
  }

  async getEncounterInfoById(encounterId: string) {
    return this.request(`/encounter/getencounterinfobyid/${encounterId}`, {
      headers: this.getOrgHeaders(),
    });
  }

  // Update encounter status (pause/resume)
  async updateEncounterStatus(encounterId: string, status: string) {
    try {
      const result = await this.request(`/encounter/updateencounterstatus/${encounterId}?status=${status}`, {
        method: 'POST',
        headers: this.getOrgHeaders()
      });
      return result;
    } catch (error: unknown) {
      logger.error('Failed to update encounter status:', error);
      throw error;
    }
  }

  // Append mobile note (uses separate MobileNotes field to avoid conflicts with web app)
  async appendMobileNote(encounterId: string, noteText: string) {

    try {
      const result = await this.request(`/encounter/append-mobile-note/${encounterId}`, {
        method: 'POST',
        headers: this.getOrgHeaders(),
        body: {
          noteText: noteText,
        },
      });
      return result;
    } catch (error: unknown) {
      logger.error('Failed to append mobile note:', error);
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

    try {
      const response = await this.request(`/clinical/records/${patientCpf}?${params}`, {
        headers: this.getOrgHeaders(),
      });

      return response;
    } catch (error) {
      logger.error('Failed to get patient clinical records:', error);
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

    try {
      const response = await this.request(`/medication/records/${patientCpf}?${params}`, {
        headers: this.getOrgHeaders(),
      });

      return response;
    } catch (error) {
      logger.error('Failed to get patient medication records:', error);
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
    try {
      const response = await this.request(`/diagnostic/records/${patientCpf}?${params}`, {
        headers: this.getOrgHeaders(),
      });
      return response;
    } catch (error) {
      logger.error('[API] getPatientDiagnosticRecords error:', error);
      throw error;
    }
  }

  async getPatientImageRecords(patientId: string, options: { page?: number; limit?: number } = {}) {
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
    });
    try {
      const response = await this.request(`/images/records/${patientId}?${params}`, {
        headers: this.getOrgHeaders(),
      });
      return response;
    } catch (error) {
      logger.error('[API] getPatientImageRecords error:', error);
      throw error;
    }
  }

  /**
   * Download image blob data from Azure storage
   * @param blobname The blob filename (from the 'file' field in image records)
   * @returns Base64 data URI for React Native Image component, or null on error
   */
  async downloadImageBlob(blobname: string): Promise<string | null> {
    try {
      const url = `${API_BASE_URL}/images/getfromazure/${encodeURIComponent(blobname)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.getAuthHeaders(),
          ...this.getOrgHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      // Get content type from response headers
      const contentType = response.headers.get('content-type') || 'image/jpeg';

      // Convert blob response to base64
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // The result is already a data URI (data:image/jpeg;base64,...)
          resolve(base64data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      logger.error('[API] downloadImageBlob error:', error);
      return null;
    }
  }

  async getPatientAttachments(patientId: string, options: { page?: number; limit?: number } = {}) {
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
    });
    try {
      const response = await this.request(`/attach/getbypatient/${patientId}?${params}`, {
        headers: this.getOrgHeaders(),
      });
      return response;
    } catch (error) {
      logger.error('[API] getPatientAttachments error:', error);
      throw error;
    }
  }

  async getPatientRecordings(patientCpf: string, options: { page?: number; limit?: number } = {}) {
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
    });
    try {
      const response = await this.request(`/recordings/patient/${patientCpf}?${params}`, {
        headers: this.getOrgHeaders(),
      });
      return response;
    } catch (error) {
      logger.error('[API] getPatientRecordings error:', error);
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
    return response;
  }

  async getAttachmentsByContext(contextId: string) {
    const response = await this.request(`/attach/getbycontext/${contextId}`, {
      headers: this.getOrgHeaders(),
    });
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

  async getEncounterSummary(encounterId: string) {
    return this.request(`/encounter/load/summary/${encounterId}`, {
      headers: this.getOrgHeaders(),
    });
  }

  async getEncounterAI(encounterId: string) {
    return this.request(`/encounter/ai/${encounterId}`, {
      headers: this.getOrgHeaders(),
    });
  }

  async getEncounterRecordings(encounterId: string, options: { limit?: number } = {}) {
    const params = new URLSearchParams({
      limit: (options.limit || 20).toString(),
    });
    return this.request(`/recordings/encounter/${encounterId}?${params}`, {
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
    const response = await this.request(`/api/internal-comm/messages/thread/${threadId}?${queryParams}`);
    return response;
  }

  async getThreadParticipants(threadId: string): Promise<any> {
    const response = await this.request(`/api/internal-comm/messages/thread/${threadId}/participants`);
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

  // Upload prescription PDF
  async uploadPrescriptionPdf(
    filePath: string,
    fileName: string,
    prescriptionId: string,
    encounterId: string,
    patientCpf: string
  ): Promise<{ success: boolean; fileid: string }> {
    const { token } = useAuthStore.getState();

    const formData = new FormData();
    // Field name must be 'attach_file' to match backend multer config
    formData.append('attach_file', {
      uri: filePath,
      type: 'application/pdf',
      name: fileName,
    } as unknown as Blob);

    // Add metadata fields to FormData body (matching the backend flow)
    formData.append('patient', patientCpf);
    formData.append('encounter', encounterId);
    formData.append('type', 'MEDREQUEST'); // Type for unsigned prescription PDFs
    formData.append('context', prescriptionId); // Link to prescription (KEY FIELD!)
    formData.append('date', new Date().toISOString().split('T')[0]); // YYYY-MM-DD
    formData.append('status', 'active');
    formData.append('filetype', 'application/pdf');
    formData.append('datasource', 'medpro-mobile');

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            logger.error('[API] Error parsing prescription PDF upload response:', error);
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Prescription PDF upload failed with status: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        logger.error('Prescription PDF upload network error');
        reject(new Error('Network error during prescription PDF upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Prescription PDF upload was aborted'));
      });

      // Use /uploadToAzure endpoint
      xhr.open('POST', `${API_BASE_URL}/attach/uploadToAzure`);

      // Add auth headers
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(formData);
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
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
        }
      });

      xhr.addEventListener('load', () => {

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            logger.error('[API] Error parsing attachment response:', error);
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Attachment upload failed with status: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        logger.error('Attachment upload network error');
        reject(new Error('Network error during attachment upload'));
      });

      xhr.addEventListener('abort', () => {
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
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
        }
      });
      
      xhr.addEventListener('load', () => {

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            logger.error('[API] Error parsing image response:', error);
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Image upload failed with status: ${xhr.status}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        logger.error('Image upload network error');
        reject(new Error('Network error during image upload'));
      });
      
      xhr.addEventListener('abort', () => {
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

    const fileName = `recording_${Date.now()}.mp4`;
    const audioFile = {
      uri: audioPath,
      type: 'audio/mp4',
      name: fileName,
    };
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

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
        }
      });

      xhr.addEventListener('load', () => {

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);

            resolve(response);
          } catch (error) {
            logger.error('Error parsing audio upload response:', error);
            reject(new Error('Invalid response format'));
          }
        } else {
          let errorMessage = `Upload failed with status: ${xhr.status}`;
          try {
            const errorData = JSON.parse(xhr.responseText);
            if (errorData.message) {
              errorMessage += ` - ${errorData.message}`;
            }
            if (errorData.error) {
              errorMessage += ` (${errorData.error})`;
            }
          } catch (e) {
            // Could not parse error response
          }

          logger.error('Audio upload failed:', errorMessage);
          reject(new Error(errorMessage));
        }
      });

      xhr.addEventListener('error', () => {
        logger.error('Network error during audio upload');
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        logger.warn('Audio upload aborted');
        reject(new Error('Upload was aborted'));
      });

      xhr.open('POST', `${API_BASE_URL}/audio/uploadAudio`);
      // Add auth headers
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      } else {
        logger.warn('No auth token available for audio upload');
      }

      // Add additional headers
      Object.entries(headers).forEach(([key, value]) => {
        if (key !== 'Content-Type' && typeof value === 'string') { // Let browser set Content-Type for FormData
          xhr.setRequestHeader(key, value);
        }
      });

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
      return result;
    } catch (error) {
      logger.error('[API] createChunkedSession error:', error);
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
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            logger.error('[API] Error parsing chunk response:', error);
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Chunk upload failed with status: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        logger.error('Chunk upload network error');
        reject(new Error('Network error during chunk upload'));
      });

      xhr.addEventListener('abort', () => {
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
    try {
      const result = await this.request(`/chunked-audio/sessions/${sessionId}/complete`, {
        method: 'POST',
      });
      return result;
    } catch (error) {
      logger.error('[API] completeChunkedSession error:', error);
      throw error;
    }
  }

  /**
   * Cancel a chunked upload session
   * @param sessionId The session ID
   */
  async cancelChunkedSession(sessionId: string): Promise<{ success: boolean }> {
    try {
      const result = await this.request(`/chunked-audio/sessions/${sessionId}/cancel`, {
        method: 'POST',
      });
      return result;
    } catch (error) {
      logger.error('[API] cancelChunkedSession error:', error);
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
    try {
      const result = await this.request(`/chunked-audio/sessions/${sessionId}/status`);
      return result;
    } catch (error) {
      logger.error('[API] getSessionStatus error:', error);
      throw error;
    }
  }

  // Get appointment setup data (services + payment coverage) for a practitioner
  // This endpoint merges org-level and personal offerings
  async getAppointmentSetup(practitionerEmail: string, includeInactive: boolean = false) {
    try {
      const endpoint = `/pract/${encodeURIComponent(practitionerEmail)}/appointment-setup${includeInactive ? '?includeInactive=true' : ''}`;
      const result = await this.request(endpoint, {
        headers: this.getOrgHeaders(practitionerEmail)
      });
      logger.debug('[API] getAppointmentSetup result:', result);
      return result;
    } catch (error) {
      logger.error('[API] getAppointmentSetup error:', error);
      throw error;
    }
  }

  // Get patient care plans for appointment creation
  async getPatientCarePlans(patientCpf: string, practitionerId: string) {
    try {
      const result = await this.request(`/careplan/patient/${encodeURIComponent(patientCpf)}/careplans?practitionerId=${encodeURIComponent(practitionerId)}`, {
        headers: this.getOrgHeaders()
      });
      return result;
    } catch (error) {
      logger.error('[API] getPatientCarePlans error:', error);
      throw error;
    }
  }

  // Get practitioner locations for appointment creation
  async getPractitionerLocations(practitionerEmail: string) {
    try {
      const result = await this.request(`/location/getpractlocationsbyemail/${encodeURIComponent(practitionerEmail)}/?status=active`, {
        headers: this.getOrgHeaders()
      });
      return result;
    } catch (error) {
      logger.error('[API] getPractitionerLocations error:', error);
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
    try {
      const result = await this.request(url, {
        headers: this.getOrgHeaders(),
      });
      return result;
    } catch (error) {
      logger.error('[API] getLocationById error:', error);
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
    try {
      const result = await this.request(`/appointment/available-dates?${params}`, {
        headers: this.getOrgHeaders()
      });
      return result;
    } catch (error) {
      logger.error('[API] getAvailableDates error:', error);
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
    try {
      const result = await this.request(`/appointment/available-times?${params}`, {
        headers: this.getOrgHeaders()
      });
      return result;
    } catch (error) {
      logger.error('[API] getAvailableTimes error:', error);
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
    try {
      const result = await this.request(`/appointment/next-five-slots?${params}`, {
        headers: this.getOrgHeaders()
      });
      return result;
    } catch (error) {
      logger.error('[API] getNextFiveSlots error:', error);
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
    try {
      const result = await this.request(`/appointment/getappointments/${practId}?${params}`, {
        headers: this.getOrgHeaders()
      });
      return result;
    } catch (error) {
      logger.error('[API] getPractitionerAppointments error:', error);
      throw error;
    }
  }

  // Create appointment
  async createAppointment(appointmentData: Partial<AppointmentData> | Record<string, unknown>) {
    try {
      const result = await this.request('/appointment/create-appointment', {
        method: 'POST',
        headers: this.getOrgHeaders(),
        body: appointmentData
      });
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('createAppointment error:', {
        message: errorMessage,
        stack: errorStack
      });
      throw error;
    }
  }

  // Cancel appointment
  async cancelAppointment(appointmentId: string) {
    try {
      const result = await this.request(`/appointment/cancel/${appointmentId}`, {
        method: 'POST',
        headers: this.getOrgHeaders()
      });
      return result;
    } catch (error: unknown) {
      logger.error('[API] cancelAppointment error:', error);
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
      const result = await this.request('/pract/getservicecategory');
      return result;
    } catch (error) {
      logger.error('[API] getServiceCategories error:', error);
      throw error;
    }
  }

  async getPractServiceCategories(practId: string) {
    try {
      const result = await this.request(`/pract/getpractservicecategories/${practId}`);
      return result;
    } catch (error) {
      logger.error('[API] getPractServiceCategories error:', error);
      throw error;
    }
  }

  async getServiceTypes() {
    try {
      const result = await this.request('/pract/getservicetypes');
      return result;
    } catch (error) {
      logger.error('[API] getServiceTypes error:', error);
      throw error;
    }
  }

  async getServiceDescriptions(categoryId?: string | null, typeId?: string | null) {
    if (!categoryId && !typeId) {
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
    try {
      const result = await this.request(url, {
        headers: this.getOrgHeaders(),
      });
      return result;
    } catch (error) {
      logger.error('[API] getServiceDescriptions error:', error);
      throw error;
    }
  }

  async getPractServiceTypes(practId: string) {
    try {
      const result = await this.request(`/pract/getpractservicetypes/${practId}`);
      return result;
    } catch (error) {
      logger.error('[API] getPractServiceTypes error:', error);
      throw error;
    }
  }

  async getAppointmentTypes(practId: string) {
    try {
      const result = await this.request(`/pract/config/${practId}`);
      return result;
    } catch (error) {
      logger.error('[API] getAppointmentTypes error:', error);
      throw error;
    }
  }

  // === PRACTITIONER PROFILE ===
  async getMyPractitionerProfile(email: string) {
    if (!email) {
      throw new Error('Email is required to fetch practitioner profile.');
    }

    try {
      const result = await this.request<PractitionerProfile>(
        `/pract/getmydata?email=${encodeURIComponent(email)}`
      );
      return result;
    } catch (error) {
      logger.error('[API] getMyPractitionerProfile error:', error);
      throw error;
    }
  }

  async saveMyPractitionerProfile(updatedFields: Record<string, unknown>) {
    if (!updatedFields || typeof updatedFields !== 'object') {
      throw new Error('Invalid profile payload.');
    }

    try {
      return await this.request('/pract/savemydata', {
        method: 'POST',
        body: { updatedFields },
      });
    } catch (error) {
      logger.error('[API] saveMyPractitionerProfile error:', error);
      throw error;
    }
  }

  async saveMyPractitionerPhoto(email: string, dataURL: string) {
    if (!email || !dataURL) {
      throw new Error('Email and photo data are required.');
    }

    try {
      return await this.request('/pract/savemyphoto', {
        method: 'POST',
        body: { email, dataURL },
      });
    } catch (error) {
      logger.error('[API] saveMyPractitionerPhoto error:', error);
      throw error;
    }
  }

  // === LOCATION SERVICES ===
  async getStates(): Promise<Array<{ id: number; sigla: string; nome: string }>> {
    try {
      const result = await this.request<Array<{ id: number; sigla: string; nome: string }>>(
        '/api/v1/localidades/estados?orderBy=nome'
      );
      return result;
    } catch (error) {
      logger.error('[API] getStates error:', error);
      throw error;
    }
  }

  async getCities(stateCode: string): Promise<Array<{ id: number; nome: string }>> {
    if (!stateCode) {
      throw new Error('State code is required to fetch cities.');
    }

    // Map state sigla to ID for API call (based on IBGE codes)
    const stateMap: Record<string, number> = {
      AC: 12, AL: 27, AP: 16, AM: 13, BA: 29, CE: 23, DF: 53, ES: 32,
      GO: 52, MA: 21, MT: 51, MS: 50, MG: 31, PA: 15, PB: 25, PR: 41,
      PE: 26, PI: 22, RJ: 33, RN: 24, RS: 43, RO: 11, RR: 14, SC: 42,
      SP: 35, SE: 28, TO: 17,
    };

    const stateId = stateMap[stateCode.toUpperCase()];
    if (!stateId) {
      throw new Error(`Invalid state code: ${stateCode}`);
    }

    try {
      const result = await this.request<Array<{ id: number; nome: string }>>(
        `/api/v1/localidades/estados/${stateId}/municipios?orderBy=nome`
      );
      return result;
    } catch (error) {
      logger.error('[API] getCities error:', error);
      throw error;
    }
  }

  async lookupCEP(cep: string): Promise<{
    cep: string;
    logradouro: string;
    complemento: string;
    bairro: string;
    localidade: string;
    uf: string;
    ibge: string;
    erro?: boolean;
  }> {
    if (!cep) {
      throw new Error('CEP is required.');
    }

    // Remove formatting
    const cleanCEP = cep.replace(/\D/g, '');
    if (cleanCEP.length !== 8) {
      throw new Error('CEP deve ter 8 dígitos.');
    }

    try {
      // Call ViaCEP API directly (external API)
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      if (!response.ok) {
        throw new Error('Erro ao consultar CEP.');
      }

      const result = await response.json();
      if (result.erro) {
        throw new Error('CEP não encontrado.');
      }

      return result;
    } catch (error) {
      logger.error('[API] lookupCEP error:', error);
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
      logger.error('[API] getPreAppointmentFormStatus error:', error);
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
      const response = await this.request<FormDetailApiResponse>(
        `/api/forms/pre-appointment/manage/${trackingId}`,
        {
          headers: this.getOrgHeaders(),
        }
      );
      return response;
    } catch (error) {
      logger.error('[API] getPreAppointmentFormDetails error:', error);
      throw error;
    }
  }

  // === ACCOUNT MANAGEMENT ===

  /**
   * Get account data counts for deletion preview
   * @param practId The practitioner email/ID
   * @returns Counts of data that will be deleted
   */
  async getAccountNumbers(practId: string): Promise<{
    relatedUsers: number;
    practitioners: number;
    linkedPatients: number;
    timeslots: number;
    schedules: number;
    practServiceTypes: number;
    practServiceCategories: number;
    appointments: number;
    organization: number;
    entityGroup: number;
    groupMembers: number;
    locations: number;
  }> {
    try {
      const result = await this.request(`/pract/getaccountnumbers/${encodeURIComponent(practId)}`);
      return result;
    } catch (error) {
      logger.error('[API] getAccountNumbers error:', error);
      throw error;
    }
  }

  /**
   * Permanently delete user account and all associated data
   * @param practId The practitioner email/ID
   * @returns Deletion result
   */
  async deleteAccount(practId: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.request(`/pract/removeaccount/${encodeURIComponent(practId)}`, {
        method: 'DELETE',
      });
      return result;
    } catch (error) {
      logger.error('[API] deleteAccount error:', error);
      throw error;
    }
  }

  /**
   * Download attachment blob data
   * @param blobname The blob filename to download
   * @param type The attachment type (e.g., "MEDREQUEST-SIGNED")
   * @param filetype The MIME type of the file
   * @returns Base64 encoded file data
   */
  async downloadAttachmentBlob(params: {
    blobname: string;
    type: string;
    filetype: string;
  }): Promise<string | null> {
    const { token } = useAuthStore.getState();
    try {
      const url = `${API_BASE_URL}/attach/getblob2`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          ...this.getOrgHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`Failed to download attachment: ${response.statusText}`);
      }

      // Convert blob response to base64
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
          const base64 = base64data.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      logger.error('[API] downloadAttachmentBlob error:', error);
      return null;
    }
  }

  /**
   * Renew a prescription - creates a new draft prescription based on the original
   * @param prescriptionId The ID of the prescription to renew
   * @returns Renewed prescription data
   */
  async renewPrescription(prescriptionId: string): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> {
    try {
      const response = await this.request(`/medication/renew/${prescriptionId}`, {
        method: 'POST',
        headers: this.getOrgHeaders(),
      });
      return response;
    } catch (error) {
      logger.error('[API] renewPrescription error:', error);
      throw error;
    }
  }

  /**
   * Update prescription status (e.g., from draft to completed)
   * @param prescriptionData Complete prescription data with updated status
   * @returns API response
   */
  async updatePrescriptionStatus(prescriptionData: {
    identifier: string;
    status: string;
    category: string;
    patient: string;
    encounter: string;
    date: string;
    type?: string;
    metadata?: any;
    requestitens?: any[] | string;
  }): Promise<any> {
    try {
      const response = await this.request('/medication/save', {
        method: 'POST',
        headers: this.getOrgHeaders(),
        body: prescriptionData, // Don't stringify - request method does it automatically
      });
      return response;
    } catch (error) {
      logger.error('[API] updatePrescriptionStatus error:', error);
      throw error;
    }
  }

  /**
   * Generate prescription PDF
   * @param params Prescription data including practitioner, patient, and medication items
   * @returns PDF response
   */
  async generatePrescriptionPdf(params: {
    category: string;
    pract: {
      name: string;
      email: string;
      crm?: string;
      phone?: string;
      specialty?: string;
    };
    patient: {
      name: string;
      cpf: string;
      birthDate?: string;
      phone?: string;
      email?: string;
    };
    header: {
      identifier: string;
      medicationRequestReceita: string;
      medicationRequestStatus: string;
      medicationRequestCategory: string;
      medicationRequestNote?: string;
      medicationRequestPatientInstructions?: string;
      encounter?: string;
      subject: string;
      practitioner: string;
    };
    items: Array<{
      produto: string;
      substancia: string;
      apresentacao: string;
      registro?: string;
      mododeuso: string;
      note?: string;
      medication: string;
      activeIngredient: string;
      presentation: string;
      posology: string;
      groupIdentifier: string;
    }>;
  }): Promise<any> {
    try {
      // Ensure token is valid before making request
      await useAuthStore.getState().ensureValidToken();
      const { token } = useAuthStore.getState();

      const url = `${API_BASE_URL}/medication/requestMedication/${params.category}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          ...this.getOrgHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PDF generation failed: ${response.status} ${errorText}`);
      }
      return { success: true };
    } catch (error) {
      logger.error('[API] generatePrescriptionPdf error:', error);
      throw error;
    }
  }

  /**
   * Generate prescription PDF and return as base64
   * @param params Prescription data including practitioner, patient, and medication items
   * @returns Base64 encoded PDF data
   */
  async generatePrescriptionPdfBlob(params: {
    category: string;
    pract: {
      name: string;
      email: string;
      crm?: string;
      phone?: string;
      specialty?: string;
    };
    patient: {
      name: string;
      cpf: string;
      birthDate?: string;
      phone?: string;
      email?: string;
    };
    header: {
      identifier: string;
      medicationRequestReceita: string;
      medicationRequestStatus: string;
      medicationRequestCategory: string;
      medicationRequestNote?: string;
      medicationRequestPatientInstructions?: string;
      encounter?: string;
      subject: string;
      practitioner: string;
    };
    items: Array<{
      produto: string;
      substancia: string;
      apresentacao: string;
      registro?: string;
      mododeuso: string;
      note?: string;
      medication: string;
      activeIngredient: string;
      presentation: string;
      posology: string;
      groupIdentifier: string;
    }>;
  }): Promise<{ base64: string; fileName: string }> {
    try {
      // Ensure token is valid before making request
      await useAuthStore.getState().ensureValidToken();

      const url = `${API_BASE_URL}/medication/requestMedication/${params.category}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          ...this.getOrgHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('PDF generation failed:', { status: response.status, error: errorText });
        throw new Error(`PDF generation failed: ${response.status} ${errorText}`);
      }
      // Get PDF as blob
      const blob = await response.blob();
      // Convert blob to base64
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remove data URL prefix (e.g., "data:application/pdf;base64,")
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const fileName = `prescription-${params.header.identifier}-${Date.now()}.pdf`;

      return {
        base64: base64Data,
        fileName,
      };
    } catch (error) {
      logger.error('[API] generatePrescriptionPdfBlob error:', error);
      throw error;
    }
  }
}

export const api = new ApiService();
export const apiService = api;
export { API_BASE_URL };
export default api;
