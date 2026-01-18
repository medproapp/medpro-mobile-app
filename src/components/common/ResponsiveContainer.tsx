import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useDeviceType } from '@/hooks/useDeviceType';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  maxWidth?: number;
  style?: ViewStyle;
  tabletPadding?: number;
}

const DEFAULT_MAX_WIDTH = 700;
const DEFAULT_TABLET_PADDING = 24;

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  maxWidth = DEFAULT_MAX_WIDTH,
  style,
  tabletPadding = DEFAULT_TABLET_PADDING,
}) => {
  const { isTablet } = useDeviceType();

  if (!isTablet) {
    // On phone, render children in a simple View wrapper
    return <View style={style}>{children}</View>;
  }

  // On tablet, center content with max-width
  return (
    <View style={[styles.tabletContainer, style]}>
      <View
        style={[
          styles.tabletContent,
          {
            maxWidth,
            paddingHorizontal: tabletPadding,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tabletContainer: {
    flex: 1,
    alignItems: 'center',
  },
  tabletContent: {
    flex: 1,
    width: '100%',
  },
});

export default ResponsiveContainer;
