import { logger } from '@/utils/logger';

/**
 * Firebase Analytics service for MedPro Mobile App
 * Tracks screen views and key user events
 */

// Lazy load analytics to prevent crashes if native module isn't available
let analyticsModule: any = null;

const getAnalytics = () => {
  if (analyticsModule === null) {
    try {
      analyticsModule = require('@react-native-firebase/analytics').default;
      logger.info('Firebase Analytics loaded successfully');
    } catch (error) {
      logger.warn('Firebase Analytics not available:', error);
      analyticsModule = false;
    }
  }
  return analyticsModule;
};

// Helper to safely log analytics events
const safeLogEvent = async (eventName: string, params?: Record<string, any>) => {
  try {
    const analytics = getAnalytics();
    if (analytics) {
      await analytics().logEvent(eventName, params);
    }
  } catch (error) {
    logger.warn(`Analytics event failed: ${eventName}`, error);
  }
};

// ============ Screen Tracking ============

export const logScreenView = async (screenName: string, screenClass?: string) => {
  try {
    const analytics = getAnalytics();
    if (analytics) {
      await analytics().logScreenView({
        screen_name: screenName,
        screen_class: screenClass || screenName,
      });
      logger.debug(`[Analytics] Screen view: ${screenName}`);
    } else {
      logger.warn('[Analytics] Screen view skipped - module not available');
    }
  } catch (error) {
    logger.warn('Analytics screen view failed', error);
  }
};

// ============ Authentication Events ============

export const logLogin = async (method: string = 'email') => {
  try {
    const analytics = getAnalytics();
    if (analytics) {
      await analytics().logLogin({ method });
    }
  } catch (error) {
    logger.warn('Analytics login event failed', error);
  }
};

export const logLogout = async () => {
  await safeLogEvent('logout');
};

export const setAnalyticsUserId = async (userId: string | null) => {
  try {
    const analytics = getAnalytics();
    if (analytics) {
      await analytics().setUserId(userId);
    }
  } catch (error) {
    logger.warn('Analytics setUserId failed', error);
  }
};

export const setUserProperties = async (properties: Record<string, string | null>) => {
  try {
    const analytics = getAnalytics();
    if (analytics) {
      for (const [key, value] of Object.entries(properties)) {
        await analytics().setUserProperty(key, value);
      }
    }
  } catch (error) {
    logger.warn('Analytics setUserProperty failed', error);
  }
};

// ============ Appointment Events ============

export const logAppointmentCreated = async (appointmentType?: string) => {
  await safeLogEvent('appointment_created', {
    type: appointmentType || 'unknown',
  });
};

export const logAppointmentViewed = async (appointmentId: string) => {
  await safeLogEvent('appointment_viewed', {
    appointment_id: appointmentId,
  });
};

export const logAppointmentCancelled = async (appointmentId: string) => {
  await safeLogEvent('appointment_cancelled', {
    appointment_id: appointmentId,
  });
};

// ============ Patient Events ============

export const logPatientViewed = async (patientId: string) => {
  await safeLogEvent('patient_viewed', {
    patient_id: patientId,
  });
};

export const logPatientSearched = async (searchTerm: string) => {
  await safeLogEvent('patient_searched', {
    search_term: searchTerm.substring(0, 100), // Limit length for privacy
  });
};

export const logPatientCreated = async () => {
  await safeLogEvent('patient_created');
};

// ============ Messaging Events ============

export const logMessageSent = async () => {
  await safeLogEvent('message_sent');
};

export const logConversationOpened = async (threadId?: string) => {
  await safeLogEvent('conversation_opened', {
    thread_id: threadId || 'unknown',
  });
};

export const logNewConversationStarted = async () => {
  await safeLogEvent('new_conversation_started');
};

// ============ Assistant Events ============

export const logAssistantSessionStarted = async (patientId?: string) => {
  await safeLogEvent('assistant_session_started', {
    has_patient_context: patientId ? 'true' : 'false',
  });
};

export const logAssistantMessageSent = async (hasAudio: boolean = false) => {
  await safeLogEvent('assistant_message_sent', {
    has_audio: hasAudio.toString(),
  });
};

export const logAssistantAudioRecorded = async (durationSeconds?: number) => {
  await safeLogEvent('assistant_audio_recorded', {
    duration_seconds: durationSeconds?.toString() || 'unknown',
  });
};

// ============ Encounter Events ============

export const logEncounterViewed = async (encounterId: string) => {
  await safeLogEvent('encounter_viewed', {
    encounter_id: encounterId,
  });
};

export const logEncounterCreated = async () => {
  await safeLogEvent('encounter_created');
};

// ============ Notification Events ============

export const logNotificationOpened = async (notificationType?: string) => {
  await safeLogEvent('notification_opened', {
    type: notificationType || 'unknown',
  });
};

// ============ Navigation Events ============

export const logTabChanged = async (tabName: string) => {
  await safeLogEvent('tab_changed', {
    tab_name: tabName,
  });
};
