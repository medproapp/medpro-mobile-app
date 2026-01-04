import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../../theme';

type IconSet = 'FontAwesome' | 'MaterialIcons' | 'Feather';

interface DuotoneIconProps {
  name: string;
  size?: number;
  primaryColor?: string;
  secondaryColor?: string;
  iconSet?: IconSet;
  style?: ViewStyle;
  /** Primary layer opacity (0-1) */
  primaryOpacity?: number;
  /** Secondary layer opacity (0-1) */
  secondaryOpacity?: number;
  /** Offset for the secondary layer to create depth */
  shadowOffset?: number;
}

const getIconComponent = (iconSet: IconSet) => {
  switch (iconSet) {
    case 'MaterialIcons':
      return MaterialIcons;
    case 'Feather':
      return Feather;
    default:
      return FontAwesome;
  }
};

export const DuotoneIcon: React.FC<DuotoneIconProps> = ({
  name,
  size = 24,
  primaryColor = theme.colors.primary,
  secondaryColor,
  iconSet = 'FontAwesome',
  style,
  primaryOpacity = 1,
  secondaryOpacity = 0.3,
  shadowOffset = 0,
}) => {
  const IconComponent = getIconComponent(iconSet);

  // Generate secondary color if not provided (lighter version of primary)
  const computedSecondaryColor = secondaryColor || primaryColor + '40';

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* Shadow/depth layer */}
      {shadowOffset > 0 && (
        <IconComponent
          name={name}
          size={size}
          color={primaryColor}
          style={[
            styles.icon,
            {
              opacity: 0.15,
              transform: [{ translateX: shadowOffset }, { translateY: shadowOffset }],
            },
          ]}
        />
      )}
      {/* Secondary/background layer */}
      <IconComponent
        name={name}
        size={size}
        color={computedSecondaryColor}
        style={[styles.icon, { opacity: secondaryOpacity }]}
      />
      {/* Primary/foreground layer */}
      <IconComponent
        name={name}
        size={size}
        color={primaryColor}
        style={[styles.icon, { opacity: primaryOpacity }]}
      />
    </View>
  );
};

/** Simple single-color icon wrapper for consistency */
export const Icon: React.FC<{
  name: string;
  size?: number;
  color?: string;
  iconSet?: IconSet;
  style?: ViewStyle;
}> = ({ name, size = 24, color = theme.colors.text, iconSet = 'FontAwesome', style }) => {
  const IconComponent = getIconComponent(iconSet);
  return <IconComponent name={name} size={size} color={color} style={style} />;
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    position: 'absolute',
  },
});