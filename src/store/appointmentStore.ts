import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Service, ServiceCoverageStatus, RecentPatient } from '../types/api';
import { logger } from '@/utils/logger';

export interface AppointmentData {
  // Patient info
  subject: string;              // Patient CPF
  patientName: string;          // Display name
  patientPhone: string;         // For display
  subjectType: 'patient' | 'lead';
  leadId?: string | null;
  
  // Location info
  locationid: string;
  locationName: string;         // Display name
  
  // Basic appointment info
  status: 'booked';
  practitionerid: string;
  
  // Date and time
  startdate: string;            // YYYY-MM-DD
  starttime: string;            // HH:MM:SS
  enddate: string;
  endtime: string;
  duration: number;             // in minutes
  
  // Services
  servicecategory: string;
  servicetype: string;
  appointmenttype: string;
  selected_services: Service[];

  // Payment
  paymentType: string | null;
  servicesCoverageStatus: ServiceCoverageStatus[];
  
  // Notes
  description: string;
  note?: string;
}

interface SelectedService {
  id: string;
  name: string;
  price: number;
  duration?: number | null;
}

interface AppointmentStore {
  // Current appointment data
  appointmentData: AppointmentData;
  
  // Current step (1-6)
  currentStep: number;

  // Recent patients for quick selection
  recentPatients: RecentPatient[];
  
  // Selected services for step 2
  selectedServices: SelectedService[];
  
  // Actions
  setPatient: (identifier: string, name: string, phone: string, subjectType?: 'patient' | 'lead', leadId?: string | null) => void;
  setServices: (category: string, type: string, appointmentType: string, services: Service[], duration: number) => void;
  setPayment: (paymentType: string, coverage: ServiceCoverageStatus[]) => void;
  setLocation: (locationId: string, locationName: string) => void;
  setDateTime: (date: string, time: string, endTime: string) => void;
  setNotes: (description: string, note?: string) => void;
  setPractitioner: (practitionerId: string) => void;
  setCurrentStep: (step: number) => void;
  
  // Service management
  addService: (service: SelectedService) => void;
  removeService: (serviceId: string) => void;
  clearServices: () => void;
  getTotalServicesValue: () => number;
  getTotalDuration: () => number;
  
  // Reset appointment data
  resetAppointment: () => void;
  
  // Recent patients management
  addRecentPatient: (patient: RecentPatient) => Promise<void>;
  loadRecentPatients: () => Promise<void>;
  
  // Validation helpers
  canProceedFromStep: (step: number) => boolean;
  isAppointmentComplete: () => boolean;
}

// Initial empty appointment data
const initialAppointmentData: AppointmentData = {
  subject: '',
  patientName: '',
  patientPhone: '',
  subjectType: 'patient',
  leadId: null,
  locationid: '',
  locationName: '',
  status: 'booked',
  practitionerid: '',
  startdate: '',
  starttime: '',
  enddate: '',
  endtime: '',
  duration: 30,
  servicecategory: '',
  servicetype: '',
  appointmenttype: '',
  selected_services: [],
  paymentType: null,
  servicesCoverageStatus: [],
  description: '',
};

export const useAppointmentStore = create<AppointmentStore>((set, get) => ({
  appointmentData: initialAppointmentData,
  currentStep: 1,
  recentPatients: [],
  selectedServices: [],

  // Set patient information
  setPatient: (identifier: string, name: string, phone: string, subjectType: 'patient' | 'lead' = 'patient', leadId: string | null = null) => {
    const resolvedLeadId = leadId !== null && leadId !== undefined ? String(leadId) : leadId;
    set((state) => ({
      appointmentData: {
        ...state.appointmentData,
        subject: subjectType === 'patient' ? identifier : '',
        patientName: name,
        patientPhone: phone,
        subjectType,
        leadId: resolvedLeadId,
      },
    }));
  },

  // Set services information
  setServices: (category: string, type: string, appointmentType: string, services: Service[], duration: number) => {
    set((state) => ({
      appointmentData: {
        ...state.appointmentData,
        servicecategory: category,
        servicetype: type,
        appointmenttype: appointmentType,
        selected_services: services,
        duration,
      },
    }));
  },

  // Set payment information
  setPayment: (paymentType: string, coverage: ServiceCoverageStatus[]) => {
    set((state) => ({
      appointmentData: {
        ...state.appointmentData,
        paymentType,
        servicesCoverageStatus: coverage,
      },
    }));
  },

  // Set location information
  setLocation: (locationId: string, locationName: string) => {
    set((state) => ({
      appointmentData: {
        ...state.appointmentData,
        locationid: locationId,
        locationName,
      },
    }));
  },

  // Set date and time information
  setDateTime: (date: string, time: string, endTime: string) => {
    set((state) => ({
      appointmentData: {
        ...state.appointmentData,
        startdate: date,
        starttime: time,
        enddate: date, // Usually same as start date
        endtime: endTime,
      },
    }));
  },

  // Set appointment notes
  setNotes: (description: string, note?: string) => {
    set((state) => ({
      appointmentData: {
        ...state.appointmentData,
        description,
        ...(note !== undefined && { note }),
      },
    }));
  },

  // Set practitioner ID
  setPractitioner: (practitionerId: string) => {
    set((state) => ({
      appointmentData: {
        ...state.appointmentData,
        practitionerid: practitionerId,
      },
    }));
  },

  // Set current step
  setCurrentStep: (step: number) => {
    set({ currentStep: step });
  },

  // Add a service to selection
  addService: (service: SelectedService) => {
    set((state) => {
      // Check if service already exists
      const exists = state.selectedServices.find(s => s.id === service.id);
      if (exists) return state;
      
      const updatedServices = [...state.selectedServices, service];
      const totalServiceDuration = updatedServices.reduce((total, s) => total + (s.duration || 0), 0);
      const appointmentDuration = totalServiceDuration > 0 ? roundUpToNext30Min(totalServiceDuration) : 30;
      
      return {
        selectedServices: updatedServices,
        appointmentData: {
          ...state.appointmentData,
          selected_services: updatedServices,
          duration: appointmentDuration,
        },
      };
    });
  },

  // Remove a service from selection
  removeService: (serviceId: string) => {
    set((state) => {
      const updatedServices = state.selectedServices.filter(s => s.id !== serviceId);
      const totalServiceDuration = updatedServices.reduce((total, s) => total + (s.duration || 0), 0);
      const appointmentDuration = totalServiceDuration > 0 ? roundUpToNext30Min(totalServiceDuration) : 30;
      
      return {
        selectedServices: updatedServices,
        appointmentData: {
          ...state.appointmentData,
          selected_services: updatedServices,
          duration: appointmentDuration,
        },
      };
    });
  },

  // Clear all selected services
  clearServices: () => {
    set((state) => ({
      selectedServices: [],
      appointmentData: {
        ...state.appointmentData,
        selected_services: [],
        duration: 30,
      },
    }));
  },

  // Get total value of selected services
  getTotalServicesValue: () => {
    const { selectedServices } = get();
    return selectedServices.reduce((total, service) => total + service.price, 0);
  },

  // Get total duration of selected services
  getTotalDuration: () => {
    const { selectedServices } = get();
    const totalServiceDurationMinutes = selectedServices.reduce((total, service) => total + (service.duration || 0), 0);
    
    if (totalServiceDurationMinutes > 0) {
      return roundUpToNext30Min(totalServiceDurationMinutes);
    }
    
    // Default to 30 minutes if no services selected (matching webapp fallback logic)
    return 30;
  },

  // Reset all appointment data
  resetAppointment: () => {
    set({
      appointmentData: initialAppointmentData,
      currentStep: 1,
      selectedServices: [],
    });
  },

  // Add patient to recent patients list
  addRecentPatient: async (patient: RecentPatient) => {
    try {
      const currentRecent = get().recentPatients;
      const updatedRecent = [
        patient,
        ...currentRecent.filter(p => p.cpf !== patient.cpf)
      ].slice(0, 5); // Keep only last 5

      set({ recentPatients: updatedRecent });
      await AsyncStorage.setItem('recentPatients', JSON.stringify(updatedRecent));
    } catch (error) {
      logger.error('Error saving recent patient:', error);
    }
  },

  // Load recent patients from storage
  loadRecentPatients: async () => {
    try {
      const stored = await AsyncStorage.getItem('recentPatients');
      if (stored) {
        const patients = JSON.parse(stored);
        set({ recentPatients: patients });
      }
    } catch (error) {
      logger.error('Error loading recent patients:', error);
    }
  },

  // Check if user can proceed from a specific step
  canProceedFromStep: (step: number): boolean => {
    const { appointmentData, selectedServices } = get();
    
    switch (step) {
      case 1: // Patient selection
        if (appointmentData.subjectType === 'lead') {
          return !!appointmentData.leadId && !!appointmentData.patientName;
        }
        return !!appointmentData.subject && !!appointmentData.patientName;
      
      case 2: // Services selection
        return selectedServices.length > 0;
      
      case 3: // Payment method
        return !!appointmentData.paymentType;
      
      case 4: // Location selection
        return !!appointmentData.locationid;
      
      case 5: // Date/time selection
        return !!appointmentData.startdate && !!appointmentData.starttime;
      
      case 6: // Review (always can proceed if we get here)
        return true;
      
      default:
        return false;
    }
  },

  // Check if entire appointment is complete
  isAppointmentComplete: (): boolean => {
    const { appointmentData } = get();
    
    return !!(
      ((appointmentData.subjectType === 'lead' && appointmentData.leadId) ||
        (appointmentData.subjectType === 'patient' && appointmentData.subject)) &&
      appointmentData.patientName &&
      appointmentData.practitionerid &&
      appointmentData.locationid &&
      appointmentData.startdate &&
      appointmentData.starttime &&
      appointmentData.servicecategory &&
      appointmentData.servicetype &&
      appointmentData.appointmenttype &&
      appointmentData.paymentType
    );
  },
}));

// Helper function to round duration up to next 30-minute increment (matching webapp logic)
function roundUpToNext30Min(minutes: number): number {
  if (minutes <= 0) return 30;
  const remainder = minutes % 30;
  if (remainder === 0) {
    return minutes;
  }
  return minutes + (30 - remainder);
}
