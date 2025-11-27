import { useAuthStore } from '../store/authStore';
import { API_BASE_URL } from '@config/environment';
import {
  AssistantMessage,
  AssistantResponse,
  AskPractitionerRequest,
  AskPractitionerResponse,
  PatientDetailsResponse,
  DocumentAnalysisRequest,
  DocumentAnalysisResponse,
  ActionButton,
  Patient,
  Encounter,
  ApiError,
  ACTION_TYPES,
  ACTION_STYLES,
  Session,
  SessionMessage,
  SessionListResponse,
  MessagesResponse,
  PostMessageResponse,
} from '../types/assistant';
import { logger } from '@/utils/logger';

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

class AssistantApiService {
  private getAuthHeaders(): Record<string, string> {
    const { token } = useAuthStore.getState();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private normalizeHeaders(headers?: HeadersInit): Record<string, string> {
    if (!headers) {
      return {};
    }

    if (headers instanceof Headers) {
      const normalized: Record<string, string> = {};
      headers.forEach((value, key) => {
        normalized[key] = value;
      });
      return normalized;
    }

    if (Array.isArray(headers)) {
      return headers.reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
    }

    return { ...headers };
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const { method = 'GET', body, headers } = options;

    const normalizedHeaders = this.normalizeHeaders(headers);
    const requestHeaders: Record<string, string> = {
      ...this.getAuthHeaders(),
      ...normalizedHeaders,
    };

    const authorizationHeader = requestHeaders['Authorization'];

    const serializedBody =
      body instanceof FormData || typeof body === 'string'
        ? (body as BodyInit)
        : body != null
          ? JSON.stringify(body)
          : undefined;

    logger.debug('[AssistantAPI] Request:', {
      method,
      url,
      headers: {
        ...requestHeaders,
        Authorization: authorizationHeader ? '[REDACTED]' : undefined,
      },
    });

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: serializedBody,
      });

      logger.debug('[AssistantAPI] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[AssistantAPI] Error response:', errorText);

        const error: ApiError = {
          status: response.status,
          message: `HTTP ${response.status}: ${response.statusText}`,
          details: errorText,
        };

        throw error;
      }

      // Handle 204 No Content and other empty responses
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return undefined as T;
      }

      // Try to parse JSON, but handle empty responses gracefully
      const text = await response.text();
      if (!text || text.trim() === '') {
        return undefined as T;
      }

      try {
        return JSON.parse(text);
      } catch {
        // If it's not valid JSON but we got a successful response, return the text
        return text as T;
      }
    } catch (error) {
      logger.error('[AssistantAPI] Request failed:', error);
      throw error;
    }
  }

  /**
   * Main assistant endpoint - identical to web frontend
   * POST /ai/askpract/${practId}
   */
  async askPractitionerAssistant(
    messages: AssistantMessage[],
    practitionerId: string
  ): Promise<AssistantResponse> {
    // Prepare request body (same format as web)
    const requestBody: AskPractitionerRequest = {
      question: messages[messages.length - 1]?.content || '',
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    };

    const response = await this.request<AskPractitionerResponse>(
      `/ai/askpract/${practitionerId}`,
      {
        method: 'POST',
        body: requestBody,
      }
    );

    // Parse response and create action buttons
    const actions = this.parseActions(response.context);

    return {
      text: response.result.text,
      context: response.context,
      actions,
      shouldUpdateContext: !!(response.context?.patientId || response.context?.encounterId),
    };
  }

  /**
   * Get patient details for context
   * GET /patient/getpatientdetails/${patientId}
   */
  async getPatientDetails(patientId: string): Promise<Patient> {
    const response = await this.request<PatientDetailsResponse>(
      `/patient/getpatientdetails/${patientId}`
    );

    // Debug log to see actual response structure
    
    // Handle response structure: { success: true, data: patient }
    const patientData = (response as any).data || response;

    return {
      id: patientData.id || patientData.cpf || patientId,
      name: patientData.name || patientData.fullName || patientData.patientName || patientData.nome || patientData.firstName || 'Paciente',
      cpf: patientData.cpf,
      email: patientData.email,
      phone: patientData.phone || patientData.telefone || patientData.cellphone,
    };
  }

  /**
   * Analyze document attachment
   * POST /ai/analyze-attachment
   */
  async analyzeAttachment(
    attachment: FormData,
    context?: { patientId?: string; encounterId?: string }
  ): Promise<DocumentAnalysisResponse> {
    const headers = {
      ...(context?.patientId && { 'patient-id': context.patientId }),
      ...(context?.encounterId && { 'encounter-id': context.encounterId }),
    };

    // Remove Content-Type header for FormData
    const { token } = useAuthStore.getState();
    const requestHeaders = {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    };

    const response = await fetch(`${API_BASE_URL}/ai/analyze-attachment`, {
      method: 'POST',
      headers: requestHeaders,
      body: attachment,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Document analysis failed: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Transcribe audio to text
   * POST /ai/transcribe
   */
  async transcribeAudio(
    audioUri: string,
    context?: { patientId?: string; encounterId?: string }
  ): Promise<{ text: string; confidence: number; duration: number }> {
    logger.debug('[AssistantAPI] Transcribing audio:', audioUri);

    const formData = new FormData();
    formData.append('audio', {
      uri: audioUri,
      type: 'audio/mp4',
      name: `audio_${Date.now()}.mp4`,
    } as any);

    // Add language and context
    formData.append('language', 'pt-BR');
    if (context?.patientId) {
      formData.append('patientId', context.patientId);
    }
    if (context?.encounterId) {
      formData.append('encounterId', context.encounterId);
    }

    const { token } = useAuthStore.getState();
    const requestHeaders = {
      ...(token && { Authorization: `Bearer ${token}` }),
      // Don't set Content-Type for FormData
    };

    try {
      const response = await fetch(`${API_BASE_URL}/ai/transcribe`, {
        method: 'POST',
        headers: requestHeaders,
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Audio transcription failed: ${errorText}`);
      }

      const result = await response.json();
      logger.debug('[AssistantAPI] Transcription result:', result);

      return {
        text: result.text || '',
        confidence: result.confidence || 0,
        duration: result.duration || 0,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[AssistantAPI] Transcription error:', errorMessage);

      // Re-throw the error instead of using fallback
      throw new Error(`Audio transcription failed: ${errorMessage}`);
    }
  }

  // ============================================================================
  // V2 SESSION-BASED API METHODS
  // Matching web app's assistant-api.js implementation
  // ============================================================================

  /**
   * Get base URL for v2 API endpoints
   */
  private getV2BaseUrl(practitionerId: string): string {
    if (!practitionerId) {
      throw new Error('Practitioner identifier is required for Assistant API calls.');
    }
    return `${API_BASE_URL}/ai/v2/practitioners/${encodeURIComponent(practitionerId)}`;
  }

  /**
   * Normalize sessions response from API
   * Handles different response formats: { sessions: [] }, { data: [] }, or []
   */
  private normalizeSessionsResponse(payload: any): Session[] {
    if (!payload) return [];
    if (Array.isArray(payload.sessions)) return payload.sessions;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload)) return payload;
    return [];
  }

  /**
   * Normalize messages response from API
   * Handles different response formats
   */
  private normalizeMessagesResponse(payload: any): MessagesResponse {
    if (!payload) return { messages: [], pagination: null };
    if (Array.isArray(payload.messages)) {
      return { messages: payload.messages, pagination: payload.pagination || null };
    }
    if (Array.isArray(payload)) {
      return { messages: payload, pagination: null };
    }
    return { messages: [], pagination: null };
  }

  /**
   * List all assistant sessions for a practitioner
   * GET /ai/v2/practitioners/{id}/sessions
   */
  async listSessions(
    practitionerId: string,
    options: { page?: number; pageSize?: number } = {}
  ): Promise<SessionListResponse> {
    const { page = 1, pageSize = 20 } = options;
    const baseUrl = this.getV2BaseUrl(practitionerId);

    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    logger.debug('[AssistantAPI] Listing sessions:', { practitionerId, page, pageSize });

    const response = await this.request<any>(`${baseUrl}/sessions?${query.toString()}`.replace(API_BASE_URL, ''));

    return {
      sessions: this.normalizeSessionsResponse(response),
      pagination: response?.pagination || null,
    };
  }

  /**
   * Create a new assistant session
   * POST /ai/v2/practitioners/{id}/sessions
   */
  async createSession(
    practitionerId: string,
    metadata: { source?: string; title?: string } = {}
  ): Promise<Session> {
    const baseUrl = this.getV2BaseUrl(practitionerId);

    const payload = {
      metadata: { source: 'app', ...metadata },
      title: metadata.title || 'Nova conversa',
    };

    logger.debug('[AssistantAPI] Creating session:', { practitionerId, payload });

    const response = await this.request<any>(`${baseUrl}/sessions`.replace(API_BASE_URL, ''), {
      method: 'POST',
      body: payload,
    });

    logger.debug('[AssistantAPI] Create session response:', JSON.stringify(response));

    // Handle various response formats
    const session = response?.data || response?.session || response;
    if (!session || !session.id) {
      logger.error('[AssistantAPI] Invalid session response:', response);
      throw new Error('Invalid session response from server');
    }

    return session;
  }

  /**
   * Get a specific session by ID
   * GET /ai/v2/practitioners/{id}/sessions/{sessionId}
   */
  async getSession(practitionerId: string, sessionId: string): Promise<Session> {
    const baseUrl = this.getV2BaseUrl(practitionerId);
    const safeSessionId = encodeURIComponent(sessionId);

    logger.debug('[AssistantAPI] Getting session:', { practitionerId, sessionId });

    const response = await this.request<any>(`${baseUrl}/sessions/${safeSessionId}`.replace(API_BASE_URL, ''));

    return response.data || response;
  }

  /**
   * Get messages for a session with pagination support
   * GET /ai/v2/practitioners/{id}/sessions/{sessionId}/messages
   */
  async getSessionMessages(
    practitionerId: string,
    sessionId: string,
    options: { limit?: number; before?: string; after?: string } = {}
  ): Promise<MessagesResponse> {
    const { limit = 30, before, after } = options;
    const baseUrl = this.getV2BaseUrl(practitionerId);
    const safeSessionId = encodeURIComponent(sessionId);

    const query = new URLSearchParams({ limit: String(limit) });
    if (before) query.set('before', before);
    if (after) query.set('after', after);

    logger.debug('[AssistantAPI] Getting session messages:', { practitionerId, sessionId, limit, before, after });

    const response = await this.request<any>(
      `${baseUrl}/sessions/${safeSessionId}/messages?${query.toString()}`.replace(API_BASE_URL, '')
    );

    return this.normalizeMessagesResponse(response);
  }

  /**
   * Post a new message to a session
   * POST /ai/v2/practitioners/{id}/sessions/{sessionId}/messages
   */
  async postSessionMessage(
    practitionerId: string,
    sessionId: string,
    content: string
  ): Promise<PostMessageResponse> {
    const baseUrl = this.getV2BaseUrl(practitionerId);
    const safeSessionId = encodeURIComponent(sessionId);

    const payload = {
      content,
      clientMessageId: `app-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      channel: 'app' as const,
    };

    logger.debug('[AssistantAPI] Posting message:', { practitionerId, sessionId, contentLength: content.length });

    const response = await this.request<any>(
      `${baseUrl}/sessions/${safeSessionId}/messages`.replace(API_BASE_URL, ''),
      {
        method: 'POST',
        body: payload,
      }
    );

    return response.data || response;
  }

  /**
   * Delete a session
   * DELETE /ai/v2/practitioners/{id}/sessions/{sessionId}
   */
  async deleteSession(practitionerId: string, sessionId: string): Promise<void> {
    const baseUrl = this.getV2BaseUrl(practitionerId);
    const safeSessionId = encodeURIComponent(sessionId);

    logger.debug('[AssistantAPI] Deleting session:', { practitionerId, sessionId });

    await this.request<void>(
      `${baseUrl}/sessions/${safeSessionId}`.replace(API_BASE_URL, ''),
      { method: 'DELETE' }
    );
  }

  /**
   * Rename a session (update title)
   * PATCH /ai/v2/practitioners/{id}/sessions/{sessionId}
   */
  async renameSession(
    practitionerId: string,
    sessionId: string,
    title: string
  ): Promise<Session> {
    const baseUrl = this.getV2BaseUrl(practitionerId);
    const safeSessionId = encodeURIComponent(sessionId);

    logger.debug('[AssistantAPI] Renaming session:', { practitionerId, sessionId, title });

    const response = await this.request<any>(
      `${baseUrl}/sessions/${safeSessionId}`.replace(API_BASE_URL, ''),
      {
        method: 'PATCH',
        body: { title },
      }
    );

    return response.data || response;
  }

  /**
   * Parse API response context and create action buttons
   * Matches web frontend behavior exactly
   */
  private parseActions(context: any): ActionButton[] {
    const actions: ActionButton[] = [];

    if (context?.prescription?.justcreated) {
      actions.push({
        type: ACTION_TYPES.PRESCRIPTION_SIGN,
        text: 'Assinar Prescrição',
        icon: '✍️',
        style: ACTION_STYLES.PRIMARY,
        onPress: () => {
          // Will be implemented by the store
          logger.debug('Prescription sign action triggered');
        },
      });

      actions.push({
        type: ACTION_TYPES.PRESCRIPTION_SEND,
        text: 'Enviar para Paciente',
        icon: '📤',
        style: ACTION_STYLES.SECONDARY,
        onPress: () => {
          // Will be implemented by the store
          logger.debug('Prescription send action triggered');
        },
      });
    }

    if (context?.patientId) {
      actions.push({
        type: ACTION_TYPES.NAVIGATE_PATIENT,
        text: 'Ver Paciente',
        icon: '👤',
        style: ACTION_STYLES.OUTLINE,
        onPress: () => {
          // Will be implemented by the store
          logger.debug('Navigate to patient action triggered');
        },
      });
    }

    if (context?.encounterId) {
      actions.push({
        type: ACTION_TYPES.NAVIGATE_ENCOUNTER,
        text: 'Ver Encontro',
        icon: '📋',
        style: ACTION_STYLES.OUTLINE,
        onPress: () => {
          // Will be implemented by the store
          logger.debug('Navigate to encounter action triggered');
        },
      });
    }

    return actions;
  }

  /**
   * Helper method to format messages for API
   */
  formatMessagesForApi(messages: AssistantMessage[]): AskPractitionerRequest['messages'] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Helper method to validate API response
   */
  validateResponse(response: any): boolean {
    return !!(
      response &&
      response.result &&
      typeof response.result.text === 'string'
    );
  }

  /**
   * Helper method to handle API errors
   */
  handleApiError(error: any): string {
    if (error.status) {
      switch (error.status) {
        case 401:
          return 'Sessão expirada. Faça login novamente.';
        case 403:
          return 'Acesso negado. Verifique suas permissões.';
        case 404:
          return 'Serviço não encontrado.';
        case 429:
          return 'Muitas perguntas. Aguarde um momento.';
        case 500:
          return 'Erro interno do servidor.';
        default:
          return `Erro ${error.status}: ${error.message}`;
      }
    }

    if (error.message) {
      return error.message;
    }

    return 'Erro desconhecido. Tente novamente.';
  }

  /**
   * Test connectivity to assistant API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.ok;
    } catch (error) {
      logger.error('[AssistantAPI] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get contextual placeholder text for input
   */
  getContextualPlaceholder(patient?: Patient, encounter?: Encounter): string {
    if (patient && encounter) {
      return `Pergunte sobre ${patient.name} ou o encontro ${encounter.id}...`;
    }
    
    if (patient) {
      return `Pergunte sobre ${patient.name}...`;
    }
    
    if (encounter) {
      return `Pergunte sobre o encontro ${encounter.id}...`;
    }
    
    return 'Digite sua pergunta...';
  }

  /**
   * Generate suggested questions based on context
   */
  getSuggestedQuestions(patient?: Patient, encounter?: Encounter): string[] {
    const suggestions: string[] = [];

    if (patient) {
      suggestions.push(
        `Como está o paciente ${patient.name}?`,
        `Qual o histórico médico de ${patient.name}?`,
        `Há alguma alergia registrada para ${patient.name}?`
      );
    }

    if (encounter) {
      suggestions.push(
        `Resuma o encontro ${encounter.id}`,
        `Quais foram os sintomas relatados?`,
        `Precisa de algum exame complementar?`
      );
    }

    if (!patient && !encounter) {
      suggestions.push(
        'Como posso ajudá-lo hoje?',
        'Precisa de uma prescrição?',
        'Quer buscar um paciente?',
        'Precisa de orientações médicas?'
      );
    }

    return suggestions;
  }
}

// Export singleton instance
export const assistantApi = new AssistantApiService();
export default assistantApi;
