export type Relation =
  | 'self'
  | 'mom'
  | 'dad'
  | 'spouse'
  | 'child'
  | 'sibling'
  | 'grandparent'
  | 'other';

export interface Profile {
  id: string;
  name: string;
  relation: Relation;
  avatar_color: string;
  created_at: number;
}

export interface Medicine {
  id: string;
  profile_id: string;
  name: string;
  dosage: string;
  illness: string;
  doses_per_day: number;
  dose_times: string; // JSON: string[] e.g. ["08:00","14:00","20:00"]
  start_date: number;
  end_date: number | null;
  notes: string;
  is_active: number; // 1 or 0 (SQLite boolean)
  color: string;
}

export interface DoseLog {
  id: string;
  medicine_id: string;
  scheduled_date: string; // "YYYY-MM-DD"
  scheduled_time: string; // "HH:MM"
  taken_at: number | null;
  skipped: number; // 1 or 0
}

export interface NotificationRecord {
  id: string;
  medicine_id: string;
  notification_id: string;
  scheduled_for: number;
}

export interface DoseScheduleItem {
  medicine: Medicine;
  profile: Profile;
  time: string;
  logId: string | null;
  takenAt: number | null;
  skipped: boolean;
  date: string;
}
