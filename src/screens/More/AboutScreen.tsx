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
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { logger } from '@/utils/logger';
import api from '@/services/api';
import releaseInfo from '../../../release.json';

interface LegalDocument {
  title: string;
  effectiveDate?: string;
  version?: string;
  sections: Array<{ heading: string; content: string }>;
}

export const AboutScreen: React.FC = () => {
  const navigation = useNavigation();
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalModalTitle, setLegalModalTitle] = useState('');
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);
  const [legalLoading, setLegalLoading] = useState(false);
  const [legalError, setLegalError] = useState(false);

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
      }
    } catch (error) {
      logger.error('Error opening link:', error);
    }
  };

  const openLegalDocument = async (type: 'terms' | 'privacy') => {
    setLegalModalTitle(type === 'terms' ? 'Termos de Serviço' : 'Política de Privacidade');
    setLegalModalVisible(true);
    setLegalLoading(true);
    setLegalError(false);
    setLegalDocument(null);

    try {
      const endpoint = type === 'terms' ? '/api/legal/terms' : '/api/legal/privacy';
      const response = await api.get(`${endpoint}?language=pt-BR`);
      setLegalDocument(response.data);
      setLegalLoading(false);
    } catch (error) {
      logger.error('Error loading legal document:', error);
      setLegalLoading(false);
      setLegalError(true);
    }
  };

  const closeLegalModal = () => {
    setLegalModalVisible(false);
    setLegalDocument(null);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  const FeatureItem: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
    <View style={styles.featureItem}>
      <View style={styles.featureIconContainer}>
        <FontAwesome name={icon} size={18} color={theme.colors.primary} />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );

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
              <Text style={styles.greeting}>Sobre o Medpro.app</Text>
              <Text style={styles.subheading}>Informações do aplicativo</Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* App Logo and Name */}
          <View style={styles.logoCard}>
            <Image
              source={require('../../assets/medpro-logo.png')}
              style={styles.appLogo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Medpro.app</Text>
            <Text style={styles.appTagline}>Profissional</Text>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>Versão {releaseInfo.version}</Text>
            </View>
          </View>

          {/* App Information */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <FontAwesome name="info-circle" size={20} color={theme.colors.primary} />
              <Text style={styles.cardTitle}>Informações</Text>
            </View>
            <InfoRow label="Versão" value={releaseInfo.version} />
            <InfoRow label="Data de Lançamento" value={formatDate(releaseInfo.releaseDate)} />
          </View>

          {/* Release Notes */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <FontAwesome name="file-text-o" size={20} color={theme.colors.primary} />
              <Text style={styles.cardTitle}>Novidades da Versão</Text>
            </View>
            {releaseInfo.releaseNotes.map((note: string, index: number) => (
              <View key={index} style={styles.releaseNoteItem}>
                <FontAwesome name="check-circle" size={14} color={theme.colors.success} style={styles.releaseNoteIcon} />
                <Text style={styles.releaseNoteText}>{note}</Text>
              </View>
            ))}
          </View>

          {/* About Description */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <FontAwesome name="stethoscope" size={20} color={theme.colors.primary} />
              <Text style={styles.cardTitle}>Sobre o Aplicativo</Text>
            </View>
            <Text style={styles.descriptionText}>
              O Medpro.app Profissional é uma plataforma completa desenvolvida especialmente para
              profissionais de saúde, oferecendo ferramentas modernas para gestão de pacientes,
              consultas e registros clínicos.
            </Text>
          </View>

          {/* Features */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <FontAwesome name="star" size={20} color={theme.colors.primary} />
              <Text style={styles.cardTitle}>Principais Recursos</Text>
            </View>
            <FeatureItem icon="calendar-check-o" text="Gestão de consultas e agendamentos" />
            <FeatureItem icon="users" text="Gerenciamento de pacientes" />
            <FeatureItem icon="file-text-o" text="Registros clínicos detalhados" />
            <FeatureItem icon="comments-o" text="Mensagens internas para equipe" />
            <FeatureItem icon="user-circle" text="Assistente IA para profissionais" />
            <FeatureItem icon="bell-o" text="Notificações em tempo real" />
          </View>

          {/* Support */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <FontAwesome name="life-ring" size={20} color={theme.colors.primary} />
              <Text style={styles.cardTitle}>Suporte</Text>
            </View>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => handleOpenLink('mailto:suporte@medproapp.com.br')}
            >
              <FontAwesome name="envelope-o" size={16} color={theme.colors.primary} />
              <Text style={styles.linkText}>suporte@medproapp.com.br</Text>
              <FontAwesome name="external-link" size={12} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Legal */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <FontAwesome name="shield" size={20} color={theme.colors.primary} />
              <Text style={styles.cardTitle}>Legal</Text>
            </View>
            <TouchableOpacity style={styles.linkRow} onPress={() => openLegalDocument('terms')}>
              <FontAwesome name="file-text-o" size={16} color={theme.colors.primary} />
              <Text style={styles.linkText}>Termos de Uso</Text>
              <FontAwesome name="chevron-right" size={12} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.linkDivider} />
            <TouchableOpacity style={styles.linkRow} onPress={() => openLegalDocument('privacy')}>
              <FontAwesome name="lock" size={16} color={theme.colors.primary} />
              <Text style={styles.linkText}>Política de Privacidade</Text>
              <FontAwesome name="chevron-right" size={12} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              © 2026 Medpro.app. Todos os direitos reservados.
            </Text>
            <Text style={styles.footerSubtext}>
              Desenvolvido com ❤️ para profissionais de saúde
            </Text>
          </View>
        </ScrollView>

        {/* Legal Document Modal */}
        <Modal
          visible={legalModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeLegalModal}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{legalModalTitle}</Text>
              <TouchableOpacity onPress={closeLegalModal} style={styles.modalCloseButton}>
                <FontAwesome name="times" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {legalLoading && (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.modalLoadingText}>Carregando...</Text>
              </View>
            )}

            {legalError && (
              <View style={styles.modalError}>
                <FontAwesome name="exclamation-circle" size={48} color={theme.colors.error} />
                <Text style={styles.modalErrorText}>
                  Não foi possível carregar o documento.
                </Text>
                <TouchableOpacity style={styles.modalRetryButton} onPress={closeLegalModal}>
                  <Text style={styles.modalRetryText}>Fechar</Text>
                </TouchableOpacity>
              </View>
            )}

            {legalDocument && !legalLoading && !legalError && (
              <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
                {(legalDocument.effectiveDate || legalDocument.version) && (
                  <View style={styles.modalMetadata}>
                    {legalDocument.effectiveDate && (
                      <Text style={styles.modalMetadataText}>
                        <Text style={styles.modalMetadataLabel}>Data de Vigência: </Text>
                        {formatDate(legalDocument.effectiveDate)}
                      </Text>
                    )}
                    {legalDocument.version && (
                      <Text style={styles.modalMetadataText}>
                        <Text style={styles.modalMetadataLabel}>Versão: </Text>
                        {legalDocument.version}
                      </Text>
                    )}
                  </View>
                )}

                {legalDocument.sections?.map((section, index) => (
                  <View key={index} style={styles.modalSection}>
                    <Text style={styles.modalSectionHeading}>{section.heading}</Text>
                    <Text style={styles.modalSectionContent}>{section.content}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </Modal>
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
  logoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.medium,
  },
  appLogo: {
    width: 80,
    height: 80,
    marginBottom: theme.spacing.md,
  },
  appName: {
    ...theme.typography.h1,
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  appTagline: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  versionBadge: {
    backgroundColor: theme.colors.primary + '18',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.round,
  },
  versionText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '600',
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  infoLabel: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  releaseNoteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  releaseNoteIcon: {
    marginRight: theme.spacing.sm,
    marginTop: 3,
  },
  releaseNoteText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
    lineHeight: 20,
  },
  descriptionText: {
    ...theme.typography.body,
    color: theme.colors.text,
    lineHeight: 22,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  featureIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  featureText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  linkText: {
    ...theme.typography.body,
    color: theme.colors.primary,
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  linkDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.sm,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  footerText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  footerSubtext: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  modalTitle: {
    ...theme.typography.h2,
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  modalCloseButton: {
    padding: theme.spacing.sm,
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  modalError: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalErrorText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  modalRetryButton: {
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.medium,
  },
  modalRetryText: {
    ...theme.typography.body,
    color: theme.colors.white,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: theme.spacing.lg,
  },
  modalMetadata: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.medium,
    marginBottom: theme.spacing.lg,
  },
  modalMetadataText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  modalMetadataLabel: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  modalSection: {
    marginBottom: theme.spacing.lg,
  },
  modalSectionHeading: {
    ...theme.typography.h3,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  modalSectionContent: {
    ...theme.typography.body,
    color: theme.colors.text,
    lineHeight: 22,
  },
});
