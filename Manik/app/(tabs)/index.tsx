import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/api';

const GEMS_URL = `${API_BASE_URL.replace('/auth', '')}/gems`;

type PublishedGemAd = {
  _id: string;
  title: string;
  category: string;
  price: { amount: number; currency: 'LKR' | 'USD'; negotiable: boolean };
  weightCarats: number;
  images: { url: string; fileId: string }[];
  location: { province: string; city: string };
  createdAt: string;
  user: { name: string };
};

const formatPrice = (price: PublishedGemAd['price']) => {
  const symbol = price.currency === 'USD' ? '$' : 'Rs.';
  return `${symbol} ${price.amount.toLocaleString()}${price.negotiable ? ' (Neg.)' : ''}`;
};

export default function HomeScreen() {
  const { userToken } = useAuth();
  const [ads, setAds] = useState<PublishedGemAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAds = useCallback(async () => {
    try {
      const res = await fetch(`${GEMS_URL}/published`, {
        headers: userToken ? { Authorization: `Bearer ${userToken}` } : undefined,
      });
      const data = await res.json();
      if (data.success) {
        setAds(data.gemAds);
      }
    } catch {
      // Silently fail - the empty state will show
    } finally {
      setLoading(false);
    }
  }, [userToken]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAds();
    setRefreshing(false);
  }, [fetchAds]);

  const renderItem = ({ item }: { item: PublishedGemAd }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.images[0]?.url }} style={styles.cardImage} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>
        <View style={styles.cardMetaRow}>
          <Text style={styles.cardMeta} numberOfLines={1}>{item.category}</Text>
          <Text style={styles.cardMetaDot}>•</Text>
          <Text style={styles.cardMeta}>{item.weightCarats}ct</Text>
        </View>
        <View style={styles.cardLocationRow}>
          <Ionicons name="location-outline" size={13} color="#94A3B8" />
          <Text style={styles.cardLocation} numberOfLines={1}>{item.location.city}, {item.location.province}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <Text style={styles.headerTitle}>Manik Gem Market</Text>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={ads}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <Ionicons name="diamond-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>No gems listed yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { marginTop: 12, fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 },
  row: { justifyContent: 'space-between' },
  card: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 1,
  },
  cardImage: { width: '100%', height: 120, backgroundColor: '#E2E8F0' },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  cardPrice: { fontSize: 13, fontWeight: '700', color: '#2563EB', marginTop: 4 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cardMeta: { fontSize: 11, color: '#64748B', fontWeight: '500', maxWidth: '70%' },
  cardMetaDot: { fontSize: 11, color: '#CBD5E1', marginHorizontal: 4 },
  cardLocationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cardLocation: { fontSize: 11, color: '#94A3B8', marginLeft: 3, flexShrink: 1 },
});