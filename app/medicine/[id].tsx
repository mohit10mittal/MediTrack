import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Switch, TextInput, Modal, Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { getMedicine, getProfile, updateMedicine, deleteMedicine, getDoseLogsForDate } from '../../src/db/queries';
import { Medicine, Profile, DoseLog } from '../../src/types';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/colors';
import { StartDateTimePicker } from '../../src/components/StartTimePicker';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { cancelAllReminders, scheduleMedicineReminders, requestNotificationPermissions } from '../../src/utils/notifications';
import { calcDoseTimes, localMidnight } from '../../src/utils/time';

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M15 6l-6 6 6 6" stroke={Colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${ampm}`;
}

export default function MedicineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editDosage, setEditDosage] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editIllness, setEditIllness] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('08:00');
  const [editDosesPerDay, setEditDosesPerDay] = useState(1);

  const load = useCallback(async () => {
    if (!id) return;
    const m = await getMedicine(db, id);
    if (!m) return;
    setMedicine(m);
    setEditDosage(m.dosage);
    setEditNotes(m.notes);
    setEditIllness(m.illness);
    const parsedTimes: string[] = (() => { try { return JSON.parse(m.dose_times); } catch { return ['08:00']; } })();
    setEditStartTime(parsedTimes[0] ?? '08:00');
    setEditDosesPerDay(m.doses_per_day);
    const sd = new Date(m.start_date);
    const sy = sd.getFullYear();
    const sm = String(sd.getMonth() + 1).padStart(2, '0');
    const sday = String(sd.getDate()).padStart(2, '0');
    setEditStartDate(`${sy}-${sm}-${sday}`);
    const p = await getProfile(db, m.profile_id);
    setProfile(p);
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayLogs = await getDoseLogsForDate(db, today);
    setLogs(todayLogs.filter((l) => l.medicine_id === id));
  }, [db, id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!medicine || !profile) return null;

  let times: string[] = [];
  try { times = JSON.parse(medicine.dose_times); } catch { times = ['08:00']; }

  const handleToggleActive = async () => {
    const newVal = medicine.is_active === 1 ? 0 : 1;
    await updateMedicine(db, medicine.id, { is_active: newVal });
    load();
  };

  const handleDelete = () => {
    Alert.alert('Delete medicine?', 'All dose history will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMedicine(db, medicine.id);
          router.back();
        },
      },
    ]);
  };

  const handleEditDosesChange = (n: number) => {
    setEditDosesPerDay(n);
  };

  const handleSaveEdit = async () => {
    const times = calcDoseTimes(editStartTime, editDosesPerDay);
    await updateMedicine(db, medicine.id, {
      dosage: editDosage.trim(),
      notes: editNotes.trim(),
      illness: editIllness.trim(),
      doses_per_day: editDosesPerDay,
      dose_times: JSON.stringify(times),
      start_date: editStartDate ? localMidnight(editStartDate) : medicine.start_date,
    });

    // Reschedule reminders with updated info
    const hasPerms = await requestNotificationPermissions();
    if (hasPerms) {
      await cancelAllReminders();
      const updated = await getMedicine(db, medicine.id);
      if (updated) await scheduleMedicineReminders(updated, profile);
    }
    setEditMode(false);
    load();
  };

  const takenToday = logs.filter((l) => l.taken_at !== null).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{medicine.name}</Text>
        <TouchableOpacity onPress={() => setEditMode(true)} style={styles.editBtn}>
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Color bar hero */}
        <View style={[styles.hero, { backgroundColor: medicine.color }]}>
          <Text style={styles.heroName}>{medicine.name}</Text>
          {medicine.dosage ? <Text style={styles.heroDosage}>{medicine.dosage}</Text> : null}
          {medicine.illness ? (
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{medicine.illness}</Text>
            </View>
          ) : null}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{times.length}</Text>
            <Text style={styles.statLabel}>Doses/day</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{takenToday}/{times.length}</Text>
            <Text style={styles.statLabel}>Taken today</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{format(new Date(medicine.start_date), 'MMM d')}</Text>
            <Text style={styles.statLabel}>Started</Text>
          </View>
        </View>

        {/* Active toggle */}
        <View style={styles.row}>
          <View>
            <Text style={styles.rowLabel}>Active</Text>
            <Text style={styles.rowSub}>Toggle off when course is complete</Text>
          </View>
          <Switch
            value={medicine.is_active === 1}
            onValueChange={handleToggleActive}
            trackColor={{ false: Colors.border, true: Colors.primaryLight }}
            thumbColor={medicine.is_active === 1 ? Colors.primary : Colors.textMuted}
          />
        </View>

        {/* Profile */}
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.infoCard}>
          <View style={[styles.avatar, { backgroundColor: profile.avatar_color }]}>
            <Text style={styles.avatarText}>
              {profile.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
            </Text>
          </View>
          <Text style={styles.infoText}>{profile.name}</Text>
        </View>

        {/* Dose times */}
        <Text style={styles.sectionTitle}>Dose Schedule</Text>
        <View style={styles.timesCard}>
          {times.map((t, i) => {
            const log = logs.find((l) => l.scheduled_time === t);
            const taken = log?.taken_at != null;
            const skipped = log?.skipped === 1;
            return (
              <View key={i} style={styles.timeRow}>
                <View style={[styles.timeDot, taken && styles.timeDotDone, skipped && styles.timeDotSkipped]} />
                <Text style={styles.timeText}>{formatTime(t)}</Text>
                <Text style={[
                  styles.timeStatus,
                  taken && { color: Colors.primary },
                  skipped && { color: Colors.accent },
                ]}>
                  {taken ? '✓ Taken' : skipped ? '✗ Skipped' : 'Pending'}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Notes */}
        {medicine.notes ? (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{medicine.notes}</Text>
            </View>
          </>
        ) : null}

        {/* End date */}
        {medicine.end_date ? (
          <>
            <Text style={styles.sectionTitle}>End Date</Text>
            <Text style={styles.infoText}>{format(new Date(medicine.end_date), 'MMMM d, yyyy')}</Text>
          </>
        ) : null}

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Delete Medicine</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editMode} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setEditMode(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          {/* Medicine name — read-only */}
          <Text style={styles.sheetTitle}>{medicine.name}</Text>
          <Text style={styles.sheetReadOnly}>Medicine name cannot be changed</Text>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.fieldLabel}>Dosage</Text>
            <TextInput
              style={styles.input}
              value={editDosage}
              onChangeText={setEditDosage}
              placeholder="e.g. 500mg, 2 tablets…"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.fieldLabel}>Doses per Day</Text>
            <View style={styles.doseRow}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.doseBtn, editDosesPerDay === n && styles.doseBtnActive]}
                  onPress={() => handleEditDosesChange(n)}
                >
                  <Text style={[styles.doseBtnText, editDosesPerDay === n && styles.doseBtnTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Start Date & Time</Text>
            {editStartDate ? (
              <StartDateTimePicker
                startDate={editStartDate}
                startTime={editStartTime}
                dosesPerDay={editDosesPerDay}
                onDateChange={setEditStartDate}
                onTimeChange={setEditStartTime}
              />
            ) : null}

            <Text style={styles.fieldLabel}>Condition</Text>
            <TextInput
              style={styles.input}
              value={editIllness}
              onChangeText={setEditIllness}
              placeholder="e.g. Diabetes"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="Special instructions…"
              placeholderTextColor={Colors.textMuted}
              multiline
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
            <View style={{ height: 16 }} />
          </ScrollView>
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
  title: { flex: 1, fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  editBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  editBtnText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },
  scrollContent: { paddingBottom: 40 },
  hero: {
    margin: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: 6,
  },
  heroName: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  heroDosage: { fontSize: FontSize.md, color: Colors.textSecondary },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  heroBadgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statNum: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: Colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  rowLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  rowSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.text },
  infoText: { fontSize: FontSize.md, color: Colors.text, fontWeight: '600' },
  timesCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  timeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },
  timeDotDone: { backgroundColor: Colors.primary },
  timeDotSkipped: { backgroundColor: Colors.accent },
  timeText: { flex: 1, fontSize: FontSize.md, color: Colors.text, fontWeight: '600' },
  timeStatus: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '500' },
  notesCard: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notesText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  deleteBtn: {
    margin: Spacing.md,
    marginTop: Spacing.xl,
    borderRadius: Radius.md,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    alignItems: 'center',
  },
  deleteBtnText: { color: Colors.accent, fontSize: FontSize.md, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: 40,
    maxHeight: '85%',
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
  sheetReadOnly: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm },
  sheetScroll: { flexShrink: 1 },
  sheetScrollContent: { gap: Spacing.sm, paddingBottom: 8 },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.sm },
  doseRow: { flexDirection: 'row', gap: Spacing.sm },
  doseBtn: {
    width: 44, height: 44,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  doseBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryPale },
  doseBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textSecondary },
  doseBtnTextActive: { color: Colors.primary },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: FontSize.md,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
});
