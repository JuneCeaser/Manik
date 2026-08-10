import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/api';

export default function SubscriptionScreen() {
  const { userToken } = useAuth();

  const [loading, setLoading] = useState(false);
  const [slipImage, setSlipImage] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'NONE' | 'MANUAL' | 'PAYHERE'>('NONE');

  // AUTH GUARD: If user is not logged in, redirect to login page
  if (!userToken) {
    return <Redirect href="/login" />;
  }

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'You need to allow access to your photos to upload a bank slip.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setSlipImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSubmitSlip = async () => {
    if (!slipImage) {
      return Alert.alert('Required', 'Please upload a screenshot of your bank receipt.');
    }

    setLoading(true);
    try {
      // Fix: Safely replace '/auth' if your API_BASE_URL includes it, 
      // so it points to /api/payments instead of /api/auth/payments
      const res = await fetch(`${API_BASE_URL.replace('/auth', '')}/payments/manual-slip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          base64Image: slipImage,
          amount: 990,
        }),
      });

      const data = await res.json();

      if (data.success) {
        Alert.alert(
          'Receipt Submitted!',
          'We have received your slip. Your 30 Ad Credits will be unlocked shortly once verified.'
        );
        setSlipImage(null);
        setPaymentMethod('NONE');
      } else {
        Alert.alert('Upload Failed', data.message || 'Something went wrong.');
      }
    } catch (error) {
      console.log('FETCH ERROR:', error);
      Alert.alert('Error', 'Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Unlock Pro Selling</Text>
        <Text style={styles.subtitle}>Get 30 Gem Ads for just Rs. 990</Text>
      </View>

      {/* Main Options */}
      {paymentMethod === 'NONE' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How would you like to pay?</Text>

          <Pressable style={styles.methodButton} onPress={() => setPaymentMethod('PAYHERE')}>
            <Ionicons name="card-outline" size={24} color="#2563EB" />
            <Text style={styles.methodText}>Pay Online (Visa / Master)</Text>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </Pressable>

          <Pressable style={styles.methodButton} onPress={() => setPaymentMethod('MANUAL')}>
            <Ionicons name="document-text-outline" size={24} color="#10B981" />
            <Text style={styles.methodText}>Manual Bank Transfer</Text>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </Pressable>
        </View>
      )}

      {/* PayHere Option Placeholder */}
      {paymentMethod === 'PAYHERE' && (
        <View style={styles.card}>
          <Pressable onPress={() => setPaymentMethod('NONE')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#64748B" />
            <Text style={styles.backText}>Back to options</Text>
          </Pressable>
          <Text style={styles.cardTitle}>Secure Online Checkout</Text>
          <Text style={{ color: '#64748B', marginBottom: 20 }}>
            PayHere integration will be wired up here soon!
          </Text>
        </View>
      )}

      {/* Manual Slip Upload */}
      {paymentMethod === 'MANUAL' && (
        <View style={styles.card}>
          <Pressable onPress={() => setPaymentMethod('NONE')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#64748B" />
            <Text style={styles.backText}>Back to options</Text>
          </Pressable>

          <Text style={styles.cardTitle}>Bank Details</Text>
          <View style={styles.bankInfoBox}>
            <Text style={styles.bankText}><Text style={{ fontWeight: 'bold' }}>Bank:</Text> Commercial Bank</Text>
            <Text style={styles.bankText}><Text style={{ fontWeight: 'bold' }}>Account Name:</Text> Manik Gem Market</Text>
            <Text style={styles.bankText}><Text style={{ fontWeight: 'bold' }}>Account No:</Text> 1234567890</Text>
            <Text style={styles.bankText}><Text style={{ fontWeight: 'bold' }}>Branch:</Text> Colombo</Text>
          </View>

          <Text style={styles.instructionText}>
            Transfer Rs. 990 to the account above and upload the receipt screenshot below.
          </Text>

          <Pressable style={styles.uploadBox} onPress={pickImage} disabled={loading}>
            {slipImage ? (
              <Image source={{ uri: slipImage }} style={styles.previewImage} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={40} color="#94A3B8" />
                <Text style={styles.uploadText}>Tap to select receipt image</Text>
              </>
            )}
          </Pressable>

          {slipImage && (
            <Pressable style={styles.submitButton} onPress={handleSubmitSlip} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Bank Slip</Text>
              )}
            </Pressable>
          )}
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 22, paddingTop: 60, paddingBottom: 60 },
  header: { marginBottom: 30, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#2563EB', fontWeight: '600' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 20 },
  methodButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  methodText: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '600', color: '#334155' },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backText: { marginLeft: 6, fontSize: 15, color: '#64748B', fontWeight: '500' },
  bankInfoBox: { backgroundColor: '#F1F5F9', padding: 16, borderRadius: 12, marginBottom: 20 },
  bankText: { fontSize: 15, color: '#334155', marginBottom: 6 },
  instructionText: { fontSize: 14, color: '#64748B', lineHeight: 22, marginBottom: 20 },
  uploadBox: { borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 16, height: 180, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', overflow: 'hidden', marginBottom: 20 },
  uploadText: { marginTop: 12, color: '#64748B', fontSize: 14, fontWeight: '500' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  submitButton: { backgroundColor: '#10B981', padding: 16, borderRadius: 12, alignItems: 'center' },
  submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});