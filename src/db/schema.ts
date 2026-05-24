import { SQLiteDatabase } from 'expo-sqlite';

export async function initDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      relation TEXT NOT NULL DEFAULT 'self',
      avatar_color TEXT NOT NULL DEFAULT '#E8F5E9',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY NOT NULL,
      profile_id TEXT NOT NULL,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL DEFAULT '',
      illness TEXT NOT NULL DEFAULT '',
      doses_per_day INTEGER NOT NULL DEFAULT 1,
      dose_times TEXT NOT NULL DEFAULT '["08:00"]',
      start_date INTEGER NOT NULL,
      end_date INTEGER,
      notes TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      color TEXT NOT NULL DEFAULT '#E8F5E9',
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dose_logs (
      id TEXT PRIMARY KEY NOT NULL,
      medicine_id TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      taken_at INTEGER,
      skipped INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notification_records (
      id TEXT PRIMARY KEY NOT NULL,
      medicine_id TEXT NOT NULL,
      notification_id TEXT NOT NULL,
      scheduled_for INTEGER NOT NULL,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
    );
  `);
}
