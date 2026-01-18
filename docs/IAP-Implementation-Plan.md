# IAP Implementation Plan (react-native-iap)

## Current Status (2026-01-17)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: App Store Connect Setup | COMPLETED | Products created, "Ready to Submit" |
| Phase 2: Database Schema | COMPLETED | Tables created and seeded |
| Phase 3: Backend IAP Service | COMPLETED | appleValidator.js, iapService.js |
| Phase 4: Backend API Routes | COMPLETED | routes/iap.js |
| Phase 5: Update Quota Service | COMPLETED | orgQuotaService.js updated |
| Phase 6: Update myplan Endpoint | COMPLETED | all-packages endpoint added |
| Phase 7: Install react-native-iap | COMPLETED | v12.15.5 (for newArchEnabled: false) |
| Phase 8: Mobile Types & Store | COMPLETED | billingStore.ts, billing.ts |
| Phase 9: PackagesScreen UI | COMPLETED | Matches app design |
| Phase 10: Web Frontend | COMPLETED | myplan.js updated |
| Phase 11: Backend Testing | COMPLETED | /iap/products tested |
| Phase 12: iOS Device Testing | **BLOCKED** | See blocker below |

### BLOCKER: App Binary Not Uploaded to App Store Connect

**Problem:** Apple `getProducts()` returns empty array. Error: `E_DEVELOPER_ERROR: Invalid product ID`

**Root Cause:** The app binary has NEVER been uploaded to App Store Connect. IAP sandbox testing requires at least one binary with IAP capability to be uploaded to App Store Connect (does not need to be submitted for review).

**Solution:**
```bash
# 1. Build production iOS binary
eas build --platform ios --profile production

# 2. Upload to App Store Connect
eas submit --platform ios --latest
```

After upload completes, IAP sandbox testing will work.

---

## Overview

This document outlines the implementation plan for adding Apple In-App Purchases to the MedPro mobile app using `react-native-iap` with separate database tables for IAP tracking.

**Estimated Timeline:** ~13 days

---

## Phase 1: App Store Connect Setup (Day 1)

### 1.1 Create In-App Purchase Products

| Product ID | Type | Description | Price Tier |
|------------|------|-------------|------------|
| `medpro.ai.tokens.1mv2` | Consumable | 1M AI Tokens | ~R$ 79 |
| `medpro.encounters.3.monthly` | Auto-Renewable | +3 Encounters/day | ~R$ 69/mo |

### 1.2 Steps in App Store Connect

1. Go to Your App → In-App Purchases → Manage
2. Create each product with Product ID, type, price
3. Add display name and description (Portuguese)
4. Submit for review (can be done with app submission)

### 1.3 Get Shared Secret

- App Store Connect → Your App → In-App Purchases → App-Specific Shared Secret
- Save this for receipt validation

---

## Phase 2: Database Schema (Day 1-2)

### 2.1 Create `iap_products` table

```sql
CREATE TABLE iap_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(100) NOT NULL UNIQUE COMMENT 'Apple product ID',
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_type ENUM('consumable', 'non_consumable', 'subscription') NOT NULL,

  -- What this product grants
  ai_tokens INT DEFAULT 0,
  audio_minutes INT DEFAULT 0,
  encounters_per_day INT DEFAULT 0,

  -- Subscription info
  duration_days INT DEFAULT 30,
  subscription_group VARCHAR(100) NULL COMMENT 'Apple subscription group',

  -- Reference price (Apple manages actual price via tiers)
  reference_price_cents INT,
  currency VARCHAR(3) DEFAULT 'BRL',

  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.2 Create `user_iap_purchases` table

```sql
CREATE TABLE user_iap_purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  practitioner_id VARCHAR(255) NOT NULL,
  organization_id VARCHAR(50) NOT NULL,

  -- Apple transaction info
  product_id VARCHAR(100) NOT NULL,
  transaction_id VARCHAR(255) NOT NULL UNIQUE,
  original_transaction_id VARCHAR(255) COMMENT 'For subscription renewal tracking',
  receipt_data TEXT COMMENT 'Base64 receipt',

  -- Status
  status ENUM('active', 'expired', 'cancelled', 'refunded') DEFAULT 'active',

  -- Period
  purchase_date TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NULL COMMENT 'NULL for consumables, set for subscriptions',

  -- What was granted (copied from iap_products at purchase time)
  ai_tokens_granted INT DEFAULT 0,
  audio_minutes_granted INT DEFAULT 0,
  encounters_per_day_granted INT DEFAULT 0,

  -- Metadata
  environment ENUM('sandbox', 'production') DEFAULT 'production',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_org (organization_id),
  INDEX idx_pract (practitioner_id),
  INDEX idx_status (status),
  INDEX idx_expires (expires_at),
  INDEX idx_original_tx (original_transaction_id),

  FOREIGN KEY (product_id) REFERENCES iap_products(product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.3 Seed initial products

```sql
INSERT INTO iap_products (product_id, name, description, product_type, ai_tokens, audio_minutes, encounters_per_day, duration_days, reference_price_cents) VALUES
('medpro.ai.tokens.1mv2', 'Pacote IA Mais 1', '1 milhão de tokens de IA + 1000 minutos de áudio', 'consumable', 1000000, 1000, 0, 30, 7900),
('medpro.encounters.3.monthly', 'Pacote +3 Atendimentos', '+3 atendimentos por dia', 'subscription', 0, 0, 3, 30, 6900);
```

---

## Phase 3: Backend - IAP Service (Day 2-3)

### 3.1 Create Apple receipt validator

**File:** `src/services/iap/appleValidator.js`

```javascript
const axios = require('axios');
const logger = require('../../config/logger');

const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';

class AppleReceiptValidator {
  constructor() {
    this.sharedSecret = process.env.APPLE_SHARED_SECRET;
  }

  async validate(receiptData) {
    const payload = {
      'receipt-data': receiptData,
      'password': this.sharedSecret,
      'exclude-old-transactions': true
    };

    try {
      // Try production first
      let response = await axios.post(APPLE_PRODUCTION_URL, payload);

      // Status 21007 = sandbox receipt sent to production
      if (response.data.status === 21007) {
        logger.info('[AppleValidator] Sandbox receipt detected, retrying with sandbox');
        response = await axios.post(APPLE_SANDBOX_URL, payload);
      }

      const status = response.data.status;

      if (status === 0) {
        return {
          valid: true,
          environment: response.data.environment,
          receipt: response.data.receipt,
          latestReceiptInfo: response.data.latest_receipt_info || [],
          pendingRenewalInfo: response.data.pending_renewal_info || []
        };
      }

      logger.warn(`[AppleValidator] Invalid receipt, status: ${status}`);
      return { valid: false, status, error: this.getStatusMessage(status) };

    } catch (error) {
      logger.error('[AppleValidator] Validation error:', error.message);
      return { valid: false, error: error.message };
    }
  }

  getStatusMessage(status) {
    const messages = {
      21000: 'App Store could not read the receipt',
      21002: 'Receipt data malformed',
      21003: 'Receipt could not be authenticated',
      21004: 'Shared secret mismatch',
      21005: 'Receipt server unavailable',
      21006: 'Receipt valid but subscription expired',
      21007: 'Sandbox receipt sent to production',
      21008: 'Production receipt sent to sandbox',
      21010: 'Account not found',
    };
    return messages[status] || `Unknown error: ${status}`;
  }
}

module.exports = new AppleReceiptValidator();
```

### 3.2 Create IAP service

**File:** `src/services/iap/iapService.js`

```javascript
const pool = require('../../db');
const logger = require('../../config/logger');
const appleValidator = require('./appleValidator');

class IAPService {

  /**
   * Get all active IAP products
   */
  async getProducts() {
    const [rows] = await pool.query(
      'SELECT * FROM iap_products WHERE active = 1 ORDER BY name'
    );
    return rows;
  }

  /**
   * Validate receipt and credit purchase
   */
  async processPurchase({ receipt, productId, transactionId, practitionerId, organizationId }) {

    // 1. Check for duplicate transaction (idempotency)
    const [existing] = await pool.query(
      'SELECT id FROM user_iap_purchases WHERE transaction_id = ?',
      [transactionId]
    );

    if (existing.length > 0) {
      logger.info(`[IAPService] Transaction ${transactionId} already processed`);
      return { success: true, alreadyProcessed: true };
    }

    // 2. Validate receipt with Apple
    const validation = await appleValidator.validate(receipt);

    if (!validation.valid) {
      logger.warn(`[IAPService] Invalid receipt for transaction ${transactionId}`);
      return { success: false, error: validation.error || 'Invalid receipt' };
    }

    // 3. Get product details
    const [products] = await pool.query(
      'SELECT * FROM iap_products WHERE product_id = ?',
      [productId]
    );

    if (products.length === 0) {
      logger.error(`[IAPService] Unknown product: ${productId}`);
      return { success: false, error: 'Unknown product' };
    }

    const product = products[0];

    // 4. Calculate expiration (for subscriptions)
    let expiresAt = null;
    if (product.product_type === 'subscription') {
      // Get expiration from Apple's response
      const latestReceipt = validation.latestReceiptInfo?.find(
        r => r.product_id === productId
      );
      if (latestReceipt?.expires_date_ms) {
        expiresAt = new Date(parseInt(latestReceipt.expires_date_ms));
      } else {
        // Fallback: calculate from duration_days
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + product.duration_days);
      }
    } else {
      // Consumables: expire after duration_days
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + product.duration_days);
    }

    // 5. Find original transaction ID (for subscription renewals)
    const originalTransactionId = validation.latestReceiptInfo?.find(
      r => r.product_id === productId
    )?.original_transaction_id || transactionId;

    // 6. Insert purchase record
    await pool.query(`
      INSERT INTO user_iap_purchases (
        practitioner_id,
        organization_id,
        product_id,
        transaction_id,
        original_transaction_id,
        receipt_data,
        status,
        purchase_date,
        expires_at,
        ai_tokens_granted,
        audio_minutes_granted,
        encounters_per_day_granted,
        environment
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', NOW(), ?, ?, ?, ?, ?)
    `, [
      practitionerId,
      organizationId,
      productId,
      transactionId,
      originalTransactionId,
      receipt,
      expiresAt,
      product.ai_tokens,
      product.audio_minutes,
      product.encounters_per_day,
      validation.environment || 'production'
    ]);

    logger.info(`[IAPService] Purchase credited: ${productId} for org ${organizationId}`);

    return {
      success: true,
      granted: {
        ai_tokens: product.ai_tokens,
        audio_minutes: product.audio_minutes,
        encounters_per_day: product.encounters_per_day
      },
      expires_at: expiresAt
    };
  }

  /**
   * Get user's IAP purchases
   */
  async getUserPurchases(organizationId, practitionerId = null) {
    let query = `
      SELECT uip.*, ip.name, ip.product_type
      FROM user_iap_purchases uip
      JOIN iap_products ip ON uip.product_id = ip.product_id
      WHERE uip.organization_id = ?
        AND uip.status = 'active'
        AND (uip.expires_at IS NULL OR uip.expires_at > NOW())
    `;
    const params = [organizationId];

    if (practitionerId) {
      query += ' AND uip.practitioner_id = ?';
      params.push(practitionerId);
    }

    query += ' ORDER BY uip.created_at DESC';

    const [rows] = await pool.query(query, params);
    return rows;
  }

  /**
   * Handle subscription renewal/cancellation (called from Apple Server Notifications)
   */
  async handleSubscriptionEvent(eventType, originalTransactionId, newTransactionId, expiresAt) {
    switch (eventType) {
      case 'DID_RENEW':
        // Update expiration date
        await pool.query(`
          UPDATE user_iap_purchases
          SET expires_at = ?, status = 'active', updated_at = NOW()
          WHERE original_transaction_id = ?
        `, [expiresAt, originalTransactionId]);
        break;

      case 'DID_FAIL_TO_RENEW':
      case 'CANCEL':
      case 'REFUND':
        await pool.query(`
          UPDATE user_iap_purchases
          SET status = 'cancelled', updated_at = NOW()
          WHERE original_transaction_id = ?
        `, [originalTransactionId]);
        break;

      case 'EXPIRED':
        await pool.query(`
          UPDATE user_iap_purchases
          SET status = 'expired', updated_at = NOW()
          WHERE original_transaction_id = ?
        `, [originalTransactionId]);
        break;
    }
  }
}

module.exports = new IAPService();
```

---

## Phase 4: Backend - API Routes (Day 3-4)

### 4.1 Create IAP routes

**File:** `routes/iap.js`

```javascript
const express = require('express');
const router = express.Router();
const { verifyJWT } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const iapService = require('../src/services/iap/iapService');
const logger = require('../config/logger');

/**
 * GET /api/iap/products
 * List available IAP products
 */
router.get('/products', verifyJWT, asyncHandler(async (req, res) => {
  const products = await iapService.getProducts();
  res.json({ success: true, products });
}));

/**
 * POST /api/iap/validate-and-credit
 * Validate Apple receipt and credit purchase
 */
router.post('/validate-and-credit', verifyJWT, asyncHandler(async (req, res) => {
  const { receipt, productId, transactionId } = req.body;
  const { practitioner_id, organization_id } = req.user;

  if (!receipt || !productId || !transactionId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: receipt, productId, transactionId'
    });
  }

  const result = await iapService.processPurchase({
    receipt,
    productId,
    transactionId,
    practitionerId: practitioner_id,
    organizationId: organization_id
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
}));

/**
 * GET /api/iap/purchases
 * Get user's IAP purchases
 */
router.get('/purchases', verifyJWT, asyncHandler(async (req, res) => {
  const { practitioner_id, organization_id } = req.user;

  const purchases = await iapService.getUserPurchases(
    organization_id,
    req.query.orgLevel === 'true' ? null : practitioner_id
  );

  res.json({ success: true, purchases });
}));

/**
 * POST /api/iap/apple-webhook
 * Apple Server-to-Server Notifications (for subscription events)
 */
router.post('/apple-webhook', asyncHandler(async (req, res) => {
  const { notification_type, unified_receipt } = req.body;

  logger.info(`[IAP Webhook] Received: ${notification_type}`);

  const latestReceipt = unified_receipt?.latest_receipt_info?.[0];
  if (latestReceipt) {
    await iapService.handleSubscriptionEvent(
      notification_type,
      latestReceipt.original_transaction_id,
      latestReceipt.transaction_id,
      latestReceipt.expires_date_ms ? new Date(parseInt(latestReceipt.expires_date_ms)) : null
    );
  }

  res.sendStatus(200);
}));

module.exports = router;
```

### 4.2 Register routes

In `app.js` or `server.js`:

```javascript
const iapRoutes = require('./routes/iap');
app.use('/api/iap', iapRoutes);
```

---

## Phase 5: Backend - Update Quota Service (Day 4)

### 5.1 Update `orgQuotaService.js`

Add function to include IAP packages in quota calculation:

```javascript
/**
 * Get active packages from BOTH Stripe and Apple IAP
 */
async function getAllActivePackages(organizationId) {
  // Stripe packages (existing)
  const [stripePackages] = await pool.query(`
    SELECT
      'stripe' as source,
      uap.package_id,
      uap.status,
      uap.current_period_end as expires_at,
      ap.monthly_tokens,
      ap.audio_minutes,
      COALESCE(p.features->>'$.encounters_per_day', 0) as encounters_per_day
    FROM user_ai_packages uap
    JOIN ai_addon_packages ap ON uap.package_id = ap.package_id
    LEFT JOIN plans p ON uap.package_id = p.plan
    WHERE uap.organization_id = ?
      AND uap.status IN ('active', 'past_due')
  `, [organizationId]);

  // Apple IAP packages (new)
  const [iapPackages] = await pool.query(`
    SELECT
      'apple_iap' as source,
      uip.product_id as package_id,
      uip.status,
      uip.expires_at,
      uip.ai_tokens_granted as monthly_tokens,
      uip.audio_minutes_granted as audio_minutes,
      uip.encounters_per_day_granted as encounters_per_day
    FROM user_iap_purchases uip
    WHERE uip.organization_id = ?
      AND uip.status = 'active'
      AND (uip.expires_at IS NULL OR uip.expires_at > NOW())
  `, [organizationId]);

  return [...stripePackages, ...iapPackages];
}

/**
 * Calculate total quotas from all sources
 */
async function getTotalPackageQuotas(organizationId) {
  const packages = await getAllActivePackages(organizationId);

  return packages.reduce((totals, pkg) => ({
    tokens: totals.tokens + (parseInt(pkg.monthly_tokens) || 0),
    audioMinutes: totals.audioMinutes + (parseInt(pkg.audio_minutes) || 0),
    encountersPerDay: totals.encountersPerDay + (parseInt(pkg.encounters_per_day) || 0)
  }), { tokens: 0, audioMinutes: 0, encountersPerDay: 0 });
}
```

---

## Phase 6: Backend - Update myplan Endpoint (Day 4)

### 6.1 Create unified packages endpoint

**File:** `routes/myplan2.js`

```javascript
/**
 * GET /myplan2/all-packages
 * Returns packages from both Stripe and Apple IAP
 */
router.get('/all-packages', verifyJWT, asyncHandler(async (req, res) => {
  const { organization_id } = req.user;

  // Stripe packages
  const [stripePackages] = await pool.query(`
    SELECT
      'stripe' as source,
      uap.id,
      uap.package_id,
      uap.status,
      uap.quantity,
      uap.current_period_start,
      uap.current_period_end,
      uap.current_period_amount_cents,
      uap.current_period_currency,
      ap.name,
      ap.monthly_tokens,
      ap.audio_minutes,
      p.features->>'$.encounters_per_day' as encounters_per_day
    FROM user_ai_packages uap
    JOIN ai_addon_packages ap ON uap.package_id = ap.package_id
    LEFT JOIN plans p ON uap.package_id = p.plan
    WHERE uap.organization_id = ?
      AND uap.status IN ('active', 'past_due')
    ORDER BY uap.created_at DESC
  `, [organization_id]);

  // Apple IAP packages
  const [iapPackages] = await pool.query(`
    SELECT
      'apple_iap' as source,
      uip.id,
      uip.product_id as package_id,
      uip.status,
      1 as quantity,
      uip.purchase_date as current_period_start,
      uip.expires_at as current_period_end,
      ip.reference_price_cents as current_period_amount_cents,
      'BRL' as current_period_currency,
      ip.name,
      uip.ai_tokens_granted as monthly_tokens,
      uip.audio_minutes_granted as audio_minutes,
      uip.encounters_per_day_granted as encounters_per_day
    FROM user_iap_purchases uip
    JOIN iap_products ip ON uip.product_id = ip.product_id
    WHERE uip.organization_id = ?
      AND uip.status = 'active'
      AND (uip.expires_at IS NULL OR uip.expires_at > NOW())
    ORDER BY uip.created_at DESC
  `, [organization_id]);

  res.json({
    success: true,
    packages: [...stripePackages, ...iapPackages]
  });
}));
```

---

## Phase 7: Mobile App - Library Setup (Day 5)

### 7.0 CHECK APP COMPATIBILITY FIRST (CRITICAL!)

**Before installing react-native-iap, check app.json:**

```bash
# Check if new architecture is enabled
cat app.json | grep newArchEnabled
```

| newArchEnabled | react-native-iap version |
|----------------|--------------------------|
| `true` | v14.x (latest) |
| `false` | **v12.15.5** (REQUIRED) |

**WARNING:** react-native-iap v13+ requires New Architecture (NitroModules/TurboModules). If your app has `newArchEnabled: false`, you MUST use v12.x or you will get runtime errors:
```
Error: Failed to get NitroModules: The native "NitroModules" Turbo/Native-Module could not be found.
TypeError: RNIap.initConnection is not a function (it is undefined)
```

### 7.1 Install react-native-iap (VERSION SPECIFIC!)

**If newArchEnabled: false (most Expo apps):**
```bash
npm install react-native-iap@12.15.5
```

**If newArchEnabled: true:**
```bash
npx expo install react-native-iap
```

### 7.2 Rebuild native projects

```bash
npx expo prebuild --clean
cd ios && pod install && cd ..
```

**For EAS builds:** Commit changes and run new EAS build. Local prebuild is not enough.

### 7.3 Add environment variable

```bash
# .env (backend)
APPLE_SHARED_SECRET=your_shared_secret_here
```

---

## Phase 8: Mobile App - Types & Store (Day 5-6)

### 8.1 Create types

**File:** `src/types/billing.ts`

```typescript
export interface IAPProduct {
  id: string;
  productId: string;
  name: string;
  description: string;
  productType: 'consumable' | 'non_consumable' | 'subscription';
  aiTokens: number;
  audioMinutes: number;
  encountersPerDay: number;
  durationDays: number;

  // From Apple (populated at runtime)
  localizedPrice?: string;
  price?: number;
  currency?: string;
}

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

export type Purchase = IAPPurchase | StripePurchase;
```

### 8.2 Create billing store

**File:** `src/store/billingStore.ts`

```typescript
import { create } from 'zustand';
import * as RNIap from 'react-native-iap';
import { Platform } from 'react-native';
import { api } from '@services/api';
import { IAPProduct, Purchase } from '@types/billing';

interface BillingState {
  products: IAPProduct[];
  purchases: Purchase[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initIAP: () => Promise<void>;
  loadProducts: () => Promise<void>;
  loadPurchases: () => Promise<void>;
  purchase: (productId: string) => Promise<boolean>;
  restorePurchases: () => Promise<void>;
  cleanup: () => void;
}

const PRODUCT_IDS = [
  'medpro.ai.tokens.1mv2',
  'medpro.encounters.3.monthly',
];

export const useBillingStore = create<BillingState>((set, get) => ({
  products: [],
  purchases: [],
  isLoading: false,
  isInitialized: false,
  error: null,

  initIAP: async () => {
    if (get().isInitialized) return;

    try {
      await RNIap.initConnection();
      set({ isInitialized: true });

      // Setup purchase listener
      RNIap.purchaseUpdatedListener(async (purchase) => {
        if (purchase.transactionReceipt) {
          await get().validateAndCredit(purchase);
        }
      });

      RNIap.purchaseErrorListener((error) => {
        console.error('Purchase error:', error);
        set({ error: error.message });
      });

    } catch (error) {
      console.error('IAP init error:', error);
      set({ error: 'Failed to initialize purchases' });
    }
  },

  loadProducts: async () => {
    set({ isLoading: true });

    try {
      // Get product definitions from our backend
      const response = await api.get('/api/iap/products');
      const backendProducts = response.products;

      // Get prices from Apple
      const appleProducts = await RNIap.getProducts({ skus: PRODUCT_IDS });

      // Merge backend data with Apple prices
      const products = backendProducts.map((bp: any) => {
        const appleProduct = appleProducts.find(ap => ap.productId === bp.product_id);
        return {
          id: bp.id,
          productId: bp.product_id,
          name: bp.name,
          description: bp.description,
          productType: bp.product_type,
          aiTokens: bp.ai_tokens,
          audioMinutes: bp.audio_minutes,
          encountersPerDay: bp.encounters_per_day,
          durationDays: bp.duration_days,
          localizedPrice: appleProduct?.localizedPrice || '',
          price: appleProduct?.price || 0,
          currency: appleProduct?.currency || 'BRL',
        };
      });

      set({ products, isLoading: false });
    } catch (error) {
      console.error('Load products error:', error);
      set({ error: 'Failed to load products', isLoading: false });
    }
  },

  loadPurchases: async () => {
    try {
      const response = await api.get('/myplan2/all-packages');
      set({ purchases: response.packages });
    } catch (error) {
      console.error('Load purchases error:', error);
    }
  },

  purchase: async (productId: string) => {
    set({ isLoading: true, error: null });

    try {
      await RNIap.requestPurchase({ sku: productId });
      return true;
    } catch (error: any) {
      if (error.code !== 'E_USER_CANCELLED') {
        set({ error: error.message });
      }
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  validateAndCredit: async (purchase: RNIap.Purchase) => {
    try {
      const response = await api.post('/api/iap/validate-and-credit', {
        receipt: purchase.transactionReceipt,
        productId: purchase.productId,
        transactionId: purchase.transactionId,
      });

      if (response.success) {
        // Finish transaction with Apple
        await RNIap.finishTransaction({ purchase });
        // Reload purchases
        await get().loadPurchases();
      }
    } catch (error) {
      console.error('Validate purchase error:', error);
    }
  },

  restorePurchases: async () => {
    set({ isLoading: true });

    try {
      const purchases = await RNIap.getAvailablePurchases();

      for (const purchase of purchases) {
        await get().validateAndCredit(purchase);
      }

      await get().loadPurchases();
    } catch (error) {
      console.error('Restore purchases error:', error);
      set({ error: 'Failed to restore purchases' });
    } finally {
      set({ isLoading: false });
    }
  },

  cleanup: () => {
    RNIap.endConnection();
    set({ isInitialized: false });
  },
}));
```

---

## Phase 9: Mobile App - UI Screens (Day 6-7)

### 9.1 Create PackagesScreen

**File:** `src/screens/More/PackagesScreen.tsx`

```typescript
import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet
} from 'react-native';
import { useBillingStore } from '@store/billingStore';
import { IAPProduct } from '@types/billing';
import { colors, spacing } from '@theme';

export const PackagesScreen: React.FC = () => {
  const {
    products,
    purchases,
    isLoading,
    initIAP,
    loadProducts,
    loadPurchases,
    purchase,
    restorePurchases
  } = useBillingStore();

  useEffect(() => {
    const init = async () => {
      await initIAP();
      await loadProducts();
      await loadPurchases();
    };
    init();
  }, []);

  const handlePurchase = async (product: IAPProduct) => {
    Alert.alert(
      'Confirmar Compra',
      `Deseja comprar ${product.name} por ${product.localizedPrice}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Comprar',
          onPress: async () => {
            const success = await purchase(product.productId);
            if (success) {
              Alert.alert('Sucesso', 'Compra realizada com sucesso!');
            }
          }
        },
      ]
    );
  };

  const renderProduct = ({ item }: { item: IAPProduct }) => (
    <View style={styles.productCard}>
      <Text style={styles.productName}>{item.name}</Text>
      <Text style={styles.productDescription}>{item.description}</Text>

      <View style={styles.features}>
        {item.aiTokens > 0 && (
          <Text style={styles.feature}>• {item.aiTokens.toLocaleString()} tokens de IA</Text>
        )}
        {item.audioMinutes > 0 && (
          <Text style={styles.feature}>• {item.audioMinutes} minutos de áudio</Text>
        )}
        {item.encountersPerDay > 0 && (
          <Text style={styles.feature}>• +{item.encountersPerDay} atendimentos/dia</Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.buyButton}
        onPress={() => handlePurchase(item)}
        disabled={isLoading}
      >
        <Text style={styles.buyButtonText}>
          {item.localizedPrice || 'Carregando...'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading && products.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando pacotes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.header}>Pacotes Disponíveis</Text>
        }
        ListFooterComponent={
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={restorePurchases}
          >
            <Text style={styles.restoreText}>Restaurar Compras</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  list: {
    padding: spacing.md,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.lg,
    color: colors.text,
  },
  productCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  productDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  features: {
    marginBottom: spacing.md,
  },
  feature: {
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  buyButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  restoreText: {
    color: colors.primary,
    fontSize: 14,
  },
});
```

### 9.2 Add to navigation

**File:** `src/navigation/MainNavigator.tsx`

```typescript
import { PackagesScreen } from '@screens/More/PackagesScreen';

// In MoreStack:
<Stack.Screen
  name="Packages"
  component={PackagesScreen}
  options={{ title: 'Pacotes' }}
/>
```

### 9.3 Add link from MoreScreen

**File:** `src/screens/More/MoreScreen.tsx`

```typescript
// Add menu item
<TouchableOpacity
  style={styles.menuItem}
  onPress={() => navigation.navigate('Packages')}
>
  <Icon name="cart" size={24} color={colors.primary} />
  <Text style={styles.menuText}>Comprar Pacotes</Text>
  <Icon name="chevron-right" size={20} color={colors.textSecondary} />
</TouchableOpacity>
```

---

## Phase 10: Frontend (Web) - Update myplan.js (Day 8)

### 10.1 Update `displayActivePackages()`

```javascript
function displayActivePackages(packages) {
  // packages now includes both Stripe and Apple IAP

  const tbody = document.getElementById('active-packages-tbody');
  if (!tbody) return;

  tbody.innerHTML = packages.map(pkg => {
    const sourceBadge = pkg.source === 'apple_iap'
      ? '<span class="badge bg-dark ms-2"><i class="fa-brands fa-apple me-1"></i>App Store</span>'
      : '<span class="badge bg-info ms-2"><i class="fa-brands fa-stripe-s me-1"></i>Web</span>';

    return `
      <tr>
        <td>
          <div class="fw-bold">${escapeHtml(pkg.name)} ${sourceBadge}</div>
          <small class="text-muted">${escapeHtml(pkg.package_id)}</small>
        </td>
        <td class="text-end">${formatNumber(pkg.monthly_tokens || 0)}</td>
        <td class="text-center">${pkg.encounters_per_day || '—'}</td>
        <td class="text-center">${formatDateBR(pkg.current_period_start)}</td>
        <td class="text-center">${formatDateBR(pkg.current_period_end)}</td>
        <td class="text-center">${getStatusBadge(pkg.status)}</td>
      </tr>
    `;
  }).join('');
}
```

### 10.2 Update data loading

```javascript
// Change from quota-summary to all-packages endpoint
async function loadActivePackages() {
  const { data } = await authenticatedFetch(`${appState.serverHost}/myplan2/all-packages`);
  if (data?.success) {
    displayActivePackages(data.packages);
  }
}
```

---

## Phase 11: Testing (Day 9-10)

### 11.1 Sandbox Testing

1. Create sandbox tester in App Store Connect
2. Test full purchase flow
3. Test receipt validation
4. Test restore purchases
5. Test subscription renewal (accelerated in sandbox)

### 11.2 Backend Testing

1. Test `/api/iap/validate-and-credit` with sandbox receipts
2. Test duplicate transaction handling (idempotency)
3. Test quota aggregation from both sources
4. Test subscription expiration handling

### 11.3 Edge Cases

- Network failure during purchase
- User cancels purchase
- Duplicate transactions
- Subscription renewal
- Receipt validation failure
- Invalid product ID

---

## Timeline Summary

| Phase | Task | Days |
|-------|------|------|
| 1 | App Store Connect Setup | 1 |
| 2 | Database Schema | 1 |
| 3 | Backend - IAP Service | 2 |
| 4 | Backend - API Routes | 1 |
| 5 | Backend - Update Quota Service | 1 |
| 6 | Backend - Update myplan Endpoint | 0.5 |
| 7 | Mobile App - Library Setup | 0.5 |
| 8 | Mobile App - Types & Store | 1 |
| 9 | Mobile App - UI Screens | 2 |
| 10 | Frontend (Web) - Update myplan | 1 |
| 11 | Testing | 2 |
| **Total** | | **~13 days** |

---

## File Structure Summary

### Backend (medproback)

```
src/
├── services/
│   └── iap/
│       ├── appleValidator.js    # NEW
│       └── iapService.js        # NEW
routes/
├── iap.js                       # NEW
├── myplan2.js                   # UPDATE
```

### Mobile App (medpro-mobile-app)

```
src/
├── types/
│   └── billing.ts               # NEW
├── store/
│   └── billingStore.ts          # NEW
├── screens/
│   └── More/
│       ├── PackagesScreen.tsx   # NEW
│       └── index.ts             # UPDATE
└── navigation/
    └── MainNavigator.tsx        # UPDATE
```

### Frontend (medprofront)

```
practitioner/
└── myplan/
    └── myplan.js                # UPDATE
```

---

## Environment Variables

### Backend (.env)

```
APPLE_SHARED_SECRET=your_app_store_connect_shared_secret
```

---

## Apple Server Notifications (Optional but Recommended)

Configure in App Store Connect to receive subscription events:

1. Go to App Store Connect → Your App → App Information
2. Set Server URL: `https://server.medproapp.dev/api/iap/apple-webhook`
3. Events to receive:
   - `DID_RENEW`
   - `DID_FAIL_TO_RENEW`
   - `CANCEL`
   - `REFUND`
   - `EXPIRED`
