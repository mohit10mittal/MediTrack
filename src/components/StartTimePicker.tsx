import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal,
} from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/colors';
import { calcDoseTimes, formatTime12 } from '../utils/time';

interface StartDateTimePickerProps {
  startDate: string;   // 'YYYY-MM-DD'
  startTime: string;   // 'HH:MM'
  dosesPerDay: number;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const CUR_YEAR = new Date().getFullYear();
const YEARS = [CUR_YEAR - 1, CUR_YEAR, CUR_YEAR + 1, CUR_YEAR + 2].map(String);

function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${dayNames[date.getDay()]}, ${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

export function StartDateTimePicker({
  startDate, startTime, dosesPerDay, onDateChange, onTimeChange,
}: StartDateTimePickerProps) {
  const [dateModal, setDateModal] = useState(false);
  const [timeModal, setTimeModal] = useState(false);

  // Date picker local state
  const [selYear, setSelYear] = useState(() => startDate.split('-')[0]);
  const [selMonth, setSelMonth] = useState(() => String(parseInt(startDate.split('-')[1], 10)));
  const [selDay, setSelDay] = useState(() => String(parseInt(startDate.split('-')[2], 10)));

  // Time picker local state
  const [selH, setSelH] = useState(() => startTime.split(':')[0]);
  const [selM, setSelM] = useState(() => startTime.split(':')[1]);

  const openDate = () => {
    const [y, mo, d] = startDate.split('-').map(Number);
    setSelYear(String(y));
    setSelMonth(String(mo));
    setSelDay(String(d));
    setDateModal(true);
  };

  const confirmDate = () => {
    const y = selYear;
    const m = selMonth.padStart(2, '0');
    const d = selDay.padStart(2, '0');
    onDateChange(`${y}-${m}-${d}`);
    setDateModal(false);
  };

  const openTime = () => {
    const [h, m] = startTime.split(':');
    setSelH(h);
    setSelM(m);
    setTimeModal(true);
  };

  const confirmTime = () => {
    onTimeChange(`${selH}:${selM}`);
    setTimeModal(false);
  };

  const allTimes = calcDoseTimes(startTime, dosesPerDay);
  const intervalHours = 24 / dosesPerDay;
  const intervalLabel = Number.isInteger(intervalHours)
    ? `${intervalHours}h`
    : `${intervalHours.toFixed(1)}h`;

  return (
    <View style={styles.container}>
      {/* Date + Time chips */}
      <View style={styles.chipsRow}>
        <TouchableOpacity style={styles.chip} onPress={openDate}>
          <Text style={styles.chipLabel}>Date</Text>
          <Text style={styles.chipValue} numberOfLines={1}>{formatDateDisplay(startDate)}</Text>
          <Text style={styles.caret}>▾</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, styles.timeChip]} onPress={openTime}>
          <Text style={styles.chipLabel}>Time</Text>
          <Text style={styles.chipValue}>{formatTime12(startTime)}</Text>
          <Text style={styles.caret}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* Schedule preview */}
      <View style={styles.preview}>
        <Text style={styles.previewHeader}>
          Dose schedule — every {intervalLabel}
        </Text>
        {allTimes.map((t, i) => (
          <View key={i} style={styles.previewRow}>
            <View style={[styles.dot, i === 0 && styles.dotFirst]} />
            <Text style={styles.previewTime}>{formatTime12(t)}</Text>
            <Text style={styles.previewLabel}>
              Dose {i + 1}{i === 0 ? '  ← start' : ''}
            </Text>
          </View>
        ))}
      </View>

      {/* ── Date Picker Modal ── */}
      <Modal visible={dateModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.modalTitle}>Start Date</Text>
            <View style={styles.pickerRow}>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Day</Text>
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                  {DAYS.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.item, selDay === String(d) && styles.itemActive]}
                      onPress={() => setSelDay(String(d))}
                    >
                      <Text style={[styles.itemText, selDay === String(d) && styles.itemTextActive]}>
                        {String(d).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={[styles.col, styles.colWide]}>
                <Text style={styles.colLabel}>Month</Text>
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                  {MONTH_NAMES.map((name, idx) => {
                    const val = String(idx + 1);
                    return (
                      <TouchableOpacity
                        key={val}
                        style={[styles.item, selMonth === val && styles.itemActive]}
                        onPress={() => setSelMonth(val)}
                      >
                        <Text style={[styles.itemText, selMonth === val && styles.itemTextActive]}>{name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Year</Text>
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                  {YEARS.map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.item, selYear === y && styles.itemActive]}
                      onPress={() => setSelYear(y)}
                    >
                      <Text style={[styles.itemText, selYear === y && styles.itemTextActive]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDateModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmDate}>
                <Text style={styles.confirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Time Picker Modal ── */}
      <Modal visible={timeModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.modalTitle}>Start Time</Text>
            <View style={styles.pickerRow}>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Hour</Text>
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                  {HOURS.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.item, selH === h && styles.itemActive]}
                      onPress={() => setSelH(h)}
                    >
                      <Text style={[styles.itemText, selH === h && styles.itemTextActive]}>{h}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <Text style={styles.colon}>:</Text>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Min</Text>
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                  {MINUTES.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.item, selM === m && styles.itemActive]}
                      onPress={() => setSelM(m)}
                    >
                      <Text style={[styles.itemText, selM === m && styles.itemTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setTimeModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmTime}>
                <Text style={styles.confirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  chipsRow: { flexDirection: 'row', gap: Spacing.sm },
  chip: {
    flex: 2,
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 2,
  },
  timeChip: { flex: 1 },
  chipLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },
  chipValue: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.primary },
  caret: { fontSize: 12, color: Colors.primary, marginTop: 2 },
  preview: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.sm,
  },
  previewHeader: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotFirst: { backgroundColor: Colors.primary },
  previewTime: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, width: 84 },
  previewLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  card: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  col: { flex: 1, alignItems: 'center' },
  colWide: { flex: 1.4 },
  colLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  scroll: { height: 180 },
  item: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: Radius.sm, alignItems: 'center' },
  itemActive: { backgroundColor: Colors.primaryPale },
  itemText: { fontSize: FontSize.md, color: Colors.textSecondary },
  itemTextActive: { color: Colors.primary, fontWeight: '700' },
  colon: { fontSize: 24, color: Colors.text, paddingTop: 20 },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  cancelBtn: {
    flex: 1, borderRadius: Radius.md, paddingVertical: 12,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  cancelText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
  confirmBtn: { flex: 1, borderRadius: Radius.md, paddingVertical: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  confirmText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
});
