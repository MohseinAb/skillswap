import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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

// --- Freelancer Screens ---
import FreelancerHomeScreen from './screens/FreelancerHomeScreen';
import FreelancerMessagesScreen from './screens/FreelancerMessagesScreen';
import ServicesScreen from './screens/ServicesScreen';

// --- Shared Screens ---
import ProfileScreen from './screens/ProfileScreen';
import ChatScreen from './screens/ChatScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// 1. Used for Clients (Search, Messages, Bookings, Profile)
function ClientTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { 
          backgroundColor: COLORS.bgBottom, 
          borderTopColor: COLORS.inputBorder, 
          height: 60, 
          paddingBottom: 10, 
          paddingTop: 10 
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

// 2. Used for Freelancers (Home, Messages, Services, Profile)
function FreelancerTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { 
          backgroundColor: COLORS.bgBottom, 
          borderTopColor: COLORS.inputBorder, 
          height: 60, 
          paddingBottom: 10, 
          paddingTop: 10 
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

// 3. Main App Stack
export default function App() {
  return (
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
        
        {/* Deep Screens */}
        <Stack.Screen name="Chat" component={ChatScreen} />
      
      </Stack.Navigator>
    </NavigationContainer>
  );
}