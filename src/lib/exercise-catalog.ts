import {
  EXERCISE_DATABASE,
  filterExerciseDatabase,
  type MuscleGroup,
} from "@/lib/exerciseDatabase";

export const EXERCISE_FILTERS = [
  "All",
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Core",
] as const;

export type ExerciseFilter = (typeof EXERCISE_FILTERS)[number];

export type CatalogExercise = {
  name: string;
  group: Exclude<ExerciseFilter, "All">;
};

export const EXERCISE_CATALOG: CatalogExercise[] = EXERCISE_DATABASE.map((exercise) => ({
  name: exercise.name,
  group: exercise.muscle,
}));

export function filterCatalog(
  query: string,
  group: ExerciseFilter
): CatalogExercise[] {
  return filterExerciseDatabase(query, group === "All" ? "All" : (group as MuscleGroup), "All").map(
    (exercise) => ({ name: exercise.name, group: exercise.muscle })
  );
}
