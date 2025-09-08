import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { DashboardScreen } from '@screens/Dashboard';
import { EncounterListScreen } from '@screens/Encounters';
import { EncounterViewScreen } from '@screens/Encounters/EncounterViewScreen';
import { AppointmentStep1Screen } from '@screens/Appointments/AppointmentStep1Screen';
import { AppointmentStep2Screen } from '@screens/Appointments/AppointmentStep2Screen';
import { AppointmentStep3Screen } from '@screens/Appointments/AppointmentStep3Screen';
import { AppointmentStep4Screen } from '@screens/Appointments/AppointmentStep4Screen';
import { AppointmentStep5Screen } from '@screens/Appointments/AppointmentStep5Screen';
import { AppointmentStep6Screen } from '@screens/Appointments/AppointmentStep6Screen';
import { AppointmentReviewScreen } from '@screens/Appointments/AppointmentReviewScreen';
import { AppointmentDetailsScreen } from '@screens/Appointments/AppointmentDetailsScreen';
import { PatientsScreen } from '@screens/Patients';
import { PatientDashboardScreen } from '@screens/Patients/PatientDashboardScreen';
import { PatientHistoryScreen } from '@screens/Patients/PatientHistoryScreen';
import { EncounterDetailsScreen } from '@screens/Patients/EncounterDetailsScreen';
import { MoreScreen } from '@screens/More';
import { MessagesListScreen, ConversationScreen, NewMessageScreen } from '@screens/Messages';
import { AssistantScreen } from '@screens/Assistant';
import { MainTabParamList, DashboardStackParamList, PatientsStackParamList, MessagesStackParamList } from '../types/navigation';
import { theme } from '@theme/index';
import { useNotifications } from '../hooks/useNotifications';
import { useMessagingUnreadCount } from '@store/messagingStore';

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
  badgeCount?: number;
}

const TabIcon: React.FC<TabIconProps> = ({ 
  name, 
  iconSet = 'FontAwesome', 
  focused, 
  color, 
  size = 24,
  isCustomImage = false,
  badgeCount,
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
      {typeof badgeCount === 'number' && badgeCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {badgeCount > 99 ? '99+' : String(badgeCount)}
          </Text>
        </View>
      )}
      {focused && <View style={styles.focusedIndicator} />}
    </View>
  );
};

// Wrapper for Messages tab icon to attach unread badge
const MessagesTabIcon: React.FC<{ focused: boolean; color: string }> = ({ focused, color }) => {
  const unread = useMessagingUnreadCount();
  return (
    <TabIcon
      name="comment"
      focused={focused}
      color={color}
      badgeCount={unread}
    />
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
      <MessagesStack.Screen name="Conversation" component={ConversationScreen} />
      <MessagesStack.Screen name="NewMessage" component={NewMessageScreen} />
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
      <DashboardStack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} />
      <DashboardStack.Screen name="EncounterList" component={EncounterListScreen} />
      <DashboardStack.Screen name="EncounterView" component={EncounterViewScreen} />
      <DashboardStack.Screen name="AppointmentStep1" component={AppointmentStep1Screen} />
      <DashboardStack.Screen name="AppointmentStep2" component={AppointmentStep2Screen} />
      <DashboardStack.Screen name="AppointmentStep3" component={AppointmentStep3Screen} />
      <DashboardStack.Screen name="AppointmentStep4" component={AppointmentStep4Screen} />
      <DashboardStack.Screen name="AppointmentStep5" component={AppointmentStep5Screen} />
      <DashboardStack.Screen name="AppointmentStep6" component={AppointmentStep6Screen} />
      <DashboardStack.Screen name="AppointmentReview" component={AppointmentReviewScreen} />
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
  // Initialize notifications system
  useNotifications();

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
          title: 'Painél',
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
            <MessagesTabIcon focused={focused} color={color} />
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
  badge: {
    position: 'absolute',
    top: -2,
    right: 2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
