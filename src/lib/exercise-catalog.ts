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

export const EXERCISE_CATALOG: CatalogExercise[] = [
  { name: "Barbell Bench Press", group: "Chest" },
  { name: "Incline Dumbbell Press", group: "Chest" },
  { name: "Cable Flyes", group: "Chest" },
  { name: "Dips", group: "Chest" },
  { name: "Push-ups", group: "Chest" },
  { name: "Barbell Deadlift", group: "Back" },
  { name: "Pull-ups", group: "Back" },
  { name: "Lat Pulldown", group: "Back" },
  { name: "Seated Cable Row", group: "Back" },
  { name: "Barbell Row", group: "Back" },
  { name: "Barbell Squat", group: "Legs" },
  { name: "Leg Press", group: "Legs" },
  { name: "Romanian Deadlift", group: "Legs" },
  { name: "Leg Extension", group: "Legs" },
  { name: "Hamstring Curl", group: "Legs" },
  { name: "Calf Raise", group: "Legs" },
  { name: "Overhead Press", group: "Shoulders" },
  { name: "Dumbbell Lateral Raise", group: "Shoulders" },
  { name: "Face Pulls", group: "Shoulders" },
  { name: "Arnold Press", group: "Shoulders" },
  { name: "Barbell Bicep Curl", group: "Arms" },
  { name: "Hammer Curl", group: "Arms" },
  { name: "Tricep Rope Pushdown", group: "Arms" },
  { name: "Skull Crushers", group: "Arms" },
];

export function filterCatalog(
  query: string,
  group: ExerciseFilter
): CatalogExercise[] {
  const normalized = query.trim().toLowerCase();

  return EXERCISE_CATALOG.filter((exercise) => {
    const matchesGroup = group === "All" || exercise.group === group;
    const matchesQuery =
      normalized.length === 0 ||
      exercise.name.toLowerCase().includes(normalized);
    return matchesGroup && matchesQuery;
  });
}
