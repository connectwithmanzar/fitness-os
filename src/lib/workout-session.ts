import type { ActiveWorkoutSession, WorkoutExercise, WorkoutSet } from "@/lib/workout-types";

export const ACTIVE_SESSION_STORAGE_KEY = "active_workout_session";
const LEGACY_SESSION_STORAGE_KEY = "fitness-engine:active-workout";

export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createEmptySet(setNumber: number): WorkoutSet {
  return {
    id: createId(),
    setNumber,
    weightKg: "",
    reps: "",
    completed: false,
  };
}

export function createExercise(name: string, setCount = 1): WorkoutExercise {
  return {
    id: createId(),
    name,
    previousSetLabel: "Prev: —",
    sets: Array.from({ length: Math.max(1, setCount) }, (_, index) =>
      createEmptySet(index + 1)
    ),
  };
}

export function createEmptySession(): ActiveWorkoutSession {
  return {
    id: createId(),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exercises: [],
  };
}

export function loadSessionFromStorage(): ActiveWorkoutSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as ActiveWorkoutSession;
    if (!parsed.id || !Array.isArray(parsed.exercises)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function persistSessionToStorage(session: ActiveWorkoutSession): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session));
  window.localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
}

export function clearSessionFromStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
}

export function previousSetLabel(sets: WorkoutSet[]): string {
  const completed = [...sets].reverse().find((set) => set.completed);
  if (!completed) {
    return "Prev: 60kg x 10";
  }
  const weight = completed.weightKg.trim() || "0";
  const reps = completed.reps.trim() || "0";
  return `Prev: ${weight}kg x ${reps}`;
}

export function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isValidLoggedSet(set: {
  completed: boolean;
  weightKg: string;
  reps: string;
}): boolean {
  if (!set.completed) {
    return false;
  }
  const reps = parseOptionalNumber(set.reps);
  if (reps === null || reps <= 0) {
    return false;
  }
  const weightRaw = set.weightKg.trim();
  if (weightRaw.length === 0) {
    return true;
  }
  const weight = parseOptionalNumber(weightRaw);
  return weight !== null && weight >= 0;
}

export function validSetCount(
  exercises: Array<{ sets: Array<{ completed: boolean; weightKg: string; reps: string }> }>
): number {
  return exercises.reduce(
    (total, exercise) =>
      total + exercise.sets.filter((set) => isValidLoggedSet(set)).length,
    0
  );
}

export function pruneToValidSets<T extends { sets: WorkoutSet[] }>(exercises: T[]): T[] {
  return exercises
    .map((exercise) => ({
      ...exercise,
      sets: exercise.sets.filter((set) => isValidLoggedSet(set)),
    }))
    .filter((exercise) => exercise.sets.length > 0)
    .map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set, index) => ({ ...set, setNumber: index + 1 })),
    }));
}
