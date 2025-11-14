/**
 * Centralized Logger Utility
 *
 * Provides safe logging that automatically filters out logs in production builds
 * to prevent exposure of PHI/PII data in console logs, crash reports, and device logs.
 *
 * SECURITY NOTE: Never log sensitive information such as:
 * - Patient data (CPF, medical records, diagnoses)
 * - Authentication credentials (passwords, tokens)
 * - Personal information (emails, phone numbers, addresses)
 * - API responses containing PHI/PII
 *
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.debug('User action:', action.type); // Only in development
 *   logger.error('API call failed', error);    // Always logged for debugging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  /**
   * Enable/disable logging by level in production
   * By default, only errors are logged in production
   */
  enabledInProduction: {
    debug: boolean;
    info: boolean;
    warn: boolean;
    error: boolean;
  };
}

const defaultConfig: LoggerConfig = {
  enabledInProduction: {
    debug: false,
    info: false,
    warn: false,
    error: true, // Keep errors for crash reporting
  },
};

class Logger {
  private config: LoggerConfig;

  constructor(config: LoggerConfig = defaultConfig) {
    this.config = config;
  }

  /**
   * Debug logs - development only
   * Use for detailed debugging information
   */
  debug(...args: any[]): void {
    if (__DEV__ || this.config.enabledInProduction.debug) {
      console.log('[DEBUG]', ...args);
    }
  }

  /**
   * Info logs - development only by default
   * Use for general informational messages
   */
  info(...args: any[]): void {
    if (__DEV__ || this.config.enabledInProduction.info) {
      console.log('[INFO]', ...args);
    }
  }

  /**
   * Warning logs - development only by default
   * Use for warning messages that don't prevent operation
   */
  warn(...args: any[]): void {
    if (__DEV__ || this.config.enabledInProduction.warn) {
      console.warn('[WARN]', ...args);
    }
  }

  /**
   * Error logs - always logged
   * Use for errors that should be tracked
   *
   * In production, these should be sent to error tracking service (Sentry, etc.)
   */
  error(...args: any[]): void {
    if (__DEV__ || this.config.enabledInProduction.error) {
      console.error('[ERROR]', ...args);

      // TODO: Send to error tracking service in production
      // if (!__DEV__) {
      //   Sentry.captureException(args[0]);
      // }
    }
  }

  /**
   * Sanitize sensitive data before logging
   * Use this to remove PHI/PII from objects before logging
   */
  sanitize(data: any): any {
    if (!data) return data;

    const sensitiveKeys = [
      'password',
      'token',
      'cpf',
      'email',
      'phone',
      'address',
      'patientName',
      'practitionerName',
      'medicalRecord',
      'diagnosis',
      'prescription',
      'ssn',
      'cardNumber',
    ];

    if (typeof data === 'object' && !Array.isArray(data)) {
      const sanitized: any = {};
      for (const key in data) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof data[key] === 'object') {
          sanitized[key] = this.sanitize(data[key]);
        } else {
          sanitized[key] = data[key];
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Log API requests safely (without exposing tokens or sensitive data)
   */
  logApiRequest(method: string, url: string, options?: any): void {
    if (__DEV__) {
      this.debug('[API Request]', {
        method,
        url,
        headers: options?.headers ? {
          ...options.headers,
          Authorization: options.headers.Authorization ? '[REDACTED]' : undefined,
        } : undefined,
      });
    }
  }

  /**
   * Log API responses safely (without exposing sensitive data)
   */
  logApiResponse(url: string, status: number): void {
    if (__DEV__) {
      this.debug('[API Response]', {
        url,
        status,
      });
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for custom configurations
export { Logger, LoggerConfig };
