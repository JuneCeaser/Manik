import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { API_BASE_URL } from '../../constants/api';
import { getPreferredCurrency } from '../../utils/currency';

type ActiveModal = 'NONE' | 'SETTINGS' | 'CHANGE_NAME' | 'CHANGE_PASSWORD' | 'DELETE_ACCOUNT' | 'ADD_WHATSAPP' | 'ADD_LOCATION';

const COUNTRY_CODES = [
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+974', country: 'Qatar', flag: '🇶🇦' },
  { code: '+965', country: 'Kuwait', flag: '🇰🇼' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+1', country: 'USA / Canada', flag: '🇺🇸' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
];

const PROVINCE_CITY_MAP: Record<string, string[]> = {
  Western: ['Colombo', 'Dehiwala-Mount Lavinia', 'Moratuwa', 'Negombo', 'Gampaha', 'Kalutara', 'Panadura', 'Ja-Ela'],
  Central: ['Kandy', 'Matale', 'Nuwara Eliya', 'Gampola', 'Nawalapitiya', 'Hatton'],
  Southern: ['Galle', 'Matara', 'Hambantota', 'Tangalle', 'Weligama', 'Ambalangoda'],
  Northern: ['Jaffna', 'Vavuniya', 'Mannar', 'Kilinochchi', 'Mullaitivu', 'Point Pedro'],
  Eastern: ['Trincomalee', 'Batticaloa', 'Ampara', 'Kalmunai', 'Kattankudy'],
  'North Western': ['Kurunegala', 'Puttalam', 'Chilaw', 'Wariyapola', 'Kuliyapitiya'],
  'North Central': ['Anuradhapura', 'Polonnaruwa', 'Kekirawa', 'Medawachchiya'],
  Uva: ['Badulla', 'Bandarawela', 'Moneragala', 'Wellawaya', 'Haputale'],
  Sabaragamuwa: ['Ratnapura', 'Kegalle', 'Embilipitiya', 'Balangoda'],
};

const PROVINCES = Object.keys(PROVINCE_CITY_MAP);

// Small wrapper around react-native-toast-message so every call site stays
// short and consistent. type controls the toast's color/icon preset
// ('success' | 'error' | 'info'); text2 is the optional secondary line.
const showToast = (type: 'success' | 'error' | 'info', text1: string, text2?: string) => {
  Toast.show({ type, text1, text2, position: 'top', visibilityTime: 3000 });
};

export default function ProfileScreen() {
  // Added updatePreferredCurrency from context
  const { user, userToken, logout, loginState, updatePreferredCurrency } = useAuth();
  const { colors, theme, setTheme } = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();

  const [activeModal, setActiveModal] = useState<ActiveModal>('NONE');
  const [step, setStep] = useState<'INPUT' | 'OTP'>('INPUT');
  const [loading, setLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [currencyPref, setCurrencyPref] = useState<'LKR' | 'USD'>('LKR');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const [whatsappCode, setWhatsappCode] = useState('+94');
  const [whatsappNumberInput, setWhatsappNumberInput] = useState('');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);

  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [provincePickerVisible, setProvincePickerVisible] = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getPreferredCurrency().then(setCurrencyPref);
    }, [])
  );

  const handleCurrencyChange = async (curr: 'LKR' | 'USD') => {
    setCurrencyPref(curr);
    await updatePreferredCurrency(curr); // This now updates global context properly
  };

  const closeModal = () => {
    setActiveModal('NONE');
    setStep('INPUT');
    setNewName('');
    setNewPassword('');
    setOtpCode('');
    setCountryPickerVisible(false);
    setProvincePickerVisible(false);
    setCityPickerVisible(false);
  };

  const openWhatsappModal = () => {
    setWhatsappCode((user as any)?.whatsappCountryCode || '+94');
    setWhatsappNumberInput((user as any)?.whatsappNumber || '');
    setActiveModal('ADD_WHATSAPP');
  };

  const openLocationModal = () => {
    setSelectedProvince((user as any)?.province || '');
    setSelectedCity((user as any)?.city || '');
    setActiveModal('ADD_LOCATION');
  };

  const onRefresh = useCallback(async () => {
    if (!userToken) return;
    setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/profile`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();

      if (res.status === 401 || !data.success) {
        showToast('error', 'Session Expired', 'Your account has been deleted or is no longer valid.');
        logout();
        return;
      }
      if (data.user) await loginState(userToken, data.user);
    } catch {
      showToast('error', 'Error', 'Failed to refresh profile data.');
    } finally {
      setRefreshing(false);
    }
  }, [userToken, logout, loginState]);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) return showToast('info', 'Permission Required', 'You need to allow access to your photos.');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });

    if (!result.canceled && result.assets[0].base64) handleUploadImage(result.assets[0].base64);
  };

  const handleUploadImage = async (base64String: string) => {
    setImageUploading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/profile-image`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ base64Image: base64String }),
      });
      const data = await res.json();
      if (res.status === 401) { logout(); return; }
      if (data.success) {
        await loginState(userToken!, data.user);
        showToast('success', 'Profile Photo Updated');
      } else showToast('error', 'Upload Failed', data.message);
    } catch {
      showToast('error', 'Error', 'Failed to connect to the server.');
    } finally {
      setImageUploading(false);
    }
  };

  const handleChangeName = async () => {
    if (!newName.trim()) return showToast('error', 'Required', 'Please enter a new name.');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/change-name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ newName }),
      });
      const data = await res.json();
      if (res.status === 401) { logout(); return; }
      if (data.success) {
        await loginState(userToken!, data.user);
        showToast('success', 'Success', 'Name updated successfully.');
        setActiveModal('SETTINGS');
      } else showToast('error', 'Error', data.message);
    } catch { showToast('error', 'Error', 'Failed to update name.'); } finally { setLoading(false); }
  };

  const handleUpdateWhatsapp = async () => {
    const cleanNumber = whatsappNumberInput.replace(/\D/g, '');
    if (!cleanNumber || cleanNumber.length < 6) return showToast('error', 'Required', 'Please enter a valid WhatsApp number.');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/whatsapp-number`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ whatsappCountryCode: whatsappCode, whatsappNumber: cleanNumber }),
      });
      const data = await res.json();
      if (res.status === 401) { logout(); return; }
      if (data.success) {
        await loginState(userToken!, data.user);
        showToast('success', 'Success', 'WhatsApp number saved.');
        closeModal();
      } else showToast('error', 'Error', data.message);
    } catch { showToast('error', 'Error', 'Failed to save WhatsApp number.'); } finally { setLoading(false); }
  };

  const handleUpdateLocation = async () => {
    if (!selectedProvince || !selectedCity) return showToast('error', 'Required', 'Please select both province and city.');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ province: selectedProvince, city: selectedCity }),
      });
      const data = await res.json();
      if (res.status === 401) { logout(); return; }
      if (data.success) {
        await loginState(userToken!, data.user);
        showToast('success', 'Success', 'Location saved.');
        closeModal();
      } else showToast('error', 'Error', data.message);
    } catch { showToast('error', 'Error', 'Failed to save location.'); } finally { setLoading(false); }
  };

  const handleSendPasswordOtp = async () => {
    if (!newPassword || newPassword.length < 6) return showToast('error', 'Error', 'New password must be at least 6 characters.');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/change-password/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();
      if (res.status === 401) { logout(); return; }
      if (data.success) setStep('OTP');
      else showToast('error', 'Error', data.message);
    } catch { showToast('error', 'Error', 'Failed to send OTP.'); } finally { setLoading(false); }
  };

  const handleVerifyPasswordOtp = async () => {
    if (otpCode.length !== 6) return showToast('error', 'Required', 'Enter 6-digit OTP.');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/change-password/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ code: otpCode, newPassword }),
      });
      const data = await res.json();
      if (res.status === 401) { logout(); return; }
      if (data.success) {
        showToast('success', 'Success', 'Password updated.');
        setActiveModal('SETTINGS');
      } else showToast('error', 'Error', data.message);
    } catch { showToast('error', 'Error', 'Failed to update password.'); } finally { setLoading(false); }
  };

  const handleSendDeleteOtp = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/delete-account/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();
      if (res.status === 401) { logout(); return; }
      if (data.success) setStep('OTP');
      else showToast('error', 'Error', data.message);
    } catch { showToast('error', 'Error', 'Failed to request deletion.'); } finally { setLoading(false); }
  };

  const handleVerifyDeleteOtp = async () => {
    if (otpCode.length !== 6) return showToast('error', 'Required', 'Enter 6-digit OTP.');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/delete-account/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ code: otpCode }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', 'Account Deleted', 'Your account has been deleted.');
        closeModal();
        logout();
      } else showToast('error', 'Error', data.message);
    } catch { showToast('error', 'Error', 'Failed to delete account.'); } finally { setLoading(false); }
  };

  const goBackOrClose = activeModal === 'SETTINGS' ? closeModal : () => setActiveModal('SETTINGS');

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <View style={styles.topBar}>
        <Text style={styles.topBarEyebrow}>Your Account</Text>
        <Text style={styles.topBarTitle}>Manik Dashboard</Text>
      </View>

      {!user && (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingStateText}>Loading your profile…</Text>
        </View>
      )}

      {user && (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroBackdrop} />
            <Pressable onPress={pickImage} disabled={imageUploading} style={styles.avatarWrapper}>
              {user.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={34} color={colors.primary} />
                </View>
              )}
              <View style={styles.editBadge}>
                {imageUploading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="camera" size={13} color="#FFFFFF" />}
              </View>
            </Pressable>

            <Text style={styles.userName}>{user.name}</Text>
            <View style={styles.phonePill}>
              <Ionicons name="call-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.userPhone}>+{user.phone}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.walletCard, pressed && styles.rowPressed]}
            onPress={() => router.push('/buy-credits')}
          >
            <View style={styles.walletBackdrop} />
            <View style={styles.walletIconBadge}>
              <Ionicons name="wallet-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.walletTextWrap}>
              <Text style={styles.walletLabel}>Ad Credits</Text>
              <Text style={styles.walletSub}>Top up or manage your subscription</Text>
            </View>
            <Text style={styles.walletValue}>{(user as any)?.adCredits || 0}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Preferences</Text>

            <View style={[styles.prefRow, styles.prefRowLast]}>
              <View style={styles.prefRowLabel}>
                <Ionicons name="cash-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.prefRowText}>Display Currency</Text>
              </View>
              <View style={styles.segmented}>
                <Pressable style={[styles.segment, currencyPref === 'LKR' && styles.segmentActive]} onPress={() => handleCurrencyChange('LKR')}>
                  <Text style={[styles.segmentText, currencyPref === 'LKR' && styles.segmentTextActive]}>LKR</Text>
                </Pressable>
                <Pressable style={[styles.segment, currencyPref === 'USD' && styles.segmentActive]} onPress={() => handleCurrencyChange('USD')}>
                  <Text style={[styles.segmentText, currencyPref === 'USD' && styles.segmentTextActive]}>USD</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Account</Text>

            <Pressable style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]} onPress={() => router.push('/my-ads')}>
              <View style={styles.rowIconBadge}>
                <Ionicons name="pricetags-outline" size={17} color={colors.textSecondary} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>My Ads</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>

            <Pressable style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]} onPress={openWhatsappModal}>
              <View style={styles.rowIconBadge}>
                <Ionicons name="logo-whatsapp" size={17} color="#25D366" />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>WhatsApp Number</Text>
                <Text style={styles.rowSubtitle}>
                  {(user as any)?.whatsappNumber ? `${(user as any).whatsappCountryCode} ${(user as any).whatsappNumber}` : 'Not set'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>

            <Pressable style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]} onPress={openLocationModal}>
              <View style={styles.rowIconBadge}>
                <Ionicons name="location-outline" size={17} color={colors.textSecondary} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Location</Text>
                <Text style={styles.rowSubtitle}>
                  {(user as any)?.city ? `${(user as any).city}, ${(user as any).province}` : 'Not set'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.listRow, styles.listRowLast, pressed && styles.rowPressed]}
              onPress={() => setActiveModal('SETTINGS')}
            >
              <View style={styles.rowIconBadge}>
                <Ionicons name="settings-outline" size={17} color={colors.textSecondary} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        </>
      )}

      <Modal visible={activeModal !== 'NONE'} animationType="slide" transparent onRequestClose={goBackOrClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={styles.sheetOverlay} onPress={goBackOrClose}>
            <Pressable style={styles.sheetCard} onPress={() => {}}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {activeModal === 'SETTINGS' && 'Account Settings'}
                  {activeModal === 'CHANGE_NAME' && 'Change Name'}
                  {activeModal === 'CHANGE_PASSWORD' && 'Change Password'}
                  {activeModal === 'DELETE_ACCOUNT' && 'Delete Account'}
                  {activeModal === 'ADD_WHATSAPP' && 'WhatsApp Number'}
                  {activeModal === 'ADD_LOCATION' && 'Location'}
                </Text>
                <Pressable style={styles.sheetCloseBtn} onPress={goBackOrClose}>
                  <Ionicons name={activeModal === 'SETTINGS' ? 'close' : 'arrow-back'} size={20} color={colors.text} />
                </Pressable>
              </View>

              {activeModal === 'SETTINGS' && (
                <View>
                  <View style={styles.prefRow}>
                    <View style={styles.prefRowLabel}>
                      <Ionicons name="contrast-outline" size={15} color={colors.textSecondary} />
                      <Text style={styles.prefRowText}>Display Theme</Text>
                    </View>
                    <View style={styles.segmented}>
                      <Pressable style={[styles.segment, theme === 'system' && styles.segmentActive]} onPress={() => setTheme('system')}>
                        <Text style={[styles.segmentText, theme === 'system' && styles.segmentTextActive]}>System</Text>
                      </Pressable>
                      <Pressable style={[styles.segment, theme === 'light' && styles.segmentActive]} onPress={() => setTheme('light')}>
                        <Text style={[styles.segmentText, theme === 'light' && styles.segmentTextActive]}>Light</Text>
                      </Pressable>
                      <Pressable style={[styles.segment, theme === 'dark' && styles.segmentActive]} onPress={() => setTheme('dark')}>
                        <Text style={[styles.segmentText, theme === 'dark' && styles.segmentTextActive]}>Dark</Text>
                      </Pressable>
                    </View>
                  </View>

                  <Pressable style={styles.sheetListRow} onPress={() => setActiveModal('CHANGE_NAME')}>
                    <View style={styles.sheetRowIcon}>
                      <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
                    </View>
                    <Text style={styles.sheetRowText}>Change Name</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </Pressable>

                  <Pressable style={styles.sheetListRow} onPress={() => { setStep('INPUT'); setActiveModal('CHANGE_PASSWORD'); }}>
                    <View style={styles.sheetRowIcon}>
                      <Ionicons name="key-outline" size={18} color={colors.textSecondary} />
                    </View>
                    <Text style={styles.sheetRowText}>Change Password</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </Pressable>

                  <Pressable style={[styles.sheetListRow, styles.listRowLast]} onPress={() => { setStep('INPUT'); setActiveModal('DELETE_ACCOUNT'); }}>
                    <View style={styles.sheetRowIcon}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </View>
                    <Text style={[styles.sheetRowText, { color: colors.danger }]}>Delete Account</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </Pressable>

                  <Pressable onPress={logout} style={({ pressed }) => [styles.logoutButton, pressed && styles.rowPressed]}>
                    <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.logoutText}>Log Out</Text>
                  </Pressable>
                </View>
              )}

              {activeModal === 'CHANGE_NAME' && (
                <View>
                  <Text style={styles.fieldLabel}>Full Name</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
                    <TextInput
                      style={styles.inputField}
                      placeholderTextColor={colors.textSecondary}
                      placeholder="Enter your full name"
                      value={newName}
                      onChangeText={setNewName}
                    />
                  </View>
                  <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.rowPressed]} onPress={handleChangeName} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Update Name</Text>}
                  </Pressable>
                </View>
              )}

              {activeModal === 'ADD_WHATSAPP' && (
                <View>
                  <View style={styles.infoBanner}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} style={{ marginRight: 8, marginTop: 1 }} />
                    <Text style={styles.infoBannerText}>This number isn t verified — it s just how buyers and sellers reach you on WhatsApp.</Text>
                  </View>
                  <Text style={styles.fieldLabel}>WhatsApp Number</Text>
                  <View style={styles.phoneRow}>
                    <Pressable style={styles.codeSelector} onPress={() => setCountryPickerVisible(true)}>
                      <Text style={styles.codeSelectorText}>{whatsappCode}</Text>
                      <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                    </Pressable>
                    <TextInput
                      style={styles.phoneInput}
                      placeholderTextColor={colors.textSecondary}
                      placeholder="77 123 4567"
                      keyboardType="phone-pad"
                      value={whatsappNumberInput}
                      onChangeText={setWhatsappNumberInput}
                    />
                  </View>
                  <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.rowPressed]} onPress={handleUpdateWhatsapp} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Save Number</Text>}
                  </Pressable>
                </View>
              )}

              {activeModal === 'ADD_LOCATION' && (
                <View>
                  <View style={styles.infoBanner}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} style={{ marginRight: 8, marginTop: 1 }} />
                    <Text style={styles.infoBannerText}>Select your province and city so buyers and sellers know roughly where you are.</Text>
                  </View>

                  <Text style={styles.fieldLabel}>Province</Text>
                  <Pressable style={styles.dropdownSelector} onPress={() => setProvincePickerVisible(true)}>
                    <Text style={selectedProvince ? styles.dropdownSelectedText : styles.dropdownPlaceholderText}>
                      {selectedProvince || 'Select Province'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                  </Pressable>

                  <Text style={styles.fieldLabel}>City</Text>
                  <Pressable
                    style={[styles.dropdownSelector, !selectedProvince && styles.dropdownDisabled]}
                    onPress={() => selectedProvince && setCityPickerVisible(true)}
                    disabled={!selectedProvince}
                  >
                    <Text style={selectedCity ? styles.dropdownSelectedText : styles.dropdownPlaceholderText}>
                      {selectedCity || (selectedProvince ? 'Select City' : 'Select a province first')}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                  </Pressable>

                  <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.rowPressed]} onPress={handleUpdateLocation} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Save Location</Text>}
                  </Pressable>
                </View>
              )}

              {activeModal === 'CHANGE_PASSWORD' && (
                step === 'INPUT' ? (
                  <View>
                    <Text style={styles.fieldLabel}>New Password</Text>
                    <View style={styles.inputWrap}>
                      <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
                      <TextInput
                        style={styles.inputField}
                        placeholderTextColor={colors.textSecondary}
                        placeholder="At least 6 characters"
                        secureTextEntry
                        value={newPassword}
                        onChangeText={setNewPassword}
                      />
                    </View>
                    <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.rowPressed]} onPress={handleSendPasswordOtp} disabled={loading}>
                      {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Send OTP</Text>}
                    </Pressable>
                  </View>
                ) : (
                  <View>
                    <Text style={styles.fieldLabel}>Verification Code</Text>
                    <TextInput
                      style={styles.otpInput}
                      placeholderTextColor={colors.textSecondary}
                      placeholder="——————"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      textContentType="oneTimeCode"
                      autoComplete="sms-otp"
                      importantForAutofill="yes"
                    />
                    <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.rowPressed]} onPress={handleVerifyPasswordOtp} disabled={loading}>
                      {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Verify & Change</Text>}
                    </Pressable>
                  </View>
                )
              )}

              {activeModal === 'DELETE_ACCOUNT' && (
                step === 'INPUT' ? (
                  <View>
                    <View style={styles.dangerBanner}>
                      <Ionicons name="warning-outline" size={18} color={colors.danger} />
                      <Text style={styles.dangerBannerText}>
                        This action is permanent and cannot be undone. All your data and images will be erased.
                      </Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.danger }, pressed && styles.rowPressed]}
                      onPress={handleSendDeleteOtp}
                      disabled={loading}
                    >
                      {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Yes, Send OTP</Text>}
                    </Pressable>
                  </View>
                ) : (
                  <View>
                    <Text style={styles.fieldLabel}>Verification Code</Text>
                    <Text style={styles.infoBannerText}>Enter the 6-digit code sent to your phone to confirm deletion.</Text>
                    <TextInput
                      style={[styles.otpInput, { marginTop: 14 }]}
                      placeholderTextColor={colors.textSecondary}
                      placeholder="——————"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      textContentType="oneTimeCode"
                      autoComplete="sms-otp"
                      importantForAutofill="yes"
                    />
                    <Pressable
                      style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.danger }, pressed && styles.rowPressed]}
                      onPress={handleVerifyDeleteOtp}
                      disabled={loading}
                    >
                      {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Verify & Delete Account</Text>}
                    </Pressable>
                  </View>
                )
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={countryPickerVisible} animationType="slide" transparent onRequestClose={() => setCountryPickerVisible(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setCountryPickerVisible(false)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Country Code</Text>
              <Pressable style={styles.sheetCloseBtn} onPress={() => setCountryPickerVisible(false)}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={(item) => item.code + item.country}
              style={styles.pickerList}
              renderItem={({ item }) => {
                const selected = item.code === whatsappCode;
                return (
                  <Pressable
                    style={({ pressed }) => [styles.pickerRow, pressed && styles.rowPressed]}
                    onPress={() => { setWhatsappCode(item.code); setCountryPickerVisible(false); }}
                  >
                    <Text style={styles.countryFlag}>{item.flag}</Text>
                    <Text style={styles.pickerRowText}>{item.country}</Text>
                    <Text style={styles.pickerRowMeta}>{item.code}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={provincePickerVisible} animationType="slide" transparent onRequestClose={() => setProvincePickerVisible(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setProvincePickerVisible(false)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Province</Text>
              <Pressable style={styles.sheetCloseBtn} onPress={() => setProvincePickerVisible(false)}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <FlatList
              data={PROVINCES}
              keyExtractor={(item) => item}
              style={styles.pickerList}
              renderItem={({ item }) => {
                const selected = item === selectedProvince;
                return (
                  <Pressable
                    style={({ pressed }) => [styles.pickerRow, pressed && styles.rowPressed]}
                    onPress={() => { setSelectedProvince(item); setSelectedCity(''); setProvincePickerVisible(false); }}
                  >
                    <Text style={styles.pickerRowText}>{item}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={cityPickerVisible} animationType="slide" transparent onRequestClose={() => setCityPickerVisible(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setCityPickerVisible(false)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select City</Text>
              <Pressable style={styles.sheetCloseBtn} onPress={() => setCityPickerVisible(false)}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <FlatList
              data={PROVINCE_CITY_MAP[selectedProvince] || []}
              keyExtractor={(item) => item}
              style={styles.pickerList}
              renderItem={({ item }) => {
                const selected = item === selectedCity;
                return (
                  <Pressable
                    style={({ pressed }) => [styles.pickerRow, pressed && styles.rowPressed]}
                    onPress={() => { setSelectedCity(item); setCityPickerVisible(false); }}
                  >
                    <Text style={styles.pickerRowText}>{item}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
      {/* Developer Credit */}
          <View style={styles.developerCredit}>
            <Text style={styles.versionText}>Manik App v1.0.0</Text>
            <Text style={styles.developerText}>
              Designed & Developed by June Ceaser De Soysa
            </Text>
          </View>
          
        </ScrollView>
    
    {/* Fallback mount point. Prefer moving <Toast /> to your root layout
        (see notes) so toasts still render after this screen unmounts —
        e.g. right before logout() navigates away. */}
    <Toast />
    </>
  );
}

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 60 },

  topBar: { marginBottom: 22 },
  topBarEyebrow: { fontSize: 12.5, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  topBarTitle: { fontSize: 26, fontWeight: '800', color: colors.text },

  loadingState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingStateText: { marginTop: 12, fontSize: 14, color: colors.textSecondary, fontWeight: '600' },

  heroCard: {
    backgroundColor: colors.card, borderRadius: 28, paddingTop: 40, paddingBottom: 26, paddingHorizontal: 20,
    alignItems: 'center', marginBottom: 16, overflow: 'hidden', position: 'relative', ...cardShadow,
  },
  heroBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, height: 92, backgroundColor: colors.primary, opacity: 0.1 },
  avatarWrapper: { marginBottom: 12, position: 'relative' },
  avatarImage: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.border, borderWidth: 4, borderColor: colors.card },
  avatarPlaceholder: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: colors.inputBg, borderWidth: 4, borderColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.primary, width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.card,
  },
  userName: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 8 },
  phonePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  userPhone: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginLeft: 5 },

  walletCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 20, padding: 16,
    marginBottom: 16, overflow: 'hidden', position: 'relative', ...cardShadow,
  },
  walletBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.primary, opacity: 0.06 },
  walletIconBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  walletTextWrap: { flex: 1, marginRight: 8 },
  walletLabel: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  walletSub: { fontSize: 12.5, color: colors.textSecondary },
  walletValue: { fontSize: 20, fontWeight: '800', color: colors.primary, marginRight: 6 },

  sectionCard: { backgroundColor: colors.card, borderRadius: 20, padding: 18, marginBottom: 16, ...cardShadow },
  sectionLabel: { fontSize: 12.5, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 },

  prefRow: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  prefRowLast: { marginBottom: 0, paddingBottom: 0, borderBottomWidth: 0 },
  prefRowLabel: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  prefRowText: { fontSize: 14, fontWeight: '600', color: colors.text, marginLeft: 6 },
  segmented: { flexDirection: 'row', backgroundColor: colors.inputBg, borderRadius: 12, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center', marginHorizontal: 1 },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary },
  segmentTextActive: { color: '#FFFFFF' },

  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  listRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  rowPressed: { opacity: 0.6 },
  rowIconBadge: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowTextWrap: { flex: 1, marginRight: 8 },
  rowTitle: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  rowSubtitle: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },

  sheetOverlay: { flex: 1, backgroundColor: colors.modalOverlay, justifyContent: 'flex-end' },
  sheetCard: {
    backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 8,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text, flex: 1 },
  sheetCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },

  sheetListRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetRowIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sheetRowText: { flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.text, marginRight: 8 },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.inputBg,
    borderRadius: 14, paddingVertical: 15, marginTop: 20,
  },
  logoutText: { color: colors.textSecondary, fontWeight: '800', fontSize: 15, marginLeft: 8 },

  fieldLabel: { fontSize: 11.5, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.inputBg,
    borderRadius: 14, paddingHorizontal: 14, height: 52, marginBottom: 18,
  },
  inputField: { flex: 1, fontSize: 15.5, fontWeight: '500', color: colors.text, paddingVertical: 0, marginLeft: 10 },
  otpInput: {
    textAlign: 'center', fontSize: 22, fontWeight: '800', letterSpacing: 8, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.inputBg, borderRadius: 14, paddingVertical: 16, color: colors.text, marginBottom: 18,
  },

  infoBanner: { flexDirection: 'row', backgroundColor: colors.inputBg, borderRadius: 14, padding: 12, marginBottom: 18, alignItems: 'flex-start' },
  infoBannerText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.textSecondary, fontWeight: '500' },

  dangerBanner: { flexDirection: 'row', borderWidth: 1.5, borderColor: colors.danger, borderRadius: 14, padding: 14, marginBottom: 18, alignItems: 'flex-start' },
  dangerBannerText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: colors.danger, fontWeight: '600', marginLeft: 10 },

  primaryButton: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  phoneRow: { flexDirection: 'row', marginBottom: 18 },
  codeSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.inputBg, borderRadius: 14, paddingHorizontal: 14, height: 52, minWidth: 84, marginRight: 10,
  },
  codeSelectorText: { fontSize: 15.5, fontWeight: '700', color: colors.text, marginRight: 4 },
  phoneInput: {
    flex: 1, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.inputBg, borderRadius: 14,
    paddingHorizontal: 14, height: 52, fontSize: 15.5, fontWeight: '500', color: colors.text,
  },

  dropdownSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.inputBg, borderRadius: 14, paddingHorizontal: 14, height: 52, marginBottom: 18,
  },
  dropdownDisabled: { opacity: 0.5 },
  dropdownSelectedText: { fontSize: 15.5, fontWeight: '700', color: colors.text },
  dropdownPlaceholderText: { fontSize: 15.5, fontWeight: '500', color: colors.textSecondary },

  pickerList: { marginTop: 4, maxHeight: 400 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  countryFlag: { fontSize: 20, marginRight: 10 },
  pickerRowText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  pickerRowMeta: { fontSize: 13.5, fontWeight: '700', color: colors.textSecondary, marginRight: 8 },
  developerCredit: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingBottom: 10,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  developerText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});