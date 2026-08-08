import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Custom Tab Icon component to match your design perfectly
const TabIcon = ({ name, focused, isAdd = false }: { name: any, focused: boolean, isAdd?: boolean }) => {
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
        <Ionicons
          name={focused ? name : `${name}-outline`}
          size={26}
          color={focused ? '#2563EB' : '#94A3B8'}
        />
      )}
      
      {/* The Active Blue Dot */}
      {focused && <View style={styles.activeDot} />}
    </View>
  );
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, // Hides the text labels
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          height: 85, // Taller to match the spacious design
          paddingTop: 10,
          elevation: 0, // Removes Android shadow for a cleaner look
          shadowOpacity: 0, // Removes iOS shadow
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
          tabBarIcon: ({ focused }) => <TabIcon name="notifications" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
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
    bottom: -8, // Pushes the dot just underneath the icon
  },
});