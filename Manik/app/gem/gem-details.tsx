import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { API_BASE_URL } from '../../constants/api';
import { formatDisplayPrice, getPreferredCurrency, fetchLiveExchangeRate } from '../../utils/currency';

const GEMS_URL = `${API_BASE_URL.replace('/auth', '')}/gems`;
const FAVORITES_URL = `${API_BASE_URL.replace('/auth', '')}/favorites`;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type GemAdDetails = {
  _id: string;
  title: string;
  category: string;
  price: { amount: number; currency: 'LKR' | 'USD'; negotiable: boolean };
  weightCarats: number;
  color: string;
  shape: string;
  origin: string;
  clarity: string;
  dimensions: { length: number; width: number; depth: number };
  treatment: string;
  certification: { status: string; labName: string };
  description: string;
  images: { url: string; fileId: string }[];
  certificateImage: { url: string; fileId: string } | null;
  location: { province: string; city: string };
  contactPhone: string;
  hidePhoneNumber: boolean;
  createdAt: string;
  user: {
    _id: string;
    name: string;
    profileImage: string;
    whatsappCountryCode: string;
    whatsappNumber: string;
    phone: string;
  };
};

export default function GemDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { userToken } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [ad, setAd] = useState<GemAdDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [prefCurrency, setPrefCurrency] = useState<'LKR' | 'USD'>('LKR');
  const [exchangeRate, setExchangeRate] = useState(300);

  useFocusEffect(
    useCallback(() => {
      const loadPreferences = async () => {
        const currency = await getPreferredCurrency();
        const rate = await fetchLiveExchangeRate();
        setPrefCurrency(currency);
        setExchangeRate(rate);
      };
      loadPreferences();
    }, [])
  );

  const fetchDetails = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${GEMS_URL}/public/${id}`, {
        headers: userToken ? { Authorization: `Bearer ${userToken}` } : undefined,
      });
      const data = await res.json();

      if (!data.success) {
        Alert.alert('Not Found', data.message || 'This gem ad is no longer available.');
        router.back();
        return;
      }

      setAd(data.gemAd);
    } catch {
      Alert.alert('Error', 'Failed to load gem details.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, userToken, router]);

  const fetchFavoriteStatus = useCallback(async () => {
    if (!id || !userToken) return;
    try {
      const res = await fetch(`${FAVORITES_URL}/ids`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setIsFavorited(data.gemAdIds.includes(id));
      }
    } catch {
    }
  }, [id, userToken]);

  useEffect(() => {
    fetchDetails();
    fetchFavoriteStatus();
  }, [fetchDetails, fetchFavoriteStatus]);

  const toggleFavorite = async () => {
    if (!userToken) {
      Alert.alert('Login Required', 'Please log in to save favorites.');
      return;
    }
    if (!id) return;

    setFavoriteLoading(true);
    const wasFavorited = isFavorited;
    setIsFavorited(!wasFavorited);

    try {
      const res = await fetch(`${FAVORITES_URL}/toggle/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();
      if (!data.success) setIsFavorited(wasFavorited);
    } catch {
      setIsFavorited(wasFavorited);
    } finally {
      setFavoriteLoading(false);
    }
  };

  const openWhatsApp = () => {
    if (!ad?.user?.whatsappNumber) return;
    const fullNumber = `${ad.user.whatsappCountryCode || ''}${ad.user.whatsappNumber}`.replace(/\D/g, '');
    const displayPrice = formatDisplayPrice(ad.price, prefCurrency, exchangeRate);
    const message = `Hello! I saw your ad on Manik: "${ad.title}" for ${displayPrice}. Is this still available?`;
    const encodedMessage = encodeURIComponent(message);
    Linking.openURL(`https://wa.me/${fullNumber}?text=${encodedMessage}`).catch(() => 
      Alert.alert('Error', 'Could not open WhatsApp.')
    );
  };

  const callSeller = () => {
    if (!ad?.contactPhone) return;
    Linking.openURL(`tel:${ad.contactPhone}`).catch(() => Alert.alert('Error', 'Could not start the call.'));
  };

  if (loading || !ad) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading gem details…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.imageCarouselWrapper}>
          <FlatList
            data={ad.images}
            keyExtractor={(img, index) => img.fileId || String(index)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setActiveImageIndex(index);
            }}
            renderItem={({ item }) => <Image source={{ uri: item.url }} style={styles.carouselImage} />}
          />

          {ad.images.length > 1 && <View style={styles.carouselScrim} pointerEvents="none" />}

          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>

          <Pressable style={styles.favoriteButton} onPress={toggleFavorite} disabled={favoriteLoading}>
            <Ionicons name={isFavorited ? 'heart' : 'heart-outline'} size={20} color={isFavorited ? colors.danger : colors.text} />
          </Pressable>

          {ad.images.length > 1 && (
            <View style={styles.dotsRow}>
              {ad.images.map((_, index) => (
                <View key={index} style={[styles.dot, index === activeImageIndex && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{ad.title}</Text>
          <Text style={styles.price}>{formatDisplayPrice(ad.price, prefCurrency, exchangeRate)}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>{ad.category}</Text>
            </View>
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>{ad.weightCarats}ct</Text>
            </View>
          </View>

          <View style={styles.locationPill}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.locationText}>{ad.location.city}, {ad.location.province}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Specifications</Text>

            <View style={styles.specRow}>
              <View style={styles.specIconWrap}>
                <Ionicons name="color-palette-outline" size={15} color={colors.textSecondary} />
              </View>
              <Text style={styles.specLabel}>Color</Text>
              <Text style={styles.specValue}>{ad.color}</Text>
            </View>

            <View style={styles.specRow}>
              <View style={styles.specIconWrap}>
                <Ionicons name="diamond-outline" size={15} color={colors.textSecondary} />
              </View>
              <Text style={styles.specLabel}>Shape & Cut</Text>
              <Text style={styles.specValue}>{ad.shape}</Text>
            </View>

            <View style={styles.specRow}>
              <View style={styles.specIconWrap}>
                <Ionicons name="earth-outline" size={15} color={colors.textSecondary} />
              </View>
              <Text style={styles.specLabel}>Origin</Text>
              <Text style={styles.specValue}>{ad.origin || 'Not specified'}</Text>
            </View>

            <View style={styles.specRow}>
              <View style={styles.specIconWrap}>
                <Ionicons name="eye-outline" size={15} color={colors.textSecondary} />
              </View>
              <Text style={styles.specLabel}>Clarity</Text>
              <Text style={styles.specValue}>{ad.clarity || 'Not specified'}</Text>
            </View>

            {ad.dimensions && (ad.dimensions.length > 0 || ad.dimensions.width > 0) && (
              <View style={styles.specRow}>
                <View style={styles.specIconWrap}>
                  <Ionicons name="resize-outline" size={15} color={colors.textSecondary} />
                </View>
                <Text style={styles.specLabel}>Dimensions</Text>
                <Text style={styles.specValue}>
                  {ad.dimensions.length} x {ad.dimensions.width} x {ad.dimensions.depth} mm
                </Text>
              </View>
            )}

            <View style={styles.specRow}>
              <View style={styles.specIconWrap}>
                <Ionicons name="flask-outline" size={15} color={colors.textSecondary} />
              </View>
              <Text style={styles.specLabel}>Treatment</Text>
              <Text style={styles.specValue}>{ad.treatment}</Text>
            </View>

            <View style={[styles.specRow, styles.specRowLast]}>
              <View style={styles.specIconWrap}>
                <Ionicons name="ribbon-outline" size={15} color={colors.textSecondary} />
              </View>
              <Text style={styles.specLabel}>Certification</Text>
              <View style={styles.certBadgeWrap}>
                <View style={[styles.certBadge, ad.certification?.status === 'Certified' && styles.certBadgeActive]}>
                  <Text style={[styles.certBadgeText, ad.certification?.status === 'Certified' && styles.certBadgeTextActive]}>
                    {ad.certification?.status === 'Certified'
                      ? `Certified · ${ad.certification.labName}`
                      : 'Not Certified'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {ad.certificateImage && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Gemological Certificate</Text>
              <Image source={{ uri: ad.certificateImage.url }} style={styles.certificateImage} />
            </View>
          )}

          {!!ad.description && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.descriptionText}>{ad.description}</Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Seller</Text>
            <View style={styles.sellerRow}>
              {ad.user?.profileImage ? (
                <Image source={{ uri: ad.user.profileImage }} style={styles.sellerAvatar} />
              ) : (
                <View style={styles.sellerAvatarPlaceholder}>
                  <Ionicons name="person" size={22} color={colors.primary} />
                </View>
              )}
              <View style={styles.sellerTextWrap}>
                <Text style={styles.sellerName}>{ad.user?.name || 'Manik Seller'}</Text>
                <Text style={styles.sellerSub}>Listed this item</Text>
              </View>
            </View>
          </View>

          <View style={styles.postedRow}>
            <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.postedDate}>Posted {new Date(ad.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {ad.user?.whatsappNumber ? (
          <Pressable style={({ pressed }) => [styles.whatsappButton, pressed && styles.footerButtonPressed]} onPress={openWhatsApp}>
            <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
            <Text style={styles.contactButtonText}>WhatsApp</Text>
          </Pressable>
        ) : null}

        {!ad.hidePhoneNumber && ad.contactPhone ? (
          <Pressable style={({ pressed }) => [styles.callButton, pressed && styles.footerButtonPressed]} onPress={callSeller}>
            <Ionicons name="call" size={18} color="#FFFFFF" />
            <Text style={styles.contactButtonText}>Call</Text>
          </Pressable>
        ) : null}

        {(!ad.user?.whatsappNumber && (ad.hidePhoneNumber || !ad.contactPhone)) && (
          <Text style={styles.noContactText}>This seller has not shared contact details.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: colors.textSecondary, fontWeight: '600' },

  scrollContent: { paddingBottom: 24 },

  imageCarouselWrapper: { position: 'relative', overflow: 'hidden', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  carouselImage: { width: SCREEN_WIDTH, height: 340, backgroundColor: colors.border },
  carouselScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 70, backgroundColor: '#000000', opacity: 0.16 },
  backButton: {
    position: 'absolute', top: 16, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  favoriteButton: {
    position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  dotsRow: { position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)', marginHorizontal: 3 },
  dotActive: { backgroundColor: '#FFFFFF', width: 18 },

  content: { padding: 22 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  price: { fontSize: 21, fontWeight: '800', color: colors.primary, marginTop: 6 },

  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  metaBadge: { backgroundColor: colors.inputBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginRight: 8 },
  metaBadgeText: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary },

  locationPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.inputBg,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, marginTop: 12,
  },
  locationText: { fontSize: 12.5, fontWeight: '600', color: colors.textSecondary, marginLeft: 5 },

  card: {
    backgroundColor: colors.card, borderRadius: 20, padding: 20, marginTop: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 },

  specRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.background },
  specRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  specIconWrap: { width: 26, alignItems: 'center', marginRight: 8 },
  specLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  specValue: { fontSize: 13, color: colors.text, fontWeight: '700', textAlign: 'right', flex: 1, paddingLeft: 10 },

  certBadgeWrap: { flex: 1, alignItems: 'flex-end' },
  certBadge: { backgroundColor: colors.inputBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  certBadgeActive: { backgroundColor: colors.primary },
  certBadgeText: { fontSize: 11.5, fontWeight: '700', color: colors.textSecondary },
  certBadgeTextActive: { color: '#FFFFFF' },

  certificateImage: { width: '100%', height: 180, borderRadius: 14, backgroundColor: colors.border },
  descriptionText: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },

  sellerRow: { flexDirection: 'row', alignItems: 'center' },
  sellerAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.border, borderWidth: 2, borderColor: colors.border },
  sellerAvatarPlaceholder: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center',
  },
  sellerTextWrap: { marginLeft: 12, flex: 1 },
  sellerName: { fontSize: 15, fontWeight: '800', color: colors.text },
  sellerSub: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },

  postedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  postedDate: { fontSize: 12, color: colors.textSecondary, marginLeft: 5 },

  footer: {
    flexDirection: 'row', paddingHorizontal: 20, paddingTop: 14, backgroundColor: colors.card,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  footerButtonPressed: { opacity: 0.75 },
  whatsappButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981',
    paddingVertical: 13, borderRadius: 14, marginRight: 10,
  },
  callButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary,
    paddingVertical: 13, borderRadius: 14,
  },
  contactButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, marginLeft: 7 },
  noContactText: { flex: 1, fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
});