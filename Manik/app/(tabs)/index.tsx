import React, { useCallback, useState } from 'react';
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
import { useTheme } from '../../context/ThemeContext';
import { API_BASE_URL } from '../../constants/api';
import { formatDisplayPrice, getPreferredCurrency, fetchLiveExchangeRate } from '../../utils/currency';
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
  const { userToken } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  
  const [ads, setAds] = useState<PublishedGemAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Preferences
  const [prefCurrency, setPrefCurrency] = useState<'LKR' | 'USD'>('LKR');
  const [exchangeRate, setExchangeRate] = useState(300);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchAds = useCallback(async (pageNumber = 1, currentCurrency = 'LKR', currentRate = 300) => {
    if (pageNumber === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      let url = `${GEMS_URL}/published?page=${pageNumber}&limit=20&currency=${currentCurrency}&rate=${currentRate}`;
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
  }, [userToken, selectedCategory, minPrice, maxPrice]);

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
    }
  }, [userToken]);

  useFocusEffect(
    useCallback(() => {
      let currentCurrency: 'LKR' | 'USD' = 'LKR';
      let currentRate = 300;

      const initParams = async () => {
        currentCurrency = await getPreferredCurrency();
        currentRate = await fetchLiveExchangeRate();
        setPrefCurrency(currentCurrency);
        setExchangeRate(currentRate);
        fetchFavoriteIds();
        fetchAds(1, currentCurrency, currentRate);
      };
      
      initParams();
    }, [fetchFavoriteIds, selectedCategory, minPrice, maxPrice])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const currency = await getPreferredCurrency();
    const rate = await fetchLiveExchangeRate();
    setPrefCurrency(currency);
    setExchangeRate(rate);
    await Promise.all([fetchAds(1, currency, rate), fetchFavoriteIds()]);
    setRefreshing(false);
  }, [fetchAds, fetchFavoriteIds]);

  const loadMoreAds = () => {
    if (!loadingMore && hasMore) {
      fetchAds(page + 1, prefCurrency, exchangeRate);
    }
  };

  const applyPriceFilter = () => {
    fetchAds(1, prefCurrency, exchangeRate);
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
              color={isFavorited ? colors.danger : colors.textSecondary}
            />
          </Pressable>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardPrice}>{formatDisplayPrice(item.price, prefCurrency, exchangeRate)}</Text>
          <View style={styles.cardMetaRow}>
            <Text style={styles.cardMeta} numberOfLines={1}>{item.category}</Text>
            <Text style={styles.cardMetaDot}>•</Text>
            <Text style={styles.cardMeta}>{item.weightCarats}ct</Text>
          </View>
          <View style={styles.cardLocationRow}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.cardLocation} numberOfLines={1}>{item.location.city}, {item.location.province}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
            placeholder={`Min Price (${prefCurrency})`}
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={minPrice}
            onChangeText={setMinPrice}
          />
          <Text style={styles.priceDivider}>-</Text>
          <TextInput
            style={styles.priceInput}
            placeholder={`Max Price (${prefCurrency})`}
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={maxPrice}
            onChangeText={setMaxPrice}
          />
        
        </View>
      </View>

      {loading && page === 1 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={ads}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReached={loadMoreAds}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <Ionicons name="diamond-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>No gems match your filters.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  filterSection: { paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  categoryList: { paddingHorizontal: 16, paddingVertical: 10 },
  categoryPill: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.inputBg, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  categoryPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  categoryTextActive: { color: '#FFFFFF' },
  priceFilterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 4 },
  priceInput: { flex: 1, height: 40, backgroundColor: colors.inputBg, borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: colors.text, borderWidth: 1, borderColor: colors.border },
  priceDivider: { marginHorizontal: 8, color: colors.textSecondary, fontWeight: '700' },
  applyFilterButton: { width: 40, height: 40, backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { marginTop: 12, fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, flexGrow: 1 },
  row: { justifyContent: 'space-between' },
  card: { width: '48%', backgroundColor: colors.card, borderRadius: 16, marginBottom: 16, overflow: 'hidden', elevation: 1 },
  imageWrapper: { position: 'relative' },
  cardImage: { width: '100%', height: 120, backgroundColor: colors.border },
  heartButton: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  cardPrice: { fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 4 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cardMeta: { fontSize: 11, color: colors.textSecondary, fontWeight: '500', maxWidth: '70%' },
  cardMetaDot: { fontSize: 11, color: colors.border, marginHorizontal: 4 },
  cardLocationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cardLocation: { fontSize: 11, color: colors.textSecondary, marginLeft: 3, flexShrink: 1 },
});