import React, { useEffect, useCallback } from 'react';
import { Stack, useSegments, Redirect } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext'; // <-- ADDED
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

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

  if (isLoading) {
    return null;
  }

  const inTabsGroup = segments[0] === '(tabs)';
  const inGemGroup = segments[0] === 'gem'; 
  const onOnboardingScreen = segments[0] === 'onboarding';
  const isAuthRoute = segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'forgot-password';

  if (!hasOnboarded && !onOnboardingScreen) {
    return <Redirect href="/onboarding" />;
  }

  if (hasOnboarded && onOnboardingScreen) {
    return <Redirect href={userToken ? '/(tabs)' : '/login'} />;
  }

  if (hasOnboarded) {
    if (userToken && isAuthRoute) {
      return <Redirect href="/(tabs)" />;
    }
    if (!userToken && (inTabsGroup || inGemGroup)) {
      return <Redirect href="/login" />;
    }
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider> 
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}