import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../constants/api';
import CountryCodePicker, {
  Country,
  DEFAULT_COUNTRY,
  buildFullPhoneNumber,
} from '../components/CountryCodePicker';

export default function LoginScreen() {
  const router = useRouter();
  const { loginState } = useAuth();

  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert(
        'Missing information',
        'Please enter your phone number and password.'
      );
      return;
    }

    if (phone.replace(/\D/g, '').length < 9) {
      Alert.alert(
        'Invalid phone number',
        'Please enter a valid phone number.'
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: buildFullPhoneNumber(country, phone),
          password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await loginState(data.token, data.user);
        router.replace('/(tabs)');
      } else {
        Alert.alert(
          'Login failed',
          data.message || 'Phone number or password is incorrect.'
        );
      }
    } catch (error) {
      Alert.alert(
        'Connection problem',
        'Unable to connect to Manik. Please check your internet connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoWrapper}>
              <LinearGradient
                colors={['#38BDF8', '#2563EB']}
                style={styles.logo}
              >
                <Ionicons name="diamond" size={27} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <Text style={styles.brand}>Manik</Text>
            <Text style={styles.tagline}>
              Discover. Trade. Own something rare.
            </Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to continue to your Manik account.
            </Text>

            {/* Phone */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Phone number</Text>

              <View style={styles.inputWrapper}>
                <CountryCodePicker
                  selectedCountry={country}
                  onSelect={setCountry}
                />

                <TextInput
                  style={styles.input}
                  placeholder="077 123 4567"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={12}
                  autoCapitalize="none"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>

              
              </View>

              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#64748B"
                  style={styles.inputIcon}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />

                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={10}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={21}
                    color="#64748B"
                  />
                </Pressable>
              </View>
                <Pressable
                  onPress={() => router.push('/forgot-password')}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>
            </View>

            {/* Login button */}
            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
            >
              <LinearGradient
                colors={['#0EA5E9', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Sign in</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={20}
                      color="#FFFFFF"
                    />
                  </>
                )}
              </LinearGradient>
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>NEW TO MANIK?</Text>
              <View style={styles.divider} />
            </View>

            {/* Register */}
            <Pressable
              onPress={() => router.push('/register')}
              style={styles.registerButton}
            >
              <Text style={styles.registerText}>Create an account</Text>
            </Pressable>
          </View>

          {/* Trust message */}
          <View style={styles.trustContainer}>
            <View style={styles.trustItem}>
              <View style={styles.trustIcon}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={17}
                  color="#2563EB"
                />
              </View>

              <Text style={styles.trustText}>Secure account</Text>
            </View>

            <View style={styles.trustDot} />

            <View style={styles.trustItem}>
              <View style={styles.trustIcon}>
                <Ionicons
                  name="diamond-outline"
                  size={17}
                  color="#2563EB"
                />
              </View>

              <Text style={styles.trustText}>Real gemstones</Text>
            </View>
          </View>

          <Text style={styles.footerText}>
            June Ceaser De Soysa
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 55,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoWrapper: {
    marginBottom: 14,
    shadowColor: '#2563EB',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 7,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.8,
  },
  tagline: {
    marginTop: 6,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#0F172A',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 21,
    marginTop: 7,
    marginBottom: 25,
  },
  fieldContainer: {
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  forgotText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    marginLeft: 'auto',
  },
  inputWrapper: {
    height: 54,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 11,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#0F172A',
  },
  button: {
    marginTop: 5,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
  },
  buttonDisabled: {
    opacity: 0.7,
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
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 23,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    marginHorizontal: 10,
    letterSpacing: 0.8,
  },
  registerButton: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FBFF',
  },
  registerText: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '800',
  },
  trustContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 25,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trustIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },
  trustText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  trustDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 14,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 10,
    color: '#94A3B8',
    lineHeight: 16,
    marginTop: 18,
    paddingHorizontal: 20,
  },
});