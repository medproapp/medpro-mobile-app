// Types for In-App Purchase (IAP) functionality

/**
 * IAP Product as defined in backend and App Store Connect
 */
export interface IAPProduct {
  id: number;
  productId: string;
  name: string;
  description: string;
  productType: 'consumable' | 'non_consumable' | 'subscription';
  aiTokens: number;
  audioMinutes: number;
  encountersPerDay: number;
  durationDays: number;

  // From Apple (populated at runtime via react-native-iap)
  localizedPrice?: string;
  price?: number;
  currency?: string;
}

/**
 * User's IAP purchase record
 */
export interface IAPPurchase {
  id: number;
  productId: string;
  transactionId: string;
  status: 'active' | 'expired' | 'cancelled' | 'refunded';
  purchaseDate: string;
  expiresAt: string | null;
  aiTokensGranted: number;
  audioMinutesGranted: number;
  encountersPerDayGranted: number;
  source: 'apple_iap';
  name: string;
}

/**
 * User's Stripe purchase record
 */
export interface StripePurchase {
  id: number;
  packageId: string;
  status: string;
  quantity: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  monthlyTokens: number;
  audioMinutes: number;
  encountersPerDay: number;
  source: 'stripe';
  name: string;
}

/**
 * Union type for any purchase (from either source)
 */
export type Purchase = IAPPurchase | StripePurchase;

/**
 * Backend API response for IAP products
 */
export interface IAPProductsResponse {
  success: boolean;
  products: Array<{
    id: number;
    product_id: string;
    name: string;
    description: string;
    product_type: 'consumable' | 'non_consumable' | 'subscription';
    ai_tokens: number;
    audio_minutes: number;
    encounters_per_day: number;
    duration_days: number;
    reference_price_cents: number;
    currency: string;
  }>;
}

/**
 * Backend API response for all packages (combined Stripe + IAP)
 */
export interface AllPackagesResponse {
  success: boolean;
  packages: Array<{
    source: 'stripe' | 'apple_iap';
    id: number;
    package_id: string;
    status: string;
    quantity: number;
    current_period_start: string;
    current_period_end: string;
    current_period_amount_cents: number;
    current_period_currency: string;
    name: string;
    monthly_tokens: number;
    audio_minutes: number;
    encounters_per_day: number | null;
  }>;
}

/**
 * Backend API response for purchase validation
 */
export interface ValidateAndCreditResponse {
  success: boolean;
  alreadyProcessed?: boolean;
  granted?: {
    ai_tokens: number;
    audio_minutes: number;
    encounters_per_day: number;
  };
  expires_at?: string;
  error?: string;
}

/**
 * Backend API response for restore purchases
 */
export interface RestorePurchasesResponse {
  success: boolean;
  restored: Array<{
    productId: string;
    transactionId: string;
    granted: {
      ai_tokens: number;
      audio_minutes: number;
      encounters_per_day: number;
    };
  }>;
  message: string;
  error?: string;
}
