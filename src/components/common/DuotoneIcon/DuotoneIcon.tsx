import React from 'react';
import { View, StyleSheet } from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { theme } from '../../../theme';

interface DuotoneIconProps {
  name: string;
  size?: number;
  primaryColor?: string;
  secondaryColor?: string;
  iconSet?: 'FontAwesome' | 'MaterialIcons';
  style?: any;
}

export const DuotoneIcon: React.FC<DuotoneIconProps> = ({
  name,
  size = 24,
  primaryColor = theme.colors.primary,
  secondaryColor = theme.colors.primaryLight,
  iconSet = 'FontAwesome',
  style
}) => {
  const IconComponent = iconSet === 'FontAwesome' ? FontAwesome : MaterialIcons;

  return (
    <View style={[styles.container, style]}>
      {/* Background layer (lighter/secondary color) */}
      <IconComponent
        name={name}
        size={size}
        color={secondaryColor}
        style={styles.backgroundIcon}
      />
      {/* Foreground layer (primary color with lower opacity) */}
      <IconComponent
        name={name}
        size={size}
        color={primaryColor}
        style={[styles.foregroundIcon, { opacity: 0.7 }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundIcon: {
    position: 'absolute',
  },
  foregroundIcon: {
    position: 'absolute',
  },
});