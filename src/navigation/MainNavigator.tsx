import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { DashboardScreen } from '@screens/Dashboard';
import { EncounterListScreen } from '@screens/Encounters';
import { EncounterViewScreen } from '@screens/Encounters/EncounterViewScreen';
import { PatientsScreen } from '@screens/Patients';
import { PatientDashboardScreen } from '@screens/Patients/PatientDashboardScreen';
import { PatientHistoryScreen } from '@screens/Patients/PatientHistoryScreen';
import { EncounterDetailsScreen } from '@screens/Patients/EncounterDetailsScreen';
import { MoreScreen } from '@screens/More';
import { MessagesListScreen } from '@screens/Messages';
import { AssistantScreen } from '@screens/Assistant';
import { MainTabParamList, DashboardStackParamList, PatientsStackParamList, MessagesStackParamList } from '../types/navigation';
import { theme } from '@theme/index';

const Tab = createBottomTabNavigator<MainTabParamList>();
const DashboardStack = createStackNavigator<DashboardStackParamList>();
const PatientsStack = createStackNavigator<PatientsStackParamList>();
const MessagesStack = createStackNavigator<MessagesStackParamList>();

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
        <View style={[
          styles.iconContainer,
          focused && styles.iconContainerFocused
        ]}>
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
          {focused && <View style={styles.focusedIndicator} />}
        </View>
      );
    } catch (error) {
      console.warn('Failed to load MedPro logo, falling back to assistant icon');
      // Fallback to assistant icon if logo fails to load
      const IconComponent = FontAwesome;
      return (
        <View style={[
          styles.iconContainer,
          focused && styles.iconContainerFocused
        ]}>
          <IconComponent
            name="user-circle"
            size={size}
            color={focused ? theme.colors.primary : theme.colors.textSecondary}
            style={focused && styles.iconFocused}
          />
          {focused && <View style={styles.focusedIndicator} />}
        </View>
      );
    }
  }

  const IconComponent = iconSet === 'FontAwesome' ? FontAwesome : MaterialIcons;
  
  return (
    <View style={[
      styles.iconContainer,
      focused && styles.iconContainerFocused
    ]}>
      <IconComponent
        name={name}
        size={size}
        color={focused ? theme.colors.primary : theme.colors.textSecondary}
        style={focused && styles.iconFocused}
      />
      {focused && <View style={styles.focusedIndicator} />}
    </View>
  );
};

// Assistant screen - now fully implemented
// Using AssistantScreen instead of placeholder

// Messages Stack Navigator
const MessagesStackNavigator: React.FC = () => {
  return (
    <MessagesStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <MessagesStack.Screen name="MessagesList" component={MessagesListScreen} />
    </MessagesStack.Navigator>
  );
};


// Dashboard Stack Navigator
const DashboardStackNavigator: React.FC = () => {
  return (
    <DashboardStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <DashboardStack.Screen name="DashboardHome" component={DashboardScreen} />
      <DashboardStack.Screen name="EncounterList" component={EncounterListScreen} />
      <DashboardStack.Screen name="EncounterView" component={EncounterViewScreen} />
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
          borderTopWidth: 1,
          paddingBottom: 10,
          paddingTop: 10,
          height: 90,
          shadowColor: theme.colors.shadow,
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 8,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          paddingBottom: 2,
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        tabBarButton: (props) => (
          <TouchableOpacity
            {...props}
            style={[
              props.style,
              {
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 8,
              }
            ]}
            activeOpacity={0.7}
          />
        ),
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
        component={AssistantScreen}
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
        name="Messages"
        component={MessagesStackNavigator}
        options={{
          title: 'Mensagens',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="comment" 
              focused={focused} 
              color={color} 
            />
          ),
        }}
      />
      
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          title: 'Mais',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="ellipsis-h" 
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
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 44,
    minHeight: 40,
  },
  iconContainerFocused: {
    backgroundColor: theme.colors.primaryLight + '15', // 15% opacity
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  iconFocused: {
    textShadowColor: theme.colors.primary + '40',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  focusedIndicator: {
    position: 'absolute',
    top: -8,
    width: 24,
    height: 3,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  logoIcon: {
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
});