import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
// expo-image caches and recycles images far better than the core RN Image
// component in long lists — swap back to `Image` from 'react-native' if
// you don't have expo-image installed (`npx expo install expo-image`).
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { API_BASE_URL } from '../../constants/api';
import { formatDisplayPrice, getPreferredCurrency, fetchLiveExchangeRate } from '../../utils/currency';
import { GEM_CATEGORIES, GEM_COLORS, GEM_SHAPES, GEM_ORIGINS, GEM_CLARITIES } from '../../constants/gemOptions';

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

type FilterOverrides = Partial<{
  category: string;
  search: string;
  minPrice: string;
  maxPrice: string;
  minCarat: string;
  maxCarat: string;
  color: string;
  shape: string;
  origin: string;
  clarity: string;
}>;

const filterCategories = ['All', ...GEM_CATEGORIES];

// Hoisted outside HomeScreen and memoized: this stops every card from being
// recreated (and RN reconciling all of them) on every parent re-render —
// e.g. every keystroke in search, every favorite toggle, every filter tap.
// It only re-renders a given card when ITS OWN props actually change.
type GemCardProps = {
  item: PublishedGemAd;
  isFavorited: boolean;
  prefCurrency: 'LKR' | 'USD';
  exchangeRate: number;
  styles: ReturnType<typeof createStyles>;
  colors: any;
  onPress: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

const GemCard = React.memo(
  ({ item, isFavorited, prefCurrency, exchangeRate, styles, colors, onPress, onToggleFavorite }: GemCardProps) => (
    <Pressable style={styles.card} onPress={() => onPress(item._id)}>
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: item.images[0]?.url }}
          style={styles.cardImage}
          contentFit="cover"
          transition={150}
        />
        <Pressable style={styles.heartButton} onPress={() => onToggleFavorite(item._id)}>
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
  )
);
GemCard.displayName = 'GemCard';

// Also hoisted + memoized: previously redefined on every HomeScreen render,
// four times (Color / Shape / Origin / Clarity), each remounting its pills.
type FilterPillsProps = {
  title: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  styles: ReturnType<typeof createStyles>;
};

const FilterPills = React.memo(({ title, options, selected, onSelect, styles }: FilterPillsProps) => (
  <View style={styles.filterPillSection}>
    <Text style={styles.filterSectionTitle}>{title}</Text>
    <View style={styles.pillWrap}>
      <Pressable style={[styles.filterPill, selected === 'All' && styles.filterPillActive]} onPress={() => onSelect('All')}>
        <Text style={[styles.filterPillText, selected === 'All' && styles.filterPillTextActive]}>All</Text>
      </Pressable>
      {options.map((opt) => (
        <Pressable key={opt} style={[styles.filterPill, selected === opt && styles.filterPillActive]} onPress={() => onSelect(opt)}>
          <Text style={[styles.filterPillText, selected === opt && styles.filterPillTextActive]}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  </View>
));
FilterPills.displayName = 'FilterPills';

export default function HomeScreen() {
  const { userToken } = useAuth();
  const { colors, isDark } = useTheme();
  // useMemo so `styles` is a stable reference across renders (only
  // recomputed when `colors` actually changes), instead of calling
  // createStyles(colors) — and rebuilding every StyleSheet object — on
  // every single render.
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [ads, setAds] = useState<PublishedGemAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Preferences
  const [prefCurrency, setPrefCurrency] = useState<'LKR' | 'USD'>('LKR');
  const [exchangeRate, setExchangeRate] = useState(300);

  // Core Filters
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Advanced Filters
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minCarat, setMinCarat] = useState('');
  const [maxCarat, setMaxCarat] = useState('');
  const [selectedColor, setSelectedColor] = useState('All');
  const [selectedShape, setSelectedShape] = useState('All');
  const [selectedOrigin, setSelectedOrigin] = useState('All');
  const [selectedClarity, setSelectedClarity] = useState('All');

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // fetchAds accepts explicit overrides so callers (like resetFilters) don't
  // have to wait a render cycle for state to update before fetching.
  const fetchAds = useCallback(
    async (
      pageNumber = 1,
      currentCurrency: 'LKR' | 'USD' = 'LKR',
      currentRate = 300,
      overrides: FilterOverrides = {}
    ) => {
      if (pageNumber === 1) setLoading(true);
      else setLoadingMore(true);

      const category = overrides.category ?? selectedCategory;
      const search = overrides.search ?? searchQuery;
      const minP = overrides.minPrice ?? minPrice;
      const maxP = overrides.maxPrice ?? maxPrice;
      const minC = overrides.minCarat ?? minCarat;
      const maxC = overrides.maxCarat ?? maxCarat;
      const color = overrides.color ?? selectedColor;
      const shape = overrides.shape ?? selectedShape;
      const origin = overrides.origin ?? selectedOrigin;
      const clarity = overrides.clarity ?? selectedClarity;

      try {
        let url = `${GEMS_URL}/published?page=${pageNumber}&limit=20&currency=${currentCurrency}&rate=${currentRate}`;

        if (category && category !== 'All') url += `&category=${encodeURIComponent(category)}`;
        if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
        if (minP) url += `&minPrice=${minP}`;
        if (maxP) url += `&maxPrice=${maxP}`;
        if (minC) url += `&minCarat=${minC}`;
        if (maxC) url += `&maxCarat=${maxC}`;
        if (color && color !== 'All') url += `&color=${encodeURIComponent(color)}`;
        if (shape && shape !== 'All') url += `&shape=${encodeURIComponent(shape)}`;
        if (origin && origin !== 'All') url += `&origin=${encodeURIComponent(origin)}`;
        if (clarity && clarity !== 'All') url += `&clarity=${encodeURIComponent(clarity)}`;

        const res = await fetch(url, {
          headers: userToken ? { Authorization: `Bearer ${userToken}` } : undefined,
        });
        const data = await res.json();

        if (data.success) {
          if (pageNumber === 1) setAds(data.gemAds);
          else setAds((prev) => [...prev, ...data.gemAds]);

          setHasMore(data.hasMore);
          setPage(pageNumber);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      userToken,
      selectedCategory,
      searchQuery,
      minPrice,
      maxPrice,
      minCarat,
      maxCarat,
      selectedColor,
      selectedShape,
      selectedOrigin,
      selectedClarity,
    ]
  );

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
      if (data.success) setFavoriteIds(new Set<string>(data.gemAdIds));
    } catch {}
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchFavoriteIds, selectedCategory])
  );

  // Debounced live search: fires automatically as the user types, including
  // when they backspace all the way down to an empty string (which naturally
  // omits the `search` param above and returns the unfiltered list).
  const isFirstSearchRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false;
      return;
    }
    const handler = setTimeout(() => {
      fetchAds(1, prefCurrency, exchangeRate);
    }, 400);

    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const currency = await getPreferredCurrency();
    const rate = await fetchLiveExchangeRate();
    setPrefCurrency(currency);
    setExchangeRate(rate);
    await Promise.all([fetchAds(1, currency, rate), fetchFavoriteIds()]);
    setRefreshing(false);
  }, [fetchAds, fetchFavoriteIds]);

  const loadMoreAds = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchAds(page + 1, prefCurrency, exchangeRate);
    }
  }, [loadingMore, hasMore, fetchAds, page, prefCurrency, exchangeRate]);

  const applyFilters = useCallback(() => {
    setFilterModalVisible(false);
    fetchAds(1, prefCurrency, exchangeRate);
  }, [fetchAds, prefCurrency, exchangeRate]);

  // Resets both the filter form fields AND immediately re-fetches the home
  // screen results using explicit overrides (so it doesn't rely on stale
  // state from before the reset).
  const resetFilters = useCallback(() => {
    setMinPrice('');
    setMaxPrice('');
    setMinCarat('');
    setMaxCarat('');
    setSelectedColor('All');
    setSelectedShape('All');
    setSelectedOrigin('All');
    setSelectedClarity('All');
    setFilterModalVisible(false);

    fetchAds(1, prefCurrency, exchangeRate, {
      minPrice: '',
      maxPrice: '',
      minCarat: '',
      maxCarat: '',
      color: 'All',
      shape: 'All',
      origin: 'All',
      clarity: 'All',
    });
  }, [fetchAds, prefCurrency, exchangeRate]);

  const toggleFavorite = useCallback(
    async (adId: string) => {
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
    },
    [userToken, favoriteIds]
  );

  const goToGemDetails = useCallback(
    (id: string) => router.push({ pathname: '/gem/gem-details', params: { id } }),
    [router]
  );

  const renderCategoryItem = useCallback(
    ({ item }: { item: string }) => (
      <Pressable
        style={[styles.categoryPill, selectedCategory === item && styles.categoryPillActive]}
        onPress={() => setSelectedCategory(item)}
      >
        <Text style={[styles.categoryText, selectedCategory === item && styles.categoryTextActive]}>
          {item}
        </Text>
      </Pressable>
    ),
    [styles, selectedCategory]
  );

  const renderItem = useCallback(
    ({ item }: { item: PublishedGemAd }) => (
      <GemCard
        item={item}
        isFavorited={favoriteIds.has(item._id)}
        prefCurrency={prefCurrency}
        exchangeRate={exchangeRate}
        styles={styles}
        colors={colors}
        onPress={goToGemDetails}
        onToggleFavorite={toggleFavorite}
      />
    ),
    [favoriteIds, prefCurrency, exchangeRate, styles, colors, goToGemDetails, toggleFavorite]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Text style={styles.headerTitle}>Manik Gem Market</Text>

      {/* Search & Filter Row */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search gems..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        <Pressable style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
          <Ionicons name="options" size={22} color="#FFF" />
        </Pressable>
      </View>

      <View style={styles.filterSection}>
        <FlatList
          data={filterCategories}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
          renderItem={renderCategoryItem}
        />
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
          // Perf tuning for large result sets (hundreds–thousands of ads):
          // render fewer rows up front, cap how many mount per scroll batch,
          // keep a modest render "window" around the viewport, and unmount
          // offscreen native views entirely instead of just hiding them.
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          updateCellsBatchingPeriod={50}
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

      {/* Advanced Filter Modal */}
      <Modal visible={filterModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Pressable onPress={resetFilters} hitSlop={10}>
              <Text style={styles.modalResetText}>Reset</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Advanced Filters</Text>
            <Pressable onPress={() => setFilterModalVisible(false)} hitSlop={10}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.filterSectionTitle}>Price Range ({prefCurrency})</Text>
            <View style={styles.inputRow}>
              <TextInput style={styles.filterInput} placeholder="Min Price" keyboardType="numeric" value={minPrice} onChangeText={setMinPrice} placeholderTextColor={colors.textSecondary}/>
              <Text style={styles.inputDivider}>-</Text>
              <TextInput style={styles.filterInput} placeholder="Max Price" keyboardType="numeric" value={maxPrice} onChangeText={setMaxPrice} placeholderTextColor={colors.textSecondary}/>
            </View>

            <Text style={styles.filterSectionTitle}>Carat Weight (ct)</Text>
            <View style={styles.inputRow}>
              <TextInput style={styles.filterInput} placeholder="Min Carat" keyboardType="numeric" value={minCarat} onChangeText={setMinCarat} placeholderTextColor={colors.textSecondary}/>
              <Text style={styles.inputDivider}>-</Text>
              <TextInput style={styles.filterInput} placeholder="Max Carat" keyboardType="numeric" value={maxCarat} onChangeText={setMaxCarat} placeholderTextColor={colors.textSecondary}/>
            </View>

            <FilterPills title="Color" options={GEM_COLORS} selected={selectedColor} onSelect={setSelectedColor} styles={styles} />
            <FilterPills title="Shape & Cut" options={GEM_SHAPES} selected={selectedShape} onSelect={setSelectedShape} styles={styles} />
            <FilterPills title="Origin" options={GEM_ORIGINS} selected={selectedOrigin} onSelect={setSelectedOrigin} styles={styles} />
            <FilterPills title="Clarity" options={GEM_CLARITIES} selected={selectedClarity} onSelect={setSelectedClarity} styles={styles} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable style={styles.applyButton} onPress={applyFilters}>
              <Text style={styles.applyButtonText}>Show Results</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },

  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 8, marginBottom: 4 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: colors.text },
  filterButton: { width: 44, height: 44, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },

  filterSection: { paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  categoryList: { paddingHorizontal: 16, paddingVertical: 10 },
  categoryPill: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.inputBg, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  categoryPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  categoryTextActive: { color: '#FFFFFF' },

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

  // Modal Styles
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalResetText: { fontSize: 15, fontWeight: '600', color: colors.danger },
  modalContent: { padding: 20, paddingBottom: 100 },
  filterSectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  filterInput: { flex: 1, height: 46, backgroundColor: colors.inputBg, borderRadius: 12, paddingHorizontal: 14, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },
  inputDivider: { marginHorizontal: 12, color: colors.textSecondary, fontWeight: '700' },

  filterPillSection: { marginBottom: 24 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.inputBg, borderRadius: 20, marginRight: 8, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  filterPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterPillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  filterPillTextActive: { color: '#FFFFFF' },

  modalFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  applyButton: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  applyButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});