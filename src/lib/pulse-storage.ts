import { isSameLocalDay, localDayKey } from "@/lib/diet-storage";
import {
  LAST_COMPLETED_WORKOUT_KEY,
  SUPPLEMENTS_TAKEN_STORAGE_KEY,
} from "@/lib/pulse-baselines";
import type { SupplementId } from "@/lib/pulse-types";
import { loadSessionFromStorage } from "@/lib/workout-session";

type TakenStore = {
  day: string;
  ids: SupplementId[];
};

const SUPPLEMENT_IDS: SupplementId[] = [
  "whey",
  "magnesium",
  "zinc",
  "vitamin-d",
  "omega-3",
];

function isSupplementId(value: unknown): value is SupplementId {
  return typeof value === "string" && SUPPLEMENT_IDS.includes(value as SupplementId);
}

export function loadTakenSupplements(dayKey: string): SupplementId[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SUPPLEMENTS_TAKEN_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as TakenStore;
    if (parsed.day !== dayKey || !Array.isArray(parsed.ids)) {
      return [];
    }
    return parsed.ids.filter(isSupplementId);
  } catch {
    return [];
  }
}

export function persistTakenSupplements(dayKey: string, ids: SupplementId[]): void {
  if (typeof window === "undefined") {
    return;
  }
  const payload: TakenStore = { day: dayKey, ids };
  window.localStorage.setItem(SUPPLEMENTS_TAKEN_STORAGE_KEY, JSON.stringify(payload));
}

export function persistLastCompletedWorkout(isoDate: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LAST_COMPLETED_WORKOUT_KEY, isoDate);
}

export function localWorkoutLoggedToday(dayKey: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const lastCompleted = window.localStorage.getItem(LAST_COMPLETED_WORKOUT_KEY);
  if (lastCompleted && isSameLocalDay(lastCompleted, dayKey)) {
    return true;
  }

  const session = loadSessionFromStorage();
  if (!session) {
    return false;
  }

  const sessionDay =
    session.finishedAt ??
    session.startedAt;
  const hasWork =
    Boolean(session.finishedAt) ||
    session.exercises.some((exercise) =>
      exercise.sets.some((set) => set.completed)
    );

  return hasWork && isSameLocalDay(sessionDay, dayKey);
}
