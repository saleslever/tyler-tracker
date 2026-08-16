// Local-time helpers pinned to Tyler's timezone.
// Server runs in UTC; we always want calendar dates in America/Denver so
// "today" doesn't flip to Sunday while it's still Saturday night for him.

export const APP_TZ = "America/Denver";

// YYYY-MM-DD in the app timezone (default: for right now).
export function todayLocal(now: Date = new Date()): string {
  return dateLocal(now);
}

// YYYY-MM-DD in the app timezone for any Date.
export function dateLocal(d: Date): string {
  // en-CA gives YYYY-MM-DD out of the box.
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ }).format(d);
}

// Shift a date by N days and return YYYY-MM-DD in the app timezone.
// Positive n = future, negative n = past.
export function addDaysLocal(n: number, from: Date = new Date()): string {
  return dateLocal(new Date(from.getTime() + n * 864e5));
}
