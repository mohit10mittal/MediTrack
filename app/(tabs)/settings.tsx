import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Switch, Linking, Platform,
} from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { Logo } from '../../src/components/Logo';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/colors';
import { cancelAllReminders, requestNotificationPermissions } from '../../src/utils/notifications';
import { getProfiles, getActiveMedicines } from '../../src/db/queries';
import { scheduleMedicineReminders } from '../../src/utils/notifications';
import Svg, { Path } from 'react-native-svg';

function ChevronRight() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path d="M6 4l5 5-5 5" stroke={Colors.textMuted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SettingRow({
  label,
  subtitle,
  onPress,
  rightElement,
}: {
  label: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress && !rightElement}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {rightElement ?? (onPress ? <ChevronRight /> : null)}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [rescheduling, setRescheduling] = useState(false);

  const handleRescheduleAll = async () => {
    setRescheduling(true);
    try {
      const hasPerms = await requestNotificationPermissions();
      if (!hasPerms) {
        Alert.alert('Permission denied', 'Please allow notifications in device settings.');
        return;
      }
      await cancelAllReminders();
      const medicines = await getActiveMedicines(db);
      const profiles = await getProfiles(db);
      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      for (const med of medicines) {
        const prof = profileMap.get(med.profile_id);
        if (prof) await scheduleMedicineReminders(med, prof);
      }
      Alert.alert('Done', `Reminders rescheduled for ${medicines.length} medicine(s).`);
    } finally {
      setRescheduling(false);
    }
  };

  const handleClearAllReminders = () => {
    Alert.alert('Clear all reminders?', 'All scheduled notifications will be cancelled.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await cancelAllReminders();
          Alert.alert('Done', 'All reminders cleared.');
        },
      },
    ]);
  };

  const handleOpenNotificationSettings = () => {
    Linking.openSettings();
  };

  const handleOpenExactAlarmSettings = async () => {
    if (Platform.OS !== 'android') return;
    try {
      await IntentLauncher.startActivityAsync(
        'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
        { data: 'package:com.meditrack.app' }
      );
    } catch {
      Linking.openSettings();
    }
  };

  const handleDisableBatteryOptimization = async () => {
    if (Platform.OS !== 'android') return;
    try {
      await IntentLauncher.startActivityAsync(
        'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
        { data: 'package:com.meditrack.app' }
      );
    } catch {
      // Fallback: open the full battery optimization list
      IntentLauncher.startActivityAsync(
        'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
      ).catch(() => Linking.openSettings());
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* App info */}
        <View style={styles.appCard}>
          <Logo size={56} />
          <View>
            <Text style={styles.appName}>MediTrack</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
            <Text style={styles.appTagline}>Your personal medicine companion</Text>
          </View>
        </View>

        {/* Notifications */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.section}>
          <SettingRow
            label="Reschedule all reminders"
            subtitle="Re-creates reminders for the next 7 days"
            onPress={rescheduling ? undefined : handleRescheduleAll}
          />
          <View style={styles.separator} />
          <SettingRow
            label="Clear all reminders"
            subtitle="Cancels all scheduled notifications"
            onPress={handleClearAllReminders}
          />
          <View style={styles.separator} />
          <SettingRow
            label="Notification settings"
            subtitle="Manage alerts in device settings"
            onPress={handleOpenNotificationSettings}
          />
        </View>

        {/* Android alarm fix */}
        {Platform.OS === 'android' && (
          <>
            <Text style={styles.sectionTitle}>Alarm Permissions</Text>
            <View style={[styles.section, styles.alarmWarning]}>
              <Text style={styles.alarmNote}>
                If alarms are not ringing, enable the settings below, then tap "Reschedule all reminders" above.
              </Text>
            </View>
            <View style={[styles.section, { marginTop: 8 }]}>
              {(Platform.Version as number) >= 31 && (
                <>
                  <SettingRow
                    label="Allow exact alarms"
                    subtitle="Android 12+ only — tap to enable in Settings"
                    onPress={handleOpenExactAlarmSettings}
                  />
                  <View style={styles.separator} />
                </>
              )}
              <SettingRow
                label="Disable battery optimization"
                subtitle="Prevents Android from blocking alarms in the background"
                onPress={handleDisableBatteryOptimization}
              />
            </View>
          </>
        )}

        {/* About */}
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.section}>
          <SettingRow
            label="How to use MediTrack"
            subtitle="Tips and feature overview"
            onPress={() => {
              Alert.alert(
                'How to use MediTrack',
                '1. Create profiles for yourself and family\n\n' +
                '2. Tap "Add Medicine" and scan a medical bill or enter manually\n\n' +
                '3. Set dosage times — reminders fire automatically\n\n' +
                '4. Mark doses taken from the Today tab each day\n\n' +
                '5. Group medicines by illness using the condition field\n\n' +
                'Long press a card to delete it.'
              );
            }}
          />
          <View style={styles.separator} />
          <SettingRow
            label="Privacy"
            subtitle="All data stays on your device"
          />
        </View>

        <Text style={styles.footer}>
          MediTrack stores all data locally on your device.{'\n'}
          No account or internet required.
        </Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  appCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  appName: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary },
  appVersion: { fontSize: FontSize.xs, color: Colors.textMuted },
  appTagline: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  rowLeft: { flex: 1, marginRight: Spacing.sm },
  rowLabel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  rowSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.md },
  footer: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xl,
    lineHeight: 18,
  },
  alarmWarning: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFE082',
    padding: Spacing.md,
  },
  alarmNote: {
    fontSize: FontSize.sm,
    color: '#795548',
    lineHeight: 20,
  },
});
