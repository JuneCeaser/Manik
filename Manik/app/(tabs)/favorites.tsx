import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/api';

const FAVORITES_URL = `${API_BASE_URL.replace('/auth', '')}/favorites`;

type FavoritedGemAd = {
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

const formatPrice = (price: FavoritedGemAd['price']) => {
  const symbol = price.currency === 'USD' ? '$' : 'Rs.';
  return `${symbol} ${price.amount.toLocaleString()}${price.negotiable ? ' (Neg.)' : ''}`;
};

export default function FavoritesScreen() {
  const { userToken } = useAuth();
  const router = useRouter();
  
  const [ads, setAds] = useState<FavoritedGemAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchFavorites = useCallback(async (pageNumber = 1) => {
    if (!userToken) {
      setLoading(false);
      return;
    }

    if (pageNumber === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      // Added ?page=x&limit=20 to the URL
      const res = await fetch(`${FAVORITES_URL}?page=${pageNumber}&limit=20`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();
      
      if (data.success) {
        if (pageNumber === 1) {
          setAds(data.gemAds); // First page replaces the list
        } else {
          setAds((prev) => [...prev, ...data.gemAds]); // Next pages attach to the bottom
        }
        setHasMore(data.hasMore);
        setPage(pageNumber);
      }
    } catch {
      // Silently fail - the empty state will show
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userToken]);

  useFocusEffect(
    useCallback(() => {
      fetchFavorites(1);
    }, [fetchFavorites])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFavorites(1);
    setRefreshing(false);
  }, [fetchFavorites]);

  // Load more trigger
  const loadMoreAds = () => {
    if (!loadingMore && hasMore) {
      fetchFavorites(page + 1);
    }
  };

  const removeFavorite = async (adId: string) => {
    if (!userToken) return;
    
    // Optimistic UI update (immediately remove from screen)
    const previousAds = [...ads];
    setAds((prev) => prev.filter((ad) => ad._id !== adId));

    try {
      const res = await fetch(`${FAVORITES_URL}/toggle/${adId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();
      if (!data.success) {
        setAds(previousAds); // Revert on fail
      }
    } catch {
      setAds(previousAds); // Revert on fail
    }
  };

  const renderItem = ({ item }: { item: FavoritedGemAd }) => (
    <Pressable 
      style={styles.card} 
      onPress={() => router.push({ pathname: '/gem/gem-details', params: { id: item._id } })}
    >
      <View style={styles.imageWrapper}>
        <Image source={{ uri: item.images[0]?.url }} style={styles.cardImage} />
        <Pressable style={styles.heartButton} onPress={() => removeFavorite(item._id)}>
          <Ionicons name="heart" size={18} color="#EF4444" />
        </Pressable>
      </View>
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
    </Pressable>
  );

  if (!userToken) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContent}>
          <Ionicons name="heart-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>Please log in to view favorites.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <Text style={styles.headerTitle}>Favorites</Text>

      {loading && page === 1 ? (
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
          
          // Pagination triggers
          onEndReached={loadMoreAds}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 20 }} />
            ) : null
          }

          ListEmptyComponent={
            <View style={styles.centerContent}>
              <Ionicons name="heart-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>No favorites yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A', paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 },
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
  imageWrapper: { position: 'relative' },
  cardImage: { width: '100%', height: 120, backgroundColor: '#E2E8F0' },
  heartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  cardPrice: { fontSize: 13, fontWeight: '700', color: '#2563EB', marginTop: 4 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cardMeta: { fontSize: 11, color: '#64748B', fontWeight: '500', maxWidth: '70%' },
  cardMetaDot: { fontSize: 11, color: '#CBD5E1', marginHorizontal: 4 },
  cardLocationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cardLocation: { fontSize: 11, color: '#94A3B8', marginLeft: 3, flexShrink: 1 },
});