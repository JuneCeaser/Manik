import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/api';
import { formatDisplayPrice } from '../../utils/currency';
import { GEM_CATEGORIES } from '../../constants/gemOptions';

const GEMS_URL = `${API_BASE_URL.replace('/auth', '')}/gems`;
const FAVORITES_URL = `${API_BASE_URL.replace('/auth', '')}/favorites`;

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

const filterCategories = ['All', ...GEM_CATEGORIES];

export default function HomeScreen() {
  const { userToken, preferredCurrency, exchangeRate } = useAuth();
  const router = useRouter();
  
  const [ads, setAds] = useState<PublishedGemAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchAds = useCallback(async (pageNumber = 1) => {
    if (pageNumber === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      let url = `${GEMS_URL}/published?page=${pageNumber}&limit=20&currency=${preferredCurrency}&rate=${exchangeRate}`;
      if (selectedCategory && selectedCategory !== 'All') url += `&category=${encodeURIComponent(selectedCategory)}`;
      if (minPrice) url += `&minPrice=${minPrice}`;
      if (maxPrice) url += `&maxPrice=${maxPrice}`;

      const res = await fetch(url, {
        headers: userToken ? { Authorization: `Bearer ${userToken}` } : undefined,
      });
      const data = await res.json();
      
      if (data.success) {
        if (pageNumber === 1) {
          setAds(data.gemAds); 
        } else {
          setAds((prev) => [...prev, ...data.gemAds]); 
        }
        setHasMore(data.hasMore);
        setPage(pageNumber);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userToken, selectedCategory, minPrice, maxPrice, preferredCurrency, exchangeRate]);

  const fetchFavoriteIds = useCallback(async () => {
    if (!userToken) {
      setFavoriteIds(new Set());
      return;
    }
    try {
      const res = await fetch(`${FAVORITES_URL}/ids`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setFavoriteIds(new Set<string>(data.gemAdIds));
      }
    } catch {
      // Silently ignore
    }
  }, [userToken]);

  useEffect(() => {
    fetchAds(1);
  }, [fetchAds, selectedCategory]); 

  useFocusEffect(
    useCallback(() => {
      fetchFavoriteIds();
    }, [fetchFavoriteIds])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAds(1), fetchFavoriteIds()]);
    setRefreshing(false);
  }, [fetchAds, fetchFavoriteIds]);

  const loadMoreAds = () => {
    if (!loadingMore && hasMore) {
      fetchAds(page + 1);
    }
  };

  const applyPriceFilter = () => {
    fetchAds(1);
  };

  const toggleFavorite = async (adId: string) => {
    if (!userToken) {
      Alert.alert('Login Required', 'Please log in to save favorites.');
      return;
    }

    const wasFavorited = favoriteIds.has(adId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorited) next.delete(adId);
      else next.add(adId);
      return next;
    });

    try {
      const res = await fetch(`${FAVORITES_URL}/toggle/${adId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();
      if (!data.success) {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorited) next.add(adId);
          else next.delete(adId);
          return next;
        });
      }
    } catch {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.add(adId);
        else next.delete(adId);
        return next;
      });
    }
  };

  const renderCategoryItem = ({ item }: { item: string }) => (
    <Pressable
      style={[styles.categoryPill, selectedCategory === item && styles.categoryPillActive]}
      onPress={() => setSelectedCategory(item)}
    >
      <Text style={[styles.categoryText, selectedCategory === item && styles.categoryTextActive]}>
        {item}
      </Text>
    </Pressable>
  );

  const renderItem = ({ item }: { item: PublishedGemAd }) => {
    const isFavorited = favoriteIds.has(item._id);
    return (
      <Pressable 
        style={styles.card} 
        onPress={() => router.push({ pathname: '/gem/gem-details', params: { id: item._id } })}
      >
        <View style={styles.imageWrapper}>
          <Image source={{ uri: item.images[0]?.url }} style={styles.cardImage} />
          <Pressable style={styles.heartButton} onPress={() => toggleFavorite(item._id)}>
            <Ionicons
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={18}
              color={isFavorited ? '#EF4444' : '#64748B'}
            />
          </Pressable>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardPrice}>{formatDisplayPrice(item.price, preferredCurrency, exchangeRate)}</Text>
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
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <Text style={styles.headerTitle}>Manik Gem Market</Text>

      <View style={styles.filterSection}>
        <FlatList
          data={filterCategories}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
          renderItem={renderCategoryItem}
        />
        <View style={styles.priceFilterRow}>
          <TextInput
            style={styles.priceInput}
            placeholder={`Min Price (${preferredCurrency})`}
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            value={minPrice}
            onChangeText={setMinPrice}
          />
          <Text style={styles.priceDivider}>-</Text>
          <TextInput
            style={styles.priceInput}
            placeholder={`Max Price (${preferredCurrency})`}
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            value={maxPrice}
            onChangeText={setMaxPrice}
          />
          <Pressable style={styles.applyFilterButton} onPress={applyPriceFilter}>
            <Ionicons name="search" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

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
          onEndReached={loadMoreAds}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 20 }} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <Ionicons name="diamond-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>No gems match your filters.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  filterSection: { paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  categoryList: { paddingHorizontal: 16, paddingVertical: 10 },
  categoryPill: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F1F5F9', borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  categoryPillActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  categoryText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  categoryTextActive: { color: '#FFFFFF' },
  priceFilterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 4 },
  priceInput: { flex: 1, height: 40, backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
  priceDivider: { marginHorizontal: 8, color: '#94A3B8', fontWeight: '700' },
  applyFilterButton: { width: 40, height: 40, backgroundColor: '#2563EB', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { marginTop: 12, fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, flexGrow: 1 },
  row: { justifyContent: 'space-between' },
  card: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 16, overflow: 'hidden', elevation: 1 },
  imageWrapper: { position: 'relative' },
  cardImage: { width: '100%', height: 120, backgroundColor: '#E2E8F0' },
  heartButton: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  cardPrice: { fontSize: 13, fontWeight: '700', color: '#2563EB', marginTop: 4 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cardMeta: { fontSize: 11, color: '#64748B', fontWeight: '500', maxWidth: '70%' },
  cardMetaDot: { fontSize: 11, color: '#CBD5E1', marginHorizontal: 4 },
  cardLocationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cardLocation: { fontSize: 11, color: '#94A3B8', marginLeft: 3, flexShrink: 1 },
});