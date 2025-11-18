import React from 'react';
import { createBottomTabNavigator, type BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View, StyleSheet, Image } from 'react-native';
import { getFocusedRouteNameFromRoute, RouteProp } from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { DashboardScreen } from '@screens/Dashboard';
import { NotificationsScreen } from '@screens/Notifications';
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
import { AppointmentListScreen } from '@screens/Appointments/AppointmentListScreen';
import { AppointmentCalendarScreen } from '@screens/Appointments/AppointmentCalendarScreen';
import { FormResponseScreen } from '@screens/Appointments/FormResponseScreen';
import { PatientsScreen } from '@screens/Patients';
import { PatientDashboardScreen } from '@screens/Patients/PatientDashboardScreen';
import { PatientHistoryScreen } from '@screens/Patients/PatientHistoryScreen';
import { ClinicalRecordsScreen } from '@screens/Patients/ClinicalRecordsScreen';
import { PrescriptionsScreen } from '@screens/Patients/PrescriptionsScreen';
import { DiagnosticsScreen } from '@screens/Patients/DiagnosticsScreen';
import { ImagesScreen } from '@screens/Patients/ImagesScreen';
import { AttachmentsScreen } from '@screens/Patients/AttachmentsScreen';
import { RecordingsScreen } from '@screens/Patients/RecordingsScreen';
import { EncounterDetailsScreen } from '@screens/Patients/EncounterDetailsScreen';
import { ClinicalRecordDetailsScreen } from '@screens/Patients/ClinicalRecordDetailsScreen';
import { MoreScreen, MyProfileScreen, AboutScreen, HelpSupportScreen } from '@screens/More';
import { MessagesListScreen, ConversationScreen, NewMessageScreen } from '@screens/Messages';
import { AssistantScreen } from '@screens/Assistant';
import { MainTabParamList, DashboardStackParamList, PatientsStackParamList, MessagesStackParamList, MoreStackParamList } from '../types/navigation';
import { theme } from '@theme/index';
import { useNotifications } from '../hooks/useNotifications';
import { useMessagingUnreadCount } from '@store/messagingStore';

const Tab = createBottomTabNavigator<MainTabParamList, 'MainTabNavigator'>();
const DashboardStack = createStackNavigator<DashboardStackParamList, 'DashboardStackNavigator'>();
const PatientsStack = createStackNavigator<PatientsStackParamList, 'PatientsStackNavigator'>();
const MessagesStack = createStackNavigator<MessagesStackParamList, 'MessagesStackNavigator'>();
const MoreStack = createStackNavigator<MoreStackParamList, 'MoreStackNavigator'>();

const TAB_BAR_BASE_STYLE = {
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
};

const getDashboardTabBarStyle = (route: RouteProp<MainTabParamList, 'Dashboard'>): typeof TAB_BAR_BASE_STYLE & { display?: 'none' } => {
  const routeName = getFocusedRouteNameFromRoute(route) ?? 'DashboardHome';
  if (['Notifications', 'AppointmentList', 'AppointmentCalendar', 'AppointmentDetails', 'FormResponse'].includes(routeName)) {
    return { ...TAB_BAR_BASE_STYLE, display: 'none' };
  }
  return TAB_BAR_BASE_STYLE;
};

const getPatientsTabBarStyle = (route: RouteProp<MainTabParamList, 'Patients'>): typeof TAB_BAR_BASE_STYLE & { display?: 'none' } => {
  const routeName = getFocusedRouteNameFromRoute(route) ?? 'PatientsList';
  if (routeName === 'PatientDashboard' || routeName === 'PatientHistory' || routeName === 'ClinicalRecords' || routeName === 'Prescriptions' || routeName === 'Diagnostics' || routeName === 'Images' || routeName === 'Attachments' || routeName === 'Recordings' || routeName === 'EncounterDetails' || routeName === 'ClinicalRecordDetails') {
    return { ...TAB_BAR_BASE_STYLE, display: 'none' };
  }
  return TAB_BAR_BASE_STYLE;
};

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

const TabBarButton = React.forwardRef<
  React.ElementRef<typeof PlatformPressable>,
  BottomTabBarButtonProps
>(({ style, children, ...rest }, ref) => {
  return (
    <PlatformPressable
      ref={ref}
      {...rest}
      pressOpacity={0.7}
      style={[
        style,
        {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 8,
        },
      ]}
    >
      {children}
    </PlatformPressable>
  );
});

TabBarButton.displayName = 'TabBarButton';

// Messages Stack Navigator
const MessagesStackNavigator: React.FC = () => {
  return (
    <MessagesStack.Navigator
      id="MessagesStackNavigator"
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
      id="DashboardStackNavigator"
      screenOptions={{
        headerShown: false,
      }}
    >
      <DashboardStack.Screen name="DashboardHome" component={DashboardScreen} />
      <DashboardStack.Screen name="AppointmentList" component={AppointmentListScreen} />
      <DashboardStack.Screen name="AppointmentCalendar" component={AppointmentCalendarScreen} />
      <DashboardStack.Screen name="Notifications" component={NotificationsScreen} />
      <DashboardStack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} />
      <DashboardStack.Screen name="FormResponse" component={FormResponseScreen} />
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
      id="PatientsStackNavigator"
      screenOptions={{
        headerShown: false,
      }}
    >
      <PatientsStack.Screen name="PatientsList" component={PatientsScreen} />
      <PatientsStack.Screen name="PatientDashboard" component={PatientDashboardScreen} />
      <PatientsStack.Screen name="PatientHistory" component={PatientHistoryScreen} />
      <PatientsStack.Screen name="ClinicalRecords" component={ClinicalRecordsScreen} />
      <PatientsStack.Screen name="Prescriptions" component={PrescriptionsScreen} />
      <PatientsStack.Screen name="Diagnostics" component={DiagnosticsScreen} />
      <PatientsStack.Screen name="Images" component={ImagesScreen} />
      <PatientsStack.Screen name="Attachments" component={AttachmentsScreen} />
      <PatientsStack.Screen name="Recordings" component={RecordingsScreen} />
      <PatientsStack.Screen name="EncounterDetails" component={EncounterDetailsScreen} />
      <PatientsStack.Screen name="ClinicalRecordDetails" component={ClinicalRecordDetailsScreen} />
    </PatientsStack.Navigator>
  );
};

// More Stack Navigator
const MoreStackNavigator: React.FC = () => {
  return (
    <MoreStack.Navigator
      id="MoreStackNavigator"
      screenOptions={{
        headerShown: false,
      }}
    >
      <MoreStack.Screen name="MoreHome" component={MoreScreen} />
      <MoreStack.Screen name="MyProfile" component={MyProfileScreen} />
      <MoreStack.Screen name="About" component={AboutScreen} />
      <MoreStack.Screen name="HelpSupport" component={HelpSupportScreen} />
    </MoreStack.Navigator>
  );
};

export const MainNavigator: React.FC = () => {
  // Initialize notifications system
  useNotifications();

  return (
    <Tab.Navigator
      id="MainTabNavigator"
      screenOptions={{
        headerShown: false,
        tabBarStyle: TAB_BAR_BASE_STYLE,
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
        tabBarButton: (props) => <TabBarButton {...props} />,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStackNavigator}
        options={({ route }) => ({
          title: 'Painél',
          tabBarStyle: getDashboardTabBarStyle(route),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="bar-chart" 
              focused={focused} 
              color={color} 
            />
          ),
        })}
      />
      
      <Tab.Screen
        name="Patients"
        component={PatientsStackNavigator}
        options={({ route }) => ({
          title: 'Pacientes',
          tabBarStyle: getPatientsTabBarStyle(route),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="users" 
              focused={focused} 
              color={color} 
            />
          ),
        })}
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
        component={MoreStackNavigator}
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
