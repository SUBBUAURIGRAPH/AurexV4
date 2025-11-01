/**
 * Hermes Trading Platform Mobile App - Main Application Component
 * Handles app initialization, authentication, and routing
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAppDispatch, useAppSelector, store } from './store';
import { validateSession } from './store/authSlice';
import { setAppReady } from './store/appSlice';

// Screens (to be implemented)
// import LoginScreen from './screens/auth/LoginScreen';
// import BiometricLoginScreen from './screens/auth/BiometricLoginScreen';
// import DashboardScreen from './screens/dashboard/DashboardScreen';
// import ChartsScreen from './screens/charts/ChartsScreen';
// import OrdersScreen from './screens/orders/OrdersScreen';
// import PositionsScreen from './screens/positions/PositionsScreen';
// import SettingsScreen from './screens/settings/SettingsScreen';

// Navigation types
type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Splash: undefined;
};

type MainTabParamList = {
  Dashboard: undefined;
  Charts: undefined;
  Orders: undefined;
  Positions: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Splash Screen Component
 * Shown while app is initializing
 */
function SplashScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0066cc" />
    </View>
  );
}

/**
 * Auth Stack Navigator
 * Screens shown when user is not authenticated
 */
function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#1f2937' }
      }}
    >
      {/* <Stack.Screen name="Auth" component={LoginScreen} /> */}
    </Stack.Navigator>
  );
}

/**
 * Main Tab Navigator
 * Screens shown when user is authenticated
 */
function MainStack() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarStyle: {
          backgroundColor: '#111827',
          borderTopColor: '#374151',
          borderTopWidth: 1
        },
        tabBarActiveTintColor: '#0066cc',
        tabBarInactiveTintColor: '#6b7280',
        headerStyle: {
          backgroundColor: '#111827',
          borderBottomColor: '#374151',
          borderBottomWidth: 1
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '600'
        }
      }}
    >
      {/* <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Icon name="home" color={color} />
        }}
      />
      <Tab.Screen
        name="Charts"
        component={ChartsScreen}
        options={{
          title: 'Charts',
          tabBarIcon: ({ color }) => <Icon name="chart" color={color} />
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) => <Icon name="list" color={color} />
        }}
      />
      <Tab.Screen
        name="Positions"
        component={PositionsScreen}
        options={{
          title: 'Positions',
          tabBarIcon: ({ color }) => <Icon name="briefcase" color={color} />
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Icon name="settings" color={color} />
        }}
      /> */}
    </Tab.Navigator>
  );
}

/**
 * App Container Component
 * Handles authentication state and conditional rendering
 */
function AppContainer() {
  const dispatch = useAppDispatch();
  const { isAppReady } = useAppSelector(state => state.app);
  const { isAuthenticated } = useAppSelector(state => state.auth);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    async function initializeApp() {
      try {
        // Validate existing session
        const result = await dispatch(validateSession());

        // Mark app as ready
        dispatch(setAppReady(true));
      } catch (error) {
        console.error('App initialization error:', error);
        dispatch(setAppReady(true));
      } finally {
        setIsInitializing(false);
      }
    }

    initializeApp();
  }, [dispatch]);

  if (isInitializing || !isAppReady) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false
        }}
      >
        {isAuthenticated ? (
          <Stack.Screen
            name="Main"
            component={MainStack}
            options={{
              animationEnabled: false
            }}
          />
        ) : (
          <Stack.Screen
            name="Auth"
            component={AuthStack}
            options={{
              animationEnabled: false
            }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/**
 * Root App Component
 * Wraps app with Redux provider
 */
export default function App() {
  return (
    <Provider store={store}>
      <AppContainer />
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1f2937'
  }
});
