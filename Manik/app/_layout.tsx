import React, { useEffect, useCallback } from 'react';
import { Stack, useSegments, Redirect } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

// Keep the native splash screen visible until we manually hide it
SplashScreen.preventAutoHideAsync();

// Separated routing logic to access the useAuth hook
function RootLayoutNav() {
  const { userToken, isLoading, hasOnboarded } = useAuth();
  const segments = useSegments();

  const hideSplashIfReady = useCallback(async () => {
    if (!isLoading) {
      await SplashScreen.hideAsync();
    }
  }, [isLoading]);

  useEffect(() => {
    hideSplashIfReady();
  }, [hideSplashIfReady]);

  // While loading, render nothing — the native splash screen is still
  // covering the app, so there's nothing for the user to see anyway.
  if (isLoading) {
    return null;
  }

  const inTabsGroup = segments[0] === '(tabs)';
  const onOnboardingScreen = segments[0] === 'onboarding';

  // Very first launch ever -> always show onboarding first
  if (!hasOnboarded && !onOnboardingScreen) {
    return <Redirect href="/onboarding" />;
  }

  // Onboarding already completed but somehow still on that route -> move on
  if (hasOnboarded && onOnboardingScreen) {
    return <Redirect href={userToken ? '/(tabs)' : '/login'} />;
  }

  if (hasOnboarded) {
    // Logged in but outside tabs -> redirect to dashboard
    if (userToken && !inTabsGroup) {
      return <Redirect href="/(tabs)" />;
    }

    // Not logged in but trying to view tabs -> redirect to login
    if (!userToken && inTabsGroup) {
      return <Redirect href="/login" />;
    }
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