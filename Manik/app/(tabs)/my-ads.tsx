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
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/api';

const GEMS_URL = `${API_BASE_URL.replace('/auth', '')}/gems`;

type GemAdStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type MyGemAd = {
  _id: string;
  title: string;
  category: string;
  price: { amount: number; currency: 'LKR' | 'USD'; negotiable: boolean };
  weightCarats: number;
  images: { url: string; fileId: string }[];
  status: GemAdStatus;
  creditsUsed: number;
  createdAt: string;
};

const formatPrice = (price: MyGemAd['price']) => {
  const symbol = price.currency === 'USD' ? '$' : 'Rs.';
  return `${symbol} ${price.amount.toLocaleString()}`;
};

export default function MyAdsScreen() {
  const { userToken, logout } = useAuth();
  const router = useRouter();

  const [ads, setAds] = useState<MyGemAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED'>('PENDING');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchMyAds = useCallback(async () => {
    if (!userToken) return;
    try {
      const res = await fetch(`${GEMS_URL}/my-ads`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();

      if (res.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.');
        logout();
        return;
      }

      if (data.success) {
        setAds(data.gemAds);
      }
    } catch {
      Alert.alert('Error', 'Failed to load your ads.');
    } finally {
      setLoading(false);
    }
  }, [userToken, logout]);

  // Refetch every time this screen gains focus, so edits/deletes made
  // elsewhere (or a new ad just posted) are reflected immediately.
  useFocusEffect(
    useCallback(() => {
      fetchMyAds();
    }, [fetchMyAds])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMyAds();
    setRefreshing(false);
  }, [fetchMyAds]);

  const performDelete = async (adId: string) => {
    setDeletingId(adId);
    try {
      const res = await fetch(`${GEMS_URL}/${adId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();

      if (res.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.');
        logout();
        return;
      }

      if (data.success) {
        setAds((prev) => prev.filter((ad) => ad._id !== adId));
      } else {
        Alert.alert('Error', data.message || 'Could not delete ad.');
      }
    } catch {
      Alert.alert('Error', 'Failed to connect to the server.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = (adId: string, title: string) => {
    Alert.alert(
      'Delete Ad',
      `Are you sure you want to delete "${title}"? This cannot be undone, and used ad credits will not be refunded.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => performDelete(adId) },
      ]
    );
  };

  const handleEdit = (adId: string) => {
    router.push(`/add?editId=${adId}`);
  };

  const pendingAds = ads.filter((ad) => ad.status === 'PENDING');
  const publishedAds = ads.filter((ad) => ad.status === 'APPROVED');
  const visibleAds = activeTab === 'PENDING' ? pendingAds : publishedAds;

  const renderItem = ({ item }: { item: MyGemAd }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.images[0]?.url }} style={styles.cardImage} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: item.status === 'PENDING' ? '#F59E0B' : '#10B981' },
            ]}
          >
            <Text style={styles.statusText}>
              {item.status === 'PENDING' ? 'Pending Review' : 'Published'}
            </Text>
          </View>
        </View>

        <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>
        <Text style={styles.cardMeta}>
          {item.category} • {item.weightCarats}ct • {item.creditsUsed} credit{item.creditsUsed > 1 ? 's' : ''} used
        </Text>
        <Text style={styles.cardDate}>Posted {new Date(item.createdAt).toLocaleDateString()}</Text>

        {item.status === 'APPROVED' && (
          <View style={styles.actionRow}>
            <Pressable style={styles.editButton} onPress={() => handleEdit(item._id)}>
              <Ionicons name="pencil-outline" size={14} color="#2563EB" />
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
            <Pressable
              style={styles.deleteButton}
              onPress={() => handleDelete(item._id, item.title)}
              disabled={deletingId === item._id}
            >
              {deletingId === item._id ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.headerTitle}>My Ads</Text>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, activeTab === 'PENDING' && styles.tabButtonActive]}
          onPress={() => setActiveTab('PENDING')}
        >
          <Text style={[styles.tabText, activeTab === 'PENDING' && styles.tabTextActive]}>
            Pending ({pendingAds.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'APPROVED' && styles.tabButtonActive]}
          onPress={() => setActiveTab('APPROVED')}
        >
          <Text style={[styles.tabText, activeTab === 'APPROVED' && styles.tabTextActive]}>
            Published ({publishedAds.length})
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={visibleAds}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <Ionicons name="pricetags-outline" size={44} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                {activeTab === 'PENDING' ? 'No ads waiting for approval.' : 'No published ads yet.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A', paddingHorizontal: 22, paddingTop: 12 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 22, marginTop: 16, marginBottom: 4 },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  tabButtonActive: { backgroundColor: '#2563EB' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  tabTextActive: { color: '#FFFFFF' },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { marginTop: 12, fontSize: 14, color: '#94A3B8', fontWeight: '500', textAlign: 'center', paddingHorizontal: 40 },
  listContent: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 40, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    elevation: 1,
  },
  cardImage: { width: 90, height: '100%', minHeight: 110, backgroundColor: '#E2E8F0' },
  cardBody: { flex: 1, padding: 12 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F172A', marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  cardPrice: { fontSize: 14, fontWeight: '700', color: '#2563EB', marginTop: 6 },
  cardMeta: { fontSize: 12, color: '#64748B', marginTop: 4 },
  cardDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  actionRow: { flexDirection: 'row', marginTop: 10 },
  editButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, marginRight: 8 },
  editButtonText: { fontSize: 12, fontWeight: '700', color: '#2563EB', marginLeft: 4 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  deleteButtonText: { fontSize: 12, fontWeight: '700', color: '#EF4444', marginLeft: 4 },
});