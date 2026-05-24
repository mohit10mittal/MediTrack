import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal
} from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/colors';

interface TimeInputProps {
  times: string[];
  onChange: (times: string[]) => void;
  maxTimes?: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

export function TimeInput({ times, onChange, maxTimes = 6 }: TimeInputProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [selectedH, setSelectedH] = useState('08');
  const [selectedM, setSelectedM] = useState('00');

  const openPicker = (index: number | null, existing?: string) => {
    setEditIndex(index);
    if (existing) {
      const [h, m] = existing.split(':');
      setSelectedH(h);
      setSelectedM(m);
    } else {
      setSelectedH('08');
      setSelectedM('00');
    }
    setPickerVisible(true);
  };

  const confirmTime = () => {
    const time = `${selectedH}:${selectedM}`;
    if (editIndex === null) {
      onChange([...times, time].sort());
    } else {
      const next = [...times];
      next[editIndex] = time;
      onChange(next.sort());
    }
    setPickerVisible(false);
  };

  const removeTime = (index: number) => {
    onChange(times.filter((_, i) => i !== index));
  };

  const formatDisplay = (t: string) => {
    const [hStr, mStr] = t.split(':');
    const h = parseInt(hStr, 10);
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${mStr} ${ampm}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {times.map((t, i) => (
          <TouchableOpacity
            key={i}
            style={styles.chip}
            onPress={() => openPicker(i, t)}
          >
            <Text style={styles.chipText}>{formatDisplay(t)}</Text>
            <TouchableOpacity onPress={() => removeTime(i)} style={styles.chipClose}>
              <Text style={styles.chipCloseText}>×</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
        {times.length < maxTimes && (
          <TouchableOpacity style={styles.addChip} onPress={() => openPicker(null)}>
            <Text style={styles.addChipText}>+ Add time</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={pickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Time</Text>
            <View style={styles.pickerRow}>
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Hour</Text>
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                  {HOURS.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.pickerItem, selectedH === h && styles.pickerItemActive]}
                      onPress={() => setSelectedH(h)}
                    >
                      <Text style={[styles.pickerItemText, selectedH === h && styles.pickerItemTextActive]}>
                        {h}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <Text style={styles.colon}>:</Text>
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Min</Text>
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                  {MINUTES.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.pickerItem, selectedM === m && styles.pickerItemActive]}
                      onPress={() => setSelectedM(m)}
                    >
                      <Text style={[styles.pickerItemText, selectedM === m && styles.pickerItemTextActive]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPickerVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmTime}>
                <Text style={styles.confirmBtnText}>Confirm</Text>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  chipText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
  chipClose: { marginLeft: 2 },
  chipCloseText: { color: Colors.primary, fontSize: 16, lineHeight: 18 },
  addChip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
  },
  addChipText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
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
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pickerCol: { flex: 1, alignItems: 'center' },
  pickerLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  scroll: { height: 180 },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  pickerItemActive: { backgroundColor: Colors.primaryPale },
  pickerItemText: { fontSize: FontSize.md, color: Colors.textSecondary },
  pickerItemTextActive: { color: Colors.primary, fontWeight: '700' },
  colon: { fontSize: 24, color: Colors.text, paddingTop: 20 },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  cancelBtn: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
});
