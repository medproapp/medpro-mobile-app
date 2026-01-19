import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { useMessagingStore } from '@store/messagingStore';
import { Contact } from '@/types/messaging';
import { logger } from '@/utils/logger';

// Contact Picker Modal Component
interface ContactPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  contacts: Contact[];
  selectedContacts: Contact[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  contactsType: 'staff' | 'patients';
  onTypeChange: (type: 'staff' | 'patients') => void;
  onContactToggle: (contact: Contact) => void;
}

const ContactPickerModal: React.FC<ContactPickerModalProps> = ({
  visible,
  onClose,
  onConfirm,
  contacts,
  selectedContacts,
  isLoading,
  searchQuery,
  onSearchChange,
  contactsType,
  onTypeChange,
  onContactToggle,
}) => {
  const filteredContacts = contacts.filter(contact =>
    contact.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isSelected = (contact: Contact) =>
    selectedContacts.some(c => c.user_id === contact.user_id);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={modalStyles.container}>
        {/* Modal Header */}
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
            <FontAwesome name="times" size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={modalStyles.title}>Selecionar Destinatário</Text>
          <TouchableOpacity onPress={onConfirm} style={modalStyles.confirmButton}>
            <Text style={modalStyles.confirmText}>OK</Text>
          </TouchableOpacity>
        </View>

        {/* Type Toggle */}
        <View style={modalStyles.toggleContainer}>
          <TouchableOpacity
            style={[
              modalStyles.toggleButton,
              contactsType === 'staff' && modalStyles.toggleButtonActive
            ]}
            onPress={() => onTypeChange('staff')}
          >
            <FontAwesome
              name="user-md"
              size={14}
              color={contactsType === 'staff' ? theme.colors.white : theme.colors.primary}
            />
            <Text style={[
              modalStyles.toggleText,
              contactsType === 'staff' && modalStyles.toggleTextActive
            ]}>
              Equipe
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              modalStyles.toggleButton,
              contactsType === 'patients' && modalStyles.toggleButtonActive
            ]}
            onPress={() => onTypeChange('patients')}
          >
            <FontAwesome
              name="users"
              size={14}
              color={contactsType === 'patients' ? theme.colors.white : theme.colors.primary}
            />
            <Text style={[
              modalStyles.toggleText,
              contactsType === 'patients' && modalStyles.toggleTextActive
            ]}>
              Pacientes
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={modalStyles.searchContainer}>
          <FontAwesome name="search" size={16} color={theme.colors.textSecondary} />
          <TextInput
            style={modalStyles.searchInput}
            placeholder={contactsType === 'staff' ? 'Buscar na equipe...' : 'Buscar pacientes...'}
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => onSearchChange('')}>
              <FontAwesome name="times-circle" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Contacts List */}
        {isLoading ? (
          <View style={modalStyles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={modalStyles.loadingText}>Carregando contatos...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            keyExtractor={(item, index) => item.user_id || `contact-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  modalStyles.contactItem,
                  isSelected(item) && modalStyles.contactItemSelected
                ]}
                onPress={() => onContactToggle(item)}
              >
                <View style={modalStyles.contactInfo}>
                  <Text style={modalStyles.contactName}>{item.display_name}</Text>
                  <Text style={modalStyles.contactEmail}>{item.email}</Text>
                </View>
                <View style={[
                  modalStyles.checkbox,
                  isSelected(item) && modalStyles.checkboxSelected
                ]}>
                  {isSelected(item) && (
                    <FontAwesome name="check" size={12} color={theme.colors.white} />
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={modalStyles.emptyContainer}>
                <FontAwesome name="users" size={48} color={theme.colors.textSecondary} />
                <Text style={modalStyles.emptyText}>
                  {searchQuery ? 'Nenhum contato encontrado' : 'Nenhum contato disponível'}
                </Text>
              </View>
            }
            contentContainerStyle={filteredContacts.length === 0 ? { flex: 1 } : undefined}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

// Main Screen Component
export const NewMessageScreen: React.FC = () => {
  const navigation = useNavigation();

  const {
    contacts,
    selectedContacts,
    isLoadingContacts,
    error,
    loadContacts,
    addSelectedContact,
    removeSelectedContact,
    clearSelectedContacts,
    sendMessage,
  } = useMessagingStore();

  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contactsType, setContactsType] = useState<'staff' | 'patients'>('staff');

  // Load contacts when type changes
  useEffect(() => {
    loadContacts({ type: contactsType });
  }, [contactsType]);

  // Clear selections when leaving screen
  useEffect(() => {
    return () => {
      clearSelectedContacts();
    };
  }, []);

  const handleContactToggle = (contact: Contact) => {
    const isSelected = selectedContacts.some(c => c.user_id === contact.user_id);
    if (isSelected) {
      removeSelectedContact(contact.user_id);
    } else {
      addSelectedContact(contact);
    }
  };

  const handleSendMessage = async () => {
    if (selectedContacts.length === 0) {
      Alert.alert('Erro', 'Selecione pelo menos um destinatário');
      return;
    }
    if (!subject.trim()) {
      Alert.alert('Erro', 'Digite um assunto para a mensagem');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Erro', 'Digite o conteúdo da mensagem');
      return;
    }

    setIsSending(true);

    try {
      await sendMessage({
        recipients: selectedContacts.map(c => c.user_id),
        subject: subject.trim(),
        content: content.trim(),
        message_type: 'text',
        priority: 'normal',
      });

      Alert.alert('Sucesso', 'Mensagem enviada com sucesso!', [
        {
          text: 'OK',
          onPress: () => {
            clearSelectedContacts();
            navigation.goBack();
          }
        }
      ]);
    } catch (error) {
      logger.error('[NewMessageScreen] Error sending message:', error);
      Alert.alert('Erro', 'Não foi possível enviar a mensagem. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  const canSend = selectedContacts.length > 0 && subject.trim() && content.trim() && !isSending;

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nova Mensagem</Text>
          <TouchableOpacity
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!canSend}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <Text style={styles.sendButtonText}>Enviar</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Recipients Row */}
          <View style={styles.recipientsRow}>
            <Text style={styles.fieldLabel}>Para:</Text>
            <View style={styles.recipientsContainer}>
              {selectedContacts.map((contact, index) => (
                <View key={contact.user_id || `selected-${index}`} style={styles.recipientChip}>
                  <Text style={styles.recipientChipText} numberOfLines={1}>
                    {contact.display_name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => removeSelectedContact(contact.user_id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <FontAwesome name="times" size={12} color={theme.colors.white} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={styles.addRecipientButton}
                onPress={() => setShowContactPicker(true)}
              >
                <FontAwesome name="plus" size={12} color={theme.colors.primary} />
                <Text style={styles.addRecipientText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Subject Row */}
          <View style={styles.subjectRow}>
            <Text style={styles.fieldLabel}>Assunto:</Text>
            <TextInput
              style={styles.subjectInput}
              value={subject}
              onChangeText={setSubject}
              placeholder="Digite o assunto..."
              placeholderTextColor={theme.colors.textSecondary}
              maxLength={200}
            />
          </View>

          {/* Message Input */}
          <View style={styles.messageContainer}>
            <TextInput
              style={styles.messageInput}
              value={content}
              onChangeText={setContent}
              placeholder="Digite sua mensagem..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              maxLength={2000}
              textAlignVertical="top"
            />
          </View>

          {/* Character count */}
          <Text style={styles.charCount}>{content.length}/2000</Text>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Contact Picker Modal */}
        <ContactPickerModal
          visible={showContactPicker}
          onClose={() => setShowContactPicker(false)}
          onConfirm={() => setShowContactPicker(false)}
          contacts={contacts}
          selectedContacts={selectedContacts}
          isLoading={isLoadingContacts}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          contactsType={contactsType}
          onTypeChange={setContactsType}
          onContactToggle={handleContactToggle}
        />
      </KeyboardAvoidingView>
    </>
  );
};

// Modal Styles
const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  title: {
    ...theme.typography.h3,
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
  },
  confirmButton: {
    padding: theme.spacing.sm,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  toggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  toggleTextActive: {
    color: theme.colors.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    height: 44,
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  contactItemSelected: {
    backgroundColor: theme.colors.primary + '08',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  contactEmail: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
});

// Main Screen Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  backButton: {
    padding: theme.spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.white,
    marginLeft: theme.spacing.sm,
  },
  sendButton: {
    backgroundColor: theme.colors.white + '20',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 16,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  recipientsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    width: 65,
    marginTop: 8,
  },
  recipientsContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recipientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 6,
    maxWidth: '70%',
  },
  recipientChipText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  addRecipientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  addRecipientText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  subjectInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    paddingVertical: 4,
  },
  messageContainer: {
    flex: 1,
    marginTop: theme.spacing.md,
  },
  messageInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    lineHeight: 24,
  },
  charCount: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: theme.spacing.sm,
  },
  errorContainer: {
    backgroundColor: theme.colors.error,
    padding: theme.spacing.sm,
    margin: theme.spacing.md,
    borderRadius: 8,
  },
  errorText: {
    color: theme.colors.white,
    textAlign: 'center',
    fontSize: 14,
  },
});
