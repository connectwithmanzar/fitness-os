export const FITNESS_BACKUP_KEYS = [
  "local_meal_logs",
  "workout_history",
  "active_workout_session",
  "diet_targets",
  "pulse_bedtime_checks",
  "supplements_taken_today",
  "fitness_os_guest_mode",
  "last_completed_workout",
  "custom_workout_splits",
] as const;

const ARRAY_MERGE_KEYS = new Set<string>([
  "local_meal_logs",
  "workout_history",
  "custom_workout_splits",
]);

export type FitnessBackup = {
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
};

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function itemId(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mergeById(local: unknown[], incoming: unknown[]): unknown[] {
  const merged = new Map<string, unknown>();
  const unlabeled: unknown[] = [];

  for (const item of [...local, ...incoming]) {
    const id = itemId(item);
    if (id) {
      merged.set(id, item);
    } else {
      unlabeled.push(item);
    }
  }

  return [...Array.from(merged.values()), ...unlabeled];
}

export function buildBackupPayload(): FitnessBackup {
  const data: Record<string, unknown> = {};
  for (const key of FITNESS_BACKUP_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (raw == null) {
      data[key] = null;
      continue;
    }
    try {
      data[key] = JSON.parse(raw) as unknown;
    } catch {
      data[key] = raw;
    }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function downloadBackup(): void {
  const blob = new Blob([JSON.stringify(buildBackupPayload(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fitness-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function importBackupJson(text: string): void {
  const parsed: unknown = JSON.parse(text);
  const record =
    typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  const nested =
    typeof record.data === "object" && record.data !== null
      ? (record.data as Record<string, unknown>)
      : record;

  for (const key of FITNESS_BACKUP_KEYS) {
    if (!(key in nested) || nested[key] == null) {
      continue;
    }
    const incoming = nested[key];
    if (ARRAY_MERGE_KEYS.has(key)) {
      let local: unknown[] = [];
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) {
          local = asArray(JSON.parse(raw) as unknown);
        }
      } catch {
        local = [];
      }
      window.localStorage.setItem(
        key,
        JSON.stringify(mergeById(local, asArray(incoming)))
      );
      continue;
    }
    if (typeof incoming === "string") {
      window.localStorage.setItem(key, incoming);
      continue;
    }
    window.localStorage.setItem(key, JSON.stringify(incoming));
  }
}
