export const typography = {
  // Headers
  h1: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
  },
  h2: {
    fontSize: 20,
    fontWeight: '500' as const,
    lineHeight: 28,
  },
  h3: {
    fontSize: 18,
    fontWeight: '500' as const,
    lineHeight: 24,
  },
  h4: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 22,
  },

  // Body text
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },

  // Buttons
  button: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 22,
  },
  buttonSmall: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },

  // Special
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
};

export type TypographyKeys = keyof typeof typography;