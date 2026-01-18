import { useState, useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

interface DeviceType {
  isTablet: boolean;
  isPhone: boolean;
  screenWidth: number;
  screenHeight: number;
}

const TABLET_MIN_WIDTH = 768;

export const useDeviceType = (): DeviceType => {
  const { width, height } = useWindowDimensions();

  // Use Platform.isPad for iOS, or width check for Android tablets
  const isTablet = Platform.OS === 'ios'
    ? Platform.isPad === true
    : width >= TABLET_MIN_WIDTH;

  return {
    isTablet,
    isPhone: !isTablet,
    screenWidth: width,
    screenHeight: height,
  };
};

export default useDeviceType;
