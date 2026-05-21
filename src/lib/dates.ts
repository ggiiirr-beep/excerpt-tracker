export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatShortDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function relativePracticeDate(value: string | null) {
  if (!value) return 'Never';
  const today = new Date(`${todayIso()}T12:00:00`);
  const date = new Date(`${value}T12:00:00`);
  const diff = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
}
