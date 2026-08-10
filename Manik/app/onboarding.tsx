import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

type Slide = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

const SLIDES: Slide[] = [
  {
    key: '1',
    icon: 'diamond-outline',
    title: 'Discover rare gemstones',
    description:
      'Browse a curated marketplace of certified, ethically sourced gems from trusted sellers.',
  },
  {
    key: '2',
    icon: 'storefront-outline',
    title: 'Buy and sell with ease',
    description:
      'List your own pieces or find your next one, all in a few taps.',
  },
  {
    key: '3',
    icon: 'shield-checkmark-outline',
    title: 'Trade with confidence',
    description:
      'Every account is phone-verified, keeping the marketplace safe and genuine.',
  },
  {
    key: '4',
    icon: 'notifications-outline',
    title: 'Stay in the loop',
    description:
      'Get notified the moment a gem you are watching changes price or sells.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const flatListRef = useRef<FlatList<Slide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const isLastSlide = currentIndex === SLIDES.length - 1;

  const handleFinish = async () => {
    await completeOnboarding();
    router.replace('/login');
  };

  const handleNext = () => {
    if (isLastSlide) {
      handleFinish();
      return;
    }

    flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Skip */}
      {!isLastSlide && (
        <Pressable style={styles.skipButton} onPress={handleFinish} hitSlop={10}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      )}

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <LinearGradient colors={['#DBEAFE', '#EFF6FF']} style={styles.iconCircle}>
              <Ionicons name={item.icon} size={56} color="#2563EB" />
            </LinearGradient>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dotsContainer}>
        {SLIDES.map((slide, index) => (
          <View
            key={slide.key}
            style={[styles.dot, index === currentIndex && styles.dotActive]}
          />
        ))}
      </View>

      {/* Next / Get started */}
      <Pressable onPress={handleNext} style={styles.button}>
        <LinearGradient
          colors={['#0EA5E9', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.buttonGradient}
        >
          <Text style={styles.buttonText}>
            {isLastSlide ? 'Get started' : 'Next'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  skipButton: {
    position: 'absolute',
    top: 16,
    right: 22,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  iconCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  dotActive: {
    width: 22,
    backgroundColor: '#2563EB',
  },
  button: {
    marginHorizontal: 22,
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  buttonGradient: {
    height: 55,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});