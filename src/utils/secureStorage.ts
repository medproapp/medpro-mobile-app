/**
 * Secure Storage Adapter for Zustand Persist
 *
 * Uses expo-secure-store to provide encrypted storage on both iOS and Android:
 * - iOS: Uses Keychain Services
 * - Android: Uses Keystore system
 *
 * This replaces AsyncStorage for sensitive data like JWT tokens to prevent
 * unauthorized access on compromised or physically accessed devices.
 */

import * as SecureStore from 'expo-secure-store';
import { StateStorage } from 'zustand/middleware';
import { logger } from '@/utils/logger';

/**
 * Secure storage adapter that implements Zustand's StateStorage interface
 * using expo-secure-store for encrypted storage.
 */
export const secureStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const value = await SecureStore.getItemAsync(name);
      return value;
    } catch (error) {
      // Only log in development mode - avoid exposing errors in production
      if (__DEV__) {
        logger.error('[SecureStorage] Error reading from secure storage:', error);
      }
      return null;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch (error) {
      // Only log in development mode
      if (__DEV__) {
        logger.error('[SecureStorage] Error writing to secure storage:', error);
      }
      throw error;
    }
  },

  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch (error) {
      // Only log in development mode
      if (__DEV__) {
        logger.error('[SecureStorage] Error removing from secure storage:', error);
      }
      throw error;
    }
  },
};
