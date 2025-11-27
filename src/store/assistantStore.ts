import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useAuthStore } from './authStore';
import { assistantApi } from '../services/assistantApi';
import { secureStorage } from '../utils/secureStorage';
import { logger } from '@/utils/logger';
import { AssistantContext } from '../types/api';
import {
  AssistantState,
  AssistantActions,
  AssistantMessage,
  Patient,
  Encounter,
  ContextInfo,
  Session,
  SessionMessage,
  MESSAGE_TYPES,
  CONTEXT_SOURCES,
} from '../types/assistant';

// Helper function to generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper to get practitioner ID
const getPractitionerId = (): string => {
  const { user } = useAuthStore.getState();
  return user?.email || '';
};

// Helper to convert SessionMessage to AssistantMessage for UI display
const sessionMessageToAssistantMessage = (msg: SessionMessage): AssistantMessage => ({
  id: String(msg.id),
  role: msg.role === 'tool' ? 'assistant' : msg.role,
  content: msg.content.text,
  timestamp: new Date(msg.createdAt),
  type: MESSAGE_TYPES.TEXT,
});

interface AssistantStore extends AssistantState, AssistantActions {}

export const useAssistantStore = create<AssistantStore>()(
  persist(
    (set, get) => ({
      // V2 Session State
      sessions: [],
      activeSessionId: null,
      sessionMessages: {},
      sessionsLoading: false,
      sessionLoading: false,
      messageLoading: false,

      // Legacy local messages (for UI display)
      messages: [],
      isLoading: false,
      isTyping: false,

      // Context
      currentPatient: undefined,
      currentEncounter: undefined,
      contextHistory: [],

      // UI State
      showContextCard: false,
      inputHeight: 40,
      keyboardVisible: false,

      // Audio State
      isTranscribing: false,
      lastAudioUri: undefined,

      // Error handling
      lastError: undefined,
      retryCount: 0,

      // ============================================================================
      // V2 SESSION ACTIONS
      // ============================================================================

      /**
       * Initialize assistant - load sessions on app start
       */
      initializeAssistant: async () => {
        const practitionerId = getPractitionerId();
        if (!practitionerId) {
          logger.warn('[AssistantStore] Cannot initialize - no practitioner ID');
          return;
        }

        try {
          set({ sessionsLoading: true, lastError: undefined });

          // Load sessions from server
          const response = await assistantApi.listSessions(practitionerId, { pageSize: 50 });

          set({
            sessions: response.sessions,
            sessionsLoading: false,
          });

          // If we have an active session ID from persistence, select it
          const { activeSessionId } = get();
          if (activeSessionId) {
            const sessionExists = response.sessions.some(s => s.id === activeSessionId);
            if (sessionExists) {
              await get().selectSession(activeSessionId);
            } else if (response.sessions.length > 0) {
              // Active session no longer exists, select first one
              await get().selectSession(response.sessions[0].id);
            }
          } else if (response.sessions.length > 0) {
            // No active session, select first one
            await get().selectSession(response.sessions[0].id);
          }

          logger.debug('[AssistantStore] Initialized with', response.sessions.length, 'sessions');
        } catch (error) {
          logger.error('[AssistantStore] Error initializing:', error);
          set({
            sessionsLoading: false,
            lastError: assistantApi.handleApiError(error),
          });
        }
      },

      /**
       * Load/refresh sessions list
       */
      loadSessions: async () => {
        const practitionerId = getPractitionerId();
        if (!practitionerId) return;

        try {
          set({ sessionsLoading: true, lastError: undefined });

          const response = await assistantApi.listSessions(practitionerId, { pageSize: 50 });

          set({
            sessions: response.sessions,
            sessionsLoading: false,
          });

          logger.debug('[AssistantStore] Loaded', response.sessions.length, 'sessions');
        } catch (error) {
          logger.error('[AssistantStore] Error loading sessions:', error);
          set({
            sessionsLoading: false,
            lastError: assistantApi.handleApiError(error),
          });
        }
      },

      /**
       * Select a session and load its messages
       */
      selectSession: async (sessionId: string) => {
        const practitionerId = getPractitionerId();
        if (!practitionerId) return;

        try {
          set({
            sessionLoading: true,
            activeSessionId: sessionId,
            lastError: undefined,
          });

          // Check if we already have messages cached
          const { sessionMessages } = get();
          let messages = sessionMessages[sessionId];

          if (!messages) {
            // Load messages from server
            const response = await assistantApi.getSessionMessages(practitionerId, sessionId, { limit: 50 });
            messages = response.messages;

            // Cache the messages
            set(state => ({
              sessionMessages: {
                ...state.sessionMessages,
                [sessionId]: messages,
              },
            }));
          }

          // Convert to UI messages
          const uiMessages = messages.map(sessionMessageToAssistantMessage);

          set({
            messages: uiMessages,
            sessionLoading: false,
          });

          logger.debug('[AssistantStore] Selected session', sessionId, 'with', messages.length, 'messages');
        } catch (error) {
          logger.error('[AssistantStore] Error selecting session:', error);
          set({
            sessionLoading: false,
            lastError: assistantApi.handleApiError(error),
          });
        }
      },

      /**
       * Create a new conversation session
       */
      createNewSession: async () => {
        const practitionerId = getPractitionerId();
        if (!practitionerId) {
          get().setError('Usuário não autenticado');
          return null;
        }

        try {
          set({ sessionLoading: true, lastError: undefined });

          const session = await assistantApi.createSession(practitionerId, {
            title: 'Nova conversa',
          });

          // Add to sessions list at the beginning
          set(state => ({
            sessions: [session, ...state.sessions],
            activeSessionId: session.id,
            sessionMessages: {
              ...state.sessionMessages,
              [session.id]: [],
            },
            messages: [],
            sessionLoading: false,
          }));

          logger.debug('[AssistantStore] Created new session:', session.id);
          return session;
        } catch (error) {
          logger.error('[AssistantStore] Error creating session:', error);
          set({
            sessionLoading: false,
            lastError: assistantApi.handleApiError(error),
          });
          return null;
        }
      },

      /**
       * Delete a session
       */
      deleteSession: async (sessionId: string) => {
        const practitionerId = getPractitionerId();
        if (!practitionerId) return;

        try {
          set({ sessionLoading: true, lastError: undefined });

          await assistantApi.deleteSession(practitionerId, sessionId);

          // Remove from local state
          set(state => {
            const newSessions = state.sessions.filter(s => s.id !== sessionId);
            const newSessionMessages = { ...state.sessionMessages };
            delete newSessionMessages[sessionId];

            // If we deleted the active session, select another one
            let newActiveSessionId = state.activeSessionId;
            let newMessages = state.messages;

            if (state.activeSessionId === sessionId) {
              newActiveSessionId = newSessions.length > 0 ? newSessions[0].id : null;
              newMessages = newActiveSessionId && newSessionMessages[newActiveSessionId]
                ? newSessionMessages[newActiveSessionId].map(sessionMessageToAssistantMessage)
                : [];
            }

            return {
              sessions: newSessions,
              sessionMessages: newSessionMessages,
              activeSessionId: newActiveSessionId,
              messages: newMessages,
              sessionLoading: false,
            };
          });

          // If we switched to a new session, load its messages
          const { activeSessionId } = get();
          if (activeSessionId && activeSessionId !== sessionId) {
            await get().selectSession(activeSessionId);
          }

          logger.debug('[AssistantStore] Deleted session:', sessionId);
        } catch (error) {
          logger.error('[AssistantStore] Error deleting session:', error);
          set({
            sessionLoading: false,
            lastError: assistantApi.handleApiError(error),
          });
        }
      },

      /**
       * Rename a session
       */
      renameSession: async (sessionId: string, title: string) => {
        const practitionerId = getPractitionerId();
        if (!practitionerId) return;

        try {
          const updatedSession = await assistantApi.renameSession(practitionerId, sessionId, title);

          // Update in local state
          set(state => ({
            sessions: state.sessions.map(s =>
              s.id === sessionId ? { ...s, title: updatedSession.title || title } : s
            ),
          }));

          logger.debug('[AssistantStore] Renamed session:', sessionId, 'to', title);
        } catch (error) {
          logger.error('[AssistantStore] Error renaming session:', error);
          set({ lastError: assistantApi.handleApiError(error) });
        }
      },

      /**
       * Send a message using v2 API
       */
      sendMessage: async (content: string) => {
        const { activeSessionId, sessions, addMessage, setLoading, setTyping, setError } = get();
        const practitionerId = getPractitionerId();

        if (!content.trim()) return;

        if (!practitionerId) {
          setError('Usuário não autenticado');
          return;
        }

        // If no active session, create one first
        let sessionId = activeSessionId;
        if (!sessionId) {
          const newSession = await get().createNewSession();
          if (!newSession) return;
          sessionId = newSession.id;
        }

        // Add optimistic user message to UI
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
          // Send message via v2 API
          const response = await assistantApi.postSessionMessage(
            practitionerId,
            sessionId,
            content.trim()
          );

          // Update cached session messages
          const newUserMsg: SessionMessage = response.userMessage || {
            id: generateId(),
            role: 'user',
            content: { text: content.trim() },
            createdAt: new Date().toISOString(),
            channel: 'app',
          };

          const newAssistantMsg: SessionMessage = response.assistantMessage || {
            id: generateId(),
            role: 'assistant',
            content: { text: 'Desculpe, não consegui processar sua mensagem.' },
            createdAt: new Date().toISOString(),
            channel: 'app',
          };

          set(state => ({
            sessionMessages: {
              ...state.sessionMessages,
              [sessionId!]: [
                ...(state.sessionMessages[sessionId!] || []),
                newUserMsg,
                newAssistantMsg,
              ],
            },
          }));

          // Add assistant response to UI
          const assistantMessage: AssistantMessage = {
            id: String(newAssistantMsg.id),
            role: 'assistant',
            content: newAssistantMsg.content.text,
            timestamp: new Date(newAssistantMsg.createdAt),
            type: MESSAGE_TYPES.TEXT,
          };

          addMessage(assistantMessage);

          // Auto-rename session if it's "Nova conversa" and this is the first message
          const session = sessions.find(s => s.id === sessionId);
          if (session?.title === 'Nova conversa') {
            const newTitle = content.trim().substring(0, 50);
            get().renameSession(sessionId, newTitle);
          }

          // Update context if provided
          if (response.context) {
            get().updateContextFromResponse(response.context);
          }

          // Reset retry count on success
          set({ retryCount: 0 });

        } catch (error) {
          logger.error('[AssistantStore] Error sending message:', error);

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
          set(state => ({ retryCount: state.retryCount + 1 }));

        } finally {
          setLoading(false);
          setTyping(false);
        }
      },

      /**
       * Load more messages (pagination)
       */
      loadMoreMessages: async () => {
        const { activeSessionId, sessionMessages } = get();
        const practitionerId = getPractitionerId();

        if (!practitionerId || !activeSessionId) return;

        const currentMessages = sessionMessages[activeSessionId] || [];
        if (currentMessages.length === 0) return;

        // Get the oldest message ID for cursor pagination
        const oldestMessage = currentMessages[0];
        const before = String(oldestMessage.id);

        try {
          set({ messageLoading: true });

          const response = await assistantApi.getSessionMessages(
            practitionerId,
            activeSessionId,
            { limit: 30, before }
          );

          if (response.messages.length > 0) {
            // Prepend older messages
            set(state => ({
              sessionMessages: {
                ...state.sessionMessages,
                [activeSessionId]: [...response.messages, ...(state.sessionMessages[activeSessionId] || [])],
              },
              // Also update UI messages
              messages: [
                ...response.messages.map(sessionMessageToAssistantMessage),
                ...state.messages,
              ],
            }));
          }

          set({ messageLoading: false });
        } catch (error) {
          logger.error('[AssistantStore] Error loading more messages:', error);
          set({
            messageLoading: false,
            lastError: assistantApi.handleApiError(error),
          });
        }
      },

      // ============================================================================
      // LEGACY MESSAGE ACTIONS (for UI compatibility)
      // ============================================================================

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

      // ============================================================================
      // CONTEXT ACTIONS
      // ============================================================================

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

      updateContextFromResponse: async (context: Partial<AssistantContext>) => {
        const { currentPatient, currentEncounter } = get();
        let updated = false;

        if (context.patientId && (!currentPatient || currentPatient.id !== context.patientId)) {
          try {
            const patient = await assistantApi.getPatientDetails(context.patientId);
            get().setPatientContext(patient);
            updated = true;
          } catch (error) {
            logger.error('[AssistantStore] Error fetching patient details:', error);
          }
        }

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

        if (updated) {
          set({ showContextCard: true });
        }
      },

      // ============================================================================
      // UI ACTIONS
      // ============================================================================

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

      // ============================================================================
      // SPECIAL ACTIONS
      // ============================================================================

      handlePrescriptionSign: async (pdfBase64: string) => {
        set({ isLoading: true });

        try {
          logger.debug('[AssistantStore] Prescription signing not yet implemented');

          const successMessage: AssistantMessage = {
            id: generateId(),
            role: 'assistant',
            content: 'Funcionalidade de assinatura digital será implementada em breve.',
            timestamp: new Date(),
            type: MESSAGE_TYPES.TEXT,
          };

          get().addMessage(successMessage);
        } catch (error) {
          logger.error('[AssistantStore] Error signing prescription:', error);
          get().setError('Erro ao assinar prescrição');
        } finally {
          set({ isLoading: false });
        }
      },

      handlePrescriptionSend: async (prescriptionId: string) => {
        set({ isLoading: true });

        try {
          logger.debug('[AssistantStore] Prescription sending not yet implemented');

          const successMessage: AssistantMessage = {
            id: generateId(),
            role: 'assistant',
            content: 'Funcionalidade de envio de prescrição será implementada em breve.',
            timestamp: new Date(),
            type: MESSAGE_TYPES.TEXT,
          };

          get().addMessage(successMessage);
        } catch (error) {
          logger.error('[AssistantStore] Error sending prescription:', error);
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
          };

          get().addMessage(analysisMessage);
        } catch (error) {
          logger.error('[AssistantStore] Error analyzing document:', error);
          get().setError('Erro ao analisar documento');
        } finally {
          set({ isLoading: false });
        }
      },

      navigateToPatient: (patientId: string) => {
        logger.debug('[AssistantStore] Navigate to patient:', patientId);
      },

      navigateToEncounter: (encounterId: string) => {
        logger.debug('[AssistantStore] Navigate to encounter:', encounterId);
      },

      // ============================================================================
      // AUDIO ACTIONS
      // ============================================================================

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
          logger.error('[AssistantStore] Error transcribing audio:', error);
          setTranscribing(false);
          setError('Erro ao transcrever áudio');
          throw error;
        }
      },

      sendAudioMessage: async (audioUri: string, transcription?: string) => {
        const { sendMessage, setError } = get();

        try {
          let finalTranscription = transcription;
          if (!finalTranscription) {
            finalTranscription = await get().transcribeAudio(audioUri);
          }

          // Send the transcription as a regular message
          await sendMessage(finalTranscription);
        } catch (error) {
          logger.error('[AssistantStore] Error sending audio message:', error);
          setError(assistantApi.handleApiError(error));
        }
      },

      // ============================================================================
      // ERROR HANDLING
      // ============================================================================

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
      storage: createJSONStorage(() => secureStorage),
      // Only persist the active session ID
      partialize: (state) => ({
        activeSessionId: state.activeSessionId,
        contextHistory: state.contextHistory.slice(-10),
      }),
    }
  )
);

// Helper hooks for common operations
export const useAssistantMessages = () => useAssistantStore(state => state.messages);
export const useAssistantLoading = () => useAssistantStore(state => state.isLoading);
export const useAssistantSessions = () => useAssistantStore(state => state.sessions);
export const useAssistantActiveSession = () => useAssistantStore(state => {
  const session = state.sessions.find(s => s.id === state.activeSessionId);
  return session || null;
});
export const useAssistantContext = () => useAssistantStore(state => ({
  patient: state.currentPatient,
  encounter: state.currentEncounter,
  showCard: state.showContextCard,
}));
export const useAssistantActions = () => useAssistantStore(state => ({
  initializeAssistant: state.initializeAssistant,
  loadSessions: state.loadSessions,
  selectSession: state.selectSession,
  createNewSession: state.createNewSession,
  deleteSession: state.deleteSession,
  renameSession: state.renameSession,
  sendMessage: state.sendMessage,
  resetConversation: state.resetConversation,
  setPatientContext: state.setPatientContext,
  setEncounterContext: state.setEncounterContext,
  clearContext: state.clearContext,
  transcribeAudio: state.transcribeAudio,
  sendAudioMessage: state.sendAudioMessage,
}));

export default useAssistantStore;
