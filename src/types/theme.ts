import { Theme } from '@theme/index';

declare module 'react-native' {
  interface DefaultTheme extends Theme {}
}

export type ThemeType = Theme;