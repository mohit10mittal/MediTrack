import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProfile, getMedicinesForProfile, deleteMedicine, getIllnessGroups } from '../../src/db/queries';
import { Profile, Medicine } from '../../src/types';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/colors';
import Svg, { Path, Circle } from 'react-native-svg';

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M15 6l-6 6 6 6" stroke={Colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlusIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M10 4v12M4 10h12" stroke="white" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

const RELATION_LABELS: Record<string, string> = {
  self: 'Myself', mom: 'Mom', dad: 'Dad', spouse: 'Spouse',
  child: 'Child', sibling: 'Sibling', grandparent: 'Grandparent', other: 'Other',
};

function formatDoseTimes(timesJson: string): string {
  try {
    const times: string[] = JSON.parse(timesJson);
    return times.map((t) => {
      const [hStr, mStr] = t.split(':');
      const h = parseInt(hStr, 10);
      const ampm = h < 12 ? 'AM' : 'PM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${h12}:${mStr} ${ampm}`;
    }).join(' · ');
  } catch {
    return '';
  }
}

export default function ProfileDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [illnesses, setIllnesses] = useState<string[]>([]);
  const [filterIllness, setFilterIllness] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [p, m, ill] = await Promise.all([
      getProfile(db, id),
      getMedicinesForProfile(db, id),
      getIllnessGroups(db, id),
    ]);
    setProfile(p);
    setMedicines(m);
    setIllnesses(ill);
  }, [db, id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (med: Medicine) => {
    Alert.alert(`Remove ${med.name}?`, 'Dose history will also be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteMedicine(db, med.id);
          load();
        },
      },
    ]);
  };

  const filtered = filterIllness
    ? medicines.filter((m) => m.illness === filterIllness)
    : medicines;

  const active = filtered.filter((m) => m.is_active === 1);
  const inactive = filtered.filter((m) => m.is_active !== 1);

  if (!profile) return null;

  const rel = RELATION_LABELS[profile.relation] ?? profile.relation;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <BackIcon />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push({ pathname: '/medicine/add', params: { profileId: id } })}
        >
          <PlusIcon />
          <Text style={styles.addBtnText}>Add Medicine</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile hero */}
        <View style={styles.hero}>
          <View style={[styles.avatar, { backgroundColor: profile.avatar_color }]}>
            <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
          </View>
          <Text style={styles.heroName}>{profile.name}</Text>
          <Text style={styles.heroRel}>{rel}</Text>
          <View style={styles.heroStats}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{medicines.filter((m) => m.is_active === 1).length}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{medicines.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{illnesses.length}</Text>
              <Text style={styles.statLabel}>Conditions</Text>
            </View>
          </View>
        </View>

        {/* Illness filter chips */}
        {illnesses.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterChip, !filterIllness && styles.filterChipActive]}
              onPress={() => setFilterIllness(null)}
            >
              <Text style={[styles.filterChipText, !filterIllness && styles.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {illnesses.map((ill) => (
              <TouchableOpacity
                key={ill}
                style={[styles.filterChip, filterIllness === ill && styles.filterChipActive]}
                onPress={() => setFilterIllness(filterIllness === ill ? null : ill)}
              >
                <Text style={[styles.filterChipText, filterIllness === ill && styles.filterChipTextActive]}>
                  {ill}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Active medicines */}
        {active.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Active Medicines</Text>
            {active.map((med) => (
              <MedicineRow
                key={med.id}
                medicine={med}
                onPress={() => router.push(`/medicine/${med.id}`)}
                onLongPress={() => handleDelete(med)}
              />
            ))}
          </>
        )}

        {/* Inactive medicines */}
        {inactive.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Past Medicines</Text>
            {inactive.map((med) => (
              <MedicineRow
                key={med.id}
                medicine={med}
                dimmed
                onPress={() => router.push(`/medicine/${med.id}`)}
                onLongPress={() => handleDelete(med)}
              />
            ))}
          </>
        )}

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💊</Text>
            <Text style={styles.emptyTitle}>No medicines yet</Text>
            <Text style={styles.emptyText}>Tap "Add Medicine" to get started.</Text>
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MedicineRow({
  medicine, dimmed, onPress, onLongPress,
}: {
  medicine: Medicine;
  dimmed?: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.medCard, dimmed && styles.medCardDim]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={600}
    >
      <View style={[styles.medColorBar, { backgroundColor: medicine.color }]} />
      <View style={styles.medContent}>
        <View style={styles.medTop}>
          <Text style={styles.medName}>{medicine.name}</Text>
          {medicine.dosage ? <Text style={styles.medDosage}>{medicine.dosage}</Text> : null}
        </View>
        <View style={styles.medMeta}>
          {medicine.illness ? (
            <View style={styles.illBadge}>
              <Text style={styles.illBadgeText}>{medicine.illness}</Text>
            </View>
          ) : null}
          <Text style={styles.medTimes}>{formatDoseTimes(medicine.dose_times)}</Text>
        </View>
      </View>
    </TouchableOpacity>
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
  backBtn: { padding: Spacing.sm },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    gap: 6,
  },
  addBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.sm },
  scrollContent: { paddingHorizontal: Spacing.md },
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: 6,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  heroName: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  heroRel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  heroStats: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  stat: { alignItems: 'center', gap: 2 },
  statNum: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: Colors.border },
  filterScroll: { marginHorizontal: -Spacing.md, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  filterChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryPale },
  filterChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: Colors.primary },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  empty: { alignItems: 'center', paddingTop: 40, gap: Spacing.sm },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  medCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  medCardDim: { opacity: 0.55 },
  medColorBar: { width: 4 },
  medContent: { flex: 1, padding: Spacing.md, gap: 6 },
  medTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  medName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, flex: 1 },
  medDosage: { fontSize: FontSize.sm, color: Colors.textSecondary },
  medMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  illBadge: {
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  illBadgeText: { fontSize: FontSize.xs, color: Colors.primaryMid, fontWeight: '600' },
  medTimes: { fontSize: FontSize.xs, color: Colors.textMuted, flex: 1 },
});
