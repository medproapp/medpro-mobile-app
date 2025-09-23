import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { OnboardingStackParamList } from '@/types/navigation';
import { OnboardingScreen } from '@screens/Onboarding';
import { theme } from '@theme/index';

const Stack = createStackNavigator<OnboardingStackParamList, 'OnboardingNavigator'>();

export const OnboardingNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      id="OnboardingNavigator"
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
