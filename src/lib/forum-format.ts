export function forumDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function forumRelativeTime(iso: string): string {
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return '';
  const diffMinutes = Math.round((date - Date.now()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });

  const abs = Math.abs(diffMinutes);
  if (abs < 1) return 'vừa xong';
  if (abs < 60) return rtf.format(diffMinutes, 'minute');
  if (abs < 60 * 24) return rtf.format(Math.round(diffMinutes / 60), 'hour');
  if (abs < 60 * 24 * 30) return rtf.format(Math.round(diffMinutes / (60 * 24)), 'day');
  return forumDate(iso);
}

export function forumNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}
