import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen } from '@screens/Auth';
import { AuthStackParamList } from '../types/navigation';
import { theme } from '@theme/index';

const Stack = createStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{
          title: 'Entrar',
        }}
      />
    </Stack.Navigator>
  );
};