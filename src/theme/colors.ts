export const colors = {
  // Cores Principais
  primary: '#4A6B7A',
  primaryLight: '#E8EDEF',
  secondary: '#6B8E9A',
  accent: '#4A6B7A',

  // Cores de Status
  success: '#5C8A6B',
  error: '#FF3366',
  warning: '#B8956B',
  info: '#7BA4B5',

  // Cores Neutras
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceVariant: '#F8F9FA',
  
  // Texto
  text: '#1A1A1A',
  textSecondary: '#666666',
  textDisabled: '#999999',
  
  // Bordas
  border: '#CCCCCC',
  borderLight: '#E0E0E0',
  
  // Sombras
  shadow: '#000000',
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  
  // Cores específicas do MedPro
  medpro: {
    blue: '#4A6B7A',
    blueLight: '#E8EDEF',
    green: '#5C8A6B',
    red: '#FF3366',
    yellow: '#B8956B',
    gray: '#666666',
    grayLight: '#F5F5F5',
  },
};

export type ColorKeys = keyof typeof colors;