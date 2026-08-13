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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
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
  const router = useRouter();

  const [ad, setAd] = useState<GemAdDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Currency States
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
      // Silently ignore
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
    
    // Clean the phone number
    const fullNumber = `${ad.user.whatsappCountryCode || ''}${ad.user.whatsappNumber}`.replace(/\D/g, '');
    
    // Create the default message string using dynamic currency
    const displayPrice = formatDisplayPrice(ad.price, prefCurrency, exchangeRate);
    const message = `Hello! I saw your ad on Manik: "${ad.title}" for ${displayPrice}. Is this still available?`;
    
    // Encode the message so it works safely in a URL
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
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
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

          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </Pressable>

          <Pressable style={styles.favoriteButton} onPress={toggleFavorite} disabled={favoriteLoading}>
            <Ionicons name={isFavorited ? 'heart' : 'heart-outline'} size={20} color={isFavorited ? '#EF4444' : '#0F172A'} />
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
            <Text style={styles.metaText}>{ad.category}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{ad.weightCarats}ct</Text>
          </View>

          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color="#94A3B8" />
            <Text style={styles.locationText}>{ad.location.city}, {ad.location.province}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Specifications</Text>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Color</Text>
              <Text style={styles.specValue}>{ad.color}</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Shape & Cut</Text>
              <Text style={styles.specValue}>{ad.shape}</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Origin</Text>
              <Text style={styles.specValue}>{ad.origin || 'Not specified'}</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Clarity</Text>
              <Text style={styles.specValue}>{ad.clarity || 'Not specified'}</Text>
            </View>
            
            {ad.dimensions && (ad.dimensions.length > 0 || ad.dimensions.width > 0) && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Dimensions</Text>
                <Text style={styles.specValue}>
                  {ad.dimensions.length} x {ad.dimensions.width} x {ad.dimensions.depth} mm
                </Text>
              </View>
            )}

            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Treatment</Text>
              <Text style={styles.specValue}>{ad.treatment}</Text>
            </View>
            <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.specLabel}>Certification</Text>
              <Text style={styles.specValue}>
                {ad.certification?.status === 'Certified'
                  ? `Certified (${ad.certification.labName})`
                  : 'Not Certified'}
              </Text>
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
                <Ionicons name="person-circle" size={44} color="#2563EB" />
              )}
              <Text style={styles.sellerName}>{ad.user?.name || 'Manik Seller'}</Text>
            </View>

            <View style={styles.contactButtonsRow}>
              {ad.user?.whatsappNumber ? (
                <Pressable style={styles.whatsappButton} onPress={openWhatsApp}>
                  <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                  <Text style={styles.contactButtonText}>WhatsApp</Text>
                </Pressable>
              ) : null}

              {!ad.hidePhoneNumber && ad.contactPhone ? (
                <Pressable style={styles.callButton} onPress={callSeller}>
                  <Ionicons name="call" size={18} color="#FFFFFF" />
                  <Text style={styles.contactButtonText}>Call</Text>
                </Pressable>
              ) : null}

              {(!ad.user?.whatsappNumber && (ad.hidePhoneNumber || !ad.contactPhone)) && (
                <Text style={styles.noContactText}>This seller has not shared contact details.</Text>
              )}
            </View>
          </View>

          <Text style={styles.postedDate}>
            Posted {new Date(ad.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageCarouselWrapper: { position: 'relative' },
  carouselImage: { width: SCREEN_WIDTH, height: 320, backgroundColor: '#E2E8F0' },
  backButton: { position: 'absolute', top: 16, left: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  favoriteButton: { position: 'absolute', top: 16, right: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  dotsRow: { position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)', marginHorizontal: 3 },
  dotActive: { backgroundColor: '#FFFFFF', width: 16 },
  content: { padding: 22 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  price: { fontSize: 20, fontWeight: '700', color: '#2563EB', marginTop: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  metaText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  metaDot: { fontSize: 13, color: '#CBD5E1', marginHorizontal: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  locationText: { fontSize: 13, color: '#94A3B8', marginLeft: 4 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, elevation: 2, marginTop: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  specLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  specValue: { fontSize: 13, color: '#0F172A', fontWeight: '700', textAlign: 'right', flex: 1, paddingLeft: 10 },
  certificateImage: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#E2E8F0' },
  descriptionText: { fontSize: 14, color: '#334155', lineHeight: 21 },
  sellerRow: { flexDirection: 'row', alignItems: 'center' },
  sellerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E2E8F0' },
  sellerName: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginLeft: 12 },
  contactButtonsRow: { flexDirection: 'row', marginTop: 16 },
  whatsappButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, marginRight: 10 },
  callButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 },
  contactButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13, marginLeft: 6 },
  noContactText: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic' },
  postedDate: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 20 },
});