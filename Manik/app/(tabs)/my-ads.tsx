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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
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
  const { user, userToken, logout, loginState } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();

  const [ads, setAds] = useState<MyGemAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED'>('PENDING');
  
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pushingId, setPushingId] = useState<string | null>(null);

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

  const performPush = async (adId: string) => {
    setPushingId(adId);
    try {
      const res = await fetch(`${GEMS_URL}/${adId}/push`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();

      if (res.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.');
        logout();
        return;
      }

      if (data.success) {
        // Update user context with new credit balance
        await loginState(userToken!, data.user);
        Alert.alert('Ad Pushed!', 'Your ad has been moved to the top of the market.');
        fetchMyAds(); // Refresh the list
      } else if (res.status === 402 || data.code === 'INSUFFICIENT_CREDITS') {
        Alert.alert('Not Enough Ad Credits', data.message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Get Credits', onPress: () => router.push('/buy-credits') },
        ]);
      } else {
        Alert.alert('Error', data.message || 'Could not push ad.');
      }
    } catch {
      Alert.alert('Error', 'Failed to connect to the server.');
    } finally {
      setPushingId(null);
    }
  };

  const handlePush = (adId: string, title: string) => {
    const credits = (user as any)?.adCredits || 0;
    if (credits < 1) {
      Alert.alert('Not Enough Ad Credits', 'You need 1 ad credit to push your ad to the front.', [
        { text: 'Cancel', style: 'cancel' },
       { text: 'Get Credits', onPress: () => router.push('/buy-credits') },
      ]);
      return;
    }

    Alert.alert(
      'Push Ad to Front',
      `Pushing "${title}" will cost 1 Ad Credit.\n\nYou currently have ${credits} credits left. Proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Push', onPress: () => performPush(adId) },
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
            {/* PUSH BUTTON */}
            <Pressable
              style={styles.pushButton}
              onPress={() => handlePush(item._id, item.title)}
              disabled={pushingId === item._id}
            >
              {pushingId === item._id ? (
                <ActivityIndicator size="small" color="#F59E0B" />
              ) : (
                <>
                  <Ionicons name="arrow-up-circle-outline" size={14} color="#F59E0B" />
                  <Text style={styles.pushButtonText}>Push</Text>
                </>
              )}
            </Pressable>

            {/* EDIT BUTTON */}
            <Pressable style={styles.editButton} onPress={() => handleEdit(item._id)}>
              <Ionicons name="pencil-outline" size={14} color={colors.primary} />
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>

            {/* DELETE BUTTON */}
            <Pressable
              style={styles.deleteButton}
              onPress={() => handleDelete(item._id, item.title)}
              disabled={deletingId === item._id}
            >
              {deletingId === item._id ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={14} color={colors.danger} />
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
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visibleAds}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <Ionicons name="pricetags-outline" size={44} color={colors.border} />
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

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.text, paddingHorizontal: 22, paddingTop: 12 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 22, marginTop: 16, marginBottom: 4 },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    marginRight: 8,
  },
  tabButtonActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: '#FFFFFF' },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { marginTop: 12, fontSize: 14, color: colors.textSecondary, fontWeight: '500', textAlign: 'center', paddingHorizontal: 40 },
  listContent: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 40, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    elevation: 1,
  },
  cardImage: { width: 90, height: '100%', minHeight: 110, backgroundColor: colors.border },
  cardBody: { flex: 1, padding: 12 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  cardPrice: { fontSize: 14, fontWeight: '700', color: colors.primary, marginTop: 6 },
  cardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  cardDate: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  actionRow: { flexDirection: 'row', marginTop: 10, flexWrap: 'wrap' },
  pushButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, marginRight: 8, marginBottom: 6 },
  pushButtonText: { fontSize: 12, fontWeight: '700', color: '#F59E0B', marginLeft: 4 },
  editButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, marginRight: 8, marginBottom: 6 },
  editButtonText: { fontSize: 12, fontWeight: '700', color: colors.primary, marginLeft: 4 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, marginBottom: 6 },
  deleteButtonText: { fontSize: 12, fontWeight: '700', color: colors.danger, marginLeft: 4 },
});