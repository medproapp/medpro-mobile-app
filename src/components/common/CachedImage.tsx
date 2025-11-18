import { Image, ImageProps } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';

interface CachedImageProps extends Omit<ImageProps, 'source'> {
  uri: string | null | undefined;
  headers?: Record<string, string>;
  fallbackIcon?: string;
  fallbackIconSize?: number;
  fallbackIconColor?: string;
}

/**
 * CachedImage Component
 *
 * Wrapper around expo-image with built-in disk and memory caching.
 * Automatically caches images to reduce network requests and improve performance.
 *
 * Features:
 * - Disk + memory caching (persistent between sessions)
 * - Automatic LRU cache eviction
 * - Progressive loading with transitions
 * - Fallback icon for missing images
 *
 * Usage:
 * <CachedImage
 *   uri={photoUrl}
 *   style={styles.avatar}
 *   fallbackIcon="user"
 * />
 */
export const CachedImage: React.FC<CachedImageProps> = ({
  uri,
  headers,
  fallbackIcon = 'user',
  fallbackIconSize = 24,
  fallbackIconColor = theme.colors.white,
  style,
  contentFit = 'cover',
  transition = 200,
  ...props
}) => {
  // Show fallback icon if no URI provided
  if (!uri) {
    return (
      <View style={[styles.fallback, style]}>
        <FontAwesome name={fallbackIcon} size={fallbackIconSize} color={fallbackIconColor} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri, headers }}
      style={style}
      contentFit={contentFit}
      transition={transition}
      cachePolicy="memory-disk"
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
});
