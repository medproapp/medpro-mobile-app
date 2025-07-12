import React from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  ViewStyle,
  Image,
} from 'react-native';
import { theme } from '@theme/index';

export interface LoadingProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  overlay?: boolean;
  style?: ViewStyle;
  showLogo?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'large',
  color = theme.colors.primary,
  text,
  overlay = false,
  style,
  showLogo = true,
}) => {
  const containerStyle = [
    styles.container,
    overlay && styles.overlay,
    style,
  ];

  return (
    <View style={containerStyle}>
      {showLogo && (
        <Image 
          source={require('../../../assets/medpro-logo.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      )}
      <ActivityIndicator size={size} color={color} style={showLogo ? styles.spinner : undefined} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
};

// Skeleton Loading Component
export interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = theme.borderRadius.small,
  style,
}) => {
  const skeletonStyle = [
    styles.skeleton,
    {
      width: width as any,
      height,
      borderRadius,
    },
    style,
  ];

  return <View style={skeletonStyle} />;
};

// Loading Card Component
export interface LoadingCardProps {
  showAvatar?: boolean;
  lines?: number;
  style?: ViewStyle;
}

export const LoadingCard: React.FC<LoadingCardProps> = ({
  showAvatar = false,
  lines = 3,
  style,
}) => {
  return (
    <View style={[styles.loadingCard, style]}>
      <View style={styles.row}>
        {showAvatar && (
          <Skeleton
            width={40}
            height={40}
            borderRadius={theme.borderRadius.round}
            style={styles.avatar}
          />
        )}
        <View style={styles.content}>
          <Skeleton width="70%" height={16} style={styles.line} />
          <Skeleton width="50%" height={14} style={styles.line} />
          {Array.from({ length: lines - 2 }).map((_, index) => (
            <Skeleton
              key={index}
              width={`${Math.random() * 40 + 40}%`}
              height={12}
              style={styles.line}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.overlay,
    zIndex: 999,
  },
  
  logo: {
    width: 100,
    height: 100,
    marginBottom: 24,
  },
  
  spinner: {
    marginVertical: 16,
  },
  
  text: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  
  skeleton: {
    backgroundColor: theme.colors.borderLight,
    opacity: 0.7,
  },
  
  loadingCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.large,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    ...theme.shadows.small,
  },
  
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  
  avatar: {
    marginRight: theme.spacing.md,
  },
  
  content: {
    flex: 1,
  },
  
  line: {
    marginBottom: theme.spacing.sm,
  },
});