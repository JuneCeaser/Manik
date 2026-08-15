import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';

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

  const [preferredCurrency, setPreferredCurrency] = useState<'LKR' | 'USD'>('LKR');
  const [exchangeRate, setExchangeRate] = useState<number>(334.43); 

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
      fetchLiveExchangeRate();

      const [token, userData, onboarded, storedCurrency] = await Promise.all([
        AsyncStorage.getItem('userToken'),
        AsyncStorage.getItem('userInfo'),
        AsyncStorage.getItem('hasOnboarded'),
        AsyncStorage.getItem('preferredCurrency'),
      ]);

      if (token && userData) {
        const parsedUser = JSON.parse(userData);
        setUserToken(token);
        setUser(parsedUser);
        
        // Ensure RevenueCat stays synced with the active session on app boot
        await Purchases.logIn(parsedUser.id);
      }

      if (onboarded === 'true') {
        setHasOnboarded(true);
      }

      if (storedCurrency === 'LKR' || storedCurrency === 'USD') {
        setPreferredCurrency(storedCurrency);
      }
    } catch (e) {
      console.log('Error reading auth state', e);
    } finally {
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
    
    // Bind the MongoDB User ID to RevenueCat
    await Purchases.logIn(userData.id);
  };

  const logout = async () => {
    setUserToken(null);
    setUser(null);
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userInfo');
    
    // Log out of RevenueCat
    await Purchases.logOut();
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