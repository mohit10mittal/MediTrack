import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Pressable,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProfiles, createProfile, deleteProfile } from '../../src/db/queries';
import { Profile, Relation } from '../../src/types';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/colors';
import Svg, { Path, Circle } from 'react-native-svg';

const RELATIONS: { value: Relation; label: string; emoji: string }[] = [
  { value: 'self', label: 'Myself', emoji: '🧑' },
  { value: 'mom', label: 'Mom', emoji: '👩' },
  { value: 'dad', label: 'Dad', emoji: '👨' },
  { value: 'spouse', label: 'Spouse', emoji: '💑' },
  { value: 'child', label: 'Child', emoji: '👶' },
  { value: 'sibling', label: 'Sibling', emoji: '👫' },
  { value: 'grandparent', label: 'Grandparent', emoji: '👴' },
  { value: 'other', label: 'Other', emoji: '🧩' },
];

const AVATAR_COLORS = [
  '#BBDEFB', '#C8E6C9', '#FFE0B2', '#F8BBD9',
  '#E1BEE7', '#B2EBF2', '#DCEDC8', '#FFE082',
];

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

export default function ProfilesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<Relation>('self');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await getProfiles(db);
    setProfiles(data);
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = () => {
    setName('');
    setRelation('self');
    setAvatarColor(AVATAR_COLORS[0]);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await createProfile(db, { name: name.trim(), relation, avatar_color: avatarColor });
    setSaving(false);
    setModalVisible(false);
    load();
  };

  const handleDelete = (profile: Profile) => {
    Alert.alert(
      `Remove ${profile.name}?`,
      'All medicines and dose history for this profile will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteProfile(db, profile.id);
            load();
          },
        },
      ]
    );
  };

  const relLabel = RELATIONS.find((r) => r.value === relation);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profiles</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <PlusIcon />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {profiles.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👨‍👩‍👧‍👦</Text>
            <Text style={styles.emptyTitle}>No profiles yet</Text>
            <Text style={styles.emptyText}>
              Add a profile for yourself or your family members to track medicines separately.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
              <Text style={styles.emptyBtnText}>Add first profile</Text>
            </TouchableOpacity>
          </View>
        ) : (
          profiles.map((profile) => {
            const rel = RELATIONS.find((r) => r.value === profile.relation);
            return (
              <TouchableOpacity
                key={profile.id}
                style={styles.card}
                onPress={() => router.push(`/profile/${profile.id}`)}
                onLongPress={() => handleDelete(profile)}
                delayLongPress={600}
              >
                <View style={[styles.avatar, { backgroundColor: profile.avatar_color }]}>
                  <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
                  {rel && <Text style={styles.avatarEmoji}>{rel.emoji}</Text>}
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{profile.name}</Text>
                  <Text style={styles.cardRelation}>{rel?.label ?? profile.relation}</Text>
                </View>
                <ChevronRight />
              </TouchableOpacity>
            );
          })
        )}
        <Text style={styles.hint}>Long press a profile to remove it</Text>
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Add Profile Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>New Profile</Text>

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Mom, Dad, Myself..."
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={styles.fieldLabel}>Relation</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relScroll}>
            {RELATIONS.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[styles.relChip, relation === r.value && styles.relChipActive]}
                onPress={() => setRelation(r.value)}
              >
                <Text style={styles.relEmoji}>{r.emoji}</Text>
                <Text style={[styles.relLabel, relation === r.value && styles.relLabelActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Color</Text>
          <View style={styles.colorRow}>
            {AVATAR_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  avatarColor === c && styles.colorDotActive,
                ]}
                onPress={() => setAvatarColor(c)}
              />
            ))}
          </View>

          <View style={styles.preview}>
            <View style={[styles.avatarLg, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarLgText}>{name ? getInitials(name) : '?'}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (!name.trim() || saving) && styles.saveBtnDim]}
            onPress={handleSave}
            disabled={!name.trim() || saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Add Profile'}</Text>
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
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  empty: { alignItems: 'center', paddingTop: 60, gap: Spacing.sm },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', maxWidth: 260 },
  emptyBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  emptyBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: { fontSize: FontSize.md, fontWeight: '800', color: Colors.text },
  avatarEmoji: { position: 'absolute', bottom: -4, right: -4, fontSize: 16 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  cardRelation: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.md },
  overlay: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: 40,
    gap: Spacing.sm,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  sheetTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
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
  relScroll: { marginHorizontal: -Spacing.lg, paddingHorizontal: Spacing.lg },
  relChip: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
    gap: 4,
  },
  relChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryPale },
  relEmoji: { fontSize: 22 },
  relLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },
  relLabelActive: { color: Colors.primary },
  colorRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: { borderColor: Colors.primary, transform: [{ scale: 1.15 }] },
  preview: { alignItems: 'center', paddingVertical: Spacing.sm },
  avatarLg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLgText: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnDim: { opacity: 0.5 },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
});
