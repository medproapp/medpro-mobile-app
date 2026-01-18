/**
 * Billing Store - Manages In-App Purchases
 *
 * Flow:
 * 1. initIAP() - Connect to Apple and set up listener (called once on app start)
 * 2. loadProducts() - Get products from backend + Apple prices
 * 3. loadPurchases() - Get user's active purchases from backend
 * 4. purchase(productId) - User initiates purchase:
 *    - Apple shows payment sheet
 *    - On completion, listener fires
 *    - Send receipt to backend for validation
 *    - Finish transaction with Apple
 *    - Reload purchases and show success
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import { API_BASE_URL } from '@config/environment';
import { useAuthStore } from './authStore';
import { logger } from '@/utils/logger';
import {
  IAPProduct,
  Purchase,
  IAPProductsResponse,
  AllPackagesResponse,
  ValidateAndCreditResponse,
} from '@/types/billing';

// Product IDs - must match App Store Connect
const PRODUCT_IDS = [
  'medpro.ai.tokens.1mv3',
];

// RNIap module reference (loaded once)
let RNIap: any = null;

// Listener subscriptions
let purchaseListener: any = null;
let errorListener: any = null;

interface BillingState {
  products: IAPProduct[];
  purchases: Purchase[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  isPurchasing: boolean;
  lastPurchaseSuccess: string | null;

  initIAP: () => Promise<void>;
  loadProducts: () => Promise<void>;
  loadPurchases: () => Promise<void>;
  purchase: (productId: string) => Promise<boolean>;
  restorePurchases: () => Promise<void>;
  cleanup: () => void;
  clearError: () => void;
  clearLastPurchaseSuccess: () => void;
}

const getAuthHeaders = (): Record<string, string> => {
  const { token, user } = useAuthStore.getState();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(user?.organizationId && { managingorg: user.organizationId }),
    ...(user?.email && { practid: user.email }),
  };
};

export const useBillingStore = create<BillingState>((set, get) => ({
  products: [],
  purchases: [],
  isLoading: false,
  isInitialized: false,
  error: null,
  isPurchasing: false,
  lastPurchaseSuccess: null,

  initIAP: async () => {
    if (get().isInitialized) return;
    if (Platform.OS !== 'ios') {
      set({ isInitialized: true });
      return;
    }

    try {
      // Load module once
      RNIap = await import('react-native-iap');
      await RNIap.initConnection();
      logger.info('[BillingStore] IAP initialized');

      // Remove old listeners if they exist
      if (purchaseListener) purchaseListener.remove();
      if (errorListener) errorListener.remove();

      // Set up purchase listener
      purchaseListener = RNIap.purchaseUpdatedListener(async (purchase: any) => {
        logger.info('[BillingStore] Purchase received:', purchase?.productId);

        if (!purchase?.transactionReceipt) {
          logger.warn('[BillingStore] No receipt in purchase');
          return;
        }

        await handlePurchaseReceived(purchase);
      });

      // Set up error listener
      errorListener = RNIap.purchaseErrorListener((error: any) => {
        logger.error('[BillingStore] Purchase error:', error?.code, error?.message);
        if (error?.code !== 'E_USER_CANCELLED') {
          set({ error: error?.message || 'Erro na compra' });
        }
        set({ isPurchasing: false });
      });

      set({ isInitialized: true });

    } catch (error: any) {
      logger.error('[BillingStore] Init error:', error);
      set({ error: 'In-App Purchases não disponível', isInitialized: true });
    }
  },

  loadProducts: async () => {
    set({ isLoading: true, error: null });

    try {
      // Get products from backend
      const response = await fetch(`${API_BASE_URL}/iap/products`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error('Falha ao carregar produtos');

      const data: IAPProductsResponse = await response.json();
      const backendProducts = data.products || [];

      // Get Apple prices
      let appleProducts: any[] = [];
      if (Platform.OS === 'ios' && RNIap) {
        try {
          appleProducts = await RNIap.getProducts({ skus: PRODUCT_IDS });
          logger.info('[BillingStore] Apple products:', appleProducts.length);
        } catch (err) {
          logger.error('[BillingStore] Apple products error:', err);
        }
      }

      // Merge backend + Apple data
      const products: IAPProduct[] = backendProducts.map((bp) => {
        const apple = appleProducts.find((ap: any) => ap.productId === bp.product_id);
        return {
          id: bp.id,
          productId: bp.product_id,
          name: bp.name,
          description: bp.description || '',
          productType: bp.product_type,
          aiTokens: bp.ai_tokens,
          audioMinutes: bp.audio_minutes,
          encountersPerDay: bp.encounters_per_day,
          durationDays: bp.duration_days,
          localizedPrice: apple?.localizedPrice || formatPrice(bp.reference_price_cents),
          price: apple?.price || bp.reference_price_cents / 100,
          currency: apple?.currency || 'BRL',
        };
      });

      set({ products, isLoading: false });

    } catch (error: any) {
      logger.error('[BillingStore] Load products error:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  loadPurchases: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/myplan2/all-packages`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error('Falha ao carregar compras');

      const data: AllPackagesResponse = await response.json();
      const purchases: Purchase[] = (data.packages || []).map((pkg) => ({
        id: pkg.id,
        productId: pkg.package_id,
        transactionId: '',
        status: pkg.status,
        purchaseDate: pkg.current_period_start,
        expiresAt: pkg.current_period_end,
        aiTokensGranted: pkg.monthly_tokens,
        audioMinutesGranted: pkg.audio_minutes,
        encountersPerDayGranted: pkg.encounters_per_day || 0,
        source: pkg.source === 'apple_iap' ? 'apple_iap' : 'stripe',
        name: pkg.name,
        // For stripe purchases
        packageId: pkg.package_id,
        quantity: pkg.quantity,
        currentPeriodStart: pkg.current_period_start,
        currentPeriodEnd: pkg.current_period_end,
        monthlyTokens: pkg.monthly_tokens,
        audioMinutes: pkg.audio_minutes,
        encountersPerDay: pkg.encounters_per_day || 0,
      }));

      set({ purchases });
      logger.info('[BillingStore] Purchases loaded:', purchases.length);

    } catch (error: any) {
      logger.error('[BillingStore] Load purchases error:', error);
    }
  },

  purchase: async (productId: string) => {
    logger.info('[BillingStore] ====== PURCHASE REQUEST ======');
    logger.info('[BillingStore] Product ID requested:', productId);
    logger.info('[BillingStore] Product ID type:', typeof productId);
    logger.info('[BillingStore] Product ID length:', productId?.length);
    logger.info('[BillingStore] Hardcoded PRODUCT_IDS:', PRODUCT_IDS);
    logger.info('[BillingStore] Is in PRODUCT_IDS:', PRODUCT_IDS.includes(productId));

    // Check if product exists in loaded products
    const loadedProducts = get().products;
    logger.info('[BillingStore] Loaded products count:', loadedProducts.length);
    loadedProducts.forEach((p, i) => {
      logger.info(`[BillingStore] Loaded product ${i}:`, {
        id: p.id,
        productId: p.productId,
        name: p.name,
      });
    });

    const matchingProduct = loadedProducts.find(p => p.productId === productId);
    logger.info('[BillingStore] Matching product found:', matchingProduct ? 'YES' : 'NO');
    if (matchingProduct) {
      logger.info('[BillingStore] Matching product details:', matchingProduct);
    }

    // Try to get Apple products again to verify
    if (RNIap) {
      try {
        const appleProducts = await RNIap.getProducts({ skus: PRODUCT_IDS });
        logger.info('[BillingStore] Apple products available:', appleProducts.length);
        appleProducts.forEach((ap: any, i: number) => {
          logger.info(`[BillingStore] Apple product ${i}:`, {
            productId: ap.productId,
            title: ap.title,
            price: ap.price,
          });
        });
        const appleMatch = appleProducts.find((ap: any) => ap.productId === productId);
        logger.info('[BillingStore] Product exists in Apple:', appleMatch ? 'YES' : 'NO');
      } catch (err) {
        logger.error('[BillingStore] Error checking Apple products:', err);
      }
    }
    logger.info('[BillingStore] ====== END PURCHASE DEBUG ======');

    if (Platform.OS !== 'ios' || !RNIap) {
      set({ error: 'Compras só disponíveis no iOS' });
      return false;
    }

    set({ isPurchasing: true, error: null });

    try {
      logger.info('[BillingStore] Calling requestPurchase with sku:', productId);
      await RNIap.requestPurchase({ sku: productId });
      // Don't set isPurchasing: false here - listener will handle it
      return true;
    } catch (error: any) {
      logger.error('[BillingStore] Purchase request error:', error);
      set({ isPurchasing: false });
      if (error?.code !== 'E_USER_CANCELLED') {
        set({ error: error?.message || 'Erro na compra' });
      }
      return false;
    }
  },

  restorePurchases: async () => {
    if (Platform.OS !== 'ios' || !RNIap) {
      set({ error: 'Restaurar compras só disponível no iOS' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const purchases = await RNIap.getAvailablePurchases();
      logger.info('[BillingStore] ====== APPLE PURCHASES QUERY ======');
      logger.info('[BillingStore] Total purchases from Apple:', purchases.length);

      for (let i = 0; i < purchases.length; i++) {
        const p = purchases[i];
        logger.info(`[BillingStore] Purchase ${i + 1}/${purchases.length}:`, {
          productId: p.productId,
          transactionId: p.transactionId,
          transactionDate: p.transactionDate,
          originalTransactionDateIOS: p.originalTransactionDateIOS,
          originalTransactionIdentifierIOS: p.originalTransactionIdentifierIOS,
        });
      }
      logger.info('[BillingStore] ====== END APPLE QUERY ======');

      for (const purchase of purchases) {
        await handlePurchaseReceived(purchase);
      }

      await get().loadPurchases();

    } catch (error: any) {
      logger.error('[BillingStore] Restore error:', error);
      set({ error: error?.message || 'Erro ao restaurar' });
    } finally {
      set({ isLoading: false });
    }
  },

  cleanup: () => {
    if (purchaseListener) {
      purchaseListener.remove();
      purchaseListener = null;
    }
    if (errorListener) {
      errorListener.remove();
      errorListener = null;
    }
    if (RNIap) {
      RNIap.endConnection().catch(() => {});
    }
    set({ isInitialized: false });
  },

  clearError: () => set({ error: null }),
  clearLastPurchaseSuccess: () => set({ lastPurchaseSuccess: null }),
}));

/**
 * Handle a purchase received from Apple (new or pending)
 */
async function handlePurchaseReceived(purchase: any): Promise<void> {
  const { productId, transactionId, transactionReceipt } = purchase;

  logger.info('[BillingStore] Processing:', productId, 'tx:', transactionId);

  try {
    // 1. Send to backend for validation
    const response = await fetch(`${API_BASE_URL}/iap/validate-and-credit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        receipt: transactionReceipt,
        productId,
        transactionId,
      }),
    });

    const data: ValidateAndCreditResponse = await response.json();
    logger.info('[BillingStore] Backend response:', data.success, data.error || '');

    // 2. Always finish transaction with Apple (success or duplicate)
    // This clears Apple's pending queue
    try {
      await RNIap.finishTransaction({ purchase, isConsumable: false });
      logger.info('[BillingStore] Transaction finished with Apple');
    } catch (finishErr: any) {
      logger.warn('[BillingStore] finishTransaction error:', finishErr?.message);
    }

    // 3. Handle result
    if (data.success) {
      // New purchase credited
      await useBillingStore.getState().loadPurchases();

      const products = useBillingStore.getState().products;
      const product = products.find(p => p.productId === productId);

      useBillingStore.setState({
        lastPurchaseSuccess: product?.name || productId,
        isPurchasing: false,
      });
    } else if (data.error?.toLowerCase().includes('duplicate')) {
      // Already credited - just refresh the list
      logger.info('[BillingStore] Duplicate transaction, refreshing list');
      await useBillingStore.getState().loadPurchases();
      useBillingStore.setState({ isPurchasing: false });
    } else {
      // Real error
      logger.error('[BillingStore] Validation error:', data.error);
      useBillingStore.setState({
        error: data.error || 'Erro na validação',
        isPurchasing: false
      });
    }

  } catch (error: any) {
    logger.error('[BillingStore] handlePurchaseReceived error:', error);
    useBillingStore.setState({ isPurchasing: false });
  }
}

function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}
