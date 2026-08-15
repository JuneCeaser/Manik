import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { useTheme } from '../../context/ThemeContext';
import { API_BASE_URL } from '../../constants/api';
import { formatDisplayPrice, getPreferredCurrency, fetchLiveExchangeRate } from '../../utils/currency';

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

// --- NEW SKELETON LOADER COMPONENTS ---
const SkeletonCard = ({ styles, colors }: any) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={styles.cardImage} />
      <View style={styles.cardBody}>
        <View style={{ height: 14, backgroundColor: colors.border, borderRadius: 4, marginBottom: 8, width: '80%' }} />
        <View style={{ height: 14, backgroundColor: colors.border, borderRadius: 4, marginBottom: 12, width: '50%' }} />
        <View style={{ height: 12, backgroundColor: colors.border, borderRadius: 4, marginBottom: 8, width: '90%' }} />
        <View style={{ height: 12, backgroundColor: colors.border, borderRadius: 4, width: '60%' }} />
      </View>
    </Animated.View>
  );
};

const SkeletonGrid = ({ styles, colors }: any) => {
  const dummyData = [1, 2, 3, 4, 5, 6]; 
  return (
    <View style={[styles.listContent, { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingTop: 16 }]}>
      {dummyData.map((key) => (
        <SkeletonCard key={key} styles={styles} colors={colors} />
      ))}
    </View>
  );
};
// --------------------------------------

export default function FavoritesScreen() {
  const { userToken } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  
  const [ads, setAds] = useState<FavoritedGemAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [prefCurrency, setPrefCurrency] = useState<'LKR' | 'USD'>('LKR');
  const [exchangeRate, setExchangeRate] = useState(300);

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
      const res = await fetch(`${FAVORITES_URL}?page=${pageNumber}&limit=20`, {
        headers: { Authorization: `Bearer ${userToken}` },
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
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userToken]);

  useFocusEffect(
    useCallback(() => {
      const loadPreferencesAndData = async () => {
        const currency = await getPreferredCurrency();
        const rate = await fetchLiveExchangeRate();
        setPrefCurrency(currency);
        setExchangeRate(rate);
        fetchFavorites(1);
      };
      loadPreferencesAndData();
    }, [fetchFavorites])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const currency = await getPreferredCurrency();
    const rate = await fetchLiveExchangeRate();
    setPrefCurrency(currency);
    setExchangeRate(rate);
    await fetchFavorites(1);
    setRefreshing(false);
  }, [fetchFavorites]);

  const loadMoreAds = () => {
    if (!loadingMore && hasMore) {
      fetchFavorites(page + 1);
    }
  };

  const removeFavorite = async (adId: string) => {
    if (!userToken) return;
    
    const previousAds = [...ads];
    setAds((prev) => prev.filter((ad) => ad._id !== adId));

    try {
      const res = await fetch(`${FAVORITES_URL}/toggle/${adId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();
      if (!data.success) setAds(previousAds);
    } catch {
      setAds(previousAds); 
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
          <Ionicons name="heart" size={18} color={colors.danger} />
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

  if (!userToken) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContent}>
          <Ionicons name="heart-outline" size={48} color={colors.border} />
          <Text style={styles.emptyText}>Please log in to view favorites.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Text style={styles.headerTitle}>Favorites</Text>

      {/* REPLACED SPINNER WITH SKELETON GRID */}
      {loading && page === 1 ? (
        <SkeletonGrid styles={styles} colors={colors} />
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
              <Ionicons name="heart-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>No favorites yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.text, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { marginTop: 12, fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 },
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