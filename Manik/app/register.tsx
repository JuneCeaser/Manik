import React, { useState, useEffect } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL } from '../constants/api';
import CountryCodePicker, {
  Country,
  DEFAULT_COUNTRY,
  buildFullPhoneNumber,
} from '../components/CountryCodePicker';

type RegisterStep = 'DETAILS' | 'OTP';

export default function RegisterScreen() {
  const router = useRouter();
  const { loginState } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);

  const [step, setStep] = useState<RegisterStep>('DETAILS');
  const [name, setName] = useState('');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => {
      setResendTimer((previous) => previous - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  const validateDetails = () => {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter your full name.'); return false; }
    if (name.trim().length < 2) { Alert.alert('Invalid name', 'Please enter a valid name.'); return false; }
    if (!phone.trim()) { Alert.alert('Phone required', 'Please enter your phone number.'); return false; }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 9) { Alert.alert('Invalid phone number', 'Please enter a valid phone number.'); return false; }
    if (!password) { Alert.alert('Password required', 'Please create a password.'); return false; }
    if (password.length < 6) { Alert.alert('Password too short', 'Your password must contain at least 6 characters.'); return false; }
    if (!confirmPassword) { Alert.alert('Confirm your password', 'Please enter your password again.'); return false; }
    if (password !== confirmPassword) { Alert.alert('Passwords do not match', 'Please make sure both passwords are the same.'); return false; }
    return true;
  };

  const handleSendOtp = async () => {
    if (!validateDetails()) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/register/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: buildFullPhoneNumber(country, phone), password }),
      });
      const data = await response.json();
      if (data.success) {
        setStep('OTP'); setOtpCode(''); setResendTimer(60);
      } else {
        Alert.alert('Unable to continue', data.message || 'Unable to send OTP.');
      }
    } catch (error) {
      Alert.alert('Connection problem', 'Unable to connect to GemMarket. Please check your internet connection and try again.');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) { return Alert.alert('Invalid OTP', 'Please enter the 6-digit verification code.'); }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/register/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: buildFullPhoneNumber(country, phone), code: otpCode }),
      });
      const data = await response.json();
      if (data.success) {
        await loginState(data.token, data.user);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Verification failed', data.message || 'The OTP is incorrect or has expired.');
      }
    } catch (error) {
      Alert.alert('Connection problem', 'Unable to connect to GemMarket. Please try again.');
    } finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || loading) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/register/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: buildFullPhoneNumber(country, phone), password }),
      });
      const data = await response.json();
      if (data.success) {
        setResendTimer(60); setOtpCode('');
        Alert.alert('OTP sent', 'A new verification code has been sent to your phone.');
      } else {
        Alert.alert('Unable to resend', data.message || 'Please try again later.');
      }
    } catch (error) {
      Alert.alert('Connection problem', 'Unable to connect to GemMarket.');
    } finally { setLoading(false); }
  };

  const handleChangeNumber = () => { setOtpCode(''); setStep('DETAILS'); setResendTimer(0); };

  const passwordEntered = password.length > 0;
  const confirmPasswordEntered = confirmPassword.length > 0;
  const passwordsMatch = passwordEntered && confirmPasswordEntered && password === confirmPassword;
  const passwordsDoNotMatch = confirmPasswordEntered && password !== confirmPassword;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
              <Ionicons name="arrow-back" size={21} color={colors.text} />
            </Pressable>
            <Text style={styles.topTitle}>Create account</Text>
            <View style={styles.topPlaceholder} />
          </View>

          <View style={styles.brandSection}>
            <LinearGradient colors={[colors.primary, colors.primary]} style={styles.logo}>
              <Ionicons name="diamond" size={24} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.brand}>Manik</Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressStep}>
              <View style={[styles.progressCircle, styles.progressCircleActive]}>
                {step === 'OTP' ? (
                  <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                ) : (
                  <Text style={styles.progressNumberActive}>1</Text>
                )}
              </View>
              <Text style={[styles.progressText, step === 'DETAILS' && styles.progressTextActive]}>Your details</Text>
            </View>

            <View style={[styles.progressLine, step === 'OTP' && styles.progressLineActive]} />

            <View style={styles.progressStep}>
              <View style={[styles.progressCircle, step === 'OTP' ? styles.progressCircleActive : styles.progressCircleInactive]}>
                <Text style={[styles.progressNumber, step === 'OTP' && styles.progressNumberActive]}>2</Text>
              </View>
              <Text style={[styles.progressText, step === 'OTP' && styles.progressTextActive]}>Verification</Text>
            </View>
          </View>

          {step === 'DETAILS' ? (
            <View style={styles.card}>
              <Text style={styles.title}>Let s get started</Text>
              <Text style={styles.subtitle}>Create your GemMarket account to buy, sell and discover gemstones.</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Full name</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Enter your full name" placeholderTextColor={colors.textSecondary} value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="next" />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Phone number</Text>
                <View style={styles.inputWrapper}>
                  <CountryCodePicker selectedCountry={country} onSelect={setCountry} />
                  <TextInput style={styles.input} placeholder="077 123 4567" placeholderTextColor={colors.textSecondary} keyboardType="phone-pad" value={phone} onChangeText={setPhone} maxLength={12} returnKeyType="next" />
                </View>
                <Text style={styles.helperText}>We ll send a verification code to this number.</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Create a password" placeholderTextColor={colors.textSecondary} secureTextEntry={!showPassword} value={password} onChangeText={setPassword} autoCapitalize="none" returnKeyType="next" />
                  <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <Text style={styles.helperText}>Use at least 6 characters.</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Confirm password</Text>
                <View style={[styles.inputWrapper, passwordsDoNotMatch && styles.inputError, passwordsMatch && styles.inputSuccess]}>
                  <Ionicons 
                    name="shield-checkmark-outline" 
                    size={20} 
                    color={passwordsDoNotMatch ? '#EF4444' : passwordsMatch ? '#16A34A' : colors.textSecondary} 
                    style={styles.inputIcon} 
                  />
                  <TextInput style={styles.input} placeholder="Re-enter your password" placeholderTextColor={colors.textSecondary} secureTextEntry={!showConfirmPassword} value={confirmPassword} onChangeText={setConfirmPassword} autoCapitalize="none" returnKeyType="done" />
                  <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={10}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.textSecondary} />
                  </Pressable>
                </View>

                {passwordsDoNotMatch && (
                  <View style={styles.statusRow}>
                    <Ionicons name="close-circle" size={14} color="#EF4444" />
                    <Text style={styles.errorText}>Passwords do not match</Text>
                  </View>
                )}

                {passwordsMatch && (
                  <View style={styles.statusRow}>
                    <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                    <Text style={styles.successText}>Passwords match</Text>
                  </View>
                )}
              </View>

              <Pressable onPress={handleSendOtp} disabled={loading} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}>
                <LinearGradient colors={[colors.primary, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.buttonText}>Continue</Text><Ionicons name="arrow-forward" size={20} color="#FFFFFF" /></>}
                </LinearGradient>
              </Pressable>

              <View style={styles.loginRow}>
                <Text style={styles.loginText}>Already have an account?</Text>
                <Pressable onPress={() => router.replace('/login')}>
                  <Text style={styles.loginLink}> Sign in</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.otpIconContainer}>
                <LinearGradient colors={[colors.inputBg, colors.inputBg]} style={styles.otpIcon}>
                  <Ionicons name="phone-portrait-outline" size={28} color={colors.primary} />
                </LinearGradient>
              </View>

              <Text style={[styles.title, styles.otpTitle]}>Verify your phone</Text>
              <Text style={styles.subtitle}>Enter the 6-digit code we sent to</Text>

              <View style={styles.phoneDisplay}>
                <Ionicons name="call" size={15} color={colors.primary} />
                <Text style={styles.phoneText}>+{buildFullPhoneNumber(country, phone)}</Text>
                <Pressable onPress={handleChangeNumber}>
                  <Text style={styles.changeText}>Change</Text>
                </Pressable>
              </View>

              <TextInput 
                style={styles.otpInput} 
                placeholder="000000" 
                placeholderTextColor={colors.textSecondary} 
                keyboardType="number-pad" 
                value={otpCode} 
                onChangeText={(value) => setOtpCode(value.replace(/\D/g, '').slice(0, 6))} 
                maxLength={6} 
                autoFocus 
                textAlign="center" 
              />

              <Text style={styles.otpHint}>Enter the code exactly as received.</Text>

              <Pressable onPress={handleVerifyOtp} disabled={loading} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}>
                <LinearGradient colors={[colors.primary, colors.primary]} style={styles.buttonGradient}>
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.buttonText}>Verify & create account</Text><Ionicons name="checkmark-circle-outline" size={21} color="#FFFFFF" /></>}
                </LinearGradient>
              </Pressable>

              <View style={styles.resendContainer}>
                <Text style={styles.resendText}>Didn t receive the code?</Text>
                <Pressable onPress={handleResendOtp} disabled={resendTimer > 0 || loading}>
                  <Text style={[styles.resendLink, resendTimer > 0 && styles.resendDisabled]}>
                    {resendTimer > 0 ? ` Resend in ${resendTimer}s` : ' Resend OTP'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          <Text style={styles.footerText}>Your phone number is used for account verification and security.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 30 },
  topBar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  topTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  topPlaceholder: { width: 42 },
  brandSection: { alignItems: 'center', marginTop: 15, marginBottom: 25 },
  logo: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  brand: { fontSize: 22, fontWeight: '800', color: colors.text },
  progressContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingHorizontal: 5 },
  progressStep: { alignItems: 'center' },
  progressCircle: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  progressCircleActive: { backgroundColor: colors.primary },
  progressCircleInactive: { backgroundColor: colors.border },
  progressNumber: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
  progressNumberActive: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  progressText: { fontSize: 10, color: colors.textSecondary, marginTop: 5, fontWeight: '600' },
  progressTextActive: { color: colors.primary },
  progressLine: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 8, marginBottom: 18 },
  progressLineActive: { backgroundColor: colors.primary },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 4 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, marginTop: 7, marginBottom: 24 },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },
  inputWrapper: { height: 54, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.inputBg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  inputError: { borderColor: '#EF4444' },
  inputSuccess: { borderColor: '#10B981' },
  inputIcon: { marginRight: 11 },
  input: { flex: 1, height: '100%', color: colors.text, fontSize: 15 },
  helperText: { fontSize: 11, color: colors.textSecondary, marginTop: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 5 },
  errorText: { color: '#EF4444', fontSize: 11, fontWeight: '600' },
  successText: { color: '#10B981', fontSize: 11, fontWeight: '600' },
  button: { borderRadius: 15, overflow: 'hidden', marginTop: 3, shadowColor: colors.primary, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 5 },
  buttonPressed: { transform: [{ scale: 0.985 }] },
  buttonDisabled: { opacity: 0.7 },
  buttonGradient: { height: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  loginText: { fontSize: 13, color: colors.textSecondary },
  loginLink: { fontSize: 13, fontWeight: '800', color: colors.primary },
  otpIconContainer: { alignItems: 'center', marginBottom: 18 },
  otpIcon: { width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  otpTitle: { textAlign: 'center' },
  phoneDisplay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  phoneText: { fontSize: 14, fontWeight: '700', color: colors.text, marginLeft: 6 },
  changeText: { fontSize: 12, fontWeight: '800', color: colors.primary, marginLeft: 10 },
  otpInput: { height: 66, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.inputBg, fontSize: 27, fontWeight: '800', color: colors.text, letterSpacing: 10, paddingLeft: 10 },
  otpHint: { textAlign: 'center', fontSize: 11, color: colors.textSecondary, marginTop: 8, marginBottom: 20 },
  resendContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  resendText: { fontSize: 12, color: colors.textSecondary },
  resendLink: { fontSize: 12, fontWeight: '800', color: colors.primary },
  resendDisabled: { color: colors.textSecondary },
  footerText: { textAlign: 'center', fontSize: 10, color: colors.textSecondary, lineHeight: 16, marginTop: 20, paddingHorizontal: 20 },
});