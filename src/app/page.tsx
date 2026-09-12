"use client";

import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { AccountButton, AuthModal } from "@/components/AuthModal";
import { ExerciseSelectorModal } from "@/components/ExerciseSelectorModal";
import { ExerciseThumb } from "@/components/ExerciseThumb";
import {
  findExerciseByName,
  type LibraryExercise,
  type MuscleGroup,
} from "@/lib/exerciseDatabase";
import { getSupabase } from "@/lib/supabaseClient";
import {
  exercisesForSplit,
  WORKOUT_SPLITS,
  type WorkoutSplit,
} from "@/lib/workout-splits";
import {
  appendWorkoutHistory,
  completedSetCount,
  formatHistoryTimestamp,
  loadWorkoutHistory,
  removeWorkoutHistory,
  topSetLabel,
  totalVolumeKg,
  type CompletedWorkout,
} from "@/lib/workout-history";
import { isValidLoggedSet, pruneToValidSets, validSetCount } from "@/lib/workout-session";
import { finishWorkoutSession } from "@/lib/workout-sync";
import { persistLastCompletedWorkout } from "@/lib/pulse-storage";

const STORAGE_KEY = "active_workout_session";
const REST_PRESETS = [60, 90, 120] as const;

type WorkoutSet = {
  id: string;
  setNumber: number;
  weightKg: string;
  reps: string;
  completed: boolean;
};

type WorkoutExercise = {
  id: string;
  name: string;
  gifUrl?: string;
  stillUrl?: string;
  muscle?: MuscleGroup;
  equipment?: string;
  sets: WorkoutSet[];
};

type ActiveWorkoutSession = {
  id: string;
  name?: string;
  splitId?: string;
  startedAt: string;
  finishedAt: string | null;
  exercises: WorkoutExercise[];
};

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSet(
  setNumber: number,
  seed?: { weightKg: string; reps: string }
): WorkoutSet {
  return {
    id: createId(),
    setNumber,
    weightKg: seed?.weightKg ?? "",
    reps: seed?.reps ?? "",
    completed: false,
  };
}

function previousSetValues(
  exerciseName: string,
  setIndex: number,
  history: CompletedWorkout[]
): { weightKg: string; reps: string } {
  for (const workout of history) {
    const match = workout.exercises.find((item) => item.name === exerciseName);
    if (!match) {
      continue;
    }
    const set = match.sets[setIndex];
    if (set && (set.weightKg.trim() || set.reps.trim())) {
      return { weightKg: set.weightKg, reps: set.reps };
    }
  }
  for (const workout of history) {
    const match = workout.exercises.find((item) => item.name === exerciseName);
    if (!match) {
      continue;
    }
    const last = [...match.sets].reverse().find((set) => set.weightKg.trim() || set.reps.trim());
    if (last) {
      return { weightKg: last.weightKg, reps: last.reps };
    }
  }
  return { weightKg: "", reps: "" };
}

function defaultsForSet(
  exerciseName: string,
  setIndex: number,
  history: CompletedWorkout[],
  currentSets: WorkoutSet[] = []
): { weightKg: string; reps: string } {
  const fromHistory = previousSetValues(exerciseName, setIndex, history);
  if (fromHistory.weightKg || fromHistory.reps) {
    return fromHistory;
  }
  const previousRow = currentSets[setIndex - 1] ?? currentSets[currentSets.length - 1];
  if (previousRow && (previousRow.weightKg || previousRow.reps)) {
    return { weightKg: previousRow.weightKg, reps: previousRow.reps };
  }
  return { weightKg: "", reps: "" };
}

function createExercise(
  exercise: LibraryExercise,
  history: CompletedWorkout[]
): WorkoutExercise {
  const setCount = Math.max(1, exercise.defaultSets);
  return {
    id: createId(),
    name: exercise.name,
    gifUrl: exercise.gifUrl || undefined,
    stillUrl: exercise.stillUrl || undefined,
    muscle: exercise.muscle,
    equipment: exercise.equipment,
    sets: Array.from({ length: setCount }, (_, index) =>
      createSet(index + 1, defaultsForSet(exercise.name, index, history))
    ),
  };
}

function createSession(
  split: WorkoutSplit,
  history: CompletedWorkout[]
): ActiveWorkoutSession {
  return {
    id: createId(),
    name: split.title,
    splitId: split.id,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exercises: exercisesForSplit(split).map((exercise) =>
      createExercise(exercise, history)
    ),
  };
}

function isSession(value: unknown): value is ActiveWorkoutSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as ActiveWorkoutSession;
  return typeof record.id === "string" && Array.isArray(record.exercises);
}

function sessionName(session: ActiveWorkoutSession): string {
  const labeled = session.name?.trim() ?? "";
  if (labeled.length > 0 && session.splitId !== "empty") {
    return labeled;
  }
  const groups = new Set<MuscleGroup>();
  for (const exercise of session.exercises) {
    const muscle = exercise.muscle ?? findExerciseByName(exercise.name)?.muscle;
    if (muscle) {
      groups.add(muscle);
    }
  }
  if (groups.has("Chest")) {
    return "Chest Workout Session";
  }
  const [first] = Array.from(groups);
  return first ? `${first} Workout Session` : session.name || "Workout Session";
}

function previousForSet(
  exerciseName: string,
  setIndex: number,
  history: CompletedWorkout[]
): string {
  for (const workout of history) {
    const match = workout.exercises.find((item) => item.name === exerciseName);
    if (!match) {
      continue;
    }
    const set = match.sets[setIndex];
    if (!set) {
      continue;
    }
    const weight = set.weightKg.trim();
    const reps = set.reps.trim();
    if (!weight && !reps) {
      continue;
    }
    return `${weight || "0"} × ${reps || "0"}`;
  }
  return "—";
}

function beepRestEnd(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      return;
    }
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
    window.setTimeout(() => {
      void ctx.close();
    }, 250);
  } catch {
    // Optional cue — skip if the browser blocks audio.
  }
}

function resolveMuscle(exercise: WorkoutExercise): MuscleGroup {
  return exercise.muscle ?? findExerciseByName(exercise.name)?.muscle ?? "Core";
}

export default function WorkoutPage() {
  const [session, setSession] = useState<ActiveWorkoutSession | null>(null);
  const [history, setHistory] = useState<CompletedWorkout[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [restSeconds, setRestSeconds] = useState<(typeof REST_PRESETS)[number]>(90);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        setSession(isSession(parsed) && !parsed.finishedAt ? parsed : null);
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    }
    setHistory(loadWorkoutHistory());
    setHydrated(true);

    const client = getSupabase();
    if (!client) {
      return;
    }
    let active = true;
    const syncAuth = async () => {
      const { data } = await client.auth.getSession();
      if (active) {
        setIsSignedIn(Boolean(data.session));
      }
    };
    void syncAuth();
    const { data: authListener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setIsSignedIn(Boolean(nextSession));
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (!session) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [hydrated, session]);

  useEffect(() => {
    if (!banner) {
      return;
    }
    const timeout = window.setTimeout(() => setBanner(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [banner]);

  useEffect(() => {
    if (restRemaining === null) {
      return;
    }
    if (restRemaining <= 0) {
      beepRestEnd();
      setRestRemaining(null);
      return;
    }
    const timeout = window.setTimeout(() => {
      setRestRemaining((current) => (current === null ? null : current - 1));
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [restRemaining]);

  const addExercise = (exercise: LibraryExercise) => {
    setSession((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        exercises: [...current.exercises, createExercise(exercise, history)],
      };
    });
    setIsModalOpen(false);
  };

  const startSplit = (split: WorkoutSplit) => {
    setSession(createSession(split, history));
    setFinishError(null);
    setRestRemaining(null);
  };

  const cancelWorkout = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setFinishError(null);
    setIsModalOpen(false);
    setRestRemaining(null);
  };

  const finishSession = async () => {
    if (!session) {
      return;
    }
    const validExercises = pruneToValidSets(session.exercises);
    if (validSetCount(session.exercises) === 0 || validExercises.length === 0) {
      setFinishError("Complete at least one set with reps (weight optional for bodyweight).");
      return;
    }
    const completedAt = new Date().toISOString();
    const completed: CompletedWorkout = {
      id: createId(),
      name: sessionName({ ...session, exercises: validExercises }),
      completedAt,
      exercises: validExercises,
    };
    setHistory(appendWorkoutHistory(completed));
    persistLastCompletedWorkout(completedAt);
    let synced = false;
    try {
      synced = await finishWorkoutSession({
        id: completed.id,
        name: completed.name,
        splitId: session.splitId,
        startedAt: session.startedAt,
        finishedAt: completedAt,
        exercises: validExercises.map((exercise) => ({
          ...exercise,
          previousSetLabel: "—",
        })),
      });
    } catch {
      synced = false;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setFinishError(null);
    setRestRemaining(null);
    setBanner(synced ? "Workout saved + synced" : "Workout saved locally");
  };

  if (!hydrated) {
    return (
      <section className="mx-auto min-h-screen max-w-md bg-neutral-950 px-4 pb-36 pt-6 text-white">
        <p className="text-sm text-neutral-500">Loading workout…</p>
      </section>
    );
  }

  const canFinish = session ? validSetCount(session.exercises) > 0 : false;

  return (
    <section className="mx-auto min-h-screen max-w-md overflow-x-hidden bg-neutral-950 px-4 pb-36 pt-6 font-sans text-white">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
            {new Intl.DateTimeFormat("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            }).format(new Date())}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Workout</h1>
            {session ? (
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
                {sessionName(session)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AccountButton signedIn={isSignedIn} onClick={() => setIsAuthOpen(true)} />
          {session ? (
            <button
              type="button"
              disabled={!canFinish}
              onClick={() => {
                void finishSession();
              }}
              className="rounded-xl bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-black transition active:scale-98 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
            >
              Finish Workout
            </button>
          ) : null}
        </div>
      </header>

      {banner ? (
        <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2.5 text-sm font-medium text-emerald-300">
          {banner}
        </div>
      ) : null}
      {finishError ? <p className="mt-3 text-xs text-amber-400">{finishError}</p> : null}

      {session ? (
        <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Rest timer
              </p>
              <p className="mt-0.5 font-mono text-lg font-semibold text-white">
                {restRemaining === null
                  ? `${restSeconds}s`
                  : `${Math.floor(restRemaining / 60)}:${String(restRemaining % 60).padStart(2, "0")}`}
              </p>
            </div>
            <div className="flex gap-1.5">
              {REST_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setRestSeconds(preset);
                    if (restRemaining !== null) {
                      setRestRemaining(preset);
                    }
                  }}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    restSeconds === preset
                      ? "bg-emerald-500 text-black"
                      : "border border-neutral-700 text-neutral-300"
                  }`}
                >
                  {preset}s
                </button>
              ))}
            </div>
          </div>
          {restRemaining !== null ? (
            <button
              type="button"
              onClick={() => setRestRemaining(null)}
              className="mt-2 text-xs text-neutral-500 underline-offset-4 hover:text-neutral-300 hover:underline"
            >
              Skip rest
            </button>
          ) : (
            <p className="mt-2 text-[11px] text-neutral-500">
              Starts automatically when you complete a set.
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-6">
        {!session ? (
          <div className="mb-8">
            <h2 className="text-lg font-semibold">Start a session</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Pick a split to pre-load compounds, or start empty and add lifts yourself.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {WORKOUT_SPLITS.map((split) => (
                <button
                  key={split.id}
                  type="button"
                  onClick={() => startSplit(split)}
                  className={`rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-left transition hover:border-emerald-500/50 active:scale-98 ${
                    split.id === "empty" ? "col-span-2" : ""
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{split.title}</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">{split.detail}</p>
                </button>
              ))}
            </div>
          </div>
        ) : session.exercises.length === 0 ? (
          <div className="mb-4 rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4 text-center text-sm text-neutral-300">
            No exercises yet. Tap below to add a movement.
          </div>
        ) : (
          session.exercises.map((exercise) => {
            const muscle = resolveMuscle(exercise);
            const catalog = findExerciseByName(exercise.name);
            return (
            <article
              key={exercise.id}
              className="mb-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ExerciseThumb
                    name={exercise.name}
                    muscle={muscle}
                    gifUrl={exercise.gifUrl ?? catalog?.gifUrl ?? ""}
                    stillUrl={exercise.stillUrl ?? catalog?.stillUrl}
                    className="h-[52px] w-[52px] shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-white">{exercise.name}</h2>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        {muscle}
                      </span>
                      {exercise.equipment || catalog?.equipment ? (
                        <span className="rounded-full border border-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                          {exercise.equipment ?? catalog?.equipment}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSession((current) =>
                      current
                        ? {
                            ...current,
                            exercises: current.exercises.filter((item) => item.id !== exercise.id),
                          }
                        : current
                    )
                  }
                  className="rounded-lg p-1.5 text-neutral-500 hover:text-red-400"
                  aria-label={`Remove ${exercise.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-[2rem_minmax(3.5rem,1fr)_1fr_1fr_2.25rem] gap-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                <span className="text-center">Set</span>
                <span className="text-center">Previous</span>
                <span className="text-center">Weight</span>
                <span className="text-center">Reps</span>
                <span />
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {exercise.sets.map((set, setIndex) => (
                  <div
                    key={set.id}
                    className="grid grid-cols-[2rem_minmax(3.5rem,1fr)_1fr_1fr_2.25rem] items-center gap-2"
                  >
                    <span className="text-center font-mono text-sm text-neutral-400">
                      {set.setNumber}
                    </span>
                    <span className="truncate text-center font-mono text-[11px] text-neutral-500">
                      {previousForSet(exercise.name, setIndex, history)}
                    </span>
                    <input
                      inputMode="decimal"
                      value={set.weightKg}
                      readOnly={set.completed}
                      aria-label={`${exercise.name} set ${set.setNumber} weight`}
                      onChange={(event) =>
                        setSession((current) =>
                          current
                            ? {
                                ...current,
                                exercises: current.exercises.map((item) =>
                                  item.id === exercise.id
                                    ? {
                                        ...item,
                                        sets: item.sets.map((row) =>
                                          row.id === set.id && !row.completed
                                            ? { ...row, weightKg: event.target.value }
                                            : row
                                        ),
                                      }
                                    : item
                                ),
                              }
                            : current
                        )
                      }
                      className="h-11 min-w-0 rounded-xl border border-neutral-800 bg-neutral-950 text-center font-mono text-sm outline-none focus:border-emerald-500"
                    />
                    <input
                      inputMode="numeric"
                      value={set.reps}
                      readOnly={set.completed}
                      aria-label={`${exercise.name} set ${set.setNumber} reps`}
                      onChange={(event) =>
                        setSession((current) =>
                          current
                            ? {
                                ...current,
                                exercises: current.exercises.map((item) =>
                                  item.id === exercise.id
                                    ? {
                                        ...item,
                                        sets: item.sets.map((row) =>
                                          row.id === set.id && !row.completed
                                            ? { ...row, reps: event.target.value }
                                            : row
                                        ),
                                      }
                                    : item
                                ),
                              }
                            : current
                        )
                      }
                      className="h-11 min-w-0 rounded-xl border border-neutral-800 bg-neutral-950 text-center font-mono text-sm outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (set.completed) {
                          setSession((current) =>
                            current
                              ? {
                                  ...current,
                                  exercises: current.exercises.map((item) =>
                                    item.id === exercise.id
                                      ? {
                                          ...item,
                                          sets: item.sets.map((row) =>
                                            row.id === set.id
                                              ? { ...row, completed: false }
                                              : row
                                          ),
                                        }
                                      : item
                                  ),
                                }
                              : current
                          );
                          return;
                        }
                        if (!isValidLoggedSet({ ...set, completed: true })) {
                          return;
                        }
                        setSession((current) =>
                          current
                            ? {
                                ...current,
                                exercises: current.exercises.map((item) =>
                                  item.id === exercise.id
                                    ? {
                                        ...item,
                                        sets: item.sets.map((row) =>
                                          row.id === set.id
                                            ? { ...row, completed: true }
                                            : row
                                        ),
                                      }
                                    : item
                                ),
                              }
                            : current
                        );
                        setRestRemaining(restSeconds);
                      }}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                        set.completed
                          ? "border-emerald-500 bg-emerald-500 text-black"
                          : "border-neutral-700 text-neutral-500"
                      }`}
                      aria-label={`Mark ${exercise.name} set ${set.setNumber} complete`}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setSession((current) =>
                    current
                      ? {
                          ...current,
                          exercises: current.exercises.map((item) =>
                            item.id === exercise.id
                              ? {
                                  ...item,
                                  sets: [
                                    ...item.sets,
                                    createSet(
                                      item.sets.length + 1,
                                      defaultsForSet(
                                        item.name,
                                        item.sets.length,
                                        history,
                                        item.sets
                                      )
                                    ),
                                  ],
                                }
                              : item
                          ),
                        }
                      : current
                  )
                }
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-800 py-2.5 text-sm text-neutral-300"
              >
                <Plus className="h-4 w-4" />
                Add Set
              </button>
            </article>
            );
          })
        )}

        {session ? (
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-700 bg-neutral-900/40 py-3.5 font-semibold text-neutral-300 transition hover:border-emerald-500 active:scale-98"
            >
              <Plus className="h-4 w-4" />
              + Add Exercise
            </button>
            <button
              type="button"
              onClick={cancelWorkout}
              className="mb-10 w-full py-2 text-sm font-medium text-neutral-500 underline-offset-4 hover:text-red-400 hover:underline"
            >
              Cancel Workout
            </button>
          </>
        ) : null}
      </div>

      <section className="pb-6">
        <h2 className="text-lg font-semibold">Past Workouts</h2>
        {history.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-neutral-800 px-4 py-8 text-center text-sm text-neutral-500">
            No completed workouts yet. Finish a session above to see your history here.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {history.map((entry) => (
              <article
                key={entry.id}
                className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-neutral-500">
                      {formatHistoryTimestamp(entry.completedAt)}
                    </p>
                    <h3 className="mt-1 text-sm font-semibold">{entry.name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                      {completedSetCount(entry)} sets
                      {totalVolumeKg(entry) > 0 ? ` • ${Math.round(totalVolumeKg(entry))}kg` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHistory(removeWorkoutHistory(entry.id))}
                      className="p-1.5 text-neutral-500 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.exercises.map((exercise) => (
                    <span
                      key={exercise.id}
                      className="rounded-full border border-neutral-800 px-2.5 py-1 text-[11px] text-neutral-300"
                    >
                      {exercise.name}: {topSetLabel(exercise)}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {session ? (
        <ExerciseSelectorModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSelect={addExercise}
        />
      ) : null}

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthChange={setIsSignedIn}
      />
    </section>
  );
}
