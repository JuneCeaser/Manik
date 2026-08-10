import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/api';

type ActiveModal = 'NONE' | 'CHANGE_NAME' | 'CHANGE_PASSWORD' | 'DELETE_ACCOUNT' | 'ADD_WHATSAPP' | 'ADD_LOCATION';

// Small, non-exhaustive list of country codes. Add more as needed.
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

// Province -> City options for the location dropdown. Keys must match the
// backend's SRI_LANKA_PROVINCES list exactly.
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

export default function ProfileScreen() {
  const { user, userToken, logout, loginState } = useAuth();
  const router = useRouter(); // <-- Used to navigate to the subscription screen

  const [activeModal, setActiveModal] = useState<ActiveModal>('NONE');
  const [step, setStep] = useState<'INPUT' | 'OTP'>('INPUT');
  const [loading, setLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form States
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // WhatsApp form state
  const [whatsappCode, setWhatsappCode] = useState('+94');
  const [whatsappNumberInput, setWhatsappNumberInput] = useState('');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);

  // Location form state
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [provincePickerVisible, setProvincePickerVisible] = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);

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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
      });

      const data = await res.json();

      if (res.status === 401 || !data.success) {
        Alert.alert('Session Expired', 'Your account has been deleted or is no longer valid.');
        logout();
        return;
      }

      if (data.user) {
        await loginState(userToken, data.user);
      }
    } catch {
      Alert.alert('Error', 'Failed to refresh profile data.');
    } finally {
      setRefreshing(false);
    }
  }, [userToken, logout, loginState]);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'You need to allow access to your photos to upload a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      handleUploadImage(result.assets[0].base64);
    }
  };

  const handleUploadImage = async (base64String: string) => {
    setImageUploading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/profile-image`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ base64Image: base64String }),
      });

      const data = await res.json();

      if (res.status === 401) {
        Alert.alert('Unauthorized', 'Your account no longer exists.');
        logout();
        return;
      }

      if (data.success) {
        await loginState(userToken!, data.user);
      } else {
        Alert.alert('Upload Failed', data.message);
      }
    } catch {
      Alert.alert('Error', 'Failed to connect to the server.');
    } finally {
      setImageUploading(false);
    }
  };

  const handleChangeName = async () => {
    if (!newName.trim()) return Alert.alert('Required', 'Please enter a new name.');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/change-name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ newName }),
      });
      const data = await res.json();

      if (res.status === 401) {
        Alert.alert('Unauthorized', 'Your account no longer exists.');
        logout();
        return;
      }

      if (data.success) {
        await loginState(userToken!, data.user); 
        Alert.alert('Success', 'Name updated successfully.');
        closeModal();
      } else {
        Alert.alert('Error', data.message);
      }
    } catch {
      Alert.alert('Error', 'Failed to update name.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWhatsapp = async () => {
    const cleanNumber = whatsappNumberInput.replace(/\D/g, '');
    if (!cleanNumber || cleanNumber.length < 6) {
      return Alert.alert('Required', 'Please enter a valid WhatsApp number.');
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/whatsapp-number`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ whatsappCountryCode: whatsappCode, whatsappNumber: cleanNumber }),
      });
      const data = await res.json();

      if (res.status === 401) {
        Alert.alert('Unauthorized', 'Your account no longer exists.');
        logout();
        return;
      }

      if (data.success) {
        await loginState(userToken!, data.user);
        Alert.alert('Success', 'WhatsApp number saved.');
        closeModal();
      } else {
        Alert.alert('Error', data.message);
      }
    } catch {
      Alert.alert('Error', 'Failed to save WhatsApp number.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLocation = async () => {
    if (!selectedProvince || !selectedCity) {
      return Alert.alert('Required', 'Please select both province and city.');
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ province: selectedProvince, city: selectedCity }),
      });
      const data = await res.json();

      if (res.status === 401) {
        Alert.alert('Unauthorized', 'Your account no longer exists.');
        logout();
        return;
      }

      if (data.success) {
        await loginState(userToken!, data.user);
        Alert.alert('Success', 'Location saved.');
        closeModal();
      } else {
        Alert.alert('Error', data.message);
      }
    } catch {
      Alert.alert('Error', 'Failed to save location.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordOtp = async () => {
    if (!newPassword || newPassword.length < 6) return Alert.alert('Error', 'New password must be at least 6 characters.');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/change-password/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();
      if (res.status === 401) {
        logout();
        return;
      }
      if (data.success) setStep('OTP');
      else Alert.alert('Error', data.message);
    } catch {
      Alert.alert('Error', 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPasswordOtp = async () => {
    if (otpCode.length !== 6) return Alert.alert('Required', 'Enter 6-digit OTP.');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/change-password/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ code: otpCode, newPassword }),
      });
      const data = await res.json();
      if (res.status === 401) {
        logout();
        return;
      }
      if (data.success) {
        Alert.alert('Success', 'Password updated.');
        closeModal();
      } else Alert.alert('Error', data.message);
    } catch {
      Alert.alert('Error', 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendDeleteOtp = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/delete-account/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();
      if (res.status === 401) {
        logout();
        return;
      }
      if (data.success) setStep('OTP');
      else Alert.alert('Error', data.message);
    } catch {
      Alert.alert('Error', 'Failed to request deletion.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDeleteOtp = async () => {
    if (otpCode.length !== 6) return Alert.alert('Required', 'Enter 6-digit OTP.');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/delete-account/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ code: otpCode }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Account Deleted', 'Your account has been deleted.');
        closeModal();
        logout();
      } else Alert.alert('Error', data.message);
    } catch {
      Alert.alert('Error', 'Failed to delete account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />
      }
    >
      <Text style={styles.headerTitle}>Manik Dashboard</Text>

      {user && (
        <View style={styles.card}>
          <View style={styles.avatarContainer}>
            <Pressable onPress={pickImage} disabled={imageUploading}>
              {user.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person-circle" size={80} color="#2563EB" />
              )}
              
              <View style={styles.editBadge}>
                {imageUploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={12} color="#FFFFFF" />
                )}
              </View>
            </Pressable>
          </View>

          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userPhone}>+{user.phone}</Text>

          {/* NEW SUBSCRIPTION ROW */}
          <Pressable style={styles.actionRow} onPress={() => router.push('/subscription')}>
            <Ionicons name="wallet-outline" size={20} color="#2563EB" />
            <Text style={[styles.actionText, { color: '#2563EB' }]}>Ad Credits / Subscribe</Text>
            <Text style={[styles.actionValue, { color: '#2563EB', fontWeight: '700' }]}>
              {(user as any)?.adCredits || 0} left
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>

          <Pressable style={styles.actionRow} onPress={() => setActiveModal('CHANGE_NAME')}>
            <Ionicons name="pencil-outline" size={20} color="#334155" />
            <Text style={styles.actionText}>Change Name</Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>

          <Pressable style={styles.actionRow} onPress={() => setActiveModal('CHANGE_PASSWORD')}>
            <Ionicons name="key-outline" size={20} color="#334155" />
            <Text style={styles.actionText}>Change Password</Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>

          <Pressable style={styles.actionRow} onPress={openWhatsappModal}>
            <Ionicons name="logo-whatsapp" size={20} color="#334155" />
            <Text style={styles.actionText}>WhatsApp Number</Text>
            <Text style={styles.actionValue}>
              {(user as any)?.whatsappNumber
                ? `${(user as any).whatsappCountryCode} ${(user as any).whatsappNumber}`
                : 'Not set'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>

          <Pressable style={styles.actionRow} onPress={openLocationModal}>
            <Ionicons name="location-outline" size={20} color="#334155" />
            <Text style={styles.actionText}>Location</Text>
            <Text style={styles.actionValue}>
              {(user as any)?.city ? `${(user as any).city}, ${(user as any).province}` : 'Not set'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>

          <Pressable style={[styles.actionRow, { borderBottomWidth: 0 }]} onPress={() => setActiveModal('DELETE_ACCOUNT')}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
            <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete Account</Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>
        </View>
      )}

      <Pressable onPress={logout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>

      <Modal visible={activeModal !== 'NONE'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activeModal === 'CHANGE_NAME' && 'Change Name'}
                {activeModal === 'CHANGE_PASSWORD' && 'Change Password'}
                {activeModal === 'DELETE_ACCOUNT' && 'Delete Account'}
                {activeModal === 'ADD_WHATSAPP' && 'WhatsApp Number'}
                {activeModal === 'ADD_LOCATION' && 'Location'}
              </Text>
              <Pressable onPress={closeModal}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            {/* DIRECT NAME CHANGE UI */}
            {activeModal === 'CHANGE_NAME' && (
              <>
                <TextInput style={styles.input} placeholder="New Full Name" value={newName} onChangeText={setNewName} />
                <Pressable style={styles.modalButton} onPress={handleChangeName} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Update Name</Text>}
                </Pressable>
              </>
            )}

            {/* ADD / UPDATE WHATSAPP NUMBER UI */}
            {activeModal === 'ADD_WHATSAPP' && (
              <>
                <Text style={{ color: '#64748B', marginBottom: 16, fontSize: 14, lineHeight: 20 }}>
                  This number is not verified — just used so buyers/sellers can reach you on WhatsApp.
                </Text>
                <View style={styles.phoneRow}>
                  <Pressable style={styles.codeSelector} onPress={() => setCountryPickerVisible(true)}>
                    <Text style={styles.codeSelectorText}>{whatsappCode}</Text>
                    <Ionicons name="chevron-down" size={16} color="#334155" />
                  </Pressable>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="77 123 4567"
                    keyboardType="phone-pad"
                    value={whatsappNumberInput}
                    onChangeText={setWhatsappNumberInput}
                  />
                </View>
                <Pressable style={styles.modalButton} onPress={handleUpdateWhatsapp} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Save Number</Text>}
                </Pressable>
              </>
            )}

            {/* ADD / UPDATE LOCATION UI */}
            {activeModal === 'ADD_LOCATION' && (
              <>
                <Text style={{ color: '#64748B', marginBottom: 16, fontSize: 14, lineHeight: 20 }}>
                  Select your province and city so buyers/sellers know roughly where you are.
                </Text>

                <Text style={styles.fieldLabel}>Province</Text>
                <Pressable style={styles.dropdownSelector} onPress={() => setProvincePickerVisible(true)}>
                  <Text style={selectedProvince ? styles.dropdownSelectedText : styles.dropdownPlaceholderText}>
                    {selectedProvince || 'Select Province'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#334155" />
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
                  <Ionicons name="chevron-down" size={16} color="#334155" />
                </Pressable>

                <Pressable style={[styles.modalButton, { marginTop: 8 }]} onPress={handleUpdateLocation} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Save Location</Text>}
                </Pressable>
              </>
            )}

            {/* PASSWORD CHANGE UI */}
            {activeModal === 'CHANGE_PASSWORD' && (
              step === 'INPUT' ? (
                <>
                  <TextInput style={styles.input} placeholder="New Password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
                  <Pressable style={styles.modalButton} onPress={handleSendPasswordOtp} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Send OTP</Text>}
                  </Pressable>
                </>
              ) : (
                <>
                  <TextInput 
                    style={styles.input} placeholder="6-Digit OTP" keyboardType="number-pad" 
                    maxLength={6} value={otpCode} onChangeText={setOtpCode}
                    textContentType="oneTimeCode" autoComplete="sms-otp" importantForAutofill="yes"
                  />
                  <Pressable style={styles.modalButton} onPress={handleVerifyPasswordOtp} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Verify & Change</Text>}
                  </Pressable>
                </>
              )
            )}

            {/* DELETE ACCOUNT UI */}
            {activeModal === 'DELETE_ACCOUNT' && (
              step === 'INPUT' ? (
                <>
                  <Text style={{ color: '#EF4444', marginBottom: 16, fontSize: 15, lineHeight: 22, fontWeight: '500' }}>
                    Are you sure you want to delete your account? This action is permanent and cannot be undone. All your data and images will be erased.
                  </Text>
                  
                  <Pressable style={[styles.modalButton, { backgroundColor: '#EF4444' }]} onPress={handleSendDeleteOtp} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Yes, Send OTP</Text>}
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={{ color: '#EF4444', marginBottom: 12 }}>Enter the 6-digit code sent to your phone to confirm deletion.</Text>
                  <TextInput 
                    style={styles.input} placeholder="6-Digit OTP" keyboardType="number-pad" 
                    maxLength={6} value={otpCode} onChangeText={setOtpCode}
                    textContentType="oneTimeCode" autoComplete="sms-otp" importantForAutofill="yes"
                  />
                  <Pressable style={[styles.modalButton, { backgroundColor: '#EF4444' }]} onPress={handleVerifyDeleteOtp} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Verify & Delete Account</Text>}
                  </Pressable>
                </>
              )
            )}
          </View>
        </View>
      </Modal>

      {/* COUNTRY CODE PICKER */}
      <Modal visible={countryPickerVisible} animationType="fade" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setCountryPickerVisible(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.modalTitle}>Select Country Code</Text>
            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={(item) => item.code + item.country}
              style={{ marginTop: 12, maxHeight: 320 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.countryRow}
                  onPress={() => {
                    setWhatsappCode(item.code);
                    setCountryPickerVisible(false);
                  }}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <Text style={styles.countryName}>{item.country}</Text>
                  <Text style={styles.countryCode}>{item.code}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      {/* PROVINCE PICKER */}
      <Modal visible={provincePickerVisible} animationType="fade" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setProvincePickerVisible(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.modalTitle}>Select Province</Text>
            <FlatList
              data={PROVINCES}
              keyExtractor={(item) => item}
              style={{ marginTop: 12, maxHeight: 320 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.countryRow}
                  onPress={() => {
                    setSelectedProvince(item);
                    setSelectedCity(''); 
                    setProvincePickerVisible(false);
                  }}
                >
                  <Text style={styles.countryName}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      {/* CITY PICKER */}
      <Modal visible={cityPickerVisible} animationType="fade" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setCityPickerVisible(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.modalTitle}>Select City</Text>
            <FlatList
              data={PROVINCE_CITY_MAP[selectedProvince] || []}
              keyExtractor={(item) => item}
              style={{ marginTop: 12, maxHeight: 320 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.countryRow}
                  onPress={() => {
                    setSelectedCity(item);
                    setCityPickerVisible(false);
                  }}
                >
                  <Text style={styles.countryName}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 22, paddingTop: 60 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, elevation: 3, marginBottom: 20 },
  avatarContainer: { alignSelf: 'center', position: 'relative', marginBottom: 10 },
  avatarImage: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E2E8F0' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#0F172A', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  userName: { fontSize: 20, fontWeight: '700', color: '#0F172A', textAlign: 'center', marginTop: 8 },
  userPhone: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  actionText: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '600', color: '#334155' },
  actionValue: { fontSize: 13, color: '#94A3B8', marginRight: 6 },
  logoutButton: { backgroundColor: '#F1F5F9', padding: 16, borderRadius: 14, alignItems: 'center' },
  logoutText: { color: '#64748B', fontWeight: '700', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 16 },
  modalButton: { backgroundColor: '#2563EB', padding: 14, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  phoneRow: { flexDirection: 'row', marginBottom: 16 },
  codeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginRight: 8,
    minWidth: 78,
    justifyContent: 'space-between',
  },
  codeSelectorText: { fontSize: 15, fontWeight: '600', color: '#0F172A', marginRight: 4 },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
  },
  pickerCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, maxHeight: '70%' },
  countryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  countryFlag: { fontSize: 20, marginRight: 10 },
  countryName: { flex: 1, fontSize: 15, color: '#334155', fontWeight: '500' },
  countryCode: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 6, marginTop: 4 },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  dropdownDisabled: { backgroundColor: '#F8FAFC' },
  dropdownSelectedText: { fontSize: 15, color: '#0F172A', fontWeight: '600' },
  dropdownPlaceholderText: { fontSize: 15, color: '#94A3B8' },
});