import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  RefreshControl,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { ResponsiveContainer } from '@components/common';
import { useBillingStore } from '@store/billingStore';
import { IAPProduct } from '@/types/billing';

export const PackagesScreen: React.FC = () => {
  const navigation = useNavigation();
  const {
    products,
    purchases,
    isLoading,
    isPurchasing,
    error,
    lastPurchaseSuccess,
    initIAP,
    loadProducts,
    loadPurchases,
    purchase,
    restorePurchases,
    clearError,
    clearLastPurchaseSuccess,
  } = useBillingStore();

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    const init = async () => {
      await initIAP();
      await loadProducts();
      await loadPurchases();
    };
    init();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Erro', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  useEffect(() => {
    if (lastPurchaseSuccess) {
      Alert.alert(
        'Compra Realizada!',
        `${lastPurchaseSuccess} foi adicionado à sua conta com sucesso.`,
        [{ text: 'OK', onPress: clearLastPurchaseSuccess }]
      );
    }
  }, [lastPurchaseSuccess]);

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    await loadPurchases();
    setRefreshing(false);
  };

  const handlePurchase = (product: IAPProduct) => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'Indisponível',
        'Compras dentro do aplicativo estão disponíveis apenas no iOS. Para adquirir pacotes, acesse o site medproapp.com.br.'
      );
      return;
    }

    Alert.alert(
      'Confirmar Compra',
      `Deseja comprar ${product.name} por ${product.localizedPrice}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Comprar',
          onPress: () => {
            // Just initiate purchase - success alert will show via lastPurchaseSuccess
            purchase(product.productId);
          },
        },
      ]
    );
  };

  const handleRestore = () => {
    Alert.alert(
      'Restaurar Compras',
      'Deseja restaurar suas compras anteriores?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          onPress: async () => {
            await restorePurchases();
            Alert.alert('Concluído', 'Suas compras foram restauradas.');
          },
        },
      ]
    );
  };

  const renderProduct = (product: IAPProduct) => (
    <View key={product.productId} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIconWrapper}>
          <FontAwesome
            name={product.productType === 'subscription' ? 'refresh' : 'cube'}
            size={20}
            color={theme.colors.primary}
          />
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productDescription}>{product.description}</Text>
        </View>
      </View>

      <View style={styles.featuresContainer}>
        {product.aiTokens > 0 && (
          <View style={styles.featureRow}>
            <FontAwesome name="bolt" size={14} color={theme.colors.success} />
            <Text style={styles.featureText}>
              {product.aiTokens.toLocaleString('pt-BR')} tokens de IA
            </Text>
          </View>
        )}
        {product.audioMinutes > 0 && (
          <View style={styles.featureRow}>
            <FontAwesome name="microphone" size={14} color={theme.colors.info} />
            <Text style={styles.featureText}>
              {product.audioMinutes} minutos de áudio
            </Text>
          </View>
        )}
        {product.encountersPerDay > 0 && (
          <View style={styles.featureRow}>
            <FontAwesome name="calendar-plus-o" size={14} color={theme.colors.warning} />
            <Text style={styles.featureText}>
              +{product.encountersPerDay} atendimentos/dia
            </Text>
          </View>
        )}
        <View style={styles.featureRow}>
          <FontAwesome name="clock-o" size={14} color={theme.colors.textSecondary} />
          <Text style={styles.featureText}>
            Válido por {product.durationDays} dias
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.buyButton, isPurchasing && styles.buyButtonDisabled]}
        onPress={() => handlePurchase(product)}
        disabled={isPurchasing}
      >
        {isPurchasing ? (
          <ActivityIndicator size="small" color={theme.colors.white} />
        ) : (
          <>
            <FontAwesome name="shopping-cart" size={16} color={theme.colors.white} />
            <Text style={styles.buyButtonText}>
              {product.localizedPrice || 'Carregando...'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderActivePurchases = () => {
    const iapPurchases = purchases.filter(pkg => pkg.source === 'apple_iap');
    if (iapPurchases.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PACOTES ATIVOS</Text>
        {iapPurchases.map((pkg, index) => (
          <View key={`${pkg.source}-${index}`} style={styles.purchaseCard}>
            <View style={styles.purchaseHeader}>
              <View style={styles.purchaseInfo}>
                <Text style={styles.purchaseName}>{pkg.name}</Text>
                <View style={[styles.sourceBadge, pkg.source === 'apple_iap' ? styles.sourceBadgeApple : styles.sourceBadgeStripe]}>
                  <FontAwesome
                    name={pkg.source === 'apple_iap' ? 'apple' : 'credit-card'}
                    size={10}
                    color={theme.colors.white}
                  />
                  <Text style={styles.sourceBadgeText}>
                    {pkg.source === 'apple_iap' ? 'App Store' : 'Web'}
                  </Text>
                </View>
              </View>
              <View style={[styles.statusBadge, styles.statusActive]}>
                <Text style={styles.statusText}>Ativo</Text>
              </View>
            </View>
            <Text style={styles.purchaseExpiry}>
              Expira em:{' '}
              {'currentPeriodEnd' in pkg
                ? new Date(pkg.currentPeriodEnd).toLocaleDateString('pt-BR')
                : pkg.expiresAt
                ? new Date(pkg.expiresAt).toLocaleDateString('pt-BR')
                : 'N/A'}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  if (isLoading && products.length === 0) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
        <View style={styles.container}>
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
                <Text style={styles.greeting}>Pacotes</Text>
                <Text style={styles.subheading}>Adquira recursos extras para sua conta</Text>
              </View>
            </View>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Carregando pacotes...</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.container}>
        {/* Header aligned with other screens */}
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
              <Text style={styles.greeting}>Pacotes</Text>
              <Text style={styles.subheading}>Adquira recursos extras para sua conta</Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <ResponsiveContainer>
            {/* Active Purchases Section */}
            {renderActivePurchases()}

            {/* Available Products Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PACOTES DISPONÍVEIS</Text>
              {Platform.OS !== 'ios' && (
                <View style={styles.webOnlyBanner}>
                  <FontAwesome name="info-circle" size={16} color={theme.colors.info} />
                  <Text style={styles.webOnlyText}>
                    Compras disponíveis apenas no iOS ou via site medproapp.com.br
                  </Text>
                </View>
              )}
              {products.length === 0 ? (
                <View style={styles.emptyState}>
                  <FontAwesome name="shopping-bag" size={48} color={theme.colors.textSecondary} />
                  <Text style={styles.emptyText}>Nenhum pacote disponível no momento</Text>
                </View>
              ) : (
                products.map(renderProduct)
              )}
            </View>

            {/* Restore Purchases Button (iOS only) */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
                <FontAwesome name="history" size={16} color={theme.colors.primary} />
                <Text style={styles.restoreText}>Restaurar Compras</Text>
              </TouchableOpacity>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Os pacotes adicionam recursos extras à sua conta organizacional.
                Benefícios são compartilhados com todos os membros da organização.
              </Text>
              <View style={styles.consumptionNote}>
                <FontAwesome name="line-chart" size={14} color={theme.colors.info} />
                <Text style={styles.consumptionNoteText}>
                  Acompanhe seu consumo de IA no aplicativo web medproapp.com.br
                </Text>
              </View>
            </View>
          </ResponsiveContainer>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.textSecondary,
    ...theme.typography.body,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  webOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.colors.info}15`,
    padding: theme.spacing.md,
    borderRadius: 12,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  webOnlyText: {
    flex: 1,
    ...theme.typography.caption,
    color: theme.colors.info,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  cardIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    ...theme.typography.h3,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  productDescription: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  featuresContainer: {
    marginBottom: theme.spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  featureText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  buyButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  buyButtonDisabled: {
    opacity: 0.6,
  },
  buyButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  purchaseCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success,
  },
  purchaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  purchaseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  purchaseName: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    gap: 4,
  },
  sourceBadgeApple: {
    backgroundColor: '#333',
  },
  sourceBadgeStripe: {
    backgroundColor: theme.colors.info,
  },
  sourceBadgeText: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.white,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusActive: {
    backgroundColor: theme.colors.success + '20',
  },
  statusText: {
    ...theme.typography.caption,
    color: theme.colors.success,
    fontWeight: '600',
  },
  purchaseExpiry: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyText: {
    marginTop: theme.spacing.md,
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  restoreButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  restoreText: {
    ...theme.typography.body,
    color: theme.colors.primary,
  },
  footer: {
    paddingVertical: theme.spacing.lg,
  },
  footerText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  consumptionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  consumptionNoteText: {
    ...theme.typography.caption,
    color: theme.colors.info,
  },
});
