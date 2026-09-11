export const WORKOUT_HISTORY_KEY = "workout_history";

export type HistorySet = {
  id: string;
  setNumber: number;
  weightKg: string;
  reps: string;
  completed: boolean;
};

export type HistoryExercise = {
  id: string;
  name: string;
  sets: HistorySet[];
};

export type CompletedWorkout = {
  id: string;
  name: string;
  completedAt: string;
  exercises: HistoryExercise[];
};

function isHistorySet(value: unknown): value is HistorySet {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as HistorySet;
  return (
    typeof record.id === "string" &&
    typeof record.setNumber === "number" &&
    typeof record.weightKg === "string" &&
    typeof record.reps === "string"
  );
}

function isHistoryExercise(value: unknown): value is HistoryExercise {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as HistoryExercise;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    Array.isArray(record.sets) &&
    record.sets.every(isHistorySet)
  );
}

export function isCompletedWorkout(value: unknown): value is CompletedWorkout {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as CompletedWorkout;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.completedAt === "string" &&
    Array.isArray(record.exercises) &&
    record.exercises.every(isHistoryExercise)
  );
}

export function loadWorkoutHistory(): CompletedWorkout[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(WORKOUT_HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(isCompletedWorkout)
      .sort(
        (left, right) =>
          new Date(right.completedAt).getTime() -
          new Date(left.completedAt).getTime()
      );
  } catch {
    return [];
  }
}

export function persistWorkoutHistory(history: CompletedWorkout[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(WORKOUT_HISTORY_KEY, JSON.stringify(history));
}

export function appendWorkoutHistory(
  entry: CompletedWorkout
): CompletedWorkout[] {
  const next = [entry, ...loadWorkoutHistory().filter((item) => item.id !== entry.id)];
  persistWorkoutHistory(next);
  return next;
}

export function removeWorkoutHistory(id: string): CompletedWorkout[] {
  const next = loadWorkoutHistory().filter((item) => item.id !== id);
  persistWorkoutHistory(next);
  return next;
}

export function historyHasWorkoutToday(dayKey: string): boolean {
  return loadWorkoutHistory().some((entry) => {
    const date = new Date(entry.completedAt);
    if (Number.isNaN(date.getTime())) {
      return false;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}` === dayKey;
  });
}

export function completedSetCount(entry: CompletedWorkout): number {
  return entry.exercises.reduce(
    (total, exercise) =>
      total + exercise.sets.filter((set) => set.completed).length,
    0
  );
}

export function totalVolumeKg(entry: CompletedWorkout): number {
  return entry.exercises.reduce((total, exercise) => {
    return (
      total +
      exercise.sets.reduce((setTotal, set) => {
        if (!set.completed) {
          return setTotal;
        }
        const weight = Number(set.weightKg);
        const reps = Number(set.reps);
        if (!Number.isFinite(weight) || !Number.isFinite(reps)) {
          return setTotal;
        }
        return setTotal + weight * reps;
      }, 0)
    );
  }, 0);
}

export function topSetLabel(exercise: HistoryExercise): string {
  const completed = exercise.sets.filter((set) => set.completed);
  if (completed.length === 0) {
    return `${exercise.sets.length} sets`;
  }

  const top = [...completed].sort((left, right) => {
    const leftWeight = Number(left.weightKg) || 0;
    const rightWeight = Number(right.weightKg) || 0;
    return rightWeight - leftWeight;
  })[0];

  const weight = top.weightKg.trim() || "0";
  const reps = top.reps.trim() || "0";
  return `${completed.length} sets • Top: ${weight}kg x ${reps}`;
}

export function formatHistoryTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  if (sameDay(date, today)) {
    return `Today, ${time}`;
  }
  if (sameDay(date, yesterday)) {
    return `Yesterday, ${time}`;
  }

  return `${new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date)}, ${time}`;
}
