import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { logger } from '@/utils/logger';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: '1',
    question: 'Como agendar uma nova consulta?',
    answer: 'No painel principal, toque no botão "+ Agendar Consulta" e preencha as informações do paciente, data e horário desejados.',
    category: 'Consultas',
  },
  {
    id: '2',
    question: 'Como visualizar o histórico de um paciente?',
    answer: 'Acesse a aba "Pacientes", busque pelo nome ou CPF do paciente e toque nele. Você verá todo o histórico de consultas e registros clínicos.',
    category: 'Pacientes',
  },
  {
    id: '3',
    question: 'Como criar um registro clínico?',
    answer: 'Durante uma consulta, acesse os detalhes do encontro e toque em "Adicionar Registro Clínico". Preencha os campos necessários e salve.',
    category: 'Registros',
  },
  {
    id: '4',
    question: 'Como usar o Assistente IA?',
    answer: 'Na aba "Assistente", você pode fazer perguntas sobre procedimentos médicos, diagnósticos ou solicitar ajuda com registros clínicos. O assistente responde baseado no contexto do paciente selecionado.',
    category: 'Assistente',
  },
  {
    id: '5',
    question: 'Como enviar mensagens para outros profissionais?',
    answer: 'Acesse a aba "Mensagens", toque no botão "+" para criar nova conversa, selecione os profissionais e envie sua mensagem.',
    category: 'Mensagens',
  },
  {
    id: '6',
    question: 'Não recebi notificação de uma consulta',
    answer: 'Verifique se as notificações estão ativadas nas configurações do seu dispositivo. Em Configurações > Notificações > Medpro.app, certifique-se de que estão habilitadas.',
    category: 'Técnico',
  },
  {
    id: '7',
    question: 'Como atualizar meus dados profissionais?',
    answer: 'Acesse "Mais" > "Meu Perfil" e edite suas informações. Não esqueça de salvar as alterações.',
    category: 'Perfil',
  },
  {
    id: '8',
    question: 'O aplicativo está lento ou travando',
    answer: 'Tente fechar completamente o aplicativo e abri-lo novamente. Se o problema persistir, verifique sua conexão com a internet ou entre em contato com o suporte.',
    category: 'Técnico',
  },
];

export const HelpSupportScreen: React.FC = () => {
  const navigation = useNavigation();
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent?.();
      parent?.setOptions({ tabBarStyle: { display: 'none' } });

      return () => {
        parent?.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation])
  );

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleOpenLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Erro', 'Não foi possível abrir o link.');
      }
    } catch (error) {
      logger.error('Error opening link:', error);
      Alert.alert('Erro', 'Não foi possível abrir o link.');
    }
  };

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const groupedFAQ = FAQ_DATA.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, FAQItem[]>);

  const ContactOption: React.FC<{
    icon: string;
    title: string;
    subtitle: string;
    onPress: () => void;
  }> = ({ icon, title, subtitle, onPress }) => (
    <TouchableOpacity style={styles.contactOption} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.contactIconContainer}>
        <FontAwesome name={icon} size={24} color={theme.colors.primary} />
      </View>
      <View style={styles.contactTextContainer}>
        <Text style={styles.contactTitle}>{title}</Text>
        <Text style={styles.contactSubtitle}>{subtitle}</Text>
      </View>
      <FontAwesome name="chevron-right" size={16} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  const FAQItemComponent: React.FC<{ item: FAQItem }> = ({ item }) => {
    const isExpanded = expandedFAQ === item.id;

    return (
      <View style={styles.faqItem}>
        <TouchableOpacity
          style={styles.faqQuestion}
          onPress={() => toggleFAQ(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.faqQuestionContent}>
            <FontAwesome
              name="question-circle"
              size={16}
              color={theme.colors.primary}
              style={styles.faqQuestionIcon}
            />
            <Text style={styles.faqQuestionText}>{item.question}</Text>
          </View>
          <FontAwesome
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={theme.colors.textSecondary}
          />
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.faqAnswer}>
            <Text style={styles.faqAnswerText}>{item.answer}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerBackground}>
          <Image
            source={require('../../assets/medpro-logo.png')}
            style={styles.backgroundLogo}
            resizeMode="contain"
          />
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleGoBack}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <FontAwesome name="chevron-left" size={18} color={theme.colors.white} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.greeting}>Ajuda e Suporte</Text>
              <Text style={styles.subheading}>Central de ajuda e contato</Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Quick Contact Options */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <FontAwesome name="headphones" size={20} color={theme.colors.primary} />
              <Text style={styles.cardTitle}>Entre em Contato</Text>
            </View>
            <Text style={styles.cardDescription}>
              Estamos aqui para ajudar. Escolha uma forma de contato:
            </Text>
            <ContactOption
              icon="envelope-o"
              title="Email"
              subtitle="suporte@medproapp.com.br"
              onPress={() => handleOpenLink('mailto:suporte@medproapp.com.br')}
            />
            <View style={styles.contactDivider} />
            <ContactOption
              icon="whatsapp"
              title="WhatsApp"
              subtitle="+55 11 93239-4778"
              onPress={() => handleOpenLink('https://wa.me/5511932394778')}
            />
          </View>

          {/* FAQ by Category */}
          {Object.entries(groupedFAQ).map(([category, items]) => (
            <View key={category} style={styles.card}>
              <View style={styles.cardHeader}>
                <FontAwesome name="question-circle-o" size={20} color={theme.colors.primary} />
                <Text style={styles.cardTitle}>{category}</Text>
              </View>
              {items.map((item) => (
                <FAQItemComponent key={item.id} item={item} />
              ))}
            </View>
          ))}

          {/* Still Need Help */}
          <View style={styles.helpCard}>
            <FontAwesome
              name="life-ring"
              size={32}
              color={theme.colors.primary}
              style={styles.helpIcon}
            />
            <Text style={styles.helpTitle}>Ainda precisa de ajuda?</Text>
            <Text style={styles.helpText}>
              Nossa equipe de suporte está pronta para ajudá-lo com qualquer dúvida ou problema.
            </Text>
            <TouchableOpacity
              style={styles.helpButton}
              onPress={() => handleOpenLink('mailto:suporte@medproapp.com.br')}
              activeOpacity={0.7}
            >
              <FontAwesome name="envelope" size={16} color={theme.colors.white} />
              <Text style={styles.helpButtonText}>Enviar Email</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerBackground: {
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: theme.spacing.lg,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
    zIndex: 1,
  },
  backgroundLogo: {
    position: 'absolute',
    right: -20,
    top: '50%',
    width: 120,
    height: 120,
    opacity: 0.1,
    transform: [{ translateY: -60 }],
    tintColor: theme.colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.white + '22',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    ...theme.typography.h1,
    color: theme.colors.white,
    fontSize: 24,
    fontWeight: '700',
  },
  subheading: {
    ...theme.typography.caption,
    color: theme.colors.white + 'AA',
    fontSize: 14,
    marginTop: theme.spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    ...theme.typography.h3,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
  },
  cardDescription: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  contactIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  contactTextContainer: {
    flex: 1,
  },
  contactTitle: {
    ...theme.typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  contactSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },
  contactDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  actionButtonText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  actionDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },
  faqItem: {
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.sm,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  faqQuestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  faqQuestionIcon: {
    marginRight: theme.spacing.sm,
  },
  faqQuestionText: {
    ...theme.typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  faqAnswer: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: 8,
    marginTop: theme.spacing.xs,
    marginLeft: theme.spacing.xl,
  },
  faqAnswerText: {
    ...theme.typography.body,
    color: theme.colors.text,
    lineHeight: 20,
  },
  helpCard: {
    backgroundColor: theme.colors.primary + '08',
    borderRadius: 16,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
  },
  helpIcon: {
    marginBottom: theme.spacing.md,
  },
  helpTitle: {
    ...theme.typography.h2,
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  helpText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    lineHeight: 20,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: 999,
    gap: theme.spacing.sm,
  },
  helpButtonText: {
    ...theme.typography.body,
    color: theme.colors.white,
    fontWeight: '700',
    marginLeft: theme.spacing.sm,
  },
});
