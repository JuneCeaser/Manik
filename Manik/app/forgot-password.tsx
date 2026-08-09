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

import { API_BASE_URL } from '../constants/api';
import CountryCodePicker, {
  Country,
  DEFAULT_COUNTRY,
  buildFullPhoneNumber,
} from '../components/CountryCodePicker';

type Step = 'PHONE' | 'OTP';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('PHONE');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Send OTP for Forgot Password
  const handleSendOtp = async () => {
    if (!phone.trim()) {
      return Alert.alert('Required', 'Please enter your phone number.');
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/forgot-password/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: buildFullPhoneNumber(country, phone) }),
      });

      const data = await response.json();

      if (data.success) {
        setStep('OTP');
      } else {
        Alert.alert('Error', data.message || 'Could not send reset code.');
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to connect to GemMarket.');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP and Reset Password
  const handleResetPassword = async () => {
    if (otpCode.length !== 6) {
      return Alert.alert('Invalid OTP', 'Please enter the 6-digit code.');
    }
    if (!newPassword || newPassword.length < 6) {
      return Alert.alert('Weak Password', 'Password must be at least 6 characters.');
    }
    if (newPassword !== confirmPassword) {
      return Alert.alert('Mismatch', 'Passwords do not match.');
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/forgot-password/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: buildFullPhoneNumber(country, phone),
          code: otpCode,
          newPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Success', 'Password reset successfully! Please sign in.', [
          { text: 'OK', onPress: () => router.replace('/login') },
        ]);
      } else {
        Alert.alert('Reset Failed', data.message || 'Verification failed.');
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to connect to GemMarket.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Top Bar */}
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={21} color="#0F172A" />
            </Pressable>
            <Text style={styles.topTitle}>Reset Password</Text>
            <View style={{ width: 42 }} />
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {step === 'PHONE' ? (
              <>
                <Text style={styles.title}>Forgot Password?</Text>
                <Text style={styles.subtitle}>Enter your phone number to receive a verification code.</Text>

                <View style={styles.field}>
                  <Text style={styles.label}>Phone Number</Text>
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
                    />
                  </View>
                </View>

                <Pressable onPress={handleSendOtp} disabled={loading} style={styles.button}>
                  <LinearGradient colors={['#0EA5E9', '#2563EB']} style={styles.buttonGradient}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Send Code</Text>}
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.title}>Set New Password</Text>
                <Text style={styles.subtitle}>
                  Enter the 6-digit code sent to +{buildFullPhoneNumber(country, phone)}
                </Text>

                <TextInput
                  style={styles.otpInput}
                  placeholder="000000"
                  placeholderTextColor="#CBD5E1"
                  keyboardType="number-pad"
                  value={otpCode}
                  onChangeText={(val) => setOtpCode(val.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />

                <View style={styles.field}>
                  <Text style={styles.label}>New Password</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="At least 6 characters"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color="#64748B" />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Confirm New Password</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="Re-enter new password"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                  </View>
                </View>

                <Pressable onPress={handleResetPassword} disabled={loading} style={styles.button}>
                  <LinearGradient colors={['#0EA5E9', '#2563EB']} style={styles.buttonGradient}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Update Password</Text>}
                  </LinearGradient>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 30 },
  topBar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  topTitle: { fontSize: 15, fontWeight: '700', color: '#334155' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, elevation: 4 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 7, marginBottom: 24 },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  inputWrapper: { height: 54, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, backgroundColor: '#F8FAFC', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  inputIcon: { marginRight: 11 },
  input: { flex: 1, height: '100%', color: '#0F172A', fontSize: 15 },
  otpInput: { height: 60, borderRadius: 16, borderWidth: 1.5, borderColor: '#BFDBFE', backgroundColor: '#F8FBFF', fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: 8, marginBottom: 20 },
  button: { borderRadius: 15, overflow: 'hidden', marginTop: 10 },
  buttonGradient: { height: 55, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});