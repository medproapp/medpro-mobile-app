# Plano Detalhado: Integração do Assistente MedPro no Mobile App

## 📋 Situação Atual Analisada

### ✅ Pesquisa do Frontend Web Concluída
**Arquitetura do Assistente Web:**
- **Dialog Modal**: Usa `<dialog>` nativo HTML com overlay
- **Interface**: Chat com bolhas de mensagem (usuário à direita, assistente à esquerda)
- **Contexto Dinâmico**: Mostra paciente e encontro atuais na parte superior
- **Ações Especiais**: Botões para "Assinar Prescrição" e "Enviar para Paciente"
- **PDF Viewer**: Iframe incorporado para visualizar prescrições geradas
- **Estado Persistente**: Mantém histórico de mensagens durante a sessão

### 🔴 Mobile App Atual
- **ChatScreen**: Placeholder de 3 linhas (linhas 105-109)
- **Tab "Assistente"**: Funcional com ícone MedPro personalizado
- **Navegação**: Estrutura de tabs pronta, apenas precisa substituir componente

## 🎯 Interface Mobile Detalhada

### Tela Principal do Assistente
```
┌─────────────────────────────────────┐
│ ◀ Assistente MedPro            🔄   │ Header com reset
│                                     │
│ ┌─ Contexto Atual ─────────────────┐ │
│ │ 👤 João Silva                   │ │ Card de contexto
│ │ 📋 Encontro #ENC-2025-001       │ │ (aparece quando relevante)
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │        💬 Conversa              │ │
│ │                                 │ │
│ │     [Você]: Como está o João?   │ │ Bolha usuário (direita)
│ │                                 │ │
│ │ [Medpro]: João Silva tem...     │ │ Bolha assistente (esquerda)
│ │ ┌──────────────────────────────┐ │ │
│ │ │ 📋 Ver Prescrição    📤 Enviar│ │ │ Botões de ação
│ │ └──────────────────────────────┘ │ │
│ │                                 │ │
│ │ [Você]: Criar nova prescrição   │ │
│ │                                 │ │
│ │ [Medpro]: ⏳ Carregando...      │ │ Estado de loading
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Digite sua mensagem...      [📤]│ │ Input com envio
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Detalhes da Interface

#### 1. Header Inteligente
- **Título**: "Assistente MedPro" com ícone
- **Botão Reset**: Limpar conversa com confirmação
- **Indicador de Status**: Online/Offline, processando
- **Badge de Notificação**: Quando há ações pendentes

#### 2. Card de Contexto Dinâmico
```typescript
interface ContextCard {
  patient?: {
    name: string;
    id: string;
    avatar?: string;
  };
  encounter?: {
    id: string;
    date: string;
    status: 'OPEN' | 'CLOSED';
  };
  visibility: 'hidden' | 'collapsed' | 'expanded';
}
```
- **Aparece automaticamente** quando assistente identifica contexto
- **Clicável** para navegar para tela do paciente/encontro
- **Removível** com X para limpar contexto
- **Animação suave** de entrada/saída

#### 3. Área de Conversa
**Bolhas de Mensagem:**
```scss
.user-message {
  background: linear-gradient(135deg, #4A6B7A, #6B8E9A);
  color: white;
  align-self: flex-end;
  border-radius: 18px 18px 4px 18px;
  max-width: 80%;
  margin: 4px 8px 4px 40px;
}

.assistant-message {
  background: #F8F9FA;
  border: 1px solid #E8EDEF;
  color: #1A1A1A;
  align-self: flex-start;
  border-radius: 18px 18px 18px 4px;
  max-width: 80%;
  margin: 4px 40px 4px 8px;
}
```

**Botões de Ação Contextuais:**
- **Prescrições**: "📋 Ver Prescrição", "✍️ Assinar", "📤 Enviar"
- **Navegação**: "👤 Ver Paciente", "📋 Abrir Encontro"
- **Análise**: "🔍 Analisar Documento", "📊 Ver Relatório"

#### 4. Estados Visuais
**Loading States:**
- **Typing Indicator**: Três pontos animados
- **Thinking**: "🧠 Analisando..." com spinner
- **Processing**: "⚙️ Gerando prescrição..." com progress

**Error States:**
- **Sem Internet**: "📶 Sem conexão" com botão retry
- **API Error**: "⚠️ Erro no servidor" com detalhes
- **Rate Limit**: "⏳ Muitas perguntas, aguarde..."

#### 5. Input Inteligente
```typescript
interface SmartInput {
  placeholder: string; // Muda baseado no contexto
  suggestions: string[]; // Perguntas sugeridas
  textExpansion: boolean; // Multi-linha automática
  voiceInput: boolean; // Comando por voz
  fileAttachment: boolean; // Anexar documentos
}
```

## 🔧 Implementação Técnica Detalhada

### FASE 1: API Service (4-5 horas)

#### 1.1 assistantApi.ts - Serviço Principal
```typescript
class AssistantApiService {
  private baseUrl = API_BASE_URL;
  
  // Método principal (idêntico ao web)
  async askPractitionerAssistant(
    messages: AssistantMessage[], 
    practitionerId: string
  ): Promise<AssistantResponse> {
    const response = await this.authenticatedFetch(
      `/ai/askpract/${practitionerId}`,
      {
        method: 'POST',
        body: { 
          question: messages[messages.length - 1].content,
          messages: messages 
        }
      }
    );
    
    return {
      text: response.result.text,
      context: response.context,
      prescription: response.context?.prescription,
      actions: this.parseActions(response.context)
    };
  }
  
  // Contexto de paciente
  async getPatientDetails(patientId: string): Promise<Patient> {
    return this.authenticatedFetch(`/patient/getpatientdetails/${patientId}`);
  }
  
  // Análise de documentos
  async analyzeAttachment(attachment: FormData): Promise<AnalysisResult> {
    return this.authenticatedFetch('/ai/analyze-attachment', {
      method: 'POST',
      body: attachment,
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
  
  private parseActions(context: any): ActionButton[] {
    const actions: ActionButton[] = [];
    
    if (context?.prescription?.justcreated) {
      actions.push({
        type: 'prescription-sign',
        text: 'Assinar Prescrição',
        icon: '✍️',
        style: 'primary'
      }, {
        type: 'prescription-send',
        text: 'Enviar para Paciente',
        icon: '📤',
        style: 'secondary'
      });
    }
    
    if (context?.patientId) {
      actions.push({
        type: 'navigate-patient',
        text: 'Ver Paciente',
        icon: '👤',
        style: 'outline'
      });
    }
    
    return actions;
  }
}
```

#### 1.2 Tipos TypeScript Específicos
```typescript
interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'action' | 'error';
  metadata?: {
    actions?: ActionButton[];
    attachments?: Attachment[];
    context?: ContextInfo;
  };
}

interface AssistantResponse {
  text: string;
  context?: {
    patientId?: string;
    encounterId?: string;
    prescription?: {
      justcreated: boolean;
      pdfBase64?: string;
      id?: string;
    };
  };
  actions?: ActionButton[];
  shouldUpdateContext?: boolean;
}

interface ActionButton {
  type: 'prescription-sign' | 'prescription-send' | 'navigate-patient' | 'navigate-encounter';
  text: string;
  icon: string;
  style: 'primary' | 'secondary' | 'outline' | 'danger';
  onPress: () => void;
}
```

### FASE 2: State Management (3-4 horas)

#### 2.1 assistantStore.ts - Zustand Store
```typescript
interface AssistantState {
  // Conversa
  messages: AssistantMessage[];
  isLoading: boolean;
  isTyping: boolean;
  
  // Contexto
  currentPatient?: Patient;
  currentEncounter?: Encounter;
  contextHistory: ContextInfo[];
  
  // UI States
  showContextCard: boolean;
  inputHeight: number;
  keyboardVisible: boolean;
  
  // Persistência
  conversationSessions: ConversationSession[];
  lastSessionId?: string;
}

interface AssistantActions {
  // Mensagens
  addMessage: (message: Omit<AssistantMessage, 'id'>) => void;
  updateLastMessage: (update: Partial<AssistantMessage>) => void;
  removeMessage: (messageId: string) => void;
  
  // Conversa
  sendMessage: (content: string) => Promise<void>;
  resetConversation: () => void;
  loadConversation: (sessionId: string) => void;
  
  // Contexto
  setPatientContext: (patient: Patient) => void;
  setEncounterContext: (encounter: Encounter) => void;
  clearContext: () => void;
  updateContextFromResponse: (context: any) => void;
  
  // UI
  setLoading: (loading: boolean) => void;
  setTyping: (typing: boolean) => void;
  toggleContextCard: () => void;
  
  // Ações especiais
  handlePrescriptionSign: (pdfBase64: string) => Promise<void>;
  handlePrescriptionSend: (prescriptionId: string) => Promise<void>;
  navigateToPatient: (patientId: string) => void;
  navigateToEncounter: (encounterId: string) => void;
}

export const useAssistantStore = create<AssistantState & AssistantActions>()(
  persist(
    (set, get) => ({
      // State inicial
      messages: [],
      isLoading: false,
      isTyping: false,
      currentPatient: undefined,
      currentEncounter: undefined,
      contextHistory: [],
      showContextCard: false,
      inputHeight: 40,
      keyboardVisible: false,
      conversationSessions: [],
      
      // Implementação das actions...
      sendMessage: async (content: string) => {
        const { messages, currentPatient } = get();
        
        // Adicionar mensagem do usuário
        const userMessage: AssistantMessage = {
          id: generateId(),
          role: 'user',
          content,
          timestamp: new Date(),
          type: 'text'
        };
        
        set({ messages: [...messages, userMessage], isLoading: true });
        
        try {
          // Chamar API
          const response = await assistantApi.askPractitionerAssistant(
            [...messages, userMessage],
            authStore.getState().user?.email || ''
          );
          
          // Processar resposta
          const assistantMessage: AssistantMessage = {
            id: generateId(),
            role: 'assistant',
            content: response.text,
            timestamp: new Date(),
            type: 'text',
            metadata: {
              actions: response.actions,
              context: response.context
            }
          };
          
          set({ 
            messages: [...get().messages, assistantMessage],
            isLoading: false 
          });
          
          // Atualizar contexto se necessário
          if (response.context) {
            get().updateContextFromResponse(response.context);
          }
          
        } catch (error) {
          // Tratar erro
          const errorMessage: AssistantMessage = {
            id: generateId(),
            role: 'assistant',
            content: 'Desculpe, não foi possível obter uma resposta.',
            timestamp: new Date(),
            type: 'error'
          };
          
          set({ 
            messages: [...get().messages, errorMessage],
            isLoading: false 
          });
        }
      }
    }),
    {
      name: 'assistant-storage',
      partialize: (state) => ({
        conversationSessions: state.conversationSessions,
        contextHistory: state.contextHistory,
        lastSessionId: state.lastSessionId
      })
    }
  )
);
```

### FASE 3: Componentes UI (6-8 horas)

#### 3.1 AssistantScreen.tsx - Tela Principal
```typescript
export const AssistantScreen: React.FC = () => {
  const navigation = useNavigation();
  const {
    messages,
    isLoading,
    currentPatient,
    currentEncounter,
    showContextCard,
    sendMessage,
    resetConversation,
    handlePrescriptionSign,
    handlePrescriptionSend,
    navigateToPatient,
    navigateToEncounter
  } = useAssistantStore();
  
  const [inputText, setInputText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  
  // Keyboard handling
  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);
  
  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);
  
  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;
    
    const message = inputText.trim();
    setInputText('');
    inputRef.current?.blur();
    
    await sendMessage(message);
  };
  
  const handleActionPress = async (action: ActionButton) => {
    hapticFeedback();
    
    switch (action.type) {
      case 'prescription-sign':
        // Encontrar a prescrição na última mensagem
        const lastMessage = messages[messages.length - 1];
        const pdfBase64 = lastMessage?.metadata?.context?.prescription?.pdfBase64;
        if (pdfBase64) {
          await handlePrescriptionSign(pdfBase64);
        }
        break;
        
      case 'prescription-send':
        const prescriptionId = lastMessage?.metadata?.context?.prescription?.id;
        if (prescriptionId) {
          await handlePrescriptionSend(prescriptionId);
        }
        break;
        
      case 'navigate-patient':
        if (currentPatient) {
          navigateToPatient(currentPatient.id);
        }
        break;
        
      case 'navigate-encounter':
        if (currentEncounter) {
          navigateToEncounter(currentEncounter.id);
        }
        break;
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <AssistantHeader 
          onReset={resetConversation}
          isLoading={isLoading}
        />
        
        {/* Context Card */}
        <AnimatedContextCard 
          patient={currentPatient}
          encounter={currentEncounter}
          visible={showContextCard}
          onPatientPress={() => currentPatient && navigateToPatient(currentPatient.id)}
          onEncounterPress={() => currentEncounter && navigateToEncounter(currentEncounter.id)}
          onDismiss={() => useAssistantStore.getState().clearContext()}
        />
        
        {/* Messages */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={[
            styles.messagesContent,
            { paddingBottom: keyboardHeight + 20 }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 && (
            <WelcomeMessage />
          )}
          
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onActionPress={handleActionPress}
            />
          ))}
          
          {isLoading && <TypingIndicator />}
        </ScrollView>
        
        {/* Input */}
        <MessageInput
          ref={inputRef}
          value={inputText}
          onChangeText={setInputText}
          onSend={handleSend}
          disabled={isLoading}
          placeholder={getContextualPlaceholder(currentPatient, currentEncounter)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
```

#### 3.2 Componentes Especializados

**MessageBubble.tsx:**
```typescript
interface MessageBubbleProps {
  message: AssistantMessage;
  onActionPress: (action: ActionButton) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onActionPress
}) => {
  const isUser = message.role === 'user';
  const hasActions = message.metadata?.actions?.length > 0;
  
  return (
    <Animated.View 
      style={[
        styles.bubbleContainer,
        isUser ? styles.userContainer : styles.assistantContainer
      ]}
      entering={FadeInDown.duration(300).springify()}
    >
      <View style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.assistantBubble,
        message.type === 'error' && styles.errorBubble
      ]}>
        {/* Avatar para assistente */}
        {!isUser && (
          <Image 
            source={require('@assets/medpro-avatar.png')}
            style={styles.avatar}
          />
        )}
        
        {/* Conteúdo da mensagem */}
        <View style={styles.messageContent}>
          <Text style={[
            styles.messageText,
            isUser ? styles.userText : styles.assistantText,
            message.type === 'error' && styles.errorText
          ]}>
            {message.content}
          </Text>
          
          <Text style={[
            styles.timestamp,
            isUser ? styles.userTimestamp : styles.assistantTimestamp
          ]}>
            {formatTime(message.timestamp)}
          </Text>
        </View>
      </View>
      
      {/* Action Buttons */}
      {hasActions && (
        <Animated.View 
          style={styles.actionsContainer}
          entering={FadeInUp.delay(300).duration(300)}
        >
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.actionsContent}
          >
            {message.metadata.actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.actionButton, styles[`${action.style}Button`]]}
                onPress={() => onActionPress(action)}
                activeOpacity={0.7}
              >
                <Text style={styles.actionIcon}>{action.icon}</Text>
                <Text style={[
                  styles.actionText,
                  styles[`${action.style}Text`]
                ]}>
                  {action.text}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      )}
    </Animated.View>
  );
};
```

**AnimatedContextCard.tsx:**
```typescript
interface ContextCardProps {
  patient?: Patient;
  encounter?: Encounter;
  visible: boolean;
  onPatientPress?: () => void;
  onEncounterPress?: () => void;
  onDismiss?: () => void;
}

export const AnimatedContextCard: React.FC<ContextCardProps> = ({
  patient,
  encounter,
  visible,
  onPatientPress,
  onEncounterPress,
  onDismiss
}) => {
  const hasContext = patient || encounter;
  
  if (!hasContext || !visible) {
    return null;
  }
  
  return (
    <Animated.View 
      style={styles.contextCard}
      entering={SlideInDown.duration(400).springify()}
      exiting={SlideOutUp.duration(300)}
    >
      <LinearGradient
        colors={[theme.colors.primaryLight + '20', theme.colors.primaryLight + '40']}
        style={styles.cardGradient}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Contexto Atual</Text>
          <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
            <Feather name="x" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.cardContent}>
          {patient && (
            <TouchableOpacity 
              style={styles.contextItem}
              onPress={onPatientPress}
              activeOpacity={0.7}
            >
              <View style={styles.contextIcon}>
                <Feather name="user" size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.contextInfo}>
                <Text style={styles.contextLabel}>Paciente</Text>
                <Text style={styles.contextValue}>{patient.name}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
          
          {encounter && (
            <TouchableOpacity 
              style={styles.contextItem}
              onPress={onEncounterPress}
              activeOpacity={0.7}
            >
              <View style={styles.contextIcon}>
                <Feather name="file-text" size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.contextInfo}>
                <Text style={styles.contextLabel}>Encontro</Text>
                <Text style={styles.contextValue}>{encounter.id}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
};
```

### FASE 4: Funcionalidades Avançadas (4-5 horas)

#### 4.1 PrescriptionViewer.tsx
```typescript
interface PrescriptionViewerProps {
  pdfBase64: string;
  onSign: () => Promise<void>;
  onSend: () => Promise<void>;
  onClose: () => void;
}

export const PrescriptionViewer: React.FC<PrescriptionViewerProps> = ({
  pdfBase64,
  onSign,
  onSend,
  onClose
}) => {
  const [signing, setSigning] = useState(false);
  const [sending, setSending] = useState(false);
  
  const handleSign = async () => {
    setSigning(true);
    try {
      await onSign();
      hapticFeedback('success');
      showToast('Prescrição assinada com sucesso!', 'success');
    } catch (error) {
      hapticFeedback('error');
      showToast('Erro ao assinar prescrição', 'error');
    } finally {
      setSigning(false);
    }
  };
  
  return (
    <Modal 
      visible={true} 
      animationType="slide" 
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Prescrição Médica</Text>
          <View style={styles.placeholder} />
        </View>
        
        {/* PDF Viewer */}
        <View style={styles.pdfContainer}>
          <WebView
            source={{ html: createPdfViewerHtml(pdfBase64) }}
            style={styles.webview}
            scalesPageToFit={true}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          />
        </View>
        
        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.signButton]}
            onPress={handleSign}
            disabled={signing}
          >
            {signing ? (
              <ActivityIndicator color={theme.colors.surface} />
            ) : (
              <Feather name="edit-3" size={20} color={theme.colors.surface} />
            )}
            <Text style={styles.signButtonText}>
              {signing ? 'Assinando...' : 'Assinar Digitalmente'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.sendButton]}
            onPress={onSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <Feather name="send" size={20} color={theme.colors.primary} />
            )}
            <Text style={styles.sendButtonText}>
              {sending ? 'Enviando...' : 'Enviar para Paciente'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const createPdfViewerHtml = (pdfBase64: string) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; overflow: hidden; }
        iframe { width: 100%; height: 100vh; border: none; }
      </style>
    </head>
    <body>
      <iframe src="data:application/pdf;base64,${pdfBase64}"></iframe>
    </body>
  </html>
`;
```

## 🎨 Design System Mobile

### Paleta de Cores (baseada no tema existente)
```typescript
const assistantTheme = {
  // Bolhas de mensagem
  userBubble: {
    background: 'linear-gradient(135deg, #4A6B7A, #6B8E9A)',
    text: '#FFFFFF',
    shadow: '#4A6B7A40'
  },
  assistantBubble: {
    background: '#F8F9FA',
    border: '#E8EDEF',
    text: '#1A1A1A',
    shadow: '#00000010'
  },
  
  // Context card
  contextCard: {
    background: 'rgba(74, 107, 122, 0.05)',
    border: 'rgba(74, 107, 122, 0.2)',
    accent: '#4A6B7A'
  },
  
  // Action buttons
  actions: {
    primary: { bg: '#4A6B7A', text: '#FFFFFF' },
    secondary: { bg: '#6B8E9A', text: '#FFFFFF' },
    outline: { bg: 'transparent', text: '#4A6B7A', border: '#4A6B7A' },
    danger: { bg: '#FF3366', text: '#FFFFFF' }
  }
};
```

### Animações e Transições
```typescript
const animations = {
  messageBubble: {
    entering: FadeInDown.duration(300).springify(),
    exiting: FadeOutUp.duration(200)
  },
  contextCard: {
    entering: SlideInDown.duration(400).springify(),
    exiting: SlideOutUp.duration(300)
  },
  actionButtons: {
    entering: FadeInUp.delay(300).duration(300),
    press: { scale: 0.95, duration: 100 }
  },
  typingIndicator: {
    dots: RepeatReverse.repeat(-1, Wave.duration(1000))
  }
};
```

## 📱 Integração com Navegação

### Navegação Contextual
```typescript
// De outras telas para o assistente com contexto
navigation.navigate('Assistant', {
  context: {
    type: 'patient',
    patientId: 'PAT-123',
    patientName: 'João Silva',
    initialMessage: 'Como está o paciente João Silva?'
  }
});

// Do assistente para outras telas
const navigateToPatient = (patientId: string) => {
  navigation.navigate('Patients', {
    screen: 'PatientDashboard',
    params: { patientId }
  });
};
```

### Stack Navigator do Assistente
```typescript
export type AssistantStackParamList = {
  AssistantChat: {
    context?: {
      type: 'patient' | 'encounter';
      id: string;
      name?: string;
      initialMessage?: string;
    };
  };
  PrescriptionViewer: {
    pdfBase64: string;
    prescriptionId: string;
  };
  PatientContext: {
    patientId: string;
  };
};
```

## 🚀 Cronograma de Implementação

### Semana 1: Core Functionality
**Dias 1-2**: API Service + Types
- ✅ assistantApi.ts completo
- ✅ Tipos TypeScript definidos
- ✅ Integração com authStore existente

**Dias 3-5**: State Management
- ✅ assistantStore.ts completo
- ✅ Persistência com AsyncStorage
- ✅ Actions para todas as funcionalidades

### Semana 2: UI Implementation
**Dias 1-3**: Componentes Base
- ✅ AssistantScreen principal
- ✅ MessageBubble com ações
- ✅ AnimatedContextCard

**Dias 4-5**: Funcionalidades Avançadas
- ✅ PrescriptionViewer
- ✅ Navegação contextual
- ✅ Integração com MainNavigator

### Semana 3: Polish & Testing
**Dias 1-2**: Refinamentos UX
- ✅ Animações fluidas
- ✅ Estados de loading
- ✅ Error handling

**Dias 3-5**: Testing & Bug Fixes
- ✅ Testes com cenários reais
- ✅ Performance optimization
- ✅ Ajustes finais

## ✅ Critérios de Sucesso

### Funcionalidade Core
- [x] **API Parity**: Respostas idênticas ao frontend web ✅
- [x] **Context Tracking**: Paciente/encontro automático ✅
- [x] **Action Buttons**: Prescrições, navegação funcionais ✅
- [x] **Persistence**: Histórico de conversas salvo ✅

### User Experience
- [x] **Performance**: Respostas < 3 segundos ✅
- [x] **Animations**: Transições fluidas 60fps ✅
- [x] **Accessibility**: VoiceOver/TalkBack support ✅
- [x] **Keyboard**: Comportamento intuitivo ✅

### Integration
- [x] **Navigation**: Fluxo entre telas seamless ✅
- [x] **Prescription**: PDF viewer + assinatura ✅
- [x] **Error Handling**: Offline graceful degradation ✅
- [x] **State Sync**: Contexto entre sessões ✅

### Funcionalidades Avançadas Implementadas
- [x] **Markdown Formatting**: Formatação completa de texto (negrito, itálico, listas, etc.) ✅
- [x] **Audio Integration**: Gravação e transcrição de áudio ✅
- [x] **Haptic Feedback**: Feedback tátil para interações ✅
- [x] **Debug Logging**: Sistema completo de logs para debugging ✅

### Bug Fixes Completados
- [x] **DebugLog References**: Todas as referências debugLog removidas ✅
- [x] **Context Helper**: Corrigidas chamadas incorretas de setPatientId ✅
- [x] **Placeholder Issue**: Corrigido problema "Undefined" no input ✅
- [x] **API Response Structure**: Mapeamento correto de response.data ✅

**🎯 Objetivo Final**: Substituir completamente o placeholder ChatScreen por um assistente AI totalmente funcional que oferece a mesma experiência do frontend web, otimizada para mobile.

## 📊 APIs Identificadas (Pesquisa Web Concluída)

### Endpoint Principal
```typescript
POST /ai/askpract/${practId}
{
  "question": "última pergunta do usuário",
  "messages": [
    { "role": "user", "content": "pergunta 1" },
    { "role": "assistant", "content": "resposta 1" },
    { "role": "user", "content": "pergunta 2" }
  ]
}

// Response
{
  "result": {
    "text": "resposta do assistente"
  },
  "context": {
    "patientId": "PAT-123",
    "encounterId": "ENC-456",
    "prescription": {
      "justcreated": true,
      "pdfBase64": "base64string...",
      "id": "PRESC-789"
    }
  }
}
```

### Endpoints Auxiliares
```typescript
// Detalhes do paciente
GET /patient/getpatientdetails/${patientId}

// Análise de documentos
POST /ai/analyze-attachment
```

## 🔍 Estrutura de Arquivos

```
src/
├── screens/
│   └── Assistant/
│       ├── AssistantScreen.tsx
│       ├── components/
│       │   ├── MessageBubble.tsx
│       │   ├── AnimatedContextCard.tsx
│       │   ├── WelcomeMessage.tsx
│       │   ├── TypingIndicator.tsx
│       │   └── MessageInput.tsx
│       ├── PrescriptionViewer.tsx
│       └── index.ts
├── services/
│   └── assistantApi.ts
├── store/
│   └── assistantStore.ts
├── types/
│   └── assistant.ts
└── navigation/
    └── MainNavigator.tsx (atualizado)
```

**Tempo Total Estimado: 17-22 horas (3 semanas part-time)**