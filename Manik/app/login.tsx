import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Social Auth Imports
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../constants/api';
import CountryCodePicker, { Country, DEFAULT_COUNTRY, buildFullPhoneNumber } from '../components/CountryCodePicker';

export default function LoginScreen() {
  const router = useRouter();
  const { loginState } = useAuth();

  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);

  useEffect(() => {
    // Configure Google Sign in
    GoogleSignin.configure({
      webClientId: 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com', // Replace with your Web Client ID
    });
  }, []);

  const handlePhoneLogin = async () => {
    if (!phone.trim() || !password.trim()) return Alert.alert('Missing information', 'Please enter your phone number and password.');
    if (phone.replace(/\D/g, '').length < 9) return Alert.alert('Invalid phone number', 'Please enter a valid phone number.');
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: buildFullPhoneNumber(country, phone), password }),
      });
      const data = await response.json();
      if (data.success) {
        await loginState(data.token, data.user);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Login failed', data.message || 'Phone number or password is incorrect.');
      }
    } catch (error) {
      Alert.alert('Connection problem', 'Unable to connect to Manik. Please check your internet connection.');
    } finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setSocialLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
// In version 11+, the token is inside the 'data' object
const idToken = userInfo.data?.idToken;

if (!idToken) {
  Alert.alert('Error', 'No ID token found from Google.');
  setSocialLoading(false);
  return;
}

      const response = await fetch(`${API_BASE_URL}/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();
      if (data.success) {
        await loginState(data.token, data.user);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Login failed', data.message || 'Unable to sign in with Google.');
      }
    } catch (error: any) {
      if (error.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('Google Sign-In Error', 'Could not complete Google sign-in.');
      }
    } finally { setSocialLoading(false); }
  };

  const handleAppleLogin = async () => {
    setSocialLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const response = await fetch(`${API_BASE_URL}/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          identityToken: credential.identityToken,
          email: credential.email,
          fullName: credential.fullName
        }),
      });

      const data = await response.json();
      if (data.success) {
        await loginState(data.token, data.user);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Login failed', data.message || 'Unable to sign in with Apple.');
      }
    } catch (error: any) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple Sign-In Error', 'Could not complete Apple sign-in.');
      }
    } finally { setSocialLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            <View style={styles.logoWrapper}>
              <LinearGradient colors={['#38BDF8', '#2563EB']} style={styles.logo}>
                <Ionicons name="diamond" size={27} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <Text style={styles.brand}>Manik</Text>
            <Text style={styles.tagline}>Discover. Trade. Own something rare.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue to your Manik account.</Text>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Phone number</Text>
              <View style={styles.inputWrapper}>
                <CountryCodePicker selectedCountry={country} onSelect={setCountry} />
                <TextInput style={styles.input} placeholder="077 123 4567" placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={phone} onChangeText={setPhone} maxLength={12} autoCapitalize="none" returnKeyType="next" />
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
              </View>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Enter your password" placeholderTextColor="#94A3B8" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} autoCapitalize="none" returnKeyType="done" onSubmitEditing={handlePhoneLogin} />
                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color="#64748B" />
                </Pressable>
              </View>
              <Pressable onPress={() => router.push('/forgot-password')}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            </View>

            <Pressable onPress={handlePhoneLogin} disabled={loading || socialLoading} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, (loading || socialLoading) && styles.buttonDisabled]}>
              <LinearGradient colors={['#0EA5E9', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
                {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <><Text style={styles.buttonText}>Sign in</Text><Ionicons name="arrow-forward" size={20} color="#FFFFFF" /></>}
              </LinearGradient>
            </Pressable>

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.divider} />
            </View>

            {/* Social Buttons */}
            <Pressable onPress={handleGoogleLogin} disabled={socialLoading || loading} style={styles.socialBtn}>
              <Ionicons name="logo-google" size={20} color="#DB4437" />
              <Text style={styles.socialBtnText}>Google</Text>
            </Pressable>

            {Platform.OS === 'ios' && (
              <Pressable onPress={handleAppleLogin} disabled={socialLoading || loading} style={[styles.socialBtn, { backgroundColor: '#000', borderColor: '#000', marginTop: 12 }]}>
                <Ionicons name="logo-apple" size={20} color="#FFF" />
                <Text style={[styles.socialBtnText, { color: '#FFF' }]}>Apple</Text>
              </Pressable>
            )}

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>NEW TO MANIK?</Text>
              <View style={styles.divider} />
            </View>

            <Pressable onPress={() => router.push('/register')} style={styles.registerButton}>
              <Text style={styles.registerText}>Create an account</Text>
            </Pressable>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 55, paddingBottom: 30 },
  header: { alignItems: 'center', marginBottom: 30 },
  logoWrapper: { marginBottom: 14, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 7 },
  logo: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 30, fontWeight: '800', color: '#0F172A', letterSpacing: -0.8 },
  tagline: { marginTop: 6, fontSize: 14, color: '#64748B', textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 4 },
  title: { fontSize: 25, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#64748B', lineHeight: 21, marginTop: 7, marginBottom: 25 },
  fieldContainer: { marginBottom: 18 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  forgotText: { color: '#2563EB', fontSize: 12, fontWeight: '700', marginTop: 6, marginLeft: 'auto' },
  inputWrapper: { height: 54, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, backgroundColor: '#F8FAFC', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  inputIcon: { marginRight: 11 },
  input: { flex: 1, height: '100%', fontSize: 15, color: '#0F172A' },
  button: { marginTop: 5, borderRadius: 15, overflow: 'hidden', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 5 },
  buttonPressed: { transform: [{ scale: 0.985 }] },
  buttonDisabled: { opacity: 0.7 },
  buttonGradient: { height: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 23 },
  divider: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { fontSize: 9, fontWeight: '800', color: '#94A3B8', marginHorizontal: 10, letterSpacing: 0.8 },
  socialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFF' },
  socialBtnText: { fontSize: 15, fontWeight: '700', color: '#334155', marginLeft: 10 },
  registerButton: { height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FBFF' },
  registerText: { color: '#2563EB', fontSize: 15, fontWeight: '800' },
});