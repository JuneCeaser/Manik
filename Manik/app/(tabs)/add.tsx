import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { API_BASE_URL } from '../../constants/api';
import { getPreferredCurrency } from '../../utils/currency';
import {
  GEM_CATEGORIES, GEM_COLORS, GEM_SHAPES, GEM_TREATMENTS, GEM_ORIGINS, GEM_CLARITIES,
  CERTIFICATION_STATUSES, CERTIFICATION_LABS, PROVINCE_CITY_MAP, PROVINCES, getEstimatedRequiredCredits,
} from '../../constants/gemOptions';
import CountryCodePicker, { Country, DEFAULT_COUNTRY } from '../../components/CountryCodePicker';

const GEMS_URL = `${API_BASE_URL.replace('/auth', '')}/gems`;

type PickerKey = 'category' | 'color' | 'shape' | 'origin' | 'clarity' | 'treatment' | 'certification' | 'lab' | 'province' | 'city' | 'none';

type AppImage = { url: string; fileId: string; isNew?: boolean; ext?: string; };

const SelectModal = ({ visible, title, options, onSelect, onClose, colors }: { visible: boolean; title: string; options: string[]; onSelect: (value: string) => void; onClose: () => void; colors: any; }) => {
  const styles = createStyles(colors);
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.pickerCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList data={options} keyExtractor={(item) => item} style={{ marginTop: 12, maxHeight: 320 }} renderItem={({ item }) => (
            <Pressable style={styles.optionRow} onPress={() => { onSelect(item); onClose(); }}><Text style={styles.optionText}>{item}</Text></Pressable>
          )} />
        </View>
      </Pressable>
    </Modal>
  );
};

const FieldSelector = ({ label, value, placeholder, onPress, disabled, colors }: { label: string; value: string; placeholder: string; onPress: () => void; disabled?: boolean; colors: any; }) => {
  const styles = createStyles(colors);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={[styles.dropdownSelector, disabled && styles.dropdownDisabled]} onPress={onPress} disabled={disabled}>
        <Text style={value ? styles.dropdownSelectedText : styles.dropdownPlaceholderText}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
};

export default function AddScreen() {
  const { user, userToken, logout } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  
  const isEditMode = !!editId && editId !== '';
  const [activePicker, setActivePicker] = useState<PickerKey>('none');
  const [submitting, setSubmitting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  
  const [prefCurrency, setPrefCurrency] = useState<'LKR' | 'USD'>('LKR');
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
  const [hidePhoneNumber, setHidePhoneNumber] = useState(false);

  // Phone + WhatsApp
  const [contactPhone, setContactPhone] = useState((user as any)?.phone || '');
  const [whatsappCountry, setWhatsappCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [whatsappNumber, setWhatsappNumber] = useState((user as any)?.whatsappNumber || '');

  useFocusEffect(
    useCallback(() => { getPreferredCurrency().then(setPrefCurrency); }, [])
  );

  useEffect(() => {
    if (!isEditMode) { setInitialLoading(false); return; }
    const loadAd = async () => {
      try {
        const res = await fetch(`${GEMS_URL}/${editId}`, { headers: { Authorization: `Bearer ${userToken}` } });
        const data = await res.json();
        if (res.status === 401) { logout(); return; }
        if (!data.success) { Alert.alert('Error', data.message); router.back(); return; }

        const ad = data.gemAd;
        setTitle(ad.title); setCategory(ad.category); setPriceAmount(String(ad.price.amount)); setPrefCurrency(ad.price.currency); setNegotiable(ad.price.negotiable);
        setWeightCarats(String(ad.weightCarats)); setOrigin(ad.origin || ''); setClarity(ad.clarity || '');
        setDimLength(ad.dimensions?.length ? String(ad.dimensions.length) : ''); setDimWidth(ad.dimensions?.width ? String(ad.dimensions.width) : ''); setDimDepth(ad.dimensions?.depth ? String(ad.dimensions.depth) : '');
        if (GEM_COLORS.includes(ad.color)) { setColor(ad.color); } else { setColor('Other'); setCustomColor(ad.color); }
        setShape(ad.shape); setTreatment(ad.treatment); setCertificationStatus(ad.certification?.status || 'Not Certified'); setLabName(ad.certification?.labName || ''); setDescription(ad.description || '');
        setImages(ad.images.map((img: any) => ({ url: img.url, fileId: img.fileId, isNew: false })));
        if (ad.certificateImage) { setCertificateImage({ url: ad.certificateImage.url, fileId: ad.certificateImage.fileId, isNew: false }); setOriginalCertificateUrl(ad.certificateImage.url); }
        setProvince(ad.location.province); setCity(ad.location.city); setHidePhoneNumber(ad.hidePhoneNumber);
        setContactPhone(ad.contactPhone || '');
      } catch { Alert.alert('Error', 'Failed to load this ad.'); router.back(); } finally { setInitialLoading(false); }
    };
    loadAd();
  }, [editId, isEditMode]);

  const pickImages = async () => {
    if (images.length >= 5) return Alert.alert('Limit Reached', 'You can upload a maximum of 5 images.');
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) return Alert.alert('Permission Required', 'You need to allow access to your photos.');
    const remainingSlots = 5 - images.length;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: remainingSlots, quality: 1 });

    if (!result.canceled) {
      const processedImages = await Promise.all(
        result.assets.map(async (a) => {
          const manipulated = await ImageManipulator.manipulateAsync(a.uri, [{ resize: { width: 1920 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
          return { url: manipulated.uri, fileId: '', isNew: true, ext: 'jpg' };
        })
      );
      setImages((prev) => [...prev, ...processedImages].slice(0, 5));
    }
  };

  const removeImage = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index));

  const pickCertificateImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1 });
    if (!result.canceled) {
      const manipulated = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 1920 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
      setCertificateImage({ url: manipulated.uri, fileId: '', isNew: true, ext: 'jpg' });
    }
  };

  const resetForm = () => {
    setImages([]); setCertificateImage(null); setTitle(''); setCategory(''); setPriceAmount(''); setNegotiable(false); setWeightCarats(''); setColor(''); setCustomColor(''); setShape(''); setOrigin(''); setClarity(''); setDimLength(''); setDimWidth(''); setDimDepth(''); setTreatment(''); setCertificationStatus('Not Certified'); setLabName(''); setDescription(''); setProvince((user as any)?.province || ''); setCity((user as any)?.city || ''); setHidePhoneNumber(false);
    setContactPhone((user as any)?.phone || '');
    setWhatsappNumber((user as any)?.whatsappNumber || '');
  };

  const validateForm = (): string | null => {
    if (images.length < 1) return 'Please upload at least 1 image.';
    if (!title.trim()) return 'Please enter an ad title.';
    if (!category) return 'Please select a category.';
    if (!priceAmount || isNaN(Number(priceAmount)) || Number(priceAmount) <= 0) return 'Please enter a valid price.';
    if (!weightCarats || isNaN(Number(weightCarats)) || Number(weightCarats) <= 0) return 'Please enter a valid weight in carats.';
    if (!color) return 'Please select a color.';
    if (color === 'Other' && !customColor.trim()) return 'Please enter a custom color.';
    if (!shape) return 'Please select a shape / cut.';
    if (!origin) return 'Please select origin.';
    if (!clarity) return 'Please select clarity.';
    if (!treatment) return 'Please select treatment.';
    if (certificationStatus === 'Certified' && !labName) return 'Please select the certifying lab.';
    if (!province || !city) return 'Please select your location.';
    
    // Validate Contact Details depending on login method
    if ((user as any)?.phone) { // Phone users
      if (!hidePhoneNumber && !contactPhone.trim()) return 'Please enter a normal contact phone.';
    } else { // Social users
      if (!whatsappNumber.trim()) return 'Please enter your WhatsApp number so buyers can reach you.';
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) return Alert.alert('Missing Information', validationError);
    setSubmitting(true);
    
    try {
      const uploadToImageKit = async (fileUri: string, folder: string, ext: string = 'jpg') => {
        const authRes = await fetch(`${GEMS_URL}/imagekit-auth?t=${Date.now()}${Math.random()}`, { headers: { Authorization: `Bearer ${userToken}`, 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } });
        const authData = await authRes.json();
        const formData = new FormData();
        const generatedFileName = `gem_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
        formData.append('file', { uri: fileUri, name: generatedFileName, type: 'image/jpeg' } as any);
        formData.append('fileName', generatedFileName); 
        formData.append('publicKey', authData.publicKey); formData.append('signature', authData.signature); formData.append('expire', String(authData.expire)); formData.append('token', authData.token); formData.append('folder', folder);
        const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: formData });
        return await res.json();
      };

      const finalImages = [];
      for (const img of images) {
        if (img.isNew && img.url) {
          const uploaded = await uploadToImageKit(img.url, 'gem_ads', img.ext);
          finalImages.push({ url: uploaded.url, fileId: uploaded.fileId });
        } else finalImages.push({ url: img.url, fileId: img.fileId });
      }

      let finalCertificate = certificateImage && !certificateImage.isNew ? { url: certificateImage.url, fileId: certificateImage.fileId } : null;
      if (certificateImage && certificateImage.isNew && certificateImage.url) {
        const uploaded = await uploadToImageKit(certificateImage.url, 'gem_certificates', certificateImage.ext);
        finalCertificate = { url: uploaded.url, fileId: uploaded.fileId };
      }

      const finalColor = color === 'Other' ? customColor.trim() : color;

      const payload: any = {
        title: title.trim(), category, price: { amount: Number(priceAmount), currency: prefCurrency, negotiable }, weightCarats: Number(weightCarats), color: finalColor, shape, origin, clarity, dimensions: { length: dimLength ? Number(dimLength) : 0, width: dimWidth ? Number(dimWidth) : 0, depth: dimDepth ? Number(dimDepth) : 0 }, treatment, certification: { status: certificationStatus, labName: certificationStatus === 'Certified' ? labName : '' }, description: description.trim(), province, city, hidePhoneNumber, images: finalImages,
      };

      if ((user as any)?.phone) {
        payload.contactPhone = hidePhoneNumber ? '' : contactPhone.trim();
      }

      if (whatsappNumber.trim()) {
        payload.whatsappCountryCode = whatsappCountry.code;
        payload.whatsappNumber = whatsappNumber.trim();
      }

      if (finalCertificate || (isEditMode && certificateImage === null)) payload.certificateImage = finalCertificate;

      const res = await fetch(isEditMode ? `${GEMS_URL}/${editId}` : GEMS_URL, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 401) { logout(); return; }
      if (res.status === 402 || data.code === 'INSUFFICIENT_CREDITS') return Alert.alert('Not Enough Ad Credits', data.message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Get Credits', onPress: () => router.push('/buy-credits') }]);
      
      if (data.success) {
        Alert.alert(isEditMode ? 'Ad Updated' : 'Ad Submitted', isEditMode ? 'Your changes were saved.' : 'Your gem has been submitted for admin approval.');
        resetForm(); router.setParams({ editId: '' }); router.push('../my-ads');
      } else Alert.alert('Submission Failed', data.message || 'Something went wrong.');
    } catch (error) { Alert.alert('Error', 'Failed to connect to the server.'); } finally { setSubmitting(false); }
  };

  const estimatedCredits = priceAmount && !isNaN(Number(priceAmount)) && Number(priceAmount) > 0 ? getEstimatedRequiredCredits(Number(priceAmount), prefCurrency) : null;
  const isSocialUser = !(user as any)?.phone;

  if (isEditMode && initialLoading) return <SafeAreaView style={styles.container} edges={['top']}><View style={styles.centerContent}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Gem' : 'Add New Gem'}</Text>
          {isEditMode && <Pressable onPress={() => { resetForm(); router.setParams({ editId: '' }); router.back(); }}><Text style={styles.cancelText}>Cancel</Text></Pressable>}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Photos ({images.length}/5)</Text>
          <View style={styles.imagesRow}>
            {images.map((img, index) => (
              <View key={index} style={styles.imageThumbWrapper}>
                <Image source={{ uri: img.url }} style={styles.imageThumb} />
                <Pressable style={styles.removeImageButton} onPress={() => removeImage(index)}><Ionicons name="close" size={14} color="#FFF" /></Pressable>
              </View>
            ))}
            {images.length < 5 && (
              <Pressable style={styles.addImageTile} onPress={pickImages}>
                <Ionicons name="camera-outline" size={26} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Core Details</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Ad Title</Text>
            <TextInput style={styles.input} placeholderTextColor={colors.textSecondary} placeholder="e.g. Natural Royal Blue Sapphire 2.5ct" value={title} onChangeText={setTitle} />
          </View>
          <FieldSelector colors={colors} label="Gem Category" value={category} placeholder="Select category" onPress={() => setActivePicker('category')} />
          <Text style={styles.fieldLabel}>Price</Text>
          <View style={styles.currencyToggleRow}>
            <View style={[styles.currencyOption, styles.currencyOptionActive]}><Text style={styles.currencyOptionTextActive}>{prefCurrency}</Text></View>
            <TextInput style={styles.priceInput} placeholderTextColor={colors.textSecondary} placeholder="Amount" keyboardType="numeric" value={priceAmount} onChangeText={setPriceAmount} />
          </View>
          <Pressable style={styles.checkboxRow} onPress={() => setNegotiable((v) => !v)}>
            <Ionicons name={negotiable ? 'checkbox' : 'square-outline'} size={22} color={negotiable ? colors.primary : colors.textSecondary} />
            <Text style={styles.checkboxLabel}>Price is negotiable</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Gem Specifications</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Weight (Carats)</Text>
            <TextInput style={styles.input} placeholderTextColor={colors.textSecondary} placeholder="e.g. 2.45" keyboardType="numeric" value={weightCarats} onChangeText={setWeightCarats} />
          </View>
          <FieldSelector colors={colors} label="Color" value={color} placeholder="Select color" onPress={() => setActivePicker('color')} />
          {color === 'Other' && <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>Custom Color</Text><TextInput style={styles.input} placeholderTextColor={colors.textSecondary} placeholder="Enter color" value={customColor} onChangeText={setCustomColor} /></View>}
          <FieldSelector colors={colors} label="Shape & Cut" value={shape} placeholder="Select shape" onPress={() => setActivePicker('shape')} />
          <FieldSelector colors={colors} label="Origin" value={origin} placeholder="Select origin" onPress={() => setActivePicker('origin')} />
          <FieldSelector colors={colors} label="Clarity" value={clarity} placeholder="Select clarity" onPress={() => setActivePicker('clarity')} />
          <FieldSelector colors={colors} label="Treatment" value={treatment} placeholder="Select treatment" onPress={() => setActivePicker('treatment')} />
          <FieldSelector colors={colors} label="Certification" value={certificationStatus} placeholder="Select certification" onPress={() => setActivePicker('certification')} />
          {certificationStatus === 'Certified' && <FieldSelector colors={colors} label="Certifying Lab" value={labName} placeholder="Select lab" onPress={() => setActivePicker('lab')} />}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Location & Contact</Text>
          <FieldSelector colors={colors} label="Province" value={province} placeholder="Select province" onPress={() => setActivePicker('province')} />
          <FieldSelector colors={colors} label="City" value={city} placeholder={province ? 'Select city' : 'Select a province first'} onPress={() => setActivePicker('city')} disabled={!province} />
          
          {/* Contact Details (Dynamic for Phone vs Social) */}
          <Text style={styles.fieldLabel}>WhatsApp Number (Required for chat)</Text>
          <View style={[styles.fieldGroup, { flexDirection: 'row' }]}>
            <View style={{ width: 100, marginRight: 10 }}>
              <CountryCodePicker selectedCountry={whatsappCountry} onSelect={setWhatsappCountry} />
            </View>
            <TextInput style={[styles.input, { flex: 1 }]} placeholderTextColor={colors.textSecondary} placeholder="77 123 4567" keyboardType="phone-pad" value={whatsappNumber} onChangeText={setWhatsappNumber} />
          </View>

          {!isSocialUser && !hidePhoneNumber && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Regular Contact Phone</Text>
              <TextInput style={styles.input} placeholderTextColor={colors.textSecondary} placeholder="Phone number" keyboardType="phone-pad" value={contactPhone} onChangeText={setContactPhone} />
            </View>
          )}

          {!isSocialUser && (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Hide regular phone number</Text>
              <Switch value={hidePhoneNumber} onValueChange={setHidePhoneNumber} trackColor={{ false: colors.border, true: '#93C5FD' }} thumbColor={hidePhoneNumber ? colors.primary : colors.inputBg} />
            </View>
          )}
        </View>

        <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>{isEditMode ? 'Save Changes' : 'Post Ad for Approval'}</Text>}
        </Pressable>
      </ScrollView>

      {/* Modals omitted for brevity - keep your existing SelectModal implementations */}
      <SelectModal colors={colors} visible={activePicker === 'category'} title="Select Category" options={GEM_CATEGORIES} onSelect={setCategory} onClose={() => setActivePicker('none')} />
      <SelectModal colors={colors} visible={activePicker === 'color'} title="Select Color" options={GEM_COLORS} onSelect={setColor} onClose={() => setActivePicker('none')} />
      <SelectModal colors={colors} visible={activePicker === 'shape'} title="Select Shape & Cut" options={GEM_SHAPES} onSelect={setShape} onClose={() => setActivePicker('none')} />
      <SelectModal colors={colors} visible={activePicker === 'origin'} title="Select Origin" options={GEM_ORIGINS} onSelect={setOrigin} onClose={() => setActivePicker('none')} />
      <SelectModal colors={colors} visible={activePicker === 'clarity'} title="Select Clarity" options={GEM_CLARITIES} onSelect={setClarity} onClose={() => setActivePicker('none')} />
      <SelectModal colors={colors} visible={activePicker === 'treatment'} title="Select Treatment" options={GEM_TREATMENTS} onSelect={setTreatment} onClose={() => setActivePicker('none')} />
      <SelectModal colors={colors} visible={activePicker === 'certification'} title="Select Certification" options={CERTIFICATION_STATUSES} onSelect={setCertificationStatus} onClose={() => setActivePicker('none')} />
      <SelectModal colors={colors} visible={activePicker === 'lab'} title="Select Lab" options={CERTIFICATION_LABS} onSelect={setLabName} onClose={() => setActivePicker('none')} />
      <SelectModal colors={colors} visible={activePicker === 'province'} title="Select Province" options={PROVINCES} onSelect={(v) => { setProvince(v); setCity(''); }} onClose={() => setActivePicker('none')} />
      <SelectModal colors={colors} visible={activePicker === 'city'} title="Select City" options={PROVINCE_CITY_MAP[province] || []} onSelect={setCity} onClose={() => setActivePicker('none')} />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 22, paddingBottom: 60 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.text },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.danger },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 20, elevation: 2, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 12 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, borderRadius: 12, padding: 12, fontSize: 15, color: colors.text },
  dropdownSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 14 },
  dropdownDisabled: { opacity: 0.5 },
  dropdownSelectedText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  dropdownPlaceholderText: { fontSize: 15, color: colors.textSecondary },
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap' },
  imageThumbWrapper: { width: 84, height: 84, marginRight: 10, marginBottom: 10, position: 'relative' },
  imageThumb: { width: '100%', height: '100%', borderRadius: 12, backgroundColor: colors.border },
  removeImageButton: { position: 'absolute', top: -6, right: -6, backgroundColor: colors.danger, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.card },
  addImageTile: { width: 84, height: 84, borderRadius: 12, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.inputBg },
  currencyToggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  currencyOption: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginRight: 8 },
  currencyOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  currencyOptionTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  priceInput: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  checkboxLabel: { marginLeft: 8, fontSize: 14, color: colors.text, fontWeight: '500' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  switchLabel: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '500', marginRight: 12 },
  submitButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  submitButtonText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: colors.modalOverlay, justifyContent: 'center', padding: 20 },
  pickerCard: { backgroundColor: colors.card, borderRadius: 20, padding: 20, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  optionRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionText: { fontSize: 15, color: colors.text, fontWeight: '500' },
});