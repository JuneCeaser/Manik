import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthContextType = {
  user: any;
  userToken: string | null;
  isLoading: boolean;
  hasOnboarded: boolean;
  preferredCurrency: 'LKR' | 'USD';
  exchangeRate: number;
  loginState: (token: string, userData: any) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  updatePreferredCurrency: (currency: 'LKR' | 'USD') => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Global Currency State
  const [preferredCurrency, setPreferredCurrency] = useState<'LKR' | 'USD'>('LKR');
  const [exchangeRate, setExchangeRate] = useState<number>(334.43); 

  // Fetch Live Rate on App Start
  const fetchLiveExchangeRate = async () => {
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await res.json();
      if (data && data.rates && data.rates.LKR) {
        setExchangeRate(data.rates.LKR);
      }
    } catch (error) {
      console.warn('Could not fetch live rate, using fallback.', error);
    }
  };

  const bootstrap = async () => {
    try {
      setIsLoading(true);

      // Fetch the exchange rate in the background
      fetchLiveExchangeRate();

      const [token, userData, onboarded, storedCurrency] = await Promise.all([
        AsyncStorage.getItem('userToken'),
        AsyncStorage.getItem('userInfo'),
        AsyncStorage.getItem('hasOnboarded'),
        AsyncStorage.getItem('preferredCurrency'),
      ]);

      if (token && userData) {
        setUserToken(token);
        setUser(JSON.parse(userData));
      }

      if (onboarded === 'true') {
        setHasOnboarded(true);
      }

      // Load user's saved currency preference
      if (storedCurrency === 'LKR' || storedCurrency === 'USD') {
        setPreferredCurrency(storedCurrency);
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

  const updatePreferredCurrency = async (currency: 'LKR' | 'USD') => {
    setPreferredCurrency(currency);
    await AsyncStorage.setItem('preferredCurrency', currency);
  };

  return (
    <AuthContext.Provider
      value={{ 
        user, 
        userToken, 
        isLoading, 
        hasOnboarded, 
        preferredCurrency,
        exchangeRate,
        loginState, 
        logout, 
        completeOnboarding,
        updatePreferredCurrency
      }}
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