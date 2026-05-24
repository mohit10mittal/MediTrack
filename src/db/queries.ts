import { SQLiteDatabase } from 'expo-sqlite';
import { Profile, Medicine, DoseLog, DoseScheduleItem } from '../types';
import { format } from 'date-fns';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export async function getProfiles(db: SQLiteDatabase): Promise<Profile[]> {
  return db.getAllAsync<Profile>(
    'SELECT * FROM profiles ORDER BY created_at ASC'
  );
}

export async function getProfile(db: SQLiteDatabase, id: string): Promise<Profile | null> {
  return db.getFirstAsync<Profile>('SELECT * FROM profiles WHERE id = ?', [id]);
}

export async function createProfile(
  db: SQLiteDatabase,
  data: Omit<Profile, 'id' | 'created_at'>
): Promise<Profile> {
  const id = uuid();
  const created_at = Date.now();
  await db.runAsync(
    'INSERT INTO profiles (id, name, relation, avatar_color, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, data.name, data.relation, data.avatar_color, created_at]
  );
  return { id, created_at, ...data };
}

export async function updateProfile(
  db: SQLiteDatabase,
  id: string,
  data: Partial<Omit<Profile, 'id' | 'created_at'>>
): Promise<void> {
  const fields = Object.keys(data).map((k) => `${k} = ?`).join(', ');
  const values = [...Object.values(data), id];
  await db.runAsync(`UPDATE profiles SET ${fields} WHERE id = ?`, values);
}

export async function deleteProfile(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM profiles WHERE id = ?', [id]);
}

// ── Medicines ─────────────────────────────────────────────────────────────────

export async function getMedicinesForProfile(
  db: SQLiteDatabase,
  profileId: string
): Promise<Medicine[]> {
  return db.getAllAsync<Medicine>(
    'SELECT * FROM medicines WHERE profile_id = ? ORDER BY name ASC',
    [profileId]
  );
}

export async function getMedicine(db: SQLiteDatabase, id: string): Promise<Medicine | null> {
  return db.getFirstAsync<Medicine>('SELECT * FROM medicines WHERE id = ?', [id]);
}

export async function getActiveMedicines(db: SQLiteDatabase): Promise<Medicine[]> {
  return db.getAllAsync<Medicine>(
    'SELECT * FROM medicines WHERE is_active = 1 ORDER BY name ASC'
  );
}

export async function createMedicine(
  db: SQLiteDatabase,
  data: Omit<Medicine, 'id'>
): Promise<Medicine> {
  const id = uuid();
  await db.runAsync(
    `INSERT INTO medicines
      (id, profile_id, name, dosage, illness, doses_per_day, dose_times, start_date, end_date, notes, is_active, color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.profile_id,
      data.name,
      data.dosage,
      data.illness,
      data.doses_per_day,
      data.dose_times,
      data.start_date,
      data.end_date ?? null,
      data.notes,
      data.is_active,
      data.color,
    ]
  );
  return { id, ...data };
}

export async function updateMedicine(
  db: SQLiteDatabase,
  id: string,
  data: Partial<Omit<Medicine, 'id'>>
): Promise<void> {
  const fields = Object.keys(data).map((k) => `${k} = ?`).join(', ');
  const values = [...Object.values(data), id];
  await db.runAsync(`UPDATE medicines SET ${fields} WHERE id = ?`, values);
}

export async function deleteMedicine(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM medicines WHERE id = ?', [id]);
}

// ── Dose Logs ─────────────────────────────────────────────────────────────────

export async function getDoseLog(
  db: SQLiteDatabase,
  medicineId: string,
  date: string,
  time: string
): Promise<DoseLog | null> {
  return db.getFirstAsync<DoseLog>(
    'SELECT * FROM dose_logs WHERE medicine_id = ? AND scheduled_date = ? AND scheduled_time = ?',
    [medicineId, date, time]
  );
}

export async function getDoseLogsForDate(
  db: SQLiteDatabase,
  date: string
): Promise<DoseLog[]> {
  return db.getAllAsync<DoseLog>(
    'SELECT * FROM dose_logs WHERE scheduled_date = ?',
    [date]
  );
}

export async function upsertDoseLog(
  db: SQLiteDatabase,
  medicineId: string,
  date: string,
  time: string,
  takenAt: number | null,
  skipped: boolean
): Promise<string> {
  const existing = await getDoseLog(db, medicineId, date, time);
  if (existing) {
    await db.runAsync(
      'UPDATE dose_logs SET taken_at = ?, skipped = ? WHERE id = ?',
      [takenAt, skipped ? 1 : 0, existing.id]
    );
    return existing.id;
  }
  const id = uuid();
  await db.runAsync(
    'INSERT INTO dose_logs (id, medicine_id, scheduled_date, scheduled_time, taken_at, skipped) VALUES (?, ?, ?, ?, ?, ?)',
    [id, medicineId, date, time, takenAt, skipped ? 1 : 0]
  );
  return id;
}

// ── Schedule Builder ──────────────────────────────────────────────────────────

export async function getScheduleForDate(
  db: SQLiteDatabase,
  date: string
): Promise<DoseScheduleItem[]> {
  const medicines = await db.getAllAsync<Medicine>(
    `SELECT m.*, p.name as _pname, p.relation as _prelation, p.avatar_color as _pcolor, p.id as _pid, p.created_at as _pcreated
     FROM medicines m
     JOIN profiles p ON m.profile_id = p.id
     WHERE m.is_active = 1`,
  );

  const logs = await getDoseLogsForDate(db, date);
  const logMap = new Map<string, DoseLog>();
  for (const log of logs) {
    logMap.set(`${log.medicine_id}|${log.scheduled_time}`, log);
  }

  const items: DoseScheduleItem[] = [];

  for (const row of medicines as any[]) {
    const medicine: Medicine = {
      id: row.id,
      profile_id: row.profile_id,
      name: row.name,
      dosage: row.dosage,
      illness: row.illness,
      doses_per_day: row.doses_per_day,
      dose_times: row.dose_times,
      start_date: row.start_date,
      end_date: row.end_date,
      notes: row.notes,
      is_active: row.is_active,
      color: row.color,
    };
    const profile: Profile = {
      id: row._pid,
      name: row._pname,
      relation: row._prelation,
      avatar_color: row._pcolor,
      created_at: row._pcreated,
    };

    const startDate = format(new Date(medicine.start_date), 'yyyy-MM-dd');
    const endDate = medicine.end_date ? format(new Date(medicine.end_date), 'yyyy-MM-dd') : null;
    if (date < startDate) continue;
    if (endDate && date > endDate) continue;

    let times: string[] = [];
    try {
      times = JSON.parse(medicine.dose_times);
    } catch {
      times = ['08:00'];
    }

    for (const time of times) {
      const key = `${medicine.id}|${time}`;
      const log = logMap.get(key);
      items.push({
        medicine,
        profile,
        time,
        logId: log?.id ?? null,
        takenAt: log?.taken_at ?? null,
        skipped: log ? log.skipped === 1 : false,
        date,
      });
    }
  }

  items.sort((a, b) => a.time.localeCompare(b.time));
  return items;
}

export async function getIllnessGroups(
  db: SQLiteDatabase,
  profileId: string
): Promise<string[]> {
  const rows = await db.getAllAsync<{ illness: string }>(
    'SELECT DISTINCT illness FROM medicines WHERE profile_id = ? AND illness != "" ORDER BY illness ASC',
    [profileId]
  );
  return rows.map((r) => r.illness);
}
