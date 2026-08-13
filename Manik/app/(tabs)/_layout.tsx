import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { API_BASE_URL } from '../../constants/api';

const NOTIFICATIONS_URL = `${API_BASE_URL.replace('/auth', '')}/notifications`;

const TabIcon = ({
  name,
  focused,
  isAdd = false,
  showBadge = false,
  colors,
}: {
  name: any;
  focused: boolean;
  isAdd?: boolean;
  showBadge?: boolean;
  colors: any;
}) => {
  const styles = createStyles(colors);
  return (
    <View style={styles.iconContainer}>
      {isAdd ? (
        <View
          style={[
            styles.addBox,
            { borderColor: focused ? colors.primary : colors.textSecondary },
          ]}
        >
          <Ionicons name="add" size={20} color={focused ? colors.primary : colors.textSecondary} />
        </View>
      ) : (
        <View>
          <Ionicons
            name={focused ? name : `${name}-outline`}
            size={26}
            color={focused ? colors.primary : colors.textSecondary}
          />
          {showBadge && <View style={styles.notificationBadge} />}
        </View>
      )}

      {focused && <View style={styles.activeDot} />}
    </View>
  );
};

export default function TabsLayout() {
  const { userToken } = useAuth();
  const { colors } = useTheme();
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
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
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
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} colors={colors} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="heart" focused={focused} colors={colors} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="add" focused={focused} isAdd colors={colors} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="notifications" focused={focused} showBadge={hasUnreadNotifications} colors={colors} />
          ),
        }}
        listeners={{
          tabPress: () => {
            setTimeout(checkUnreadNotifications, 500);
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} colors={colors} />,
        }}
      />

      <Tabs.Screen
        name="subscription"
        options={{
          href: null, 
        }}
      />

      <Tabs.Screen
        name="my-ads"
        options={{
          href: null, 
        }}
      />
    </Tabs>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
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
    backgroundColor: colors.primary,
    position: 'absolute',
    bottom: -8,
  },
  notificationBadge: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.danger,
    position: 'absolute',
    top: -2,
    right: -4,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
});