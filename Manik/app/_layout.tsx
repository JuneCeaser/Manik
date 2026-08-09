import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Separated routing logic to access the useAuth hook
function RootLayoutNav() {
  const { userToken, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Stop and wait if AsyncStorage is still being checked
    if (isLoading) return;

    const inTabsGroup = segments[0] === '(tabs)';

    if (userToken && !inTabsGroup) {
      // Logged in but outside tabs -> push to dashboard
      router.replace('/(tabs)');
    } else if (!userToken && inTabsGroup) {
      // Not logged in but trying to view tabs -> push to login
      router.replace('/login');
    }
  }, [userToken, isLoading, segments]);

  // Display a smooth loading screen to prevent the Auth Flash
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </SafeAreaProvider>
  );
}