import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/api';
import {
  GEM_CATEGORIES,
  GEM_COLORS,
  GEM_SHAPES,
  GEM_TREATMENTS,
  CERTIFICATION_STATUSES,
  CERTIFICATION_LABS,
  PROVINCE_CITY_MAP,
  PROVINCES,
  getEstimatedRequiredCredits,
} from '../../constants/gemOptions';

const GEMS_URL = `${API_BASE_URL.replace('/auth', '')}/gems`;

type PickerKey =
  | 'category'
  | 'color'
  | 'shape'
  | 'treatment'
  | 'certification'
  | 'lab'
  | 'province'
  | 'city'
  | 'none';

// Reusable option-list modal used for every dropdown on this screen
const SelectModal = ({
  visible,
  title,
  options,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
}) => (
  <Modal visible={visible} animationType="fade" transparent>
    <Pressable style={styles.modalOverlay} onPress={onClose}>
      <View style={styles.pickerCard}>
        <Text style={styles.modalTitle}>{title}</Text>
        <FlatList
          data={options}
          keyExtractor={(item) => item}
          style={{ marginTop: 12, maxHeight: 320 }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.optionRow}
              onPress={() => {
                onSelect(item);
                onClose();
              }}
            >
              <Text style={styles.optionText}>{item}</Text>
            </Pressable>
          )}
        />
      </View>
    </Pressable>
  </Modal>
);

const FieldSelector = ({
  label,
  value,
  placeholder,
  onPress,
  disabled,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Pressable
      style={[styles.dropdownSelector, disabled && styles.dropdownDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={value ? styles.dropdownSelectedText : styles.dropdownPlaceholderText}>
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-down" size={16} color="#334155" />
    </Pressable>
  </View>
);

export default function AddScreen() {
  const { user, userToken, logout } = useAuth();
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditMode = !!editId;

  const [activePicker, setActivePicker] = useState<PickerKey>('none');
  const [submitting, setSubmitting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);

  // Images - each entry is either an existing https:// URL (kept from the
  // ad) or a newly picked data:image/...;base64 string.
  const [images, setImages] = useState<string[]>([]);
  const [originalImageUrls, setOriginalImageUrls] = useState<string[]>([]);
  const [certificateImage, setCertificateImage] = useState<string | null>(null);
  const [originalCertificateUrl, setOriginalCertificateUrl] = useState<string | null>(null);

  // Core details
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [priceAmount, setPriceAmount] = useState('');
  const [currency, setCurrency] = useState<'LKR' | 'USD'>('LKR');
  const [negotiable, setNegotiable] = useState(false);

  // Specifications
  const [weightCarats, setWeightCarats] = useState('');
  const [color, setColor] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [shape, setShape] = useState('');
  const [treatment, setTreatment] = useState('');
  const [certificationStatus, setCertificationStatus] = useState('Not Certified');
  const [labName, setLabName] = useState('');

  // Description
  const [description, setDescription] = useState('');

  // Location & contact
  const [province, setProvince] = useState((user as any)?.province || '');
  const [city, setCity] = useState((user as any)?.city || '');
  const [contactPhone, setContactPhone] = useState((user as any)?.phone || '');
  const [hidePhoneNumber, setHidePhoneNumber] = useState(false);

  // Load existing ad data when editing
  useEffect(() => {
    if (!isEditMode) return;

    const loadAd = async () => {
      try {
        const res = await fetch(`${GEMS_URL}/${editId}`, {
          headers: { Authorization: `Bearer ${userToken}` },
        });
        const data = await res.json();

        if (res.status === 401) {
          Alert.alert('Session Expired', 'Please log in again.');
          logout();
          return;
        }

        if (!data.success) {
          Alert.alert('Error', data.message || 'Could not load this ad for editing.');
          router.back();
          return;
        }

        const ad = data.gemAd;
        setTitle(ad.title);
        setCategory(ad.category);
        setPriceAmount(String(ad.price.amount));
        setCurrency(ad.price.currency);
        setNegotiable(ad.price.negotiable);
        setWeightCarats(String(ad.weightCarats));

        if (GEM_COLORS.includes(ad.color)) {
          setColor(ad.color);
        } else {
          setColor('Other');
          setCustomColor(ad.color);
        }

        setShape(ad.shape);
        setTreatment(ad.treatment);
        setCertificationStatus(ad.certification?.status || 'Not Certified');
        setLabName(ad.certification?.labName || '');
        setDescription(ad.description || '');

        const urls = ad.images.map((img: any) => img.url);
        setImages(urls);
        setOriginalImageUrls(urls);

        if (ad.certificateImage) {
          setCertificateImage(ad.certificateImage.url);
          setOriginalCertificateUrl(ad.certificateImage.url);
        }

        setProvince(ad.location.province);
        setCity(ad.location.city);
        setHidePhoneNumber(ad.hidePhoneNumber);
        setContactPhone(ad.hidePhoneNumber ? ((user as any)?.phone || '') : ad.contactPhone || '');
      } catch {
        Alert.alert('Error', 'Failed to load this ad for editing.');
        router.back();
      } finally {
        setInitialLoading(false);
      }
    };

    loadAd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const pickImages = async () => {
    if (images.length >= 5) {
      Alert.alert('Limit Reached', 'You can upload a maximum of 5 images.');
      return;
    }
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'You need to allow access to your photos to upload gem images.');
      return;
    }
    const remainingSlots = 5 - images.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      const newImages = result.assets
        .filter((a) => a.base64)
        .map((a) => `data:image/jpeg;base64,${a.base64}`);
      setImages((prev) => [...prev, ...newImages].slice(0, 5));
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const pickCertificateImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'You need to allow access to your photos to upload a certificate.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setCertificateImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const resetForm = () => {
    setImages([]);
    setCertificateImage(null);
    setTitle('');
    setCategory('');
    setPriceAmount('');
    setCurrency('LKR');
    setNegotiable(false);
    setWeightCarats('');
    setColor('');
    setCustomColor('');
    setShape('');
    setTreatment('');
    setCertificationStatus('Not Certified');
    setLabName('');
    setDescription('');
    setProvince((user as any)?.province || '');
    setCity((user as any)?.city || '');
    setContactPhone((user as any)?.phone || '');
    setHidePhoneNumber(false);
  };

  const validateForm = (): string | null => {
    if (images.length < 1) return 'Please upload at least 1 image of the gem.';
    if (!title.trim()) return 'Please enter an ad title.';
    if (!category) return 'Please select a gem category.';
    if (!priceAmount || isNaN(Number(priceAmount)) || Number(priceAmount) <= 0) return 'Please enter a valid price.';
    if (!weightCarats || isNaN(Number(weightCarats)) || Number(weightCarats) <= 0)
      return 'Please enter a valid weight in carats.';
    if (!color) return 'Please select a color.';
    if (color === 'Other' && !customColor.trim()) return 'Please enter a custom color.';
    if (!shape) return 'Please select a shape / cut.';
    if (!treatment) return 'Please select a treatment status.';
    if (certificationStatus === 'Certified' && !labName) return 'Please select the certifying lab.';
    if (!province || !city) return 'Please select your location.';
    if (!hidePhoneNumber && !contactPhone.trim()) return 'Please enter a contact number or hide it.';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Missing Information', validationError);
      return;
    }

    const finalColor = color === 'Other' ? customColor.trim() : color;

    const payload: any = {
      title: title.trim(),
      category,
      price: {
        amount: Number(priceAmount),
        currency,
        negotiable,
      },
      weightCarats: Number(weightCarats),
      color: finalColor,
      shape,
      treatment,
      certification: {
        status: certificationStatus,
        labName: certificationStatus === 'Certified' ? labName : '',
      },
      description: description.trim(),
      province,
      city,
      contactPhone: hidePhoneNumber ? '' : contactPhone.trim(),
      hidePhoneNumber,
    };

    // Only send images/certificate if they actually changed (edit mode) or
    // always (create mode, where they're required/optional respectively).
    const imagesChanged = JSON.stringify(images) !== JSON.stringify(originalImageUrls);
    if (!isEditMode || imagesChanged) {
      payload.images = images;
    }

    const certChanged = certificateImage !== originalCertificateUrl;
    if ((!isEditMode && certificateImage) || (isEditMode && certChanged && certificateImage)) {
      payload.certificateImage = certificateImage;
    }

    setSubmitting(true);
    try {
      const url = isEditMode ? `${GEMS_URL}/${editId}` : GEMS_URL;
      const method = isEditMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.');
        logout();
        return;
      }

      if (res.status === 402 || data.code === 'INSUFFICIENT_CREDITS') {
        Alert.alert(
          'Not Enough Ad Credits',
          data.message || 'You need more ad credits to post this listing.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Get Credits', onPress: () => router.push('/subscription') },
          ]
        );
        return;
      }

      if (data.success) {
        Alert.alert(
          isEditMode ? 'Ad Updated' : 'Ad Submitted',
          isEditMode
            ? 'Your changes were saved and the ad has been resubmitted for admin approval.'
            : 'Your gem has been submitted for admin approval.'
        );
        resetForm();
        router.push('../my-ads');
      } else {
        Alert.alert('Submission Failed', data.message || 'Something went wrong.');
      }
    } catch {
      Alert.alert('Error', 'Failed to connect to the server.');
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedCredits =
    priceAmount && !isNaN(Number(priceAmount)) && Number(priceAmount) > 0
      ? getEstimatedRequiredCredits(Number(priceAmount), currency)
      : null;

  if (isEditMode && initialLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Gem' : 'Add New Gem'}</Text>
          {isEditMode && (
            <Pressable onPress={() => router.back()}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          )}
        </View>

        {/* IMAGES */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Photos ({images.length}/5)</Text>
          <Text style={styles.sectionHint}>Add at least 1 photo. Top, bottom, and side angles help buyers most.</Text>
          <View style={styles.imagesRow}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageThumbWrapper}>
                <Image source={{ uri }} style={styles.imageThumb} />
                <Pressable style={styles.removeImageButton} onPress={() => removeImage(index)}>
                  <Ionicons name="close" size={14} color="#FFF" />
                </Pressable>
              </View>
            ))}
            {images.length < 5 && (
              <Pressable style={styles.addImageTile} onPress={pickImages}>
                <Ionicons name="camera-outline" size={26} color="#94A3B8" />
                <Text style={styles.addImageText}>Add Photo</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* CERTIFICATE */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Gemological Certificate (Optional)</Text>
          <Pressable style={styles.certUploadBox} onPress={pickCertificateImage}>
            {certificateImage ? (
              <Image source={{ uri: certificateImage }} style={styles.certPreviewImage} />
            ) : (
              <>
                <Ionicons name="ribbon-outline" size={32} color="#94A3B8" />
                <Text style={styles.uploadText}>Tap to upload certificate</Text>
              </>
            )}
          </Pressable>
          {certificateImage && (!isEditMode || certificateImage !== originalCertificateUrl) && (
            <Pressable onPress={() => setCertificateImage(isEditMode ? originalCertificateUrl : null)}>
              <Text style={styles.removeCertText}>
                {isEditMode ? 'Undo new certificate' : 'Remove certificate'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* CORE DETAILS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Core Details</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Ad Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Natural Royal Blue Sapphire 2.5ct"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <FieldSelector
            label="Gem Category"
            value={category}
            placeholder="Select category"
            onPress={() => setActivePicker('category')}
          />

          <Text style={styles.fieldLabel}>Price</Text>
          <View style={styles.currencyToggleRow}>
            {(['LKR', 'USD'] as const).map((cur) => (
              <Pressable
                key={cur}
                style={[styles.currencyOption, currency === cur && styles.currencyOptionActive]}
                onPress={() => setCurrency(cur)}
              >
                <Text style={[styles.currencyOptionText, currency === cur && styles.currencyOptionTextActive]}>
                  {cur}
                </Text>
              </Pressable>
            ))}
            <TextInput
              style={styles.priceInput}
              placeholder="Amount"
              keyboardType="numeric"
              value={priceAmount}
              onChangeText={setPriceAmount}
            />
          </View>

          <Pressable style={styles.checkboxRow} onPress={() => setNegotiable((v) => !v)}>
            <Ionicons
              name={negotiable ? 'checkbox' : 'square-outline'}
              size={22}
              color={negotiable ? '#2563EB' : '#94A3B8'}
            />
            <Text style={styles.checkboxLabel}>Price is negotiable</Text>
          </Pressable>

          {!isEditMode && estimatedCredits !== null && (
            <View style={styles.creditsEstimateBox}>
              <Ionicons name="information-circle-outline" size={18} color="#2563EB" />
              <Text style={styles.creditsEstimateText}>
                This ad will use approximately {estimatedCredits} ad credit{estimatedCredits > 1 ? 's' : ''}. You have{' '}
                {(user as any)?.adCredits ?? 0} available.
              </Text>
            </View>
          )}

          {isEditMode && (
            <View style={styles.creditsEstimateBox}>
              <Ionicons name="information-circle-outline" size={18} color="#2563EB" />
              <Text style={styles.creditsEstimateText}>
                Editing doesn t use any ad credits, but the ad will need admin approval again before it s visible.
              </Text>
            </View>
          )}
        </View>

        {/* SPECIFICATIONS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Gem Specifications</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Weight (Carats)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2.45"
              keyboardType="numeric"
              value={weightCarats}
              onChangeText={setWeightCarats}
            />
          </View>

          <FieldSelector label="Color" value={color} placeholder="Select color" onPress={() => setActivePicker('color')} />
          {color === 'Other' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Custom Color</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter color"
                value={customColor}
                onChangeText={setCustomColor}
              />
            </View>
          )}

          <FieldSelector label="Shape & Cut" value={shape} placeholder="Select shape" onPress={() => setActivePicker('shape')} />

          <FieldSelector
            label="Treatment Status"
            value={treatment}
            placeholder="Select treatment status"
            onPress={() => setActivePicker('treatment')}
          />

          <FieldSelector
            label="Certification Status"
            value={certificationStatus}
            placeholder="Select certification status"
            onPress={() => setActivePicker('certification')}
          />
          {certificationStatus === 'Certified' && (
            <FieldSelector label="Certifying Lab" value={labName} placeholder="Select lab" onPress={() => setActivePicker('lab')} />
          )}
        </View>

        {/* DESCRIPTION */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe clarity, origin (e.g. Ceylon, Madagascar), or unique features..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
          />
        </View>

        {/* LOCATION & CONTACT */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Location & Contact</Text>

          <FieldSelector label="Province" value={province} placeholder="Select province" onPress={() => setActivePicker('province')} />
          <FieldSelector
            label="City"
            value={city}
            placeholder={province ? 'Select city' : 'Select a province first'}
            onPress={() => setActivePicker('city')}
            disabled={!province}
          />

          {!hidePhoneNumber && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Contact Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="Phone number"
                keyboardType="phone-pad"
                value={contactPhone}
                onChangeText={setContactPhone}
              />
            </View>
          )}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Hide my phone number on this ad</Text>
            <Switch
              value={hidePhoneNumber}
              onValueChange={setHidePhoneNumber}
              trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
              thumbColor={hidePhoneNumber ? '#2563EB' : '#F8FAFC'}
            />
          </View>
        </View>

        <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>{isEditMode ? 'Save Changes' : 'Post Ad for Approval'}</Text>
          )}
        </Pressable>
      </ScrollView>

      <SelectModal
        visible={activePicker === 'category'}
        title="Select Category"
        options={GEM_CATEGORIES}
        onSelect={setCategory}
        onClose={() => setActivePicker('none')}
      />
      <SelectModal
        visible={activePicker === 'color'}
        title="Select Color"
        options={GEM_COLORS}
        onSelect={setColor}
        onClose={() => setActivePicker('none')}
      />
      <SelectModal
        visible={activePicker === 'shape'}
        title="Select Shape & Cut"
        options={GEM_SHAPES}
        onSelect={setShape}
        onClose={() => setActivePicker('none')}
      />
      <SelectModal
        visible={activePicker === 'treatment'}
        title="Select Treatment Status"
        options={GEM_TREATMENTS}
        onSelect={setTreatment}
        onClose={() => setActivePicker('none')}
      />
      <SelectModal
        visible={activePicker === 'certification'}
        title="Select Certification Status"
        options={CERTIFICATION_STATUSES}
        onSelect={setCertificationStatus}
        onClose={() => setActivePicker('none')}
      />
      <SelectModal
        visible={activePicker === 'lab'}
        title="Select Certifying Lab"
        options={CERTIFICATION_LABS}
        onSelect={setLabName}
        onClose={() => setActivePicker('none')}
      />
      <SelectModal
        visible={activePicker === 'province'}
        title="Select Province"
        options={PROVINCES}
        onSelect={(value) => {
          setProvince(value);
          setCity('');
        }}
        onClose={() => setActivePicker('none')}
      />
      <SelectModal
        visible={activePicker === 'city'}
        title="Select City"
        options={PROVINCE_CITY_MAP[province] || []}
        onSelect={setCity}
        onClose={() => setActivePicker('none')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 22, paddingBottom: 60 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A' },
  cancelText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, elevation: 2, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  sectionHint: { fontSize: 13, color: '#64748B', marginBottom: 14, lineHeight: 18 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, fontSize: 15, color: '#0F172A' },
  textArea: { height: 110, textAlignVertical: 'top' },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  dropdownDisabled: { backgroundColor: '#F8FAFC' },
  dropdownSelectedText: { fontSize: 15, color: '#0F172A', fontWeight: '600' },
  dropdownPlaceholderText: { fontSize: 15, color: '#94A3B8' },
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap' },
  imageThumbWrapper: { width: 84, height: 84, marginRight: 10, marginBottom: 10, position: 'relative' },
  imageThumb: { width: '100%', height: '100%', borderRadius: 12, backgroundColor: '#E2E8F0' },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  addImageTile: {
    width: 84,
    height: 84,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  addImageText: { fontSize: 11, color: '#94A3B8', marginTop: 4, fontWeight: '500' },
  certUploadBox: {
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  certPreviewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  uploadText: { marginTop: 10, color: '#64748B', fontSize: 13, fontWeight: '500' },
  removeCertText: { color: '#EF4444', fontSize: 13, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  currencyToggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  currencyOption: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 8,
  },
  currencyOptionActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  currencyOptionText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  currencyOptionTextActive: { color: '#FFFFFF' },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  checkboxLabel: { marginLeft: 8, fontSize: 14, color: '#334155', fontWeight: '500' },
  creditsEstimateBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  creditsEstimateText: { flex: 1, marginLeft: 8, fontSize: 13, color: '#1D4ED8', lineHeight: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  switchLabel: { flex: 1, fontSize: 14, color: '#334155', fontWeight: '500', marginRight: 12 },
  submitButton: { backgroundColor: '#2563EB', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  submitButtonText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  pickerCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  optionRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  optionText: { fontSize: 15, color: '#334155', fontWeight: '500' },
});