import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { OnboardingStackParamList } from '@/types/navigation';
import { OnboardingScreen } from '@screens/Onboarding';
import { theme } from '@theme/index';

const Stack = createStackNavigator<OnboardingStackParamList>();

export const OnboardingNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Stack.Screen name="OnboardingHome" component={OnboardingScreen} />
    </Stack.Navigator>
  );
};
