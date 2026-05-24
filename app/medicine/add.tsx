import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Modal, Pressable, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { getProfiles, createMedicine } from '../../src/db/queries';
import { Profile } from '../../src/types';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/colors';
import { StartDateTimePicker } from '../../src/components/StartTimePicker';
import { scheduleMedicineReminders, requestNotificationPermissions } from '../../src/utils/notifications';
import { calcDoseTimes, todayDateString, localMidnight } from '../../src/utils/time';
import Svg, { Path } from 'react-native-svg';

// OCR: try ML Kit, fall back gracefully if not available
let TextRecognition: any = null;
try {
  TextRecognition = require('@react-native-ml-kit/text-recognition').default;
} catch {}

const PILL_COLORS = [
  '#E8F5E9', '#E3F2FD', '#FFF8E1', '#FCE4EC',
  '#EDE7F6', '#E0F7FA', '#F3E5F5', '#DCEDC8',
];

const COMMON_ILLNESSES = [
  'Diabetes', 'Hypertension', 'Heart', 'Thyroid',
  'Allergy', 'Asthma', 'Arthritis', 'Anxiety',
  'Depression', 'Cholesterol', 'Vitamins', 'Pain',
];

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M15 6l-6 6 6 6" stroke={Colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CameraIcon({ color = 'white' }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

function extractMedicineNames(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const results = new Set<string>();

  for (const line of lines) {
    // Skip lines that look like addresses, dates, prices, totals
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(line)) continue;
    if (/₹|\$|total|amount|gst|tax|invoice|bill|receipt|qty|batch|mrp|address|phone/i.test(line)) continue;
    if (/^\d+$/.test(line)) continue;

    // Match common medicine name patterns:
    // - Starts with capital letter, has letters + maybe numbers (e.g., "Metformin 500mg", "Atorvastatin")
    const medPattern = /^([A-Z][a-zA-Z]+(?:\s+[A-Za-z0-9]+)*(?:\s+\d+\s*(?:mg|mcg|ml|g|iu|IU))?)/;
    const match = line.match(medPattern);
    if (match && match[1].length >= 4 && match[1].length <= 60) {
      results.add(match[1].trim());
    }
  }

  return Array.from(results).slice(0, 20);
}

export default function AddMedicineScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const router = useRouter();
  const db = useSQLiteContext();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState(profileId ?? '');

  // OCR state
  const [scanLoading, setScanLoading] = useState(false);
  const [scannedMeds, setScannedMeds] = useState<string[]>([]);
  const [showScanned, setShowScanned] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [illness, setIllness] = useState('');
  const [customIllness, setCustomIllness] = useState('');
  const [dosesPerDay, setDosesPerDay] = useState(1);
  const [startDate, setStartDate] = useState(todayDateString);
  const [startTime, setStartTime] = useState('08:00');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState(PILL_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProfiles(db).then((p) => {
      setProfiles(p);
      if (!profileId && p.length > 0) setSelectedProfileId(p[0].id);
    });
  }, [db]);

  // Sync doses per day with times array
  const handleDosesChange = (n: number) => {
    setDosesPerDay(n);
  };

  const handleScan = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      const { status: galleryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (galleryStatus !== 'granted') {
        Alert.alert('Permission needed', 'Camera or gallery access is required to scan bills.');
        return;
      }
    }

    Alert.alert('Scan Medical Bill', 'Choose source', [
      {
        text: 'Camera',
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            quality: 0.9,
            allowsEditing: false,
          });
          if (!result.canceled) processImage(result.assets[0].uri);
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            quality: 0.9,
            allowsEditing: false,
          });
          if (!result.canceled) processImage(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const processImage = async (uri: string) => {
    if (!TextRecognition) {
      Alert.alert(
        'OCR not available',
        'ML Kit text recognition is not available on this device/simulator. Please enter medicines manually.'
      );
      return;
    }
    setScanLoading(true);
    try {
      const result = await TextRecognition.recognize(uri);
      const fullText = result.blocks?.map((b: any) => b.text).join('\n') ?? '';
      const found = extractMedicineNames(fullText);
      if (found.length === 0) {
        Alert.alert('No medicines found', 'Could not detect medicine names in this image. Try a clearer photo or enter manually.');
      } else {
        setScannedMeds(found);
        setShowScanned(true);
      }
    } catch (e) {
      Alert.alert('Scan failed', 'Could not read the image. Please try again or enter manually.');
    } finally {
      setScanLoading(false);
    }
  };

  const handleSelectScanned = (medName: string) => {
    setName(medName);
    const dosageMatch = medName.match(/(\d+\s*(?:mg|mcg|ml|g|iu|IU))/i);
    if (dosageMatch) setDosage(dosageMatch[1]);
    setShowScanned(false);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter the medicine name.'); return; }
    if (!selectedProfileId) { Alert.alert('Profile required', 'Please select a profile.'); return; }

    setSaving(true);
    try {
      const finalIllness = illness === '__custom__' ? customIllness.trim() : illness;
      const endTimestamp = endDate ? new Date(endDate).getTime() : null;
      const times = calcDoseTimes(startTime, dosesPerDay);

      const medicine = await createMedicine(db, {
        profile_id: selectedProfileId,
        name: name.trim(),
        dosage: dosage.trim(),
        illness: finalIllness,
        doses_per_day: dosesPerDay,
        dose_times: JSON.stringify(times),
        start_date: localMidnight(startDate),
        end_date: endTimestamp,
        notes: notes.trim(),
        is_active: 1,
        color,
      });

      const hasPerms = await requestNotificationPermissions();
      if (hasPerms) {
        const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
        if (selectedProfile) {
          await scheduleMedicineReminders(medicine, selectedProfile);
        }
      }

      router.back();
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (n: string) =>
    n.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.title}>Add Medicine</Text>
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={handleScan}
          disabled={scanLoading}
        >
          {scanLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <>
              <CameraIcon color={Colors.primary} />
              <Text style={styles.scanBtnText}>Scan Bill</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Profile selector */}
        <Text style={styles.label}>Profile *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.profileRow}>
          {profiles.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.profileChip, selectedProfileId === p.id && styles.profileChipActive]}
              onPress={() => setSelectedProfileId(p.id)}
            >
              <View style={[styles.chipAvatar, { backgroundColor: p.avatar_color }]}>
                <Text style={styles.chipAvatarText}>{getInitials(p.name)}</Text>
              </View>
              <Text style={[styles.profileChipText, selectedProfileId === p.id && styles.profileChipTextActive]}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Medicine name */}
        <Text style={styles.label}>Medicine Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Metformin, Atorvastatin..."
          placeholderTextColor={Colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        {/* Dosage */}
        <Text style={styles.label}>Dosage</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 500mg, 10mg, 2 tablets..."
          placeholderTextColor={Colors.textMuted}
          value={dosage}
          onChangeText={setDosage}
        />

        {/* Illness / condition */}
        <Text style={styles.label}>Condition / Illness</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
          <TouchableOpacity
            style={[styles.illnessChip, illness === '' && styles.illnessChipActive]}
            onPress={() => setIllness('')}
          >
            <Text style={[styles.illnessChipText, illness === '' && styles.illnessChipTextActive]}>None</Text>
          </TouchableOpacity>
          {COMMON_ILLNESSES.map((ill) => (
            <TouchableOpacity
              key={ill}
              style={[styles.illnessChip, illness === ill && styles.illnessChipActive]}
              onPress={() => setIllness(ill)}
            >
              <Text style={[styles.illnessChipText, illness === ill && styles.illnessChipTextActive]}>{ill}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.illnessChip, illness === '__custom__' && styles.illnessChipActive]}
            onPress={() => setIllness('__custom__')}
          >
            <Text style={[styles.illnessChipText, illness === '__custom__' && styles.illnessChipTextActive]}>Other…</Text>
          </TouchableOpacity>
        </ScrollView>
        {illness === '__custom__' && (
          <TextInput
            style={[styles.input, { marginTop: Spacing.sm }]}
            placeholder="Enter condition name..."
            placeholderTextColor={Colors.textMuted}
            value={customIllness}
            onChangeText={setCustomIllness}
          />
        )}

        {/* Doses per day */}
        <Text style={styles.label}>Doses per Day</Text>
        <View style={styles.doseRow}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.doseBtn, dosesPerDay === n && styles.doseBtnActive]}
              onPress={() => handleDosesChange(n)}
            >
              <Text style={[styles.doseBtnText, dosesPerDay === n && styles.doseBtnTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Start date & time */}
        <Text style={styles.label}>Start Date & Time</Text>
        <StartDateTimePicker
          startDate={startDate}
          startTime={startTime}
          dosesPerDay={dosesPerDay}
          onDateChange={setStartDate}
          onTimeChange={setStartTime}
        />

        {/* Color */}
        <Text style={styles.label}>Color Tag</Text>
        <View style={styles.colorRow}>
          {PILL_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotActive]}
              onPress={() => setColor(c)}
            />
          ))}
        </View>

        {/* End date (optional) */}
        <Text style={styles.label}>End Date (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD (leave blank for ongoing)"
          placeholderTextColor={Colors.textMuted}
          value={endDate}
          onChangeText={setEndDate}
          keyboardType="numbers-and-punctuation"
        />

        {/* Notes */}
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Special instructions, food timing, etc."
          placeholderTextColor={Colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDim]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.saveBtnText}>Save Medicine & Set Reminders</Text>
          )}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Scanned medicines picker */}
      <Modal visible={showScanned} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setShowScanned(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Medicines Found</Text>
          <Text style={styles.sheetSubtitle}>Tap a name to fill in the form</Text>
          <ScrollView style={styles.scannedList}>
            {scannedMeds.map((med, i) => (
              <TouchableOpacity
                key={i}
                style={styles.scannedItem}
                onPress={() => handleSelectScanned(med)}
              >
                <Text style={styles.scannedItemText}>{med}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowScanned(false)}>
            <Text style={styles.cancelBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.sm },
  title: { flex: 1, fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  scanBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  label: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, marginBottom: 6, marginTop: Spacing.md },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: FontSize.md,
    color: Colors.text,
    backgroundColor: Colors.card,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  profileRow: { marginHorizontal: -Spacing.md, paddingHorizontal: Spacing.md },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    marginRight: Spacing.sm,
  },
  profileChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryPale },
  chipAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chipAvatarText: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.text },
  profileChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  profileChipTextActive: { color: Colors.primary },
  chipsRow: { marginHorizontal: -Spacing.md, paddingHorizontal: Spacing.md },
  illnessChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  illnessChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryPale },
  illnessChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  illnessChipTextActive: { color: Colors.primary, fontWeight: '700' },
  doseRow: { flexDirection: 'row', gap: Spacing.sm },
  doseBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  doseBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryPale },
  doseBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textSecondary },
  doseBtnTextActive: { color: Colors.primary },
  colorRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: { borderColor: Colors.primary, transform: [{ scale: 1.15 }] },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  saveBtnDim: { opacity: 0.6 },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  sheetTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  sheetSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  scannedList: { flex: 1 },
  scannedItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  scannedItemText: { fontSize: FontSize.md, color: Colors.text, fontWeight: '500' },
  cancelBtn: {
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
});
