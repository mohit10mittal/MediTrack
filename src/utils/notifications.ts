import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Medicine, Profile } from '../types';
import { format, addDays } from 'date-fns';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medicine-reminders', {
      name: 'Medicine Reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400, 200, 400],
      lightColor: '#2E7D32',
      sound: 'alarm_ringtone',
      enableVibrate: true,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return status === 'granted';
}

export async function scheduleMedicineReminders(
  medicine: Medicine,
  profile: Profile,
  daysAhead = 7
): Promise<string[]> {
  const notificationIds: string[] = [];
  let times: string[] = [];
  try {
    times = JSON.parse(medicine.dose_times);
  } catch {
    times = ['08:00'];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 0; d < daysAhead; d++) {
    const day = addDays(today, d);
    const dateStr = format(day, 'yyyy-MM-dd');
    const startDateStr = format(new Date(medicine.start_date), 'yyyy-MM-dd');
    const endDateStr = medicine.end_date
      ? format(new Date(medicine.end_date), 'yyyy-MM-dd')
      : null;

    if (dateStr < startDateStr) continue;
    if (endDateStr && dateStr > endDateStr) continue;

    for (const time of times) {
      const [hours, minutes] = time.split(':').map(Number);
      const trigger = new Date(day);
      trigger.setHours(hours, minutes, 0, 0);
      trigger.setTime(trigger.getTime() - 60 * 1000); // 1 minute early

      if (trigger <= new Date()) continue;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${medicine.name} in 1 minute`,
          body: `${profile.name} — ${medicine.dosage || 'take your dose'}${medicine.illness ? ` (${medicine.illness})` : ''}`,
          data: { medicineId: medicine.id, profileId: profile.id, time },
          sound: 'alarm_ringtone.wav',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger,
        },
      });
      notificationIds.push(id);
    }
  }
  return notificationIds;
}

export async function cancelMedicineReminders(notificationIds: string[]): Promise<void> {
  for (const id of notificationIds) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
