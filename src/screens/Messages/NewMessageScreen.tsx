import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { useMessagingStore } from '@store/messagingStore';
import { Contact } from '@/types/messaging';
import { logger } from '@/utils/logger';

interface ContactItemProps {
  contact: Contact;
  isSelected: boolean;
  onPress: () => void;
}

const ContactItem: React.FC<ContactItemProps> = ({ contact, isSelected, onPress }) => {
  return (
    <TouchableOpacity 
      style={[styles.contactItem, isSelected && styles.contactItemSelected]}
      onPress={onPress}
    >
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{contact.display_name}</Text>
        <Text style={styles.contactEmail}>{contact.email}</Text>
        {contact.role && (
          <Text style={styles.contactRole}>{contact.role}</Text>
        )}
      </View>
      {isSelected && (
        <FontAwesome 
          name="check-circle" 
          size={20} 
          color={theme.colors.primary} 
        />
      )}
    </TouchableOpacity>
  );
};

interface SelectedContactBadgeProps {
  contact: Contact;
  onRemove: () => void;
}

const SelectedContactBadge: React.FC<SelectedContactBadgeProps> = ({ contact, onRemove }) => {
  return (
    <View style={styles.selectedBadge}>
      <Text style={styles.selectedBadgeText}>{contact.display_name}</Text>
      <TouchableOpacity onPress={onRemove} style={styles.removeBadge}>
        <FontAwesome name="times" size={12} color={theme.colors.white} />
      </TouchableOpacity>
    </View>
  );
};

export const NewMessageScreen: React.FC = () => {
  const navigation = useNavigation();
  
  // Messaging store
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

  // Local state
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // Filtered contacts based on search
  const filteredContacts = contacts.filter(contact => 
    contact.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Load contacts on mount
  useEffect(() => {
    loadContacts();
    return () => {
      clearSelectedContacts(); // Clear selections when leaving screen
    };
  }, []);

  // Handle contact selection
  const handleContactPress = (contact: Contact) => {
    const isSelected = selectedContacts.some(c => c.user_id === contact.user_id);
    if (isSelected) {
      removeSelectedContact(contact.user_id);
    } else {
      addSelectedContact(contact);
    }
  };

  // Handle send message
  const handleSendMessage = async () => {
    // Validation
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
      const result = await sendMessage({
        recipients: selectedContacts.map(c => c.user_id),
        subject: subject.trim(),
        content: content.trim(),
        message_type: 'text',
        priority: 'normal',
      });

      Alert.alert(
        'Sucesso', 
        'Mensagem enviada com sucesso!',
        [
          {
            text: 'OK',
            onPress: () => {
              clearSelectedContacts();
              navigation.goBack();
            }
          }
        ]
      );
    } catch (error) {
      logger.error('[NewMessageScreen] Error sending message:', error);
      Alert.alert('Erro', 'Não foi possível enviar a mensagem. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  // Render contact item
  const renderContact = ({ item }: { item: Contact }) => (
    <ContactItem
      contact={item}
      isSelected={selectedContacts.some(c => c.user_id === item.user_id)}
      onPress={() => handleContactPress(item)}
    />
  );

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <FontAwesome name="arrow-left" size={20} color={theme.colors.white} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Nova Mensagem</Text>
          </View>
          <TouchableOpacity 
            style={[
              styles.sendHeaderButton,
              (!subject.trim() || !content.trim() || selectedContacts.length === 0 || isSending) 
                && styles.sendHeaderButtonDisabled
            ]}
            onPress={handleSendMessage}
            disabled={!subject.trim() || !content.trim() || selectedContacts.length === 0 || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <Text style={styles.sendHeaderButtonText}>Enviar</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Recipients Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Para:</Text>
            
            {/* Selected Recipients */}
            {selectedContacts.length > 0 && (
              <View style={styles.selectedContainer}>
                {selectedContacts.map(contact => (
                  <SelectedContactBadge
                    key={contact.user_id}
                    contact={contact}
                    onRemove={() => removeSelectedContact(contact.user_id)}
                  />
                ))}
              </View>
            )}

            {/* Search Contacts */}
            <View style={styles.searchContainer}>
              <FontAwesome name="search" size={16} color={theme.colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar contatos..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            {/* Contacts List */}
            <View style={styles.contactsList}>
              {isLoadingContacts ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={styles.loadingText}>Carregando contatos...</Text>
                </View>
              ) : filteredContacts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {searchQuery ? 'Nenhum contato encontrado' : 'Nenhum contato disponível'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredContacts}
                  renderItem={renderContact}
                  keyExtractor={item => item.user_id}
                  scrollEnabled={false}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          </View>

          {/* Subject Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assunto:</Text>
            <TextInput
              style={styles.subjectInput}
              value={subject}
              onChangeText={setSubject}
              placeholder="Digite o assunto da mensagem..."
              placeholderTextColor={theme.colors.textSecondary}
              maxLength={200}
            />
          </View>

          {/* Message Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mensagem:</Text>
            <TextInput
              style={styles.contentInput}
              value={content}
              onChangeText={setContent}
              placeholder="Digite sua mensagem..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              maxLength={2000}
              textAlignVertical="top"
            />
            <Text style={styles.characterCount}>
              {content.length}/2000 caracteres
            </Text>
          </View>
        </ScrollView>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
};

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
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  backButton: {
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...theme.typography.h3,
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  sendHeaderButton: {
    backgroundColor: theme.colors.white + '20',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 16,
  },
  sendHeaderButtonDisabled: {
    opacity: 0.5,
  },
  sendHeaderButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  selectedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  selectedBadgeText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  removeBadge: {
    marginLeft: theme.spacing.xs,
    padding: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    height: 40,
    color: theme.colors.text,
  },
  contactsList: {
    maxHeight: 200,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: 8,
  },
  contactItemSelected: {
    backgroundColor: theme.colors.primary + '10',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  contactEmail: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  contactRole: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontSize: 11,
    marginTop: 2,
  },
  subjectInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: 16,
  },
  contentInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: 16,
    minHeight: 120,
  },
  characterCount: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: theme.spacing.xs,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  loadingText: {
    marginLeft: theme.spacing.sm,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
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