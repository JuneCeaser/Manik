import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/api';

const NOTIFICATIONS_URL = `${API_BASE_URL.replace('/auth', '')}/notifications`;

// Custom Tab Icon component
const TabIcon = ({
  name,
  focused,
  isAdd = false,
  showBadge = false,
}: {
  name: any;
  focused: boolean;
  isAdd?: boolean;
  showBadge?: boolean;
}) => {
  return (
    <View style={styles.iconContainer}>
      {isAdd ? (
        <View
          style={[
            styles.addBox,
            { borderColor: focused ? '#2563EB' : '#94A3B8' },
          ]}
        >
          <Ionicons name="add" size={20} color={focused ? '#2563EB' : '#94A3B8'} />
        </View>
      ) : (
        <View>
          <Ionicons
            name={focused ? name : `${name}-outline`}
            size={26}
            color={focused ? '#2563EB' : '#94A3B8'}
          />
          {showBadge && <View style={styles.notificationBadge} />}
        </View>
      )}

      {/* Active Blue Dot */}
      {focused && <View style={styles.activeDot} />}
    </View>
  );
};

export default function TabsLayout() {
  const { userToken } = useAuth();
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  const checkUnreadNotifications = useCallback(async () => {
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
      if (data.success) {
        setHasUnreadNotifications(data.notifications.some((n: any) => !n.isRead));
      }
    } catch {
      // Silently ignore - badge just won't refresh this cycle
    }
  }, [userToken]);

  useEffect(() => {
    checkUnreadNotifications();
    const interval = setInterval(checkUnreadNotifications, 30000);
    return () => clearInterval(interval);
  }, [checkUnreadNotifications]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          height: 85,
          paddingTop: 10,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="heart" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="add" focused={focused} isAdd />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="notifications" focused={focused} showBadge={hasUnreadNotifications} />
          ),
        }}
        listeners={{
          tabPress: () => {
            // Re-check shortly after the user opens the tab, since the
            // notifications screen marks items read as they're tapped.
            setTimeout(checkUnreadNotifications, 500);
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
        }}
      />

      {/* HIDDEN TAB: Subscription Page */}
      <Tabs.Screen
        name="subscription"
        options={{
          href: null, // Hides this screen completely from the bottom tab bar
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  addBox: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#2563EB',
    position: 'absolute',
    bottom: -8,
  },
  notificationBadge: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#EF4444',
    position: 'absolute',
    top: -2,
    right: -4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});