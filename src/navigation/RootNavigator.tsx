import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { Loading } from '@components/common';
import { useAuthStore } from '@store/authStore';
import { RootStackParamList } from '../types/navigation';

const Stack = createStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  console.log('Auth State:', { isAuthenticated, isLoading, user });
  const needsOnboarding = isAuthenticated && user?.role === 'practitioner' && user?.firstLogin;

  return (
    <NavigationContainer>
      <StatusBar style="dark" backgroundColor="transparent" />
      <Stack.Navigator
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
