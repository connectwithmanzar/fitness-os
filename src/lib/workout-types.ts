export type WorkoutSet = {
  id: string;
  setNumber: number;
  weightKg: string;
  reps: string;
  completed: boolean;
};

export type WorkoutExercise = {
  id: string;
  name: string;
  previousSetLabel: string;
  sets: WorkoutSet[];
};

export type ActiveWorkoutSession = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  exercises: WorkoutExercise[];
};

export type WorkoutSessionRow = {
  id: string;
  user_id: string | null;
  started_at: string;
  completed_at: string | null;
};

export type ExerciseLogRow = {
  id: string;
  session_id: string;
  user_id: string | null;
  exercise_name: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  completed: boolean;
};
