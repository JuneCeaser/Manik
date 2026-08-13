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
import * as ImageManipulator from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/api';
import {
  GEM_CATEGORIES,
  GEM_COLORS,
  GEM_SHAPES,
  GEM_TREATMENTS,
  GEM_ORIGINS,
  GEM_CLARITIES,
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
  | 'origin'
  | 'clarity'
  | 'treatment'
  | 'certification'
  | 'lab'
  | 'province'
  | 'city'
  | 'none';

type AppImage = {
  url: string;
  fileId: string;
  isNew?: boolean;
  ext?: string;
};

const SelectModal = ({ visible, title, options, onSelect, onClose }: { visible: boolean; title: string; options: string[]; onSelect: (value: string) => void; onClose: () => void; }) => (
  <Modal visible={visible} animationType="fade" transparent>
    <Pressable style={styles.modalOverlay} onPress={onClose}>
      <View style={styles.pickerCard}>
        <Text style={styles.modalTitle}>{title}</Text>
        <FlatList
          data={options}
          keyExtractor={(item) => item}
          style={{ marginTop: 12, maxHeight: 320 }}
          renderItem={({ item }) => (
            <Pressable style={styles.optionRow} onPress={() => { onSelect(item); onClose(); }}>
              <Text style={styles.optionText}>{item}</Text>
            </Pressable>
          )}
        />
      </View>
    </Pressable>
  </Modal>
);

const FieldSelector = ({ label, value, placeholder, onPress, disabled }: { label: string; value: string; placeholder: string; onPress: () => void; disabled?: boolean; }) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Pressable style={[styles.dropdownSelector, disabled && styles.dropdownDisabled]} onPress={onPress} disabled={disabled}>
      <Text style={value ? styles.dropdownSelectedText : styles.dropdownPlaceholderText}>{value || placeholder}</Text>
      <Ionicons name="chevron-down" size={16} color="#334155" />
    </Pressable>
  </View>
);

export default function AddScreen() {
  const { user, userToken, logout, preferredCurrency } = useAuth();
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  
  const isEditMode = !!editId && editId !== '';

  const [activePicker, setActivePicker] = useState<PickerKey>('none');
  const [submitting, setSubmitting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);

  const [images, setImages] = useState<AppImage[]>([]);
  const [certificateImage, setCertificateImage] = useState<AppImage | null>(null);
  const [originalCertificateUrl, setOriginalCertificateUrl] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [priceAmount, setPriceAmount] = useState('');
  const [negotiable, setNegotiable] = useState(false);

  const [weightCarats, setWeightCarats] = useState('');
  const [color, setColor] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [shape, setShape] = useState('');
  const [origin, setOrigin] = useState('');
  const [clarity, setClarity] = useState('');
  const [dimLength, setDimLength] = useState('');
  const [dimWidth, setDimWidth] = useState('');
  const [dimDepth, setDimDepth] = useState('');
  const [treatment, setTreatment] = useState('');
  const [certificationStatus, setCertificationStatus] = useState('Not Certified');
  const [labName, setLabName] = useState('');

  const [description, setDescription] = useState('');

  const [province, setProvince] = useState((user as any)?.province || '');
  const [city, setCity] = useState((user as any)?.city || '');
  const [contactPhone, setContactPhone] = useState((user as any)?.phone || '');
  const [hidePhoneNumber, setHidePhoneNumber] = useState(false);

  useEffect(() => {
    if (!isEditMode) {
      setInitialLoading(false);
      return;
    }

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
        setNegotiable(ad.price.negotiable);
        setWeightCarats(String(ad.weightCarats));
        setOrigin(ad.origin || '');
        setClarity(ad.clarity || '');
        setDimLength(ad.dimensions?.length ? String(ad.dimensions.length) : '');
        setDimWidth(ad.dimensions?.width ? String(ad.dimensions.width) : '');
        setDimDepth(ad.dimensions?.depth ? String(ad.dimensions.depth) : '');

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

        setImages(ad.images.map((img: any) => ({ url: img.url, fileId: img.fileId, isNew: false })));

        if (ad.certificateImage) {
          setCertificateImage({ url: ad.certificateImage.url, fileId: ad.certificateImage.fileId, isNew: false });
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
  }, [editId, isEditMode]);

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
      quality: 1,
    });

    if (!result.canceled) {
      const processedImages = await Promise.all(
        result.assets.map(async (a) => {
          const manipulated = await ImageManipulator.manipulateAsync(
            a.uri,
            [{ resize: { width: 1920 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );

          return {
            url: manipulated.uri, 
            fileId: '',
            isNew: true,
            ext: 'jpg', 
          };
        })
      );
      setImages((prev) => [...prev, ...processedImages].slice(0, 5));
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
      quality: 1,
    });

    if (!result.canceled) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1920 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      setCertificateImage({
        url: manipulated.uri, 
        fileId: '',
        isNew: true,
        ext: 'jpg',
      });
    }
  };

  const resetForm = () => {
    setImages([]);
    setCertificateImage(null);
    setTitle('');
    setCategory('');
    setPriceAmount('');
    setNegotiable(false);
    setWeightCarats('');
    setColor('');
    setCustomColor('');
    setShape('');
    setOrigin('');
    setClarity('');
    setDimLength('');
    setDimWidth('');
    setDimDepth('');
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
    if (!weightCarats || isNaN(Number(weightCarats)) || Number(weightCarats) <= 0) return 'Please enter a valid weight in carats.';
    if (!color) return 'Please select a color.';
    if (color === 'Other' && !customColor.trim()) return 'Please enter a custom color.';
    if (!shape) return 'Please select a shape / cut.';
    if (!origin) return 'Please select the gem origin.';
    if (!clarity) return 'Please select the clarity grade.';
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

    setSubmitting(true);
    try {
      const uploadToImageKit = async (fileUri: string, folder: string, ext: string = 'jpg') => {
        const authRes = await fetch(`${GEMS_URL}/imagekit-auth?t=${Date.now()}${Math.random()}`, {
          headers: { 
            Authorization: `Bearer ${userToken}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
        });
        const authData = await authRes.json();

        if (!authData.success) throw new Error('Failed to get upload signature.');

        const formData = new FormData();
        const generatedFileName = `gem_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
        
        formData.append('file', {
          uri: fileUri,
          name: generatedFileName,
          type: 'image/jpeg',
        } as any);
        formData.append('fileName', generatedFileName); 
        formData.append('publicKey', authData.publicKey);
        formData.append('signature', authData.signature);
        formData.append('expire', String(authData.expire));
        formData.append('token', authData.token);
        formData.append('folder', folder);

        const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Image upload failed');
        return await res.json();
      };

      const finalImages = [];
      for (const img of images) {
        if (img.isNew && img.url) {
          const uploaded = await uploadToImageKit(img.url, 'gem_ads', img.ext);
          finalImages.push({ url: uploaded.url, fileId: uploaded.fileId });
        } else {
          finalImages.push({ url: img.url, fileId: img.fileId });
        }
      }

      let finalCertificate = certificateImage && !certificateImage.isNew ? { url: certificateImage.url, fileId: certificateImage.fileId } : null;
      if (certificateImage && certificateImage.isNew && certificateImage.url) {
        const uploaded = await uploadToImageKit(certificateImage.url, 'gem_certificates', certificateImage.ext);
        finalCertificate = { url: uploaded.url, fileId: uploaded.fileId };
      }

      const finalColor = color === 'Other' ? customColor.trim() : color;

      const payload: any = {
        title: title.trim(),
        category,
        price: {
          amount: Number(priceAmount),
          currency: preferredCurrency, // Uses Global User Preference
          negotiable,
        },
        weightCarats: Number(weightCarats),
        color: finalColor,
        shape,
        origin,
        clarity,
        dimensions: {
          length: dimLength ? Number(dimLength) : 0,
          width: dimWidth ? Number(dimWidth) : 0,
          depth: dimDepth ? Number(dimDepth) : 0,
        },
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
        images: finalImages,
      };

      if (finalCertificate || (isEditMode && certificateImage === null)) {
        payload.certificateImage = finalCertificate;
      }

      const url = isEditMode ? `${GEMS_URL}/${editId}` : GEMS_URL;
      const method = isEditMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.');
        logout();
        return;
      }

      if (res.status === 402 || data.code === 'INSUFFICIENT_CREDITS') {
        Alert.alert('Not Enough Ad Credits', data.message || 'You need more ad credits to post this listing.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Get Credits', onPress: () => router.push('/subscription') },
        ]);
        return;
      }

      if (data.success) {
        Alert.alert(isEditMode ? 'Ad Updated' : 'Ad Submitted', isEditMode ? 'Your changes were saved and the ad has been resubmitted for admin approval.' : 'Your gem has been submitted for admin approval.');
        resetForm();
        router.setParams({ editId: '' });
        router.push('../my-ads');
      } else {
        Alert.alert('Submission Failed', data.message || 'Something went wrong.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to the server.');
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedCredits = priceAmount && !isNaN(Number(priceAmount)) && Number(priceAmount) > 0 ? getEstimatedRequiredCredits(Number(priceAmount), preferredCurrency) : null;

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
            <Pressable onPress={() => { resetForm(); router.setParams({ editId: '' }); router.back(); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Photos ({images.length}/5)</Text>
          <Text style={styles.sectionHint}>Add at least 1 photo. Top, bottom, and side angles help buyers most.</Text>
          <View style={styles.imagesRow}>
            {images.map((img, index) => (
              <View key={index} style={styles.imageThumbWrapper}>
                <Image source={{ uri: img.url }} style={styles.imageThumb} />
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

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Gemological Certificate (Optional)</Text>
          <Pressable style={styles.certUploadBox} onPress={pickCertificateImage}>
            {certificateImage ? (
              <Image source={{ uri: certificateImage.url }} style={styles.certPreviewImage} />
            ) : (
              <>
                <Ionicons name="ribbon-outline" size={32} color="#94A3B8" />
                <Text style={styles.uploadText}>Tap to upload certificate</Text>
              </>
            )}
          </Pressable>
          {certificateImage && (!isEditMode || certificateImage.url !== originalCertificateUrl) && (
            <Pressable onPress={() => setCertificateImage(isEditMode && originalCertificateUrl ? { url: originalCertificateUrl, fileId: '', isNew: false } : null)}>
              <Text style={styles.removeCertText}>
                {isEditMode ? 'Undo new certificate' : 'Remove certificate'}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Core Details</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Ad Title</Text>
            <TextInput style={styles.input} placeholder="e.g. Natural Royal Blue Sapphire 2.5ct" value={title} onChangeText={setTitle} />
          </View>

          <FieldSelector label="Gem Category" value={category} placeholder="Select category" onPress={() => setActivePicker('category')} />

          <Text style={styles.fieldLabel}>Price</Text>
          <View style={styles.currencyToggleRow}>
            <View style={[styles.currencyOption, styles.currencyOptionActive]}>
              <Text style={styles.currencyOptionTextActive}>{preferredCurrency}</Text>
            </View>
            <TextInput style={styles.priceInput} placeholder="Amount" keyboardType="numeric" value={priceAmount} onChangeText={setPriceAmount} />
          </View>

          <Pressable style={styles.checkboxRow} onPress={() => setNegotiable((v) => !v)}>
            <Ionicons name={negotiable ? 'checkbox' : 'square-outline'} size={22} color={negotiable ? '#2563EB' : '#94A3B8'} />
            <Text style={styles.checkboxLabel}>Price is negotiable</Text>
          </Pressable>

          {!isEditMode && estimatedCredits !== null && (
            <View style={styles.creditsEstimateBox}>
              <Ionicons name="information-circle-outline" size={18} color="#2563EB" />
              <Text style={styles.creditsEstimateText}>
                This ad will use approximately {estimatedCredits} ad credit{estimatedCredits > 1 ? 's' : ''}. You have {(user as any)?.adCredits ?? 0} available.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Gem Specifications</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Weight (Carats)</Text>
            <TextInput style={styles.input} placeholder="e.g. 2.45" keyboardType="numeric" value={weightCarats} onChangeText={setWeightCarats} />
          </View>

          <FieldSelector label="Color" value={color} placeholder="Select color" onPress={() => setActivePicker('color')} />
          {color === 'Other' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Custom Color</Text>
              <TextInput style={styles.input} placeholder="Enter color" value={customColor} onChangeText={setCustomColor} />
            </View>
          )}

          <FieldSelector label="Shape & Cut" value={shape} placeholder="Select shape" onPress={() => setActivePicker('shape')} />
          <FieldSelector label="Origin" value={origin} placeholder="Select origin" onPress={() => setActivePicker('origin')} />
          <FieldSelector label="Clarity" value={clarity} placeholder="Select clarity grade" onPress={() => setActivePicker('clarity')} />

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Dimensions (Optional in mm)</Text>
            <View style={styles.dimensionsRow}>
              <TextInput style={[styles.input, styles.dimInput]} placeholder="L" keyboardType="numeric" value={dimLength} onChangeText={setDimLength} />
              <Text style={styles.dimDivider}>×</Text>
              <TextInput style={[styles.input, styles.dimInput]} placeholder="W" keyboardType="numeric" value={dimWidth} onChangeText={setDimWidth} />
              <Text style={styles.dimDivider}>×</Text>
              <TextInput style={[styles.input, styles.dimInput]} placeholder="D" keyboardType="numeric" value={dimDepth} onChangeText={setDimDepth} />
            </View>
          </View>

          <FieldSelector label="Treatment Status" value={treatment} placeholder="Select treatment status" onPress={() => setActivePicker('treatment')} />
          <FieldSelector label="Certification Status" value={certificationStatus} placeholder="Select certification status" onPress={() => setActivePicker('certification')} />
          {certificationStatus === 'Certified' && (
            <FieldSelector label="Certifying Lab" value={labName} placeholder="Select lab" onPress={() => setActivePicker('lab')} />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Description</Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="Describe unique features..." value={description} onChangeText={setDescription} multiline numberOfLines={5} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Location & Contact</Text>
          <FieldSelector label="Province" value={province} placeholder="Select province" onPress={() => setActivePicker('province')} />
          <FieldSelector label="City" value={city} placeholder={province ? 'Select city' : 'Select a province first'} onPress={() => setActivePicker('city')} disabled={!province} />
          {!hidePhoneNumber && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Contact Phone</Text>
              <TextInput style={styles.input} placeholder="Phone number" keyboardType="phone-pad" value={contactPhone} onChangeText={setContactPhone} />
            </View>
          )}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Hide my phone number on this ad</Text>
            <Switch value={hidePhoneNumber} onValueChange={setHidePhoneNumber} trackColor={{ false: '#E2E8F0', true: '#93C5FD' }} thumbColor={hidePhoneNumber ? '#2563EB' : '#F8FAFC'} />
          </View>
        </View>

        <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>{isEditMode ? 'Save Changes' : 'Post Ad for Approval'}</Text>}
        </Pressable>
      </ScrollView>

      <SelectModal visible={activePicker === 'category'} title="Select Category" options={GEM_CATEGORIES} onSelect={setCategory} onClose={() => setActivePicker('none')} />
      <SelectModal visible={activePicker === 'color'} title="Select Color" options={GEM_COLORS} onSelect={setColor} onClose={() => setActivePicker('none')} />
      <SelectModal visible={activePicker === 'shape'} title="Select Shape & Cut" options={GEM_SHAPES} onSelect={setShape} onClose={() => setActivePicker('none')} />
      <SelectModal visible={activePicker === 'origin'} title="Select Origin" options={GEM_ORIGINS} onSelect={setOrigin} onClose={() => setActivePicker('none')} />
      <SelectModal visible={activePicker === 'clarity'} title="Select Clarity" options={GEM_CLARITIES} onSelect={setClarity} onClose={() => setActivePicker('none')} />
      <SelectModal visible={activePicker === 'treatment'} title="Select Treatment Status" options={GEM_TREATMENTS} onSelect={setTreatment} onClose={() => setActivePicker('none')} />
      <SelectModal visible={activePicker === 'certification'} title="Select Certification Status" options={CERTIFICATION_STATUSES} onSelect={setCertificationStatus} onClose={() => setActivePicker('none')} />
      <SelectModal visible={activePicker === 'lab'} title="Select Certifying Lab" options={CERTIFICATION_LABS} onSelect={setLabName} onClose={() => setActivePicker('none')} />
      <SelectModal visible={activePicker === 'province'} title="Select Province" options={PROVINCES} onSelect={(value) => { setProvince(value); setCity(''); }} onClose={() => setActivePicker('none')} />
      <SelectModal visible={activePicker === 'city'} title="Select City" options={PROVINCE_CITY_MAP[province] || []} onSelect={setCity} onClose={() => setActivePicker('none')} />
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
  dimensionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dimInput: { flex: 1, textAlign: 'center' },
  dimDivider: { fontSize: 18, color: '#94A3B8', marginHorizontal: 8 },
  dropdownSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 14 },
  dropdownDisabled: { backgroundColor: '#F8FAFC' },
  dropdownSelectedText: { fontSize: 15, color: '#0F172A', fontWeight: '600' },
  dropdownPlaceholderText: { fontSize: 15, color: '#94A3B8' },
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap' },
  imageThumbWrapper: { width: 84, height: 84, marginRight: 10, marginBottom: 10, position: 'relative' },
  imageThumb: { width: '100%', height: '100%', borderRadius: 12, backgroundColor: '#E2E8F0' },
  removeImageButton: { position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  addImageTile: { width: 84, height: 84, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  addImageText: { fontSize: 11, color: '#94A3B8', marginTop: 4, fontWeight: '500' },
  certUploadBox: { borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 16, height: 140, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', overflow: 'hidden' },
  certPreviewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  uploadText: { marginTop: 10, color: '#64748B', fontSize: 13, fontWeight: '500' },
  removeCertText: { color: '#EF4444', fontSize: 13, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  currencyToggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  currencyOption: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginRight: 8 },
  currencyOptionActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  currencyOptionText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  currencyOptionTextActive: { color: '#FFFFFF' },
  priceInput: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 15, color: '#0F172A' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  checkboxLabel: { marginLeft: 8, fontSize: 14, color: '#334155', fontWeight: '500' },
  creditsEstimateBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginTop: 14 },
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