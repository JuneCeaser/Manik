import React, { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

  const [localCurrency, setLocalCurrency] = useState<'LKR' | 'USD'>('LKR');
  const [localRate, setLocalRate] = useState(300);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loadingOfferings, setLoadingOfferings] = useState(true);

  const [myPayments, setMyPayments] = useState<PaymentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

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

  const getFormattedPrice = (amount: number) => {
    const isOriginalUSD = amount < 100;
    let convertedAmount = amount;
    if (isOriginalUSD && localCurrency === 'LKR') convertedAmount = amount * localRate;
    else if (!isOriginalUSD && localCurrency === 'USD') convertedAmount = amount / localRate;

    if (localCurrency === 'USD') return `$${convertedAmount.toFixed(2)}`;
    else return `Rs. ${Math.round(convertedAmount).toLocaleString()}`;
  };

  const fetchHistory = useCallback(async () => {
    if (!userToken) return;
    try {
      const res = await fetch(`${API_BASE_URL.replace('/auth', '')}/payments/my-payments`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();
      if (data.success) setMyPayments(data.payments);
    } catch (error) {} finally { setLoadingHistory(false); }
  }, [userToken]);

  const fetchOfferings = useCallback(async () => {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
        setPackages(offerings.current.availablePackages);
      }
    } catch (error) {} finally { setLoadingOfferings(false); }
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

  if (!userToken) return <Redirect href="/login" />;

  const handleRevenueCatPurchase = async (pkg: PurchasesPackage) => {
    setLoading(true);
    try {
      await Purchases.purchasePackage(pkg);
      Alert.alert('Purchase Processing!', 'Your transaction is verifying. Your 30 Ad Credits will appear in your account momentarily.');
      setTimeout(() => fetchHistory(), 3000);
    } catch (error: any) {
      if (!error.userCancelled) Alert.alert('Purchase Error', error.message);
    } finally { setLoading(false); }
  };

  const getStatusColor = (status: string) => {
    if (status === 'APPROVED') return '#10B981';
    if (status === 'REJECTED') return colors.danger;
    return '#F59E0B'; 
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
      
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.topBackRow}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.topBackText}>Back to Profile</Text>
        </Pressable>
        <Text style={styles.title}>Unlock Pro Selling</Text>
        <Text style={styles.subtitle}>Get 30 Ad Credits for just {getFormattedPrice(990)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Instant Checkout</Text>
        {loadingOfferings ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
        ) : packages.length === 0 ? (
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>No packages found in RevenueCat dashboard.</Text>
        ) : (
          packages.map((pkg) => (
            <Pressable key={pkg.identifier} style={styles.submitButton} onPress={() => handleRevenueCatPurchase(pkg)} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Buy {pkg.product.title} ({getFormattedPrice(pkg.product.price)})</Text>}
            </Pressable>
          ))
        )}
      </View>

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