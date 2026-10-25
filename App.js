import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { COLORS } from './styles';

// --- Auth Screens ---
import GetStartedScreen from './screens/GetStartedScreen';
import LoginScreen from './screens/LoginScreen';
import AccountTypeScreen from './screens/AccountTypeScreen';
import RegFreelancerScreen from './screens/RegFreelancerScreen';
import RegClientScreen from './screens/RegClientScreen';

// --- Client Screens ---
import SearchScreen from './screens/SearchScreen';
import MessagesScreen from './screens/MessagesScreen';
import BookingsScreen from './screens/BookingsScreen';
import ClientBookingDetailScreen from './screens/ClientBookingDetailScreen';
import FreelancerPortfolioScreen from './screens/FreelancerPortfolioScreen';

// --- Freelancer Screens ---
import FreelancerHomeScreen from './screens/FreelancerHomeScreen';
import FreelancerMessagesScreen from './screens/FreelancerMessagesScreen';
import ServicesScreen from './screens/ServicesScreen';
import CreateServiceScreen from './screens/CreateServiceScreen';
import ServiceBookingsScreen from './screens/ServiceBookingsScreen';
import BookingProgressScreen from './screens/BookingProgressScreen';

// --- Shared Screens ---
import ProfileScreen from './screens/ProfileScreen';
import ChatScreen from './screens/ChatScreen';

import AdminDashboardScreen from './screens/AdminDashboardScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function ClientTabNavigator() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 20);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { 
          backgroundColor: COLORS.bgBottom, 
          borderTopColor: COLORS.inputBorder, 
          height: 60 + bottomPadding, 
          paddingBottom: bottomPadding, 
          paddingTop: 8 
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarIcon: ({ color }) => {
          let iconName = 
            route.name === 'Search' ? 'search' : 
            route.name === 'Messages' ? 'mail' : 
            route.name === 'Bookings' ? 'calendar' : 'user';
          return <Feather name={iconName} size={20} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function FreelancerTabNavigator() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 20);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { 
          backgroundColor: COLORS.bgBottom, 
          borderTopColor: COLORS.inputBorder, 
          height: 60 + bottomPadding, 
          paddingBottom: bottomPadding, 
          paddingTop: 8 
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarIcon: ({ color }) => {
          let iconName = 
            route.name === 'Home' ? 'grid' : 
            route.name === 'Messages' ? 'mail' : 
            route.name === 'Services' ? 'file-text' : 'user';
          return <Feather name={iconName} size={20} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={FreelancerHomeScreen} />
      <Tab.Screen name="Messages" component={FreelancerMessagesScreen} />
      <Tab.Screen name="Services" component={ServicesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          
          {/* Auth Stack */}
          <Stack.Screen name="GetStarted" component={GetStartedScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="AccountType" component={AccountTypeScreen} />
          <Stack.Screen name="RegFreelancer" component={RegFreelancerScreen} />
          <Stack.Screen name="RegClient" component={RegClientScreen} />
          
          {/* Main App (Tabs based on User Role) */}
          <Stack.Screen name="ClientTabs" component={ClientTabNavigator} />
          <Stack.Screen name="FreelancerTabs" component={FreelancerTabNavigator} />
          
          {/* Freelancer Service & Progress Screens */}
          <Stack.Screen name="CreateService" component={CreateServiceScreen} />
          <Stack.Screen name="ServiceBookings" component={ServiceBookingsScreen} />
          <Stack.Screen name="BookingProgress" component={BookingProgressScreen} />

          {/* Client Booking Detail & Freelancer Portfolio Screens */}
          <Stack.Screen name="ClientBookingDetail" component={ClientBookingDetailScreen} />
          <Stack.Screen name="FreelancerPortfolio" component={FreelancerPortfolioScreen} />

          {/* Shared Deep Screens */}
          <Stack.Screen name="Chat" component={ChatScreen} />

          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}