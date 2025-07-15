import { useAuthStore } from '../store/authStore';
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
  ApiError,
  ACTION_TYPES,
  ACTION_STYLES,
} from '../types/assistant';

const API_BASE_URL = 'http://192.168.2.30:3333';

class AssistantApiService {
  private getAuthHeaders(): Record<string, string> {
    const { token } = useAuthStore.getState();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const { method = 'GET', body, headers = {} } = options;

    const requestHeaders = {
      ...this.getAuthHeaders(),
      ...headers,
    };

    console.log('[AssistantAPI] Request:', {
      method,
      url,
      headers: {
        ...requestHeaders,
        Authorization: requestHeaders.Authorization ? '[REDACTED]' : undefined,
      },
    });

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      console.log('[AssistantAPI] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AssistantAPI] Error response:', errorText);
        
        const error: ApiError = {
          status: response.status,
          message: `HTTP ${response.status}: ${response.statusText}`,
          details: errorText,
        };
        
        throw error;
      }

      const data = await response.json();
      console.log('[AssistantAPI] Success response:', data);
      return data;
    } catch (error) {
      console.error('[AssistantAPI] Request failed:', error);
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
    console.log('[AssistantAPI] getPatientDetails raw response:', JSON.stringify(response, null, 2));
    
    // Handle response structure: { success: true, data: patient }
    const patientData = (response as any).data || response;
    console.log('[AssistantAPI] patientData after extraction:', JSON.stringify(patientData, null, 2));

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
    console.log('[AssistantAPI] Transcribing audio:', audioUri);

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
      console.log('[AssistantAPI] Transcription result:', result);

      return {
        text: result.text || '',
        confidence: result.confidence || 0,
        duration: result.duration || 0,
      };
    } catch (error) {
      console.error('[AssistantAPI] Transcription error:', error);
      
      // Re-throw the error instead of using fallback
      throw new Error(`Audio transcription failed: ${error.message}`);
    }
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
          console.log('Prescription sign action triggered');
        },
      });

      actions.push({
        type: ACTION_TYPES.PRESCRIPTION_SEND,
        text: 'Enviar para Paciente',
        icon: '📤',
        style: ACTION_STYLES.SECONDARY,
        onPress: () => {
          // Will be implemented by the store
          console.log('Prescription send action triggered');
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
          console.log('Navigate to patient action triggered');
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
          console.log('Navigate to encounter action triggered');
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
      console.error('[AssistantAPI] Connection test failed:', error);
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