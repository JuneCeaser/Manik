import AsyncStorage from '@react-native-async-storage/async-storage';

// Fallback rate just in case the API is temporarily unreachable
let cachedRate = 334.43; 

export const fetchLiveExchangeRate = async (): Promise<number> => {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data && data.rates && data.rates.LKR) {
      cachedRate = data.rates.LKR;
    }
  } catch (error) {
    console.warn('Could not fetch live rate, using fallback.', error);
  }
  return cachedRate;
};

export const getPreferredCurrency = async (): Promise<'LKR' | 'USD'> => {
  try {
    const stored = await AsyncStorage.getItem('preferredCurrency');
    return stored === 'USD' ? 'USD' : 'LKR';
  } catch {
    return 'LKR';
  }
};

export const setPreferredCurrency = async (currency: 'LKR' | 'USD') => {
  await AsyncStorage.setItem('preferredCurrency', currency);
};

export const formatDisplayPrice = (
  price: { amount: number; currency: 'LKR' | 'USD' | string; negotiable?: boolean },
  targetCurrency: 'LKR' | 'USD',
  liveExchangeRate: number = cachedRate
) => {
  let convertedAmount = price.amount;

  // Convert if the ad's native currency doesn't match the user's preference
  if (price.currency === 'LKR' && targetCurrency === 'USD') {
    convertedAmount = price.amount / liveExchangeRate;
  } else if (price.currency === 'USD' && targetCurrency === 'LKR') {
    convertedAmount = price.amount * liveExchangeRate;
  }

  const symbol = targetCurrency === 'USD' ? '$' : 'Rs.';
  
  // USD gets 2 decimal places, LKR gets rounded to whole numbers
  const formattedAmount = targetCurrency === 'USD' 
    ? convertedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(convertedAmount).toLocaleString('en-US');

  return `${symbol} ${formattedAmount}${price.negotiable ? ' (Neg.)' : ''}`;
};