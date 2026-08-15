import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, useRouter, useFocusEffect } from 'expo-router';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL } from '../constants/api';
import { getPreferredCurrency, fetchLiveExchangeRate } from '../utils/currency';

type PaymentHistory = {
  _id: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
};

export default function BuyCreditsScreen() {
  const { userToken } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();

  // Explicitly fetch and track currency just for this screen to prevent caching bugs
  const [localCurrency, setLocalCurrency] = useState<'LKR' | 'USD'>('LKR');
  const [localRate, setLocalRate] = useState(300);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [slipImage, setSlipImage] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'NONE' | 'MANUAL' | 'REVENUECAT'>('NONE');
  
  // RevenueCat states
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loadingOfferings, setLoadingOfferings] = useState(true);

  // History states
  const [myPayments, setMyPayments] = useState<PaymentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Fetch local storage exactly on screen focus to instantly respect the user's changes
  useFocusEffect(
    useCallback(() => {
      const loadPreferences = async () => {
        const currency = await getPreferredCurrency();
        const rate = await fetchLiveExchangeRate();
        setLocalCurrency(currency);
        setLocalRate(rate);
      };
      loadPreferences();
    }, [])
  );

  // Helper to dynamically format the price based on global user preference
  const getFormattedPrice = (amount: number) => {
    // Infer the original currency (Store USD amounts will be small, LKR will be > 100)
    const isOriginalUSD = amount < 100;
    
    let convertedAmount = amount;
    
    // Cross-convert depending on the user's preference using our locally fetched rate
    if (isOriginalUSD && localCurrency === 'LKR') {
      convertedAmount = amount * localRate;
    } else if (!isOriginalUSD && localCurrency === 'USD') {
      convertedAmount = amount / localRate;
    }

    if (localCurrency === 'USD') {
      return `$${convertedAmount.toFixed(2)}`;
    } else {
      return `Rs. ${Math.round(convertedAmount).toLocaleString()}`;
    }
  };

  const fetchHistory = useCallback(async () => {
    if (!userToken) return;
    try {
      const res = await fetch(`${API_BASE_URL.replace('/auth', '')}/payments/my-payments`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setMyPayments(data.payments);
      }
    } catch (error) {
      console.log('Failed to fetch history', error);
    } finally {
      setLoadingHistory(false);
    }
  }, [userToken]);

  const fetchOfferings = useCallback(async () => {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
        setPackages(offerings.current.availablePackages);
      }
    } catch (error: any) {
      console.log('Error fetching RevenueCat offerings:', error.message);
    } finally {
      setLoadingOfferings(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchOfferings();
  }, [fetchHistory, fetchOfferings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchHistory(), fetchOfferings()]);
    setRefreshing(false);
  }, [fetchHistory, fetchOfferings]);

  if (!userToken) {
    return <Redirect href="/login" />;
  }

  // Handle RevenueCat Test Store Purchase
  const handleRevenueCatPurchase = async (pkg: PurchasesPackage) => {
    setLoading(true);
    try {
      await Purchases.purchasePackage(pkg);

      // We no longer call our backend manually here. The webhook will handle it.
      Alert.alert(
        'Purchase Processing!', 
        'Your transaction is verifying. Your 30 Ad Credits will appear in your account momentarily.'
      );
      
      setPaymentMethod('NONE');
      
      // Refresh the history after a 3 second delay to give the webhook time to hit our server
      setTimeout(() => {
        fetchHistory();
      }, 3000);

    } catch (error: any) {
      if (!error.userCancelled) {
        Alert.alert('Purchase Error', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'You need to allow access to your photos to upload a bank slip.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setSlipImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSubmitSlip = async () => {
    if (!slipImage) {
      return Alert.alert('Required', 'Please upload a screenshot of your bank receipt.');
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL.replace('/auth', '')}/payments/manual-slip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          base64Image: slipImage,
          amount: 990,
        }),
      });

      const data = await res.json();

      if (data.success) {
        Alert.alert(
          'Receipt Submitted!',
          'We have received your slip. Your 30 Ad Credits will be unlocked shortly once verified by admin.'
        );
        setSlipImage(null);
        setPaymentMethod('NONE');
        fetchHistory();
      } else {
        Alert.alert('Upload Failed', data.message || 'Something went wrong.');
      }
    } catch (error) {
      console.log('FETCH ERROR:', error);
      Alert.alert('Error', 'Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'APPROVED') return '#10B981';
    if (status === 'REJECTED') return colors.danger;
    return '#F59E0B'; 
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.topBackRow}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.topBackText}>Back to Profile</Text>
        </Pressable>
        <Text style={styles.title}>Unlock Pro Selling</Text>
        <Text style={styles.subtitle}>Get 30 Ad Credits for just {getFormattedPrice(990)}</Text>
      </View>

      {/* Main Options */}
      {paymentMethod === 'NONE' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How would you like to pay?</Text>

          <Pressable style={styles.methodButton} onPress={() => setPaymentMethod('REVENUECAT')}>
            <Ionicons name="card-outline" size={24} color={colors.primary} />
            <Text style={styles.methodText}>Pay Instantly (Test Store / Card)</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>

          <Pressable style={styles.methodButton} onPress={() => setPaymentMethod('MANUAL')}>
            <Ionicons name="document-text-outline" size={24} color="#10B981" />
            <Text style={styles.methodText}>Manual Bank Transfer (Slip Upload)</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* RevenueCat Instant / Test Store Checkout */}
      {paymentMethod === 'REVENUECAT' && (
        <View style={styles.card}>
          <Pressable onPress={() => setPaymentMethod('NONE')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
            <Text style={styles.backText}>Back to options</Text>
          </Pressable>
          <Text style={styles.cardTitle}>Instant Checkout</Text>
          
          {loadingOfferings ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
          ) : packages.length === 0 ? (
            <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
              No packages found in RevenueCat dashboard. Please check your Offering setup.
            </Text>
          ) : (
            packages.map((pkg) => (
              <Pressable 
                key={pkg.identifier} 
                style={styles.submitButton}
                onPress={() => handleRevenueCatPurchase(pkg)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    Buy {pkg.product.title} ({getFormattedPrice(pkg.product.price)})
                  </Text>
                )}
              </Pressable>
            ))
          )}
        </View>
      )}

      {/* Manual Slip Upload */}
      {paymentMethod === 'MANUAL' && (
        <View style={styles.card}>
          <Pressable onPress={() => setPaymentMethod('NONE')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
            <Text style={styles.backText}>Back to options</Text>
          </Pressable>

          <Text style={styles.cardTitle}>Bank Details</Text>
          <View style={styles.bankInfoBox}>
            <Text style={styles.bankText}><Text style={{ fontWeight: 'bold', color: colors.text }}>Bank:</Text> Commercial Bank</Text>
            <Text style={styles.bankText}><Text style={{ fontWeight: 'bold', color: colors.text }}>Account Name:</Text> J C D Soysa</Text>
            <Text style={styles.bankText}><Text style={{ fontWeight: 'bold', color: colors.text }}>Account No:</Text> 8012401525</Text>
            <Text style={styles.bankText}><Text style={{ fontWeight: 'bold', color: colors.text }}>Branch:</Text> Delgoda Laghf</Text>
          </View>

          <Text style={styles.instructionText}>
            Transfer {getFormattedPrice(990)} to the account above and upload the receipt screenshot below.
          </Text>

          <Pressable style={styles.uploadBox} onPress={pickImage} disabled={loading}>
            {slipImage ? (
              <Image source={{ uri: slipImage }} style={styles.previewImage} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={40} color={colors.textSecondary} />
                <Text style={styles.uploadText}>Tap to select receipt image</Text>
              </>
            )}
          </Pressable>

          {slipImage && (
            <Pressable style={styles.submitButton} onPress={handleSubmitSlip} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Bank Slip</Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      {/* PAYMENT HISTORY & STATUS TRACKER */}
      {paymentMethod === 'NONE' && (
        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>Payment History</Text>
          
          {loadingHistory ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
          ) : myPayments.length === 0 ? (
            <Text style={styles.emptyText}>No previous payments found.</Text>
          ) : (
            myPayments.map((payment) => (
              <View key={payment._id} style={styles.historyCard}>
                <View>
                  <Text style={styles.historyAmount}>30 Ad Credits ({getFormattedPrice(payment.amount)})</Text>
                  <Text style={styles.historyDate}>{new Date(payment.createdAt).toLocaleDateString()}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(payment.status) }]}>
                  <Text style={styles.statusText}>{payment.status}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}

    </ScrollView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 22, paddingTop: 40, paddingBottom: 60 },
  topBackRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 15 },
  topBackText: { marginLeft: 6, fontSize: 14, fontWeight: '600', color: colors.text },
  header: { marginBottom: 30, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 24, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 20 },
  methodButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  methodText: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '600', color: colors.text },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backText: { marginLeft: 6, fontSize: 15, color: colors.textSecondary, fontWeight: '500' },
  bankInfoBox: { backgroundColor: colors.inputBg, padding: 16, borderRadius: 12, marginBottom: 20 },
  bankText: { fontSize: 15, color: colors.textSecondary, marginBottom: 6 },
  instructionText: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 20 },
  uploadBox: { borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 16, height: 180, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.inputBg, overflow: 'hidden', marginBottom: 20 },
  uploadText: { marginTop: 12, color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  submitButton: { backgroundColor: '#10B981', padding: 16, borderRadius: 12, alignItems: 'center', marginVertical: 6 },
  submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  historyContainer: { marginTop: 30 },
  historyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
  emptyText: { color: colors.textSecondary, fontStyle: 'italic', marginTop: 10 },
  historyCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, padding: 16, borderRadius: 16, marginBottom: 12, elevation: 1 },
  historyAmount: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  historyDate: { fontSize: 13, color: colors.textSecondary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
});