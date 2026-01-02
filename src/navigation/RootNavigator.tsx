import React, { useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { Loading } from '@components/common';
import { useAuthStore } from '@store/authStore';
import { RootStackParamList } from '../types/navigation';
import { logger } from '@/utils/logger';
import { logScreenView } from '@services/analytics';

const Stack = createStackNavigator<RootStackParamList, 'RootNavigator'>();

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  // logger.debug('Auth State:', { isAuthenticated, isLoading, user });
  const needsOnboarding = isAuthenticated && user?.role === 'practitioner' && user?.firstLogin;

  // Analytics: screen tracking refs
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const routeNameRef = useRef<string | undefined>(undefined);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
      }}
      onStateChange={async () => {
        const previousRouteName = routeNameRef.current;
        const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;

        if (previousRouteName !== currentRouteName && currentRouteName) {
          // Track screen view in Firebase Analytics
          await logScreenView(currentRouteName);
        }
        routeNameRef.current = currentRouteName;
      }}>
      <StatusBar style="dark" backgroundColor="transparent" />
      <Stack.Navigator
        id="RootNavigator"
        screenOptions={{
          headerShown: false,
          presentation: 'card',
        }}
      >
        {!isAuthenticated && (
          <Stack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{
              animationTypeForReplace: 'pop',
            }}
          />
        )}

        {isAuthenticated && needsOnboarding && (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingNavigator}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
        )}

        {isAuthenticated && !needsOnboarding && (
          <Stack.Screen
            name="Main"
            component={MainNavigator}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
        )}
      </Stack.Navigator>
      {isLoading && (
        <Loading text="Verificando autenticação..." overlay />
      )}
    </NavigationContainer>
  );
};
