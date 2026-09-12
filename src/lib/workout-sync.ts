import { getSupabase } from "@/lib/supabaseClient";
import type { ActiveWorkoutSession, WorkoutSet } from "@/lib/workout-types";
import { parseOptionalNumber, isValidLoggedSet } from "@/lib/workout-session";

async function getUserId(): Promise<string | null> {
  const client = getSupabase();
  if (!client) {
    return null;
  }
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      return null;
    }
    return data.user.id;
  } catch {
    return null;
  }
}

export async function upsertWorkoutSession(
  session: ActiveWorkoutSession,
  userId: string
): Promise<void> {
  const client = getSupabase();
  if (!client) {
    return;
  }

  const { error } = await client.from("workout_sessions").upsert(
    {
      id: session.id,
      user_id: userId,
      started_at: session.startedAt,
      completed_at: session.finishedAt,
    },
    { onConflict: "id" }
  );

  if (error) {
    throw error;
  }
}

export async function upsertCompletedSet(
  sessionId: string,
  userId: string,
  exerciseName: string,
  set: WorkoutSet
): Promise<void> {
  const client = getSupabase();
  if (!client) {
    return;
  }

  const { error } = await client.from("exercise_logs").upsert(
    {
      id: set.id,
      session_id: sessionId,
      user_id: userId,
      exercise_name: exerciseName,
      set_number: set.setNumber,
      weight_kg: parseOptionalNumber(set.weightKg),
      reps: parseOptionalNumber(set.reps),
      completed: true,
    },
    { onConflict: "id" }
  );

  if (error) {
    throw error;
  }
}

export async function syncCompletedSet(
  session: ActiveWorkoutSession,
  exerciseName: string,
  set: WorkoutSet
): Promise<void> {
  const userId = await getUserId();
  if (!userId) {
    return;
  }

  await upsertWorkoutSession(session, userId);
  await upsertCompletedSet(session.id, userId, exerciseName, set);
}

export async function finishWorkoutSession(
  session: ActiveWorkoutSession
): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) {
    return false;
  }

  const finished: ActiveWorkoutSession = {
    ...session,
    finishedAt: session.finishedAt ?? new Date().toISOString(),
  };

  const completedSets = finished.exercises.flatMap((exercise) =>
    exercise.sets
      .filter((set) => isValidLoggedSet(set))
      .map((set) => ({ exerciseName: exercise.name, set }))
  );

  if (completedSets.length === 0) {
    return false;
  }

  await upsertWorkoutSession(finished, userId);

  for (const entry of completedSets) {
    await upsertCompletedSet(
      finished.id,
      userId,
      entry.exerciseName,
      entry.set
    );
  }

  return true;
}

export async function fetchTodayWorkoutLogged(
  dayStartIso: string
): Promise<boolean | null> {
  const client = getSupabase();
  if (!client) {
    return null;
  }

  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) {
      return null;
    }

    const { data, error } = await client
      .from("workout_sessions")
      .select("id, started_at, completed_at")
      .eq("user_id", userData.user.id)
      .or(`started_at.gte.${dayStartIso},completed_at.gte.${dayStartIso}`)
      .limit(1);

    if (error) {
      return null;
    }

    return Boolean(data && data.length > 0);
  } catch {
    return null;
  }
}
