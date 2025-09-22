import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { theme } from '../../theme';
import { useAssistantStore } from '../../store/assistantStore';
import { AssistantMessage, ActionButton } from '../../types/assistant';
import { AssistantAudioRecorder } from './components/AssistantAudioRecorder';

// Markdown styles function
const getMarkdownStyles = (isError: boolean = false) => ({
  body: {
    margin: 0,
    padding: 0,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    color: isError ? theme.colors.error : theme.colors.text,
    margin: 0,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 6,
    fontSize: 16,
    lineHeight: 22,
    color: isError ? theme.colors.error : theme.colors.text,
  },
  strong: {
    fontWeight: '700' as const,
    color: isError ? theme.colors.error : theme.colors.text,
  },
  em: {
    fontStyle: 'italic',
    color: isError ? theme.colors.error : theme.colors.text,
  },
  list_item: {
    marginBottom: 2,
    fontSize: 16,
    lineHeight: 22,
    color: isError ? theme.colors.error : theme.colors.text,
  },
  bullet_list: {
    marginVertical: 4,
    paddingLeft: 20,
  },
  ordered_list: {
    marginVertical: 4,
    paddingLeft: 20,
  },
  bullet_list_icon: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: isError ? theme.colors.error : theme.colors.text,
    marginTop: 8,
    marginRight: 8,
  },
  code_inline: {
    backgroundColor: theme.colors.background,
    color: theme.colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  code_block: {
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    padding: 8,
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  blockquote: {
    backgroundColor: theme.colors.background,
    borderLeftWidth: 3,
    borderLeftColor: isError ? theme.colors.error : theme.colors.primary,
    paddingLeft: 12,
    paddingVertical: 4,
    marginVertical: 4,
  },
  heading1: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: isError ? theme.colors.error : theme.colors.text,
    marginBottom: 8,
    marginTop: 8,
  },
  heading2: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: isError ? theme.colors.error : theme.colors.text,
    marginBottom: 6,
    marginTop: 6,
  },
  heading3: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: isError ? theme.colors.error : theme.colors.text,
    marginBottom: 4,
    marginTop: 4,
  },
});

export const AssistantScreen: React.FC = () => {
  const {
    messages,
    isLoading,
    isTyping,
    isTranscribing,
    currentPatient,
    currentEncounter,
    showContextCard,
    sendMessage,
    sendAudioMessage,
    transcribeAudio,
    resetConversation,
    handlePrescriptionSign,
    handlePrescriptionSend,
    navigateToPatient,
    navigateToEncounter,
    clearContext,
    setKeyboardVisible,
  } = useAssistantStore();

  const insets = useSafeAreaInsets();

  const [inputText, setInputText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Keyboard handling
  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setKeyboardVisible(true);
    });
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setKeyboardVisible(false);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, [setKeyboardVisible]);

  // Auto-scroll to bottom when messages change
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

  const handleReset = () => {
    Alert.alert(
      'Resetar Conversa',
      'Tem certeza que deseja limpar toda a conversa?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resetar',
          style: 'destructive',
          onPress: resetConversation,
        },
      ]
    );
  };

  const handleActionPress = async (action: ActionButton) => {
    switch (action.type) {
      case 'prescription-sign':
        // Find the prescription in the last message
        const lastMessage = messages[messages.length - 1];
        const pdfBase64 = (lastMessage?.metadata?.context as any)?.prescription?.pdfBase64;
        if (pdfBase64) {
          await handlePrescriptionSign(pdfBase64);
        }
        break;

      case 'prescription-send':
        const prescriptionId = (messages[messages.length - 1]?.metadata?.context as any)?.prescription?.id;
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

      default:
        console.log('Unknown action type:', action.type);
    }
  };

  const handleAudioRecorded = (audioUri: string) => {
    console.log('[AssistantScreen] Audio recorded:', audioUri);
    // Audio URI is stored for later use
  };

  const handleTranscriptionComplete = async (text: string) => {
    console.log('[AssistantScreen] Transcription completed:', text);
    // Set the transcribed text in the input
    setInputText(text);
  };

  const handleAudioMessage = async (audioUri: string) => {
    try {
      // Send audio message directly (will transcribe internally)
      await sendAudioMessage(audioUri);
      setInputText(''); // Clear input after sending
    } catch (error) {
      console.error('[AssistantScreen] Error sending audio message:', error);
    }
  };

  const renderMessage = (message: AssistantMessage) => {
    const isUser = message.role === 'user';
    const isError = message.type === 'error';
    const isAudio = message.type === 'audio';

    return (
      <View key={message.id} style={styles.messageContainer}>
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
            isError && styles.errorBubble,
            isAudio && styles.audioBubble,
          ]}
        >
          {/* Audio indicator */}
          {isAudio && (
            <View style={styles.audioIndicator}>
              <Feather name="mic" size={16} color={isUser ? theme.colors.surface : theme.colors.primary} />
              <Text style={[
                styles.audioLabel,
                isUser ? styles.userAudioLabel : styles.assistantAudioLabel,
              ]}>
                Áudio
              </Text>
            </View>
          )}
          
          {isUser ? (
            <Text
              style={[
                styles.messageText,
                styles.userMessageText,
                isError && styles.errorMessageText,
              ]}
            >
              {message.content}
            </Text>
          ) : (
            <Markdown
              style={getMarkdownStyles(isError)}
            >
              {message.content}
            </Markdown>
          )}
          <Text
            style={[
              styles.messageTime,
              isUser ? styles.userMessageTime : styles.assistantMessageTime,
            ]}
          >
            {message.timestamp.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {/* Action Buttons */}
        {message.metadata?.actions && message.metadata.actions.length > 0 && (
          <View style={styles.actionsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.actionsContent}
            >
              {message.metadata.actions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.actionButton,
                    styles[`${action.style}Button`],
                  ]}
                  onPress={() => handleActionPress(action)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionIcon}>{action.icon}</Text>
                  <Text
                    style={[
                      styles.actionText,
                      styles[`${action.style}Text`],
                    ]}
                  >
                    {action.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!isTyping) return null;

    return (
      <View style={styles.typingContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={styles.typingText}>Assistente está pensando...</Text>
      </View>
    );
  };

  const renderContextCard = () => {
    if (!showContextCard || (!currentPatient && !currentEncounter)) {
      return null;
    }

    return (
      <View style={styles.contextCard}>
        <View style={styles.contextCardHeader}>
          <Text style={styles.contextCardTitle}>Contexto Atual</Text>
          <TouchableOpacity onPress={clearContext} style={styles.contextCloseButton}>
            <Feather name="x" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.contextCardContent}>
          {currentPatient && (
            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => navigateToPatient(currentPatient.id)}
              activeOpacity={0.7}
            >
              <View style={styles.contextIcon}>
                <Feather name="user" size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.contextInfo}>
                <Text style={styles.contextLabel}>Paciente</Text>
                <Text style={styles.contextValue}>{currentPatient.name}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}

          {currentEncounter && (
            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => navigateToEncounter(currentEncounter.id)}
              activeOpacity={0.7}
            >
              <View style={styles.contextIcon}>
                <Feather name="file-text" size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.contextInfo}>
                <Text style={styles.contextLabel}>Encontro</Text>
                <Text style={styles.contextValue}>{currentEncounter.id}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderWelcomeMessage = () => {
    if (messages.length > 0) return null;

    return (
      <View style={styles.welcomeContainer}>
        <Feather name="message-circle" size={48} color={theme.colors.primary} />
        <Text style={styles.welcomeTitle}>Olá! Sou o Assistente MedPro</Text>
        <Text style={styles.welcomeText}>
          Estou aqui para ajudá-lo com informações sobre pacientes, criar prescrições e muito mais.
          Como posso ajudá-lo hoje?
        </Text>
      </View>
    );
  };

  const getContextualPlaceholder = (): string => {
    if (currentPatient && currentEncounter) {
      return `Pergunte sobre ${currentPatient.name || 'paciente'} ou o encontro ${currentEncounter.id}...`;
    }
    
    if (currentPatient) {
      return `Pergunte sobre ${currentPatient.name || 'paciente'}...`;
    }
    
    if (currentEncounter) {
      return `Pergunte sobre o encontro ${currentEncounter.id}...`;
    }
    
    return 'Digite sua pergunta...';
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

        {/* Header */}
        <View style={[styles.headerBackground, { paddingTop: insets.top + theme.spacing.md }]}>
          <Image
            source={require('../../assets/medpro-logo.png')}
            style={styles.backgroundLogo}
            resizeMode="contain"
          />
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.headerTitles}>
                <Text style={styles.headerTitle}>Assistente MedPro</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleReset} style={styles.resetButton} activeOpacity={0.8}>
              <Feather name="refresh-cw" size={16} color={theme.colors.white} />
              <Text style={styles.resetButtonText}>Resetar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.headerDescription}>
            Tire dúvidas sobre pacientes, prescrições e atendimentos.
          </Text>
        </View>

        {/* Context Card */}
        {renderContextCard()}

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={[
            styles.messagesContent,
            { paddingBottom: keyboardHeight + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderWelcomeMessage()}
          {messages.map(renderMessage)}
          {renderTypingIndicator()}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder={getContextualPlaceholder()}
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              maxLength={500}
              editable={!isLoading && !isTranscribing}
              onSubmitEditing={handleSend}
            />
            
            {/* Audio recorder button */}
            <AssistantAudioRecorder
              onAudioRecorded={handleAudioRecorded}
              onTranscriptionComplete={handleTranscriptionComplete}
              onAudioMessage={handleAudioMessage}
              disabled={isLoading || isTranscribing}
              style={styles.audioRecorderStyle}
            />
            
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isLoading || isTranscribing) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading || isTranscribing}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.colors.surface} />
              ) : (
                <Feather name="send" size={20} color={theme.colors.surface} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  headerBackground: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...theme.shadows.large,
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundLogo: {
    position: 'absolute',
    right: -32,
    top: '30%',
    width: 140,
    height: 140,
    opacity: 0.08,
    tintColor: theme.colors.white,
    transform: [{ translateY: -70 }],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    flex: 1,
  },
  headerTitles: {
    flexShrink: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.white,
  },
  headerDescription: {
    marginTop: theme.spacing.sm,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.white + 'CC',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white + '1F',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 24,
    gap: theme.spacing.xs,
  },
  resetButtonText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  contextCard: {
    backgroundColor: theme.colors.primaryLight + '20',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contextCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  contextCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  contextCloseButton: {
    padding: 4,
  },
  contextCardContent: {
    gap: 8,
  },
  contextItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contextIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextInfo: {
    flex: 1,
  },
  contextLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  contextValue: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.text,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  messageContainer: {
    marginBottom: 16,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  userBubble: {
    backgroundColor: theme.colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: theme.colors.surface,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  errorBubble: {
    backgroundColor: theme.colors.error + '20',
    borderColor: theme.colors.error,
  },
  audioBubble: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.info,
  },
  audioIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  audioLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  userAudioLabel: {
    color: theme.colors.surface + '80',
  },
  assistantAudioLabel: {
    color: theme.colors.info,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: theme.colors.surface,
  },
  assistantMessageText: {
    color: theme.colors.text,
  },
  errorMessageText: {
    color: theme.colors.error,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  userMessageTime: {
    color: theme.colors.surface + '80',
  },
  assistantMessageTime: {
    color: theme.colors.textSecondary,
  },
  actionsContainer: {
    marginTop: 8,
    marginLeft: 8,
  },
  actionsContent: {
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 4,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  secondaryButton: {
    backgroundColor: theme.colors.secondary,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  dangerButton: {
    backgroundColor: theme.colors.error,
  },
  actionIcon: {
    fontSize: 14,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  primaryText: {
    color: theme.colors.surface,
  },
  secondaryText: {
    color: theme.colors.surface,
  },
  outlineText: {
    color: theme.colors.primary,
  },
  dangerText: {
    color: theme.colors.surface,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  typingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  inputContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.shadows.medium,
    borderWidth: 0,
    gap: theme.spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    maxHeight: 120,
    paddingVertical: theme.spacing.xs,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.textSecondary + '33',
    opacity: 1,
  },
  audioRecorderStyle: {
    marginLeft: theme.spacing.sm,
  },
});
