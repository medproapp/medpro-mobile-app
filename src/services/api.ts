import { useAuthStore } from '../store/authStore';
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

const API_BASE_URL = 'http://192.168.2.30:3333';

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

  // Get user info (used by web app after login)
  async getUserInfo(email: string) {
    return this.request(`/login/getUserInfo?email=${encodeURIComponent(email)}`);
  }

  // Get user to organization mapping
  async getUserToOrg(email: string, role?: string) {
    const queryParam = role ? `?role=${role}` : '';
    return this.request(`/login/getusertoorg/${email}${queryParam}`);
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
          'managingorg': user?.organization || 'ORG-000006',
          'practid': practId,
        }
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

    return this.request(`/api/internal-comm/messages/thread/${threadId}?${queryParams}`);
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
      'organization': user?.organization || 'ORG-000006',
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
      'organization': user?.organization || 'ORG-000006',
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
      'organization': user?.organization || 'ORG-000006',
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
}

export const api = new ApiService();
export const apiService = api;
export default api;