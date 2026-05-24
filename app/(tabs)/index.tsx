import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, Modal, Pressable,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, addDays, subDays, isToday, isTomorrow, isYesterday } from 'date-fns';
import { Logo } from '../../src/components/Logo';
import { getScheduleForDate, upsertDoseLog, updateMedicine, getActiveMedicines, getProfile } from '../../src/db/queries';
import { calcDoseTimes } from '../../src/utils/time';
import { cancelAllReminders, requestNotificationPermissions, scheduleMedicineReminders } from '../../src/utils/notifications';
import { DoseScheduleItem } from '../../src/types';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/colors';
import Svg, { Path, Circle } from 'react-native-svg';

function CheckIcon({ done }: { done: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      <Circle
        cx="11" cy="11" r="10"
        fill={done ? Colors.primary : 'transparent'}
        stroke={done ? Colors.primary : Colors.border}
        strokeWidth={1.8}
      />
      {done && (
        <Path
          d="M6.5 11l3.5 3.5 5.5-6"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

function SkipIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      <Circle cx="11" cy="11" r="10" fill={Colors.accentLight} stroke={Colors.accent} strokeWidth={1.8} />
      <Path d="M7.5 14.5l7-7M7.5 7.5l7 7" stroke={Colors.accent} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function formatDateLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEE, MMM d');
}

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${ampm}`;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

function groupByTime(items: DoseScheduleItem[]): [string, DoseScheduleItem[]][] {
  const map = new Map<string, DoseScheduleItem[]>();
  for (const item of items) {
    if (!map.has(item.time)) map.set(item.time, []);
    map.get(item.time)!.push(item);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedule, setSchedule] = useState<DoseScheduleItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editingItem, setEditingItem] = useState<DoseScheduleItem | null>(null);
  const [selH, setSelH] = useState('08');
  const [selM, setSelM] = useState('00');

  const dateStr = format(currentDate, 'yyyy-MM-dd');

  const loadSchedule = useCallback(async () => {
    const items = await getScheduleForDate(db, dateStr);
    setSchedule(items);
  }, [db, dateStr]);

  useFocusEffect(
    useCallback(() => {
      loadSchedule();
    }, [loadSchedule])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSchedule();
    setRefreshing(false);
  };

  const openTakenPicker = (item: DoseScheduleItem) => {
    const ref = item.takenAt ? new Date(item.takenAt) : new Date();
    setSelH(String(ref.getHours()).padStart(2, '0'));
    setSelM(String(ref.getMinutes()).padStart(2, '0'));
    setEditingItem(item);
  };

  const handleConfirmTaken = async () => {
    if (!editingItem) return;

    const [y, mo, d] = editingItem.date.split('-').map(Number);
    const ts = new Date(y, mo - 1, d, parseInt(selH, 10), parseInt(selM, 10), 0, 0).getTime();
    await upsertDoseLog(db, editingItem.medicine.id, editingItem.date, editingItem.time, ts, false);

    const actualTime = `${selH}:${selM}`;
    const scheduledTime = editingItem.time;
    const item = editingItem;

    setEditingItem(null);
    loadSchedule();

    if (actualTime !== scheduledTime) {
      const newTimes = calcDoseTimes(actualTime, item.medicine.doses_per_day);
      const nextDoseTime = newTimes[1] ?? newTimes[0];

      Alert.alert(
        'Update dose schedule?',
        `You took this at ${formatTime(actualTime)} instead of the scheduled ${formatTime(scheduledTime)}.\n\nUpdate the schedule so the next dose is at ${formatTime(nextDoseTime)}?`,
        [
          { text: 'Keep schedule', style: 'cancel' },
          {
            text: 'Update schedule',
            onPress: async () => {
              await updateMedicine(db, item.medicine.id, {
                dose_times: JSON.stringify(newTimes),
              });
              const hasPerms = await requestNotificationPermissions();
              if (hasPerms) {
                await cancelAllReminders();
                const allMeds = await getActiveMedicines(db);
                for (const med of allMeds) {
                  const profile = await getProfile(db, med.profile_id);
                  if (profile) await scheduleMedicineReminders(med, profile);
                }
              }
              loadSchedule();
            },
          },
        ]
      );
    }
  };

  const handleUndoTaken = async () => {
    if (!editingItem) return;
    await upsertDoseLog(db, editingItem.medicine.id, editingItem.date, editingItem.time, null, false);
    setEditingItem(null);
    loadSchedule();
  };

  const setNow = () => {
    const now = new Date();
    setSelH(String(now.getHours()).padStart(2, '0'));
    setSelM(String(now.getMinutes()).padStart(2, '0'));
  };

  const handleSkip = async (item: DoseScheduleItem) => {
    if (item.skipped) {
      await upsertDoseLog(db, item.medicine.id, item.date, item.time, null, false);
    } else {
      await upsertDoseLog(db, item.medicine.id, item.date, item.time, null, true);
    }
    loadSchedule();
  };

  const takenCount = schedule.filter((i) => i.takenAt !== null).length;
  const total = schedule.length;
  const progress = total > 0 ? takenCount / total : 0;

  const groups = groupByTime(schedule);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Logo size={36} />
          <Text style={styles.appName}>MediTrack</Text>
        </View>
        <Text style={styles.dateLabel}>{format(currentDate, 'MMM d, yyyy')}</Text>
      </View>

      {/* Date navigator */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={() => setCurrentDate(subDays(currentDate, 1))} style={styles.dateNavBtn}>
          <Svg width={20} height={20} viewBox="0 0 20 20">
            <Path d="M13 4l-6 6 6 6" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCurrentDate(new Date())}>
          <Text style={styles.dateNavLabel}>{formatDateLabel(currentDate)}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCurrentDate(addDays(currentDate, 1))} style={styles.dateNavBtn}>
          <Svg width={20} height={20} viewBox="0 0 20 20">
            <Path d="M7 4l6 6-6 6" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      {total > 0 && (
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>
              {takenCount} of {total} doses taken
            </Text>
            <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {schedule.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💊</Text>
            <Text style={styles.emptyTitle}>No medicines scheduled</Text>
            <Text style={styles.emptyText}>
              Add medicines from the Medicines tab or create profiles first.
            </Text>
          </View>
        ) : (
          groups.map(([time, items]) => (
            <View key={time} style={styles.timeGroup}>
              <View style={styles.timeHeader}>
                <View style={styles.timeDot} />
                <Text style={styles.timeText}>{formatTime(time)}</Text>
              </View>
              {items.map((item, idx) => {
                const taken = item.takenAt !== null;
                const skipped = item.skipped;
                return (
                  <View
                    key={`${item.medicine.id}-${idx}`}
                    style={[
                      styles.doseCard,
                      taken && styles.doseCardTaken,
                      skipped && styles.doseCardSkipped,
                    ]}
                  >
                    <View style={[styles.doseColorBar, { backgroundColor: item.medicine.color }]} />
                    <View style={styles.doseContent}>
                      <View style={styles.doseTop}>
                        <View>
                          <Text style={[styles.medicineName, (taken || skipped) && styles.medicineNameDim]}>
                            {item.medicine.name}
                          </Text>
                          {item.medicine.dosage ? (
                            <Text style={styles.dosage}>{item.medicine.dosage}</Text>
                          ) : null}
                          {item.medicine.illness ? (
                            <View style={styles.illnessBadge}>
                              <Text style={styles.illnessText}>{item.medicine.illness}</Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.profileBadge}>
                          <View style={[styles.avatar, { backgroundColor: item.profile.avatar_color }]}>
                            <Text style={styles.avatarText}>{getInitials(item.profile.name)}</Text>
                          </View>
                          <Text style={styles.profileName}>{item.profile.name}</Text>
                        </View>
                      </View>
                      <View style={styles.doseActions}>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => openTakenPicker(item)}
                        >
                          <CheckIcon done={taken} />
                          <Text style={[styles.actionText, taken && styles.actionTextDone]}>
                            {taken ? `Taken at ${formatTimestamp(item.takenAt!)}` : 'Mark taken'}
                          </Text>
                        </TouchableOpacity>
                        {!taken && (
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => handleSkip(item)}
                          >
                            <SkipIcon />
                            <Text style={[styles.actionText, skipped && { color: Colors.accent }]}>
                              {skipped ? 'Skipped' : 'Skip'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Taken-time picker modal */}
      <Modal visible={editingItem !== null} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setEditingItem(null)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>
            {editingItem?.takenAt ? 'Edit taken time' : 'When did you take it?'}
          </Text>
          <Text style={styles.sheetSub}>
            {editingItem?.medicine.name} · scheduled {editingItem ? formatTime(editingItem.time) : ''}
          </Text>

          <TouchableOpacity style={styles.nowBtn} onPress={setNow}>
            <Text style={styles.nowBtnText}>Now ({formatTimestamp(Date.now())})</Text>
          </TouchableOpacity>

          <View style={styles.pickerRow}>
            <View style={styles.pickerCol}>
              <Text style={styles.pickerLabel}>Hour</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.pickerItem, selH === h && styles.pickerItemActive]}
                    onPress={() => setSelH(h)}
                  >
                    <Text style={[styles.pickerItemText, selH === h && styles.pickerItemTextActive]}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <Text style={styles.pickerColon}>:</Text>
            <View style={styles.pickerCol}>
              <Text style={styles.pickerLabel}>Min</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {MINUTES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.pickerItem, selM === m && styles.pickerItemActive]}
                    onPress={() => setSelM(m)}
                  >
                    <Text style={[styles.pickerItemText, selM === m && styles.pickerItemTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.sheetActions}>
            {editingItem?.takenAt ? (
              <TouchableOpacity style={styles.undoBtn} onPress={handleUndoTaken}>
                <Text style={styles.undoBtnText}>Undo taken</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmTaken}>
              <Text style={styles.confirmBtnText}>Confirm</Text>
            </TouchableOpacity>
          </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  appName: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  dateLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.lg,
  },
  dateNavBtn: { padding: Spacing.sm },
  dateNavLabel: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    minWidth: 120,
    textAlign: 'center',
  },
  progressSection: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    gap: 6,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  progressPct: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '700' },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  empty: { alignItems: 'center', paddingTop: 60, gap: Spacing.sm },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', maxWidth: 260 },
  timeGroup: { marginBottom: Spacing.md },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  timeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  timeText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary, letterSpacing: 0.3 },
  doseCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  doseCardTaken: { opacity: 0.7, borderColor: Colors.primaryPale },
  doseCardSkipped: { opacity: 0.5 },
  doseColorBar: { width: 4 },
  doseContent: { flex: 1, padding: Spacing.md },
  doseTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  medicineName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  medicineNameDim: { color: Colors.textMuted },
  dosage: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  illnessBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  illnessText: { fontSize: FontSize.xs, color: Colors.primaryMid, fontWeight: '600' },
  profileBadge: { alignItems: 'center', gap: 3 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.text },
  profileName: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500' },
  doseActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  actionTextDone: { color: Colors.primary, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: Spacing.sm,
  },
  sheetTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  sheetSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: Spacing.md },
  nowBtn: {
    alignSelf: 'center',
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  nowBtnText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: Spacing.lg },
  pickerCol: { flex: 1, alignItems: 'center' },
  pickerLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  pickerScroll: { height: 180 },
  pickerItem: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: Radius.sm, alignItems: 'center', width: '100%' },
  pickerItemActive: { backgroundColor: Colors.primaryPale },
  pickerItemText: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
  pickerItemTextActive: { color: Colors.primary, fontWeight: '700' },
  pickerColon: { fontSize: 24, color: Colors.text, paddingTop: 20 },
  sheetActions: { flexDirection: 'row', gap: Spacing.sm },
  undoBtn: {
    flex: 1, borderRadius: Radius.md, paddingVertical: 14,
    borderWidth: 1.5, borderColor: Colors.accent, alignItems: 'center',
  },
  undoBtnText: { color: Colors.accent, fontSize: FontSize.md, fontWeight: '700' },
  confirmBtn: { flex: 2, borderRadius: Radius.md, paddingVertical: 14, backgroundColor: Colors.primary, alignItems: 'center' },
  confirmBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
});
