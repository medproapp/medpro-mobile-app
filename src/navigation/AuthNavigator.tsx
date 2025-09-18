import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import {
  LoginScreen,
  RegisterScreen,
  RegistrationSuccessScreen,
  RegistrationWelcomeScreen,
} from '@screens/Auth';
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
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          title: 'Cadastro',
        }}
      />
      <Stack.Screen
        name="RegistrationSuccess"
        component={RegistrationSuccessScreen}
        options={{
          title: 'Conta criada',
        }}
      />
      <Stack.Screen
        name="RegistrationWelcome"
        component={RegistrationWelcomeScreen}
        options={{
          title: 'Bem-vindo',
        }}
      />
    </Stack.Navigator>
  );
};
