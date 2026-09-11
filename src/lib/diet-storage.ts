import { LOCAL_MEAL_LOGS_KEY } from "@/lib/diet-types";
import type { MealLog } from "@/lib/diet-types";

function isMealLog(value: unknown): value is MealLog {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as MealLog;
  return (
    typeof record.id === "string" &&
    typeof record.meal_name === "string" &&
    typeof record.logged_at === "string" &&
    typeof record.calories === "number" &&
    typeof record.micronutrients === "object" &&
    record.micronutrients !== null
  );
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
    return parsed.filter(isMealLog);
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
