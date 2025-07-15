import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from './authStore';
import { assistantApi } from '../services/assistantApi';
import {
  AssistantState,
  AssistantActions,
  AssistantMessage,
  Patient,
  Encounter,
  ContextInfo,
  ConversationSession,
  ActionButton,
  MESSAGE_TYPES,
  ACTION_TYPES,
  CONTEXT_SOURCES,
} from '../types/assistant';

// Helper function to generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper function to format time
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

interface AssistantStore extends AssistantState, AssistantActions {}

export const useAssistantStore = create<AssistantStore>()(
  persist(
    (set, get) => ({
      // Initial state
      messages: [],
      isLoading: false,
      isTyping: false,
      currentPatient: undefined,
      currentEncounter: undefined,
      contextHistory: [],
      showContextCard: false,
      inputHeight: 40,
      keyboardVisible: false,
      isTranscribing: false,
      lastAudioUri: undefined,
      conversationSessions: [],
      lastSessionId: undefined,
      lastError: undefined,
      retryCount: 0,

      // Message actions
      addMessage: (message: Omit<AssistantMessage, 'id'>) => {
        const newMessage: AssistantMessage = {
          ...message,
          id: generateId(),
          timestamp: message.timestamp || new Date(),
        };

        set(state => ({
          messages: [...state.messages, newMessage],
          lastError: undefined,
        }));

        // Auto-scroll will be handled by the component
      },

      updateLastMessage: (update: Partial<AssistantMessage>) => {
        set(state => ({
          messages: state.messages.map((msg, index) => 
            index === state.messages.length - 1 
              ? { ...msg, ...update }
              : msg
          ),
        }));
      },

      removeMessage: (messageId: string) => {
        set(state => ({
          messages: state.messages.filter(msg => msg.id !== messageId),
        }));
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      // Conversation actions
      sendMessage: async (content: string) => {
        const { messages, currentPatient, addMessage, setLoading, setTyping, setError } = get();
        
        if (!content.trim()) return;

        // Add user message
        const userMessage: AssistantMessage = {
          id: generateId(),
          role: 'user',
          content: content.trim(),
          timestamp: new Date(),
          type: MESSAGE_TYPES.TEXT,
        };

        addMessage(userMessage);
        setLoading(true);
        setTyping(true);

        try {
          // Get practitioner ID from auth store
          const { user } = useAuthStore.getState();
          const practitionerId = user?.email || '';

          if (!practitionerId) {
            throw new Error('Usuário não autenticado');
          }

          // Call assistant API
          const response = await assistantApi.askPractitionerAssistant(
            [...messages, userMessage],
            practitionerId
          );

          // Create assistant message
          const assistantMessage: AssistantMessage = {
            id: generateId(),
            role: 'assistant',
            content: response.text,
            timestamp: new Date(),
            type: MESSAGE_TYPES.TEXT,
            metadata: {
              actions: response.actions,
              context: response.context,
            },
          };

          addMessage(assistantMessage);

          // Update context if provided
          if (response.shouldUpdateContext && response.context) {
            get().updateContextFromResponse(response.context);
          }

          // Reset retry count on success
          set({ retryCount: 0 });

        } catch (error) {
          console.error('[AssistantStore] Error sending message:', error);
          
          const errorMessage = assistantApi.handleApiError(error);
          setError(errorMessage);

          // Add error message to conversation
          const errorMsg: AssistantMessage = {
            id: generateId(),
            role: 'assistant',
            content: `Desculpe, não foi possível obter uma resposta: ${errorMessage}`,
            timestamp: new Date(),
            type: MESSAGE_TYPES.ERROR,
          };

          addMessage(errorMsg);

          // Increment retry count
          set(state => ({ retryCount: state.retryCount + 1 }));

        } finally {
          setLoading(false);
          setTyping(false);
        }
      },

      resetConversation: () => {
        set({
          messages: [],
          currentPatient: undefined,
          currentEncounter: undefined,
          showContextCard: false,
          lastError: undefined,
          retryCount: 0,
        });
      },

      loadConversation: (sessionId: string) => {
        const { conversationSessions } = get();
        const session = conversationSessions.find(s => s.id === sessionId);
        
        if (session) {
          set({
            messages: session.messages,
            currentPatient: session.context?.patient,
            currentEncounter: session.context?.encounter,
            lastSessionId: sessionId,
            showContextCard: !!(session.context?.patient || session.context?.encounter),
          });
        }
      },

      saveConversation: () => {
        const { messages, currentPatient, currentEncounter, conversationSessions } = get();
        
        if (messages.length === 0) return;

        const sessionId = generateId();
        const session: ConversationSession = {
          id: sessionId,
          messages,
          context: {
            patient: currentPatient,
            encounter: currentEncounter,
            timestamp: new Date(),
            source: CONTEXT_SOURCES.USER,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          title: messages[0]?.content.substring(0, 50) + '...',
        };

        set({
          conversationSessions: [...conversationSessions, session],
          lastSessionId: sessionId,
        });
      },

      // Context actions
      setPatientContext: (patient: Patient) => {
        const contextInfo: ContextInfo = {
          patient,
          timestamp: new Date(),
          source: CONTEXT_SOURCES.NAVIGATION,
        };

        set(state => ({
          currentPatient: patient,
          contextHistory: [...state.contextHistory, contextInfo],
          showContextCard: true,
        }));
      },

      setEncounterContext: (encounter: Encounter) => {
        const contextInfo: ContextInfo = {
          encounter,
          timestamp: new Date(),
          source: CONTEXT_SOURCES.NAVIGATION,
        };

        set(state => ({
          currentEncounter: encounter,
          contextHistory: [...state.contextHistory, contextInfo],
          showContextCard: true,
        }));
      },

      clearContext: () => {
        set({
          currentPatient: undefined,
          currentEncounter: undefined,
          showContextCard: false,
        });
      },

      updateContextFromResponse: async (context: any) => {
        const { currentPatient, currentEncounter } = get();
        let updated = false;

        // Update patient context if provided
        if (context.patientId && (!currentPatient || currentPatient.id !== context.patientId)) {
          try {
            const patient = await assistantApi.getPatientDetails(context.patientId);
            get().setPatientContext(patient);
            updated = true;
          } catch (error) {
            console.error('[AssistantStore] Error fetching patient details:', error);
          }
        }

        // Update encounter context if provided
        if (context.encounterId && (!currentEncounter || currentEncounter.id !== context.encounterId)) {
          const encounter: Encounter = {
            id: context.encounterId,
            patientId: context.patientId || '',
            date: new Date().toISOString(),
            status: 'OPEN',
          };
          
          get().setEncounterContext(encounter);
          updated = true;
        }

        // Show context card if updated
        if (updated) {
          set({ showContextCard: true });
        }
      },

      // UI actions
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setTyping: (typing: boolean) => {
        set({ isTyping: typing });
      },

      toggleContextCard: () => {
        set(state => ({ showContextCard: !state.showContextCard }));
      },

      setKeyboardVisible: (visible: boolean) => {
        set({ keyboardVisible: visible });
      },

      setTranscribing: (transcribing: boolean) => {
        set({ isTranscribing: transcribing });
      },

      // Special actions
      handlePrescriptionSign: async (pdfBase64: string) => {
        set({ isLoading: true });
        
        try {
          // TODO: Implement prescription signing
          // This would integrate with the digital signature service
          console.log('[AssistantStore] Prescription signing not yet implemented');
          
          // For now, just show success message
          const successMessage: AssistantMessage = {
            id: generateId(),
            role: 'assistant',
            content: 'Funcionalidade de assinatura digital será implementada em breve.',
            timestamp: new Date(),
            type: MESSAGE_TYPES.TEXT,
          };

          get().addMessage(successMessage);
          
        } catch (error) {
          console.error('[AssistantStore] Error signing prescription:', error);
          get().setError('Erro ao assinar prescrição');
        } finally {
          set({ isLoading: false });
        }
      },

      handlePrescriptionSend: async (prescriptionId: string) => {
        set({ isLoading: true });
        
        try {
          // TODO: Implement prescription sending
          console.log('[AssistantStore] Prescription sending not yet implemented');
          
          const successMessage: AssistantMessage = {
            id: generateId(),
            role: 'assistant',
            content: 'Funcionalidade de envio de prescrição será implementada em breve.',
            timestamp: new Date(),
            type: MESSAGE_TYPES.TEXT,
          };

          get().addMessage(successMessage);
          
        } catch (error) {
          console.error('[AssistantStore] Error sending prescription:', error);
          get().setError('Erro ao enviar prescrição');
        } finally {
          set({ isLoading: false });
        }
      },

      handleDocumentAnalysis: async (attachment: FormData) => {
        set({ isLoading: true });
        
        try {
          const { currentPatient, currentEncounter } = get();
          
          const response = await assistantApi.analyzeAttachment(attachment, {
            patientId: currentPatient?.id,
            encounterId: currentEncounter?.id,
          });

          const analysisMessage: AssistantMessage = {
            id: generateId(),
            role: 'assistant',
            content: response.text,
            timestamp: new Date(),
            type: MESSAGE_TYPES.TEXT,
            metadata: {
              context: response.analysis,
            },
          };

          get().addMessage(analysisMessage);
          
        } catch (error) {
          console.error('[AssistantStore] Error analyzing document:', error);
          get().setError('Erro ao analisar documento');
        } finally {
          set({ isLoading: false });
        }
      },

      navigateToPatient: (patientId: string) => {
        // TODO: Implement navigation to patient screen
        console.log('[AssistantStore] Navigate to patient:', patientId);
        // This will be implemented when we integrate with the navigation system
      },

      navigateToEncounter: (encounterId: string) => {
        // TODO: Implement navigation to encounter screen
        console.log('[AssistantStore] Navigate to encounter:', encounterId);
        // This will be implemented when we integrate with the navigation system
      },

      // Audio actions
      transcribeAudio: async (audioUri: string) => {
        const { currentPatient, currentEncounter, setTranscribing, setError } = get();
        
        try {
          setTranscribing(true);
          set({ lastAudioUri: audioUri });

          const result = await assistantApi.transcribeAudio(audioUri, {
            patientId: currentPatient?.id,
            encounterId: currentEncounter?.id,
          });

          setTranscribing(false);
          return result.text;
        } catch (error) {
          console.error('[AssistantStore] Error transcribing audio:', error);
          setTranscribing(false);
          setError('Erro ao transcrever áudio');
          throw error;
        }
      },

      sendAudioMessage: async (audioUri: string, transcription?: string) => {
        const { addMessage, setLoading, setTyping, setError } = get();
        
        try {
          // If no transcription provided, transcribe first
          let finalTranscription = transcription;
          if (!finalTranscription) {
            finalTranscription = await get().transcribeAudio(audioUri);
          }

          // Add single audio message to conversation
          const audioMessage: AssistantMessage = {
            id: generateId(),
            role: 'user',
            content: finalTranscription,
            timestamp: new Date(),
            type: MESSAGE_TYPES.AUDIO,
            metadata: {
              audio: {
                uri: audioUri,
                duration: 0, // TODO: Calculate actual duration
                transcription: finalTranscription,
                confidence: 0.8,
              },
            },
          };

          addMessage(audioMessage);
          setLoading(true);
          setTyping(true);

          // Send transcribed text to assistant (without creating another user message)
          const { messages } = get();
          const { user } = useAuthStore.getState();
          const practitionerId = user?.email || '';

          if (!practitionerId) {
            throw new Error('Usuário não autenticado');
          }

          // Call assistant API with the audio message included
          const response = await assistantApi.askPractitionerAssistant(
            messages, // This already includes the audio message we just added
            practitionerId
          );

          // Create assistant response message
          const assistantMessage: AssistantMessage = {
            id: generateId(),
            role: 'assistant',
            content: response.text,
            timestamp: new Date(),
            type: MESSAGE_TYPES.TEXT,
            metadata: {
              actions: response.actions,
              context: response.context,
            },
          };

          addMessage(assistantMessage);

          // Update context if provided
          if (response.shouldUpdateContext && response.context) {
            get().updateContextFromResponse(response.context);
          }

        } catch (error) {
          console.error('[AssistantStore] Error sending audio message:', error);
          
          const errorMessage = assistantApi.handleApiError(error);
          setError(errorMessage);

          // Add error message to conversation
          const errorMsg: AssistantMessage = {
            id: generateId(),
            role: 'assistant',
            content: `Desculpe, não foi possível obter uma resposta: ${errorMessage}`,
            timestamp: new Date(),
            type: MESSAGE_TYPES.ERROR,
          };

          addMessage(errorMsg);
        } finally {
          setLoading(false);
          setTyping(false);
        }
      },

      // Error handling
      setError: (error: string) => {
        set({ lastError: error });
      },

      clearError: () => {
        set({ lastError: undefined });
      },

      retry: async () => {
        const { messages, retryCount } = get();
        
        if (retryCount >= 3) {
          get().setError('Muitas tentativas. Tente novamente mais tarde.');
          return;
        }

        // Find the last user message and retry
        const lastUserMessage = messages
          .slice()
          .reverse()
          .find(msg => msg.role === 'user');

        if (lastUserMessage) {
          await get().sendMessage(lastUserMessage.content);
        }
      },
    }),
    {
      name: 'assistant-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist certain parts of the state
      partialize: (state) => ({
        conversationSessions: state.conversationSessions,
        lastSessionId: state.lastSessionId,
        contextHistory: state.contextHistory.slice(-10), // Keep last 10 context changes
      }),
    }
  )
);

// Helper hooks for common operations
export const useAssistantMessages = () => useAssistantStore(state => state.messages);
export const useAssistantLoading = () => useAssistantStore(state => state.isLoading);
export const useAssistantContext = () => useAssistantStore(state => ({
  patient: state.currentPatient,
  encounter: state.currentEncounter,
  showCard: state.showContextCard,
}));
export const useAssistantActions = () => useAssistantStore(state => ({
  sendMessage: state.sendMessage,
  resetConversation: state.resetConversation,
  setPatientContext: state.setPatientContext,
  setEncounterContext: state.setEncounterContext,
  clearContext: state.clearContext,
  transcribeAudio: state.transcribeAudio,
  sendAudioMessage: state.sendAudioMessage,
}));

export default useAssistantStore;