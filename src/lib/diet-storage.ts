import { parseMealScanResult } from "@/lib/diet-parse";
import { LOCAL_MEAL_LOGS_KEY } from "@/lib/diet-types";
import type { MealLog } from "@/lib/diet-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeMealLog(value: unknown): MealLog | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = typeof value.id === "string" ? value.id : null;
  const loggedAt =
    typeof value.logged_at === "string"
      ? value.logged_at
      : typeof value.created_at === "string"
        ? value.created_at
        : null;
  if (!id || !loggedAt) {
    return null;
  }
  const query =
    typeof value.query === "string"
      ? value.query
      : typeof value.meal_name === "string"
        ? value.meal_name
        : "Meal";
  const scanned = parseMealScanResult(value, query);
  if (!scanned) {
    return null;
  }
  return {
    ...scanned,
    id,
    query,
    logged_at: loggedAt,
  };
}

export function loadLocalMealLogs(): MealLog[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_MEAL_LOGS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(normalizeMealLog)
      .filter((log): log is MealLog => log !== null);
  } catch {
    return [];
  }
}

export function persistLocalMealLogs(logs: MealLog[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LOCAL_MEAL_LOGS_KEY, JSON.stringify(logs));
}

export function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isSameLocalDay(isoDate: string, dayKey: string): boolean {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return localDayKey(date) === dayKey;
}

export function createMealId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
