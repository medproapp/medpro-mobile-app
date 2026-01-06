import { Image, ImageProps } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';
import { logger } from '@/utils/logger';

interface CachedImageProps extends Omit<ImageProps, 'source'> {
  uri: string | null | undefined;
  headers?: Record<string, string>;
  fallbackIcon?: string;
  fallbackIconSize?: number;
  fallbackIconColor?: string;
  /** Optional cache key to force re-fetching when value changes (e.g., timestamp on refresh) */
  cacheKey?: string | number;
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
 * - Automatic fallback on load error
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
  cacheKey,
  style,
  contentFit = 'cover',
  transition = 200,
  ...props
}) => {
  const [imageError, setImageError] = useState(false);

  // Show fallback icon if no URI provided or image failed to load
  if (!uri || imageError) {
    return (
      <View style={[styles.fallback, style]}>
        <FontAwesome name={fallbackIcon} size={fallbackIconSize} color={fallbackIconColor} />
      </View>
    );
  }

  // Build effective URI with cache key appended for cache busting
  // When cacheKey changes, the URL changes, forcing expo-image to re-fetch
  const effectiveUri = cacheKey
    ? `${uri}${uri.includes('?') ? '&' : '?'}_ck=${cacheKey}`
    : uri;

  return (
    <Image
      source={{ uri: effectiveUri, headers }}
      style={style}
      contentFit={contentFit}
      transition={transition}
      cachePolicy="memory-disk"
      onError={(error) => {
        setImageError(true);
      }}
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
