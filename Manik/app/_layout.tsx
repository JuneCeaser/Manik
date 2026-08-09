import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useSegments, Redirect } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Separated routing logic to access the useAuth hook
function RootLayoutNav() {
  const { userToken, isLoading } = useAuth();
  const segments = useSegments();

  // Display a smooth loading screen to prevent the Auth Flash
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  const inTabsGroup = segments[0] === '(tabs)';

  // Logged in but outside tabs -> redirect to dashboard
  if (userToken && !inTabsGroup) {
    return <Redirect href="/(tabs)" />;
  }

  // Not logged in but trying to view tabs -> redirect to login
  if (!userToken && inTabsGroup) {
    return <Redirect href="/login" />;
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