import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View, StyleSheet, Image } from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { DashboardScreen } from '@screens/Dashboard';
import { PatientsScreen } from '@screens/Patients';
import { PatientDashboardScreen } from '@screens/Patients/PatientDashboardScreen';
import { PatientHistoryScreen } from '@screens/Patients/PatientHistoryScreen';
import { EncounterDetailsScreen } from '@screens/Patients/EncounterDetailsScreen';
import { MainTabParamList, DashboardStackParamList, PatientsStackParamList } from '../types/navigation';
import { theme } from '@theme/index';

const Tab = createBottomTabNavigator<MainTabParamList>();
const DashboardStack = createStackNavigator<DashboardStackParamList>();
const PatientsStack = createStackNavigator<PatientsStackParamList>();

// Dual-color Tab Icon Component
interface TabIconProps {
  name: string;
  iconSet?: 'FontAwesome' | 'MaterialIcons';
  focused: boolean;
  color: string;
  size?: number;
  isCustomImage?: boolean;
}

const TabIcon: React.FC<TabIconProps> = ({ 
  name, 
  iconSet = 'FontAwesome', 
  focused, 
  color, 
  size = 24,
  isCustomImage = false
}) => {
  // Special handling for MedPro logo
  if (isCustomImage && name === 'medpro-logo') {
    try {
      return (
        <View style={styles.iconContainer}>
          <Image
            source={require('../assets/medpro-logo.png')}
            style={[
              styles.logoIcon,
              {
                width: size,
                height: size,
                opacity: focused ? 1 : 0.6,
              }
            ]}
            resizeMode="contain"
          />
        </View>
      );
    } catch (error) {
      console.warn('Failed to load MedPro logo, falling back to assistant icon');
      // Fallback to assistant icon if logo fails to load
      const IconComponent = FontAwesome;
      return (
        <View style={styles.iconContainer}>
          <IconComponent
            name="user-circle"
            size={size}
            color={focused ? theme.colors.primary : theme.colors.textSecondary}
          />
        </View>
      );
    }
  }

  const IconComponent = iconSet === 'FontAwesome' ? FontAwesome : MaterialIcons;
  
  return (
    <View style={styles.iconContainer}>
      <IconComponent
        name={name}
        size={size}
        color={focused ? theme.colors.primary : theme.colors.textSecondary}
      />
      <IconComponent
        name={name}
        size={size}
        color={focused ? theme.colors.primaryLight : theme.colors.borderLight}
        style={[styles.iconShadow, { opacity: focused ? 0.3 : 0.2 }]}
      />
    </View>
  );
};

// Placeholder components for other tabs
const ChatScreen: React.FC = () => (
  <Text style={{ flex: 1, textAlign: 'center', marginTop: 100 }}>
    Assistente IA - Em desenvolvimento
  </Text>
);

const NotificationsScreen: React.FC = () => (
  <Text style={{ flex: 1, textAlign: 'center', marginTop: 100 }}>
    Notificações - Em desenvolvimento
  </Text>
);

const ProfileScreen: React.FC = () => (
  <Text style={{ flex: 1, textAlign: 'center', marginTop: 100 }}>
    Perfil - Em desenvolvimento
  </Text>
);

// Dashboard Stack Navigator
const DashboardStackNavigator: React.FC = () => {
  return (
    <DashboardStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <DashboardStack.Screen name="DashboardHome" component={DashboardScreen} />
    </DashboardStack.Navigator>
  );
};

// Patients Stack Navigator
const PatientsStackNavigator: React.FC = () => {
  return (
    <PatientsStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <PatientsStack.Screen name="PatientsList" component={PatientsScreen} />
      <PatientsStack.Screen name="PatientDashboard" component={PatientDashboardScreen} />
      <PatientsStack.Screen name="PatientHistory" component={PatientHistoryScreen} />
      <PatientsStack.Screen name="EncounterDetails" component={EncounterDetailsScreen} />
    </PatientsStack.Navigator>
  );
};

export const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          paddingBottom: 8,
          height: 80,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          paddingBottom: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStackNavigator}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="bar-chart" 
              focused={focused} 
              color={color} 
            />
          ),
        }}
      />
      
      <Tab.Screen
        name="Patients"
        component={PatientsStackNavigator}
        options={{
          title: 'Pacientes',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="users" 
              focused={focused} 
              color={color} 
            />
          ),
        }}
      />
      
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: 'Assistente',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="medpro-logo" 
              focused={focused} 
              color={color}
              isCustomImage={true}
              size={32}
            />
          ),
        }}
      />
      
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Avisos',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="bell" 
              focused={focused} 
              color={color} 
            />
          ),
        }}
      />
      
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="user-md" 
              focused={focused} 
              color={color} 
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShadow: {
    position: 'absolute',
    top: 1,
    left: 1,
  },
  logoIcon: {
    // Logo-specific styling if needed
  },
});