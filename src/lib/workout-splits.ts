import { findExerciseById, type LibraryExercise } from "@/lib/exerciseDatabase";

export type WorkoutSplitId =
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower"
  | "full"
  | "empty";

export type WorkoutSplit = {
  id: WorkoutSplitId;
  title: string;
  detail: string;
  exerciseIds: string[];
};

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

export function exercisesForSplit(split: WorkoutSplit): LibraryExercise[] {
  return split.exerciseIds
    .map(findExerciseById)
    .filter((exercise): exercise is LibraryExercise => exercise !== undefined);
}
