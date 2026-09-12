import { findExerciseById, findExerciseByName, type LibraryExercise } from "@/lib/exerciseDatabase";

export type WorkoutSplitId =
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower"
  | "full"
  | "empty"
  | string;

export type WorkoutSplit = {
  id: string;
  title: string;
  detail: string;
  exerciseIds: string[];
  custom?: boolean;
};

export const CUSTOM_SPLITS_KEY = "custom_workout_splits";

export const WORKOUT_SPLITS: WorkoutSplit[] = [
  {
    id: "push",
    title: "Push Day",
    detail: "Bench, press, incline, triceps",
    exerciseIds: ["bench-press", "ohp", "incline-db-press", "rope-pushdown"],
  },
  {
    id: "pull",
    title: "Pull Day",
    detail: "Deadlift, pull-ups, rows, curls",
    exerciseIds: ["deadlift", "pull-ups", "barbell-row", "lat-pulldown", "barbell-curl"],
  },
  {
    id: "legs",
    title: "Leg Day",
    detail: "Squat, hinge, press, curls",
    exerciseIds: ["back-squat", "rdl", "leg-press", "leg-curl", "calf-raise"],
  },
  {
    id: "upper",
    title: "Upper Body",
    detail: "Chest, back, shoulders",
    exerciseIds: ["bench-press", "barbell-row", "ohp", "lat-pulldown", "lateral-raise"],
  },
  {
    id: "lower",
    title: "Lower Body",
    detail: "Squat, RDL, lunges, calves",
    exerciseIds: ["back-squat", "rdl", "leg-press", "db-lunge", "calf-raise"],
  },
  {
    id: "full",
    title: "Full Body",
    detail: "One compound per pattern",
    exerciseIds: ["back-squat", "bench-press", "barbell-row", "ohp", "rdl"],
  },
  {
    id: "empty",
    title: "Empty Workout",
    detail: "Blank session — pick your own lifts",
    exerciseIds: [],
  },
];

function stubExercise(name: string): LibraryExercise {
  return {
    id: name.trim().toLowerCase().replace(/\s+/g, "-"),
    name,
    muscle: "Core",
    equipment: "Bodyweight",
    gifUrl: "",
    stillUrl: "",
    instructions: [],
    defaultSets: 3,
  };
}

function isWorkoutSplit(value: unknown): value is WorkoutSplit {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as WorkoutSplit;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    Array.isArray(record.exerciseIds) &&
    record.exerciseIds.every((id) => typeof id === "string")
  );
}

export function loadCustomSplits(): WorkoutSplit[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(CUSTOM_SPLITS_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isWorkoutSplit).map((split) => ({ ...split, custom: true }));
  } catch {
    return [];
  }
}

export function persistCustomSplits(splits: WorkoutSplit[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CUSTOM_SPLITS_KEY, JSON.stringify(splits));
}

export function saveCustomSplit(split: WorkoutSplit): WorkoutSplit[] {
  const next = [
    { ...split, custom: true as const },
    ...loadCustomSplits().filter((item) => item.id !== split.id),
  ];
  persistCustomSplits(next);
  return next;
}

export function allWorkoutSplits(custom: WorkoutSplit[] = loadCustomSplits()): WorkoutSplit[] {
  return [...custom, ...WORKOUT_SPLITS];
}

export function exercisesForSplit(split: WorkoutSplit): LibraryExercise[] {
  return split.exerciseIds.map((id) => {
    return (
      findExerciseById(id) ??
      findExerciseByName(id) ??
      stubExercise(id)
    );
  });
}
