import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { COLORS } from './styles';
import { navigationRef, configureNotifications, useNotificationTapHandler, usePushRegistration } from './services/notifications';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { resolveStartRoute } from './services/session';

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

// How notifications look while the app is open (once, at startup).
configureNotifications();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function ClientTabNavigator() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 20);
  usePushRegistration(); // ask for permission and save this phone's push token after login

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
  usePushRegistration(); // ask for permission and save this phone's push token after login

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

// Works out where the app should open. Someone who is still signed in from last time goes straight
// to their home screen; everyone else (or anyone who may no longer sign in) sees the welcome screen.
// Returns null while it is still deciding.
function useStartRoute() {
  const [route, setRoute] = useState(null);

  useEffect(() => {
    let finished = false;
    let unsubscribe = null;
    const finish = (next) => {
      if (!finished) {
        finished = true;
        setRoute(next);
      }
    };

    // Only the first answer matters; after that the screens navigate by themselves (login, logout).
    unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (unsubscribe) unsubscribe();
        finish(
          await resolveStartRoute({
            user,
            loadProfile: async (uid) => {
              const snap = await getDoc(doc(db, 'users', uid));
              return snap.exists() ? snap.data() : {};
            },
            reloadUser: () => user.reload(),
            isEmailVerified: () => !!(auth.currentUser || user).emailVerified,
            signOutUser: () => signOut(auth),
          })
        );
      },
      () => finish('GetStarted')
    );

    // Never leave someone staring at a spinner because of a slow connection.
    const timer = setTimeout(() => finish('GetStarted'), 8000);
    return () => {
      finished = true;
      if (unsubscribe) unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  return route;
}

export default function App() {
  useNotificationTapHandler(); // open the right screen when a notification is tapped
  const startRoute = useStartRoute();

  if (startRoute === null) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bgBottom, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator initialRouteName={startRoute} screenOptions={{ headerShown: false, animation: 'fade' }}>
          
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