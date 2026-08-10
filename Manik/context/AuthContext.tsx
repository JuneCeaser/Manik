import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthContextType = {
  user: any;
  userToken: string | null;
  isLoading: boolean;
  hasOnboarded: boolean;
  loginState: (token: string, userData: any) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  // Set default to true so it loads immediately on startup
  const [isLoading, setIsLoading] = useState(true);

  const bootstrap = async () => {
    try {
      setIsLoading(true);

      const [token, userData, onboarded] = await Promise.all([
        AsyncStorage.getItem('userToken'),
        AsyncStorage.getItem('userInfo'),
        AsyncStorage.getItem('hasOnboarded'),
      ]);

      if (token && userData) {
        setUserToken(token);
        setUser(JSON.parse(userData));
      }

      if (onboarded === 'true') {
        setHasOnboarded(true);
      }
    } catch (e) {
      console.log('Error reading auth state', e);
    } finally {
      // Always stop loading after checking, whether a token exists or not
      setIsLoading(false);
    }
  };

  useEffect(() => {
    bootstrap();
  }, []);

  const loginState = async (token: string, userData: any) => {
    setUserToken(token);
    setUser(userData);
    await AsyncStorage.setItem('userToken', token);
    await AsyncStorage.setItem('userInfo', JSON.stringify(userData));
  };

  const logout = async () => {
    setUserToken(null);
    setUser(null);
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userInfo');
  };

  const completeOnboarding = async () => {
    setHasOnboarded(true);
    await AsyncStorage.setItem('hasOnboarded', 'true');
  };

  return (
    <AuthContext.Provider
      value={{ user, userToken, isLoading, hasOnboarded, loginState, logout, completeOnboarding }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};