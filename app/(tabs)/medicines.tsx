import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProfiles, getMedicinesForProfile } from '../../src/db/queries';
import { Profile, Medicine } from '../../src/types';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/colors';
import Svg, { Path, Circle } from 'react-native-svg';

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function PlusIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M10 4v12M4 10h12" stroke="white" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronRight() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path d="M6 4l5 5-5 5" stroke={Colors.textMuted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

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
  } catch { return ''; }
}

type ProfileWithMeds = { profile: Profile; medicines: Medicine[] };

export default function MedicinesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [data, setData] = useState<ProfileWithMeds[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  const load = useCallback(async () => {
    const profiles = await getProfiles(db);
    const result: ProfileWithMeds[] = [];
    for (const profile of profiles) {
      const medicines = await getMedicinesForProfile(db, profile.id);
      result.push({ profile, medicines });
    }
    setData(result);
    if (result.length > 0 && !selectedProfile) {
      setSelectedProfile(result[0].profile.id);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const current = data.find((d) => d.profile.id === selectedProfile);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Medicines</Text>
        {current && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push({ pathname: '/medicine/add', params: { profileId: selectedProfile } })}
          >
            <PlusIcon />
          </TouchableOpacity>
        )}
      </View>

      {data.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>💊</Text>
          <Text style={styles.emptyTitle}>No profiles yet</Text>
          <Text style={styles.emptyText}>Create a profile first from the Profiles tab, then add medicines.</Text>
        </View>
      ) : (
        <>
          {/* Profile selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.profileScroll}
            contentContainerStyle={styles.profileScrollContent}
          >
            {data.map(({ profile }) => (
              <TouchableOpacity
                key={profile.id}
                style={[styles.profileChip, selectedProfile === profile.id && styles.profileChipActive]}
                onPress={() => setSelectedProfile(profile.id)}
              >
                <View style={[styles.chipAvatar, { backgroundColor: profile.avatar_color }]}>
                  <Text style={styles.chipAvatarText}>{getInitials(profile.name)}</Text>
                </View>
                <Text style={[styles.profileChipText, selectedProfile === profile.id && styles.profileChipTextActive]}>
                  {profile.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {!current || current.medicines.length === 0 ? (
              <View style={styles.noMeds}>
                <Text style={styles.noMedsEmoji}>✚</Text>
                <Text style={styles.noMedsTitle}>No medicines for {current?.profile.name}</Text>
                <TouchableOpacity
                  style={styles.addMedBtn}
                  onPress={() => router.push({ pathname: '/medicine/add', params: { profileId: selectedProfile } })}
                >
                  <Text style={styles.addMedBtnText}>Add Medicine</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Group by illness */}
                {renderGrouped(current.medicines, (med) =>
                  router.push(`/medicine/${med.id}`)
                )}
              </>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

function renderGrouped(medicines: Medicine[], onPress: (med: Medicine) => void) {
  const groups = new Map<string, Medicine[]>();
  for (const med of medicines) {
    const key = med.illness || 'General';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(med);
  }

  return Array.from(groups.entries()).map(([illness, meds]) => (
    <View key={illness}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>{illness}</Text>
        <View style={styles.groupCount}>
          <Text style={styles.groupCountText}>{meds.length}</Text>
        </View>
      </View>
      {meds.map((med) => (
        <TouchableOpacity key={med.id} style={styles.medCard} onPress={() => onPress(med)}>
          <View style={[styles.medBar, { backgroundColor: med.color }]} />
          <View style={styles.medContent}>
            <View style={styles.medRow}>
              <Text style={[styles.medName, med.is_active !== 1 && styles.medNameDim]}>
                {med.name}
              </Text>
              {med.is_active !== 1 && (
                <View style={styles.inactiveBadge}>
                  <Text style={styles.inactiveBadgeText}>Inactive</Text>
                </View>
              )}
            </View>
            <Text style={styles.medDosage}>{med.dosage || '—'}</Text>
            <Text style={styles.medTimes}>{formatDoseTimes(med.dose_times)}</Text>
          </View>
          <Svg width={18} height={18} viewBox="0 0 18 18">
            <Path d="M6 4l5 5-5 5" stroke={Colors.textMuted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      ))}
    </View>
  ));
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
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  addBtn: {
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileScroll: { flexGrow: 0 },
  profileScrollContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  profileChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryPale },
  chipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAvatarText: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.text },
  profileChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  profileChipTextActive: { color: Colors.primary },
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: 4 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', maxWidth: 260 },
  noMeds: { alignItems: 'center', paddingTop: 48, gap: Spacing.sm },
  noMedsEmoji: { fontSize: 40, color: Colors.primary },
  noMedsTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  addMedBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    marginTop: 4,
  },
  addMedBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  groupTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  groupCount: {
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  groupCountText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '700' },
  medCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  medBar: { width: 4, alignSelf: 'stretch' },
  medContent: { flex: 1, padding: Spacing.md, gap: 3 },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  medName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, flex: 1 },
  medNameDim: { color: Colors.textMuted },
  inactiveBadge: {
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  inactiveBadgeText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  medDosage: { fontSize: FontSize.sm, color: Colors.textSecondary },
  medTimes: { fontSize: FontSize.xs, color: Colors.textMuted },
});
