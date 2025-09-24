import { useAuthStore } from '../store/authStore';
import { Buffer } from 'buffer';
import { PractitionerProfile } from '@/types/practitioner';
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

export const API_BASE_URL = 'http://192.168.2.30:3000';

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

  private async request<T = any>(endpoint: string, config: ApiConfig = {}): Promise<T> {
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
          console.log('[API] 404 response treated as empty data for:', url);
          return [] as unknown as T; // Return empty array for 404s on history endpoints
        }
      }
      
      const errorText = await response.text();
      console.error('[API] Error response:', errorText);
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
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
      console.warn('[API] Health check failed:', error);
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
      // console.log('[API] Fetching practitioner schedule summary:', { email, days });
      return await this.request(url);
    } catch (error) {
      console.error('[API] getPractitionerScheduleSummary error:', error);
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
    const { user } = useAuthStore.getState();
    return this.request(`/appointment/getnextappointments/${email}?days=${days}`, {
      headers: {
        'managingorg': user?.organization,
        'practid': email,
      },
    });
  }

  // Get appointment details by ID
  async getAppointmentById(appointmentId: string) {
    const { user } = useAuthStore.getState();
    // console.log('[API] getAppointmentById called with ID:', appointmentId);
    return this.request(`/appointment/getappointmentbyid/${appointmentId}`, {
      headers: {
        'managingorg': user?.organization,
        'practid': user?.email || '',
      },
    });
  }

  // Get patient details by CPF
  async getPatientDetails(cpf: string) {
    // console.log('[API] getPatientDetails called with CPF:', cpf);
    const { user } = useAuthStore.getState();
    // console.log('[API] User context:', { organization: user?.organization, email: user?.email });
    
    try {
      const result = await this.request(`/patient/getpatientdetails/${cpf}`, {
        headers: {
          'managingorg': user?.organization,
          'practid': user?.email || '',
        },
      });
      // console.log('[API] getPatientDetails success:', result);
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
        'managingorg': user?.organization,
        'practid': practId,
      },
    });
  }

  // Search patients for appointment booking - using the same endpoint as web frontend
  async searchPatients(searchTerm: string, searchType: 'name' | 'cpf' | 'phone', page: number = 1, limit: number = 10) {
    const { user } = useAuthStore.getState();
    // console.log('[API] searchPatients called with term:', searchTerm, 'type:', searchType);
    
    try {
      // Use the same endpoint as web frontend: /patient/getpatientbyname/${practId}
      const params = new URLSearchParams({
        name: searchTerm.trim(), // The backend uses 'name' parameter for search
        page: page.toString(),
        limit: limit.toString(),
      });

      const result = await this.request(`/patient/getpatientbyname/${user?.email}?${params}`, {
        headers: {
          'managingorg': user?.organization,
          'practid': user?.email || '',
        },
      });
      // console.log('[API] searchPatients success:', result);
      return result;
    } catch (error) {
      console.error('[API] searchPatients error:', error);
      throw error;
    }
  }

  // Get patient appointments
  async getPatientAppointments(patientCpf: string) {
    const { user } = useAuthStore.getState();
    // console.log('[API] getPatientAppointments called with CPF:', patientCpf);
    
    try {
      const result = await this.request(`/appointment/getnextpatientappointments/${patientCpf}`, {
        headers: {
          'managingorg': user?.organization,
          'practid': user?.email || '',
        },
      });
      // console.log('[API] getPatientAppointments success:', result);
      return result;
    } catch (error) {
      console.error('[API] getPatientAppointments error:', error);
      throw error;
    }
  }

  // Get patient photo (returns blob data, not JSON)
  async getPatientPhoto(patientCpf: string) {
    const { user } = useAuthStore.getState();
    const { token } = useAuthStore.getState();

    console.log('[API] getPatientPhoto called for CPF:', patientCpf);

    const url = `${API_BASE_URL}/patient/getpatientphoto?patientCpf=${patientCpf}`;
    const headers = {
      'Content-Type': 'application/json',
      'managingorg': user?.organization,
      'practid': user?.email || '',
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    console.log('[API] Fetching patient photo from:', url);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      console.log('[API] Patient photo response status:', response.status);
      console.log('[API] Patient photo response headers:', Object.fromEntries(response.headers.entries()));

      if (response.status === 404) {
        console.log('[API] Patient photo not found (404)');
        return null;
      }

      if (!response.ok) {
        throw new Error(`Photo API Error: ${response.status} ${response.statusText}`);
      }

      // Check if response has content
      const contentLength = response.headers.get('content-length');
      console.log('[API] Photo content length:', contentLength);
      
      if (contentLength === '0' || contentLength === null) {
        console.log('[API] No photo data available (empty response)');
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        console.log('[API] No photo data available (empty buffer)');
        return null;
      }

      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const dataUri = `data:${contentType};base64,${base64}`;
      console.log('[API] Photo converted to base64, length:', dataUri.length);
      return dataUri;
    } catch (error) {
      console.error('[API] Error fetching patient photo:', error);
      throw error;
    }
  }

  // Get encounters with in-progress or on-hold status for practitioner
  async getInProgressEncounters(practId: string) {
    const { user } = useAuthStore.getState();
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

    console.log('[API] getInProgressEncounters called for practitioner:', practId);
    
    try {
      const result = await this.request(`/encounter/getencounters/practitioner/${practId}?${params}`, {
        headers: {
          'managingorg': user?.organization,
          'practid': practId,
        },
      });
      console.log('[API] getInProgressEncounters success:', result);
      return result;
    } catch (error) {
      console.error('[API] getInProgressEncounters error:', error);
      throw error;
    }
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
        'managingorg': user?.organization,
        'practid': user?.email || '',
      },
    });
  }

  async getPatientLastEncounterSummary(patientCpf: string, currentEncounterId?: string) {
    const { user } = useAuthStore.getState();
    const query = currentEncounterId ? `?curEnc=${encodeURIComponent(currentEncounterId)}` : '';

    return this.request(`/encounter/patient/lastencounter/${patientCpf}${query}`, {
      headers: {
        'managingorg': user?.organization,
        'practid': user?.email || '',
      },
    });
  }

  async getEncounterInfoById(encounterId: string) {
    const { user } = useAuthStore.getState();

    return this.request(`/encounter/getencounterinfobyid/${encounterId}`, {
      headers: {
        'managingorg': user?.organization,
        'practid': user?.email || '',
      },
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

  async getEncounterClinicalRecords(encounterId: string, options: { page?: number; limit?: number; type?: string } = {}) {
    const { user } = useAuthStore.getState();
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
      ...(options.type && { type: options.type })
    });

    const response = await this.request(`/clinical/records/encounter/${encounterId}?${params}`, {
      headers: {
        'managingorg': user?.organization,
        'practid': user?.email || '',
      },
    });

    // console.log('[API] getEncounterClinicalRecords response:', JSON.stringify(response, null, 2));

    return response;
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
        'managingorg': user?.organization,
        'practid': user?.email || '',
      },
    });
  }

  async getEncounterDiagnostics(encounterId: string) {
    const { user } = useAuthStore.getState();
    return this.request(`/diagnostic/encounter/${encounterId}`, {
      headers: {
        'managingorg': user?.organization,
        'practid': user?.email || '',
      },
    });
  }

  async getEncounterImages(encounterId: string) {
    const { user } = useAuthStore.getState();
    return this.request(`/images/encounter/${encounterId}`, {
      headers: {
        'managingorg': user?.organization,
        'practid': user?.email || '',
      },
    });
  }

  async getEncounterAttachments(encounterId: string) {
    const { user } = useAuthStore.getState();
    return this.request(`/attach/getbyencounter/${encounterId}`, {
      headers: {
        'managingorg': user?.organization,
        'practid': user?.email || '',
      },
    });
  }

  async getClinicalRecordAttachments(clinicalId: string) {
    const { user } = useAuthStore.getState();

    const response = await this.request(`/clinical/record/${clinicalId}/attachments`, {
      headers: {
        'managingorg': user?.organization,
        'practid': user?.email || '',
      },
    });

    console.log('[API] getClinicalRecordAttachments response:', JSON.stringify(response, null, 2));

    return response;
  }

  async getEncounterServices(encounterId: string) {
    const { user } = useAuthStore.getState();
    return this.request(`/encounter/getencounterservices/${encounterId}`, {
      headers: {
        'managingorg': user?.organization,
        'practid': user?.email || '',
      },
    });
  }

  async getEncounterFinancials(encounterId: string) {
    const { user } = useAuthStore.getState();
    return this.request(`/encounter/getencounterfinancials/${encounterId}`, {
      headers: {
        'managingorg': user?.organization,
        'practid': user?.email || '',
      },
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

    console.log('[API] getThreadMessages -> request', {
      threadId,
      params,
      query: queryParams.toString(),
    });

    const response = await this.request(`/api/internal-comm/messages/thread/${threadId}?${queryParams}`);

    console.log('[API] getThreadMessages <- response', response);

    return response;
  }

  async getThreadParticipants(threadId: string): Promise<any> {
    console.log('[API] getThreadParticipants -> request', { threadId });
    const response = await this.request(`/api/internal-comm/messages/thread/${threadId}/participants`);
    console.log('[API] getThreadParticipants <- response', response);
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
    const { user } = useAuthStore.getState();
    
    const formData = new FormData();
    formData.append('file', {
      uri: filePath,
      type: fileType,
      name: fileName,
    } as any);

    const headers = {
      'Content-Type': 'multipart/form-data',
      'patient': patientCpf,
      'pract': practitionerId,
      'encid': encounterId,
      'entity': 'encounter',
      'organization': user?.organization,
    };

    console.log('[API] uploadAttachment called with:', {
      filePath,
      fileName,
      fileType,
      encounterId,
      patientCpf,
      practitionerId,
    });

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          console.log(`[API] Attachment upload progress: ${percentComplete.toFixed(1)}%`);
        }
      });
      
      xhr.addEventListener('load', () => {
        console.log('[API] Attachment upload response status:', xhr.status);
        console.log('[API] Attachment upload response text:', xhr.responseText);
        
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            console.error('[API] Error parsing attachment response:', error);
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Attachment upload failed with status: ${xhr.status}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        console.error('[API] Attachment upload network error');
        reject(new Error('Network error during attachment upload'));
      });
      
      xhr.addEventListener('abort', () => {
        console.log('[API] Attachment upload was aborted');
        reject(new Error('Attachment upload was aborted'));
      });
      
      xhr.open('POST', `${API_BASE_URL}/attach/upload`);
      
      // Add auth headers
      const token = useAuthStore.getState().token;
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

  // Upload image
  async uploadImage(
    imagePath: string,
    fileName: string,
    encounterId: string,
    patientCpf: string,
    practitionerId: string
  ): Promise<{ message: string; imageId: string }> {
    const { user } = useAuthStore.getState();
    
    const formData = new FormData();
    formData.append('image', {
      uri: imagePath,
      type: 'image/jpeg',
      name: fileName,
    } as any);

    const headers = {
      'Content-Type': 'multipart/form-data',
      'patient': patientCpf,
      'pract': practitionerId,
      'encid': encounterId,
      'entity': 'encounter',
      'organization': user?.organization,
    };

    console.log('[API] uploadImage called with:', {
      imagePath,
      fileName,
      encounterId,
      patientCpf,
      practitionerId,
    });

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          console.log(`[API] Image upload progress: ${percentComplete.toFixed(1)}%`);
        }
      });
      
      xhr.addEventListener('load', () => {
        console.log('[API] Image upload response status:', xhr.status);
        console.log('[API] Image upload response text:', xhr.responseText);
        
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            console.error('[API] Error parsing image response:', error);
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Image upload failed with status: ${xhr.status}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        console.error('[API] Image upload network error');
        reject(new Error('Network error during image upload'));
      });
      
      xhr.addEventListener('abort', () => {
        console.log('[API] Image upload was aborted');
        reject(new Error('Image upload was aborted'));
      });
      
      xhr.open('POST', `${API_BASE_URL}/images/upload`);
      
      // Add auth headers
      const token = useAuthStore.getState().token;
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

  // Upload audio recording
  async uploadAudioRecording(
    audioPath: string,
    encounterId: string,
    patientCpf: string,
    practitionerId: string,
    sequence: number = 1
  ): Promise<{ message: string; audioId: string }> {
    const { user } = useAuthStore.getState();
    
    const formData = new FormData();
    formData.append('audio', {
      uri: audioPath,
      type: 'audio/mp4',
      name: `recording_${Date.now()}.mp4`,
    } as any);

    const headers = {
      'Content-Type': 'multipart/form-data',
      'patient': patientCpf,
      'pract': practitionerId,
      'encid': encounterId,
      'sequence': sequence.toString(),
      'subentitytype': 'none',
      'entity': 'encounter',
      'organization': user?.organization,
    };

    console.log('[API] uploadAudioRecording called with:', {
      audioPath,
      encounterId,
      patientCpf,
      practitionerId,
      sequence,
    });

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          console.log(`[API] Upload progress: ${percentComplete.toFixed(1)}%`);
        }
      });
      
      xhr.addEventListener('load', () => {
        console.log('[API] Upload response status:', xhr.status);
        console.log('[API] Upload response text:', xhr.responseText);
        
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            console.error('[API] Error parsing response:', error);
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Upload failed with status: ${xhr.status}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        console.error('[API] Upload network error');
        reject(new Error('Network error during upload'));
      });
      
      xhr.addEventListener('abort', () => {
        console.log('[API] Upload was aborted');
        reject(new Error('Upload was aborted'));
      });
      
      xhr.open('POST', `${API_BASE_URL}/audio/uploadAudio`);
      
      // Add auth headers
      const token = useAuthStore.getState().token;
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

  // Get offerings (services/procedures) for appointment creation
  async getOfferings(offeringType: string = 'SERVICE', isActive: boolean = true) {
    const { user } = useAuthStore.getState();
    const params = new URLSearchParams({
      offering_type: offeringType,
      is_active: isActive.toString(),
    });

    console.log('[API] getOfferings called with:', { offeringType, isActive });
    
    try {
      const result = await this.request(`/offerings?${params}`, {
        headers: {
          'managingorg': user?.organization,
          'practid': user?.email || '',
        }
      });
      console.log('[API] getOfferings success:', result);
      // The offerings endpoint returns the array directly, unlike other endpoints
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('[API] getOfferings error:', error);
      throw error;
    }
  }

  // Get patient care plans for appointment creation
  async getPatientCarePlans(patientCpf: string, practitionerId: string) {
    const { user } = useAuthStore.getState();

    console.log('[API] getPatientCarePlans called with:', { patientCpf, practitionerId });
    
    try {
      const result = await this.request(`/careplan/patient/${encodeURIComponent(patientCpf)}/careplans?practitionerId=${encodeURIComponent(practitionerId)}`, {
        headers: {
          'managingorg': user?.organization,
          'practid': user?.email || '',
        }
      });
      console.log('[API] getPatientCarePlans success:', result);
      return result;
    } catch (error) {
      console.error('[API] getPatientCarePlans error:', error);
      throw error;
    }
  }

  // Get practitioner locations for appointment creation
  async getPractitionerLocations(practitionerEmail: string) {
    const { user } = useAuthStore.getState();

    console.log('[API] getPractitionerLocations called with:', { practitionerEmail });
    
    try {
      const result = await this.request(`/location/getpractlocationsbyemail/${encodeURIComponent(practitionerEmail)}/?status=active`, {
        headers: {
          'managingorg': user?.organization,
          'practid': user?.email || '',
        }
      });
      console.log('[API] getPractitionerLocations success:', result);
      return result;
    } catch (error) {
      console.error('[API] getPractitionerLocations error:', error);
      throw error;
    }
  }

  async getLocationById(locationId: string, practitionerEmail?: string) {
    const { user } = useAuthStore.getState();

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

    console.log('[API] getLocationById called with:', { locationId, practitionerEmail });

    try {
      const result = await this.request(url, {
        headers: {
          'managingorg': user?.organization,
          'practid': user?.email || '',
        },
      });
      console.log('[API] getLocationById success:', result);
      return result;
    } catch (error) {
      console.error('[API] getLocationById error:', error);
      throw error;
    }
  }

  // Get available dates for appointment scheduling
  async getAvailableDates(practitionerId: string, locationId: string, year: number, month: number, duration: number = 60) {
    const { user } = useAuthStore.getState();
    const params = new URLSearchParams({
      practitionerId,
      locationId,
      year: year.toString(),
      month: month.toString(),
      duration: duration.toString(),
    });

    console.log('[API] getAvailableDates called with:', { practitionerId, locationId, year, month, duration });
    
    try {
      const result = await this.request(`/appointment/available-dates?${params}`, {
        headers: {
          'managingorg': user?.organization,
          'practid': user?.email || '',
        }
      });
      console.log('[API] getAvailableDates success:', result);
      return result;
    } catch (error) {
      console.error('[API] getAvailableDates error:', error);
      throw error;
    }
  }

  // Get available times for a specific date
  async getAvailableTimes(practitionerId: string, locationId: string, date: string, duration: number = 60) {
    const { user } = useAuthStore.getState();
    const params = new URLSearchParams({
      practitionerId,
      locationId,
      date,
      duration: duration.toString(),
    });

    console.log('[API] getAvailableTimes called with:', { practitionerId, locationId, date, duration });
    
    try {
      const result = await this.request(`/appointment/available-times?${params}`, {
        headers: {
          'managingorg': user?.organization,
          'practid': user?.email || '',
        }
      });
      console.log('[API] getAvailableTimes success:', result);
      return result;
    } catch (error) {
      console.error('[API] getAvailableTimes error:', error);
      throw error;
    }
  }

  // Get next five available slots
  async getNextFiveSlots(practitionerId: string, locationId: string, duration: number = 60) {
    const { user } = useAuthStore.getState();
    const params = new URLSearchParams({
      practitionerId,
      locationId,
      duration: duration.toString(),
    });

    console.log('[API] getNextFiveSlots called with:', { practitionerId, locationId, duration });
    
    try {
      const result = await this.request(`/appointment/next-five-slots?${params}`, {
        headers: {
          'managingorg': user?.organization,
          'practid': user?.email || '',
        }
      });
      console.log('[API] getNextFiveSlots success:', result);
      return result;
    } catch (error) {
      console.error('[API] getNextFiveSlots error:', error);
      throw error;
    }
  }

  // Get practitioner appointments to check for conflicts
  async getPractitionerAppointments(practId: string, options: { page?: number; limit?: number; future?: string } = {}) {
    const { user } = useAuthStore.getState();
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 100).toString(), // Get more appointments to check conflicts
      ...(options.future && { future: options.future })
    });

    console.log('[API] getPractitionerAppointments called with:', { practId, options });
    
    try {
      const result = await this.request(`/appointment/getappointments/${practId}?${params}`, {
        headers: {
          'managingorg': user?.organization,
          'practid': user?.email || '',
        }
      });
      console.log('[API] getPractitionerAppointments success:', result);
      return result;
    } catch (error) {
      console.error('[API] getPractitionerAppointments error:', error);
      throw error;
    }
  }

  // Create appointment
  async createAppointment(appointmentData: any) {
    const { user } = useAuthStore.getState();
    console.log('[API] createAppointment called with:', appointmentData);
    console.log('[API] User context:', { email: user?.email, org: user?.organization });
    console.log('[API] Request headers will be:', {
      'managingorg': user?.organization,
      'practid': user?.email || '',
    });
    
    try {
      console.log('[API] About to make POST request to /appointment/create-appointment');
      const result = await this.request('/appointment/create-appointment', {
        method: 'POST',
        headers: {
          'managingorg': user?.organization,
          'practid': user?.email || '',
        },
        body: appointmentData
      });
      console.log('[API] createAppointment success:', result);
      return result;
    } catch (error) {
      console.error('[API] createAppointment error:', error);
      console.error('[API] Error details:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Step 6 API methods
  async getServiceCategories() {
    try {
      console.log('[API] getServiceCategories called');
      const result = await this.request('/pract/getservicecategory');
      console.log('[API] getServiceCategories success:', result);
      return result;
    } catch (error) {
      console.error('[API] getServiceCategories error:', error);
      throw error;
    }
  }

  async getPractServiceCategories(practId: string) {
    try {
      console.log('[API] getPractServiceCategories called with practId:', practId);
      const result = await this.request(`/pract/getpractservicecategories/${practId}`);
      console.log('[API] getPractServiceCategories success:', result);
      return result;
    } catch (error) {
      console.error('[API] getPractServiceCategories error:', error);
      throw error;
    }
  }

  async getServiceTypes() {
    try {
      console.log('[API] getServiceTypes called');
      const result = await this.request('/pract/getservicetypes');
      console.log('[API] getServiceTypes success:', result);
      return result;
    } catch (error) {
      console.error('[API] getServiceTypes error:', error);
      throw error;
    }
  }

  async getServiceDescriptions(categoryId?: string | null, typeId?: string | null) {
    const { user } = useAuthStore.getState();

    if (!categoryId && !typeId) {
      console.log('[API] getServiceDescriptions skipped (no ids provided)');
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

    console.log('[API] getServiceDescriptions called with:', { categoryId, typeId });

    try {
      const result = await this.request(url, {
        headers: {
          'managingorg': user?.organization,
          'practid': user?.email || '',
        },
      });
      console.log('[API] getServiceDescriptions success:', result);
      return result;
    } catch (error) {
      console.error('[API] getServiceDescriptions error:', error);
      throw error;
    }
  }

  async getPractServiceTypes(practId: string) {
    try {
      console.log('[API] getPractServiceTypes called with practId:', practId);
      const result = await this.request(`/pract/getpractservicetypes/${practId}`);
      console.log('[API] getPractServiceTypes success:', result);
      return result;
    } catch (error) {
      console.error('[API] getPractServiceTypes error:', error);
      throw error;
    }
  }

  async getAppointmentTypes(practId: string) {
    try {
      console.log('[API] getAppointmentTypes called with practId:', practId);
      const result = await this.request(`/pract/config/${practId}`);
      console.log('[API] getAppointmentTypes success:', result);
      return result;
    } catch (error) {
      console.error('[API] getAppointmentTypes error:', error);
      throw error;
    }
  }

  // === PRACTITIONER PROFILE ===
  async getMyPractitionerProfile(email: string) {
    if (!email) {
      throw new Error('Email is required to fetch practitioner profile.');
    }

    try {
      console.log('[API] getMyPractitionerProfile request email:', email);
      const result = await this.request<PractitionerProfile>(
        `/pract/getmydata?email=${encodeURIComponent(email)}`
      );
      console.log('[API] getMyPractitionerProfile response:', result);
      return result;
    } catch (error) {
      console.error('[API] getMyPractitionerProfile error:', error);
      throw error;
    }
  }

  async saveMyPractitionerProfile(updatedFields: Record<string, unknown>) {
    if (!updatedFields || typeof updatedFields !== 'object') {
      throw new Error('Invalid profile payload.');
    }

    try {
      console.log('[API] saveMyPractitionerProfile payload:', updatedFields);
      return await this.request('/pract/savemydata', {
        method: 'POST',
        body: { updatedFields },
      });
    } catch (error) {
      console.error('[API] saveMyPractitionerProfile error:', error);
      throw error;
    }
  }

  async saveMyPractitionerPhoto(email: string, dataURL: string) {
    if (!email || !dataURL) {
      throw new Error('Email and photo data are required.');
    }

    try {
      console.log('[API] saveMyPractitionerPhoto email:', email, 'payloadLength:', dataURL.length);
      return await this.request('/pract/savemyphoto', {
        method: 'POST',
        body: { email, dataURL },
      });
    } catch (error) {
      console.error('[API] saveMyPractitionerPhoto error:', error);
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
}

export const api = new ApiService();
export const apiService = api;
export default api;
