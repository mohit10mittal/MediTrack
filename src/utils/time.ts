export function calcDoseTimes(startTime: string, count: number): string[] {
  const [hStr, mStr] = startTime.split(':');
  const startMins = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
  const interval = Math.round((24 * 60) / count);
  return Array.from({ length: count }, (_, i) => {
    const total = (startMins + i * interval) % (24 * 60);
    const h = Math.floor(total / 60).toString().padStart(2, '0');
    const m = (total % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  });
}

export function formatTime12(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${ampm}`;
}

export function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function localMidnight(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}
