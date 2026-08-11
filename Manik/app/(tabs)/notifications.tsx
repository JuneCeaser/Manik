import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/api';

type NotificationType = 'PAYMENT_APPROVED' | 'GENERAL';

type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
};

const NOTIFICATIONS_URL = `${API_BASE_URL.replace('/auth', '')}/notifications`;

const getIconForType = (type: NotificationType) => {
  if (type === 'PAYMENT_APPROVED') return 'wallet-outline';
  return 'notifications-outline';
};

const getIconColorForType = (type: NotificationType) => {
  if (type === 'PAYMENT_APPROVED') return '#10B981';
  return '#2563EB';
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export default function NotificationsScreen() {
  const { userToken, logout } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!userToken) return;
    try {
      const res = await fetch(NOTIFICATIONS_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
      });

      const data = await res.json();

      if (res.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.');
        logout();
        return;
      }

      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch {
      Alert.alert('Error', 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [userToken, logout]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
    );

    try {
      const res = await fetch(`${NOTIFICATIONS_URL}/${id}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
      });
      const data = await res.json();

      if (res.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.');
        logout();
        return;
      }

      if (!data.success) {
        // Revert on failure
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, isRead: false } : n))
        );
      }
    } catch {
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: false } : n))
      );
    }
  };

  const markAllAsRead = async () => {
    const hasUnread = notifications.some((n) => !n.isRead);
    if (!hasUnread) return;

    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      const res = await fetch(`${NOTIFICATIONS_URL}/read-all`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
      });
      const data = await res.json();

      if (res.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.');
        logout();
        return;
      }

      if (!data.success) {
        setNotifications(previous);
      }
    } catch {
      setNotifications(previous);
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <Pressable
      style={[styles.notificationCard, !item.isRead && styles.notificationCardUnread]}
      onPress={() => !item.isRead && markAsRead(item._id)}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${getIconColorForType(item.type)}1A` }]}>
        <Ionicons name={getIconForType(item.type) as any} size={22} color={getIconColorForType(item.type)} />
      </View>

      <View style={styles.notificationBody}>
        <View style={styles.notificationHeaderRow}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.notificationMessage}>{item.message}</Text>
        <Text style={styles.notificationTime}>{formatTimeAgo(item.createdAt)}</Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Notifications</Text>
        {notifications.some((n) => !n.isRead) && (
          <Pressable onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />
          }
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <Ionicons name="notifications-off-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>No notifications yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#0F172A' },
  markAllText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { marginTop: 12, fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  listContent: { paddingHorizontal: 22, paddingBottom: 40, flexGrow: 1 },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    elevation: 1,
  },
  notificationCardUnread: {
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#F5F9FF',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationBody: { flex: 1 },
  notificationHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  notificationTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB', marginLeft: 8 },
  notificationMessage: { fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 },
  notificationTime: { fontSize: 11, color: '#94A3B8', marginTop: 6, fontWeight: '500' },
});