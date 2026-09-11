"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, Trash2, X } from "lucide-react";
import { AccountButton, AuthModal } from "@/components/AuthModal";
import { getSupabase } from "@/lib/supabaseClient";
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
import { finishWorkoutSession } from "@/lib/workout-sync";

const STORAGE_KEY = "active_workout_session";

type MuscleGroup = "Chest" | "Back" | "Legs" | "Shoulders" | "Arms";
type ExerciseFilter = "All" | MuscleGroup;

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
  sets: WorkoutSet[];
};

type ActiveWorkoutSession = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  exercises: WorkoutExercise[];
};

const FILTERS: ExerciseFilter[] = ["All", "Chest", "Back", "Legs", "Shoulders", "Arms"];

const CATALOG: Array<{ name: string; group: MuscleGroup }> = [
  { name: "Barbell Bench Press", group: "Chest" },
  { name: "Incline Dumbbell Press", group: "Chest" },
  { name: "Cable Flyes", group: "Chest" },
  { name: "Dips", group: "Chest" },
  { name: "Lat Pulldown", group: "Back" },
  { name: "Barbell Row", group: "Back" },
  { name: "Pull-ups", group: "Back" },
  { name: "Barbell Deadlift", group: "Back" },
  { name: "Squat", group: "Legs" },
  { name: "Leg Press", group: "Legs" },
  { name: "Romanian Deadlift", group: "Legs" },
  { name: "Overhead Press", group: "Shoulders" },
  { name: "Dumbbell Lateral Raise", group: "Shoulders" },
  { name: "Bicep Curls", group: "Arms" },
  { name: "Hammer Curl", group: "Arms" },
  { name: "Tricep Rope Pushdown", group: "Arms" },
];

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSet(setNumber: number): WorkoutSet {
  return { id: createId(), setNumber, weightKg: "", reps: "", completed: false };
}

function createExercise(name: string): WorkoutExercise {
  return { id: createId(), name, sets: [createSet(1)] };
}

function createSession(): ActiveWorkoutSession {
  return { id: createId(), startedAt: new Date().toISOString(), finishedAt: null, exercises: [] };
}

function isSession(value: unknown): value is ActiveWorkoutSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as ActiveWorkoutSession;
  return typeof record.id === "string" && Array.isArray(record.exercises);
}

function sessionName(exercises: WorkoutExercise[]): string {
  const groups = new Set<MuscleGroup>();
  for (const exercise of exercises) {
    const match = CATALOG.find((item) => item.name === exercise.name);
    if (match) {
      groups.add(match.group);
    }
  }
  if (groups.has("Chest")) {
    return "Chest & Workout Session";
  }
  const [first] = Array.from(groups);
  return first ? `${first} Workout Session` : "Workout Session";
}

export default function WorkoutPage() {
  const [session, setSession] = useState<ActiveWorkoutSession | null>(null);
  const [history, setHistory] = useState<CompletedWorkout[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ExerciseFilter>("All");
  const [customName, setCustomName] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        setSession(isSession(parsed) && !parsed.finishedAt ? parsed : createSession());
      } else {
        setSession(createSession());
      }
    } catch {
      setSession(createSession());
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
    if (!hydrated || !session) {
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

  const visibleExercises = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return CATALOG.filter((exercise) => {
      const matchesGroup = activeFilter === "All" || exercise.group === activeFilter;
      return matchesGroup && (query.length === 0 || exercise.name.toLowerCase().includes(query));
    });
  }, [activeFilter, searchQuery]);

  const closeModal = () => {
    setIsModalOpen(false);
    setSearchQuery("");
    setActiveFilter("All");
    setCustomName("");
  };

  const addExercise = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setSession((current) => {
      const base = current ?? createSession();
      return { ...base, exercises: [...base.exercises, createExercise(trimmed)] };
    });
    closeModal();
  };

  const finishSession = async () => {
    if (!session || session.exercises.length === 0) {
      setFinishError("Add at least one exercise before finishing.");
      return;
    }
    const completedAt = new Date().toISOString();
    const completed: CompletedWorkout = {
      id: createId(),
      name: sessionName(session.exercises),
      completedAt,
      exercises: session.exercises,
    };
    setHistory(appendWorkoutHistory(completed));
    try {
      await finishWorkoutSession({
        id: completed.id,
        startedAt: session.startedAt,
        finishedAt: completedAt,
        exercises: session.exercises.map((exercise) => ({
          ...exercise,
          previousSetLabel: "—",
        })),
      });
    } catch {
      // Local history is already saved.
    }
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(createSession());
    setFinishError(null);
    setBanner("Workout Saved to History!");
    closeModal();
  };

  if (!session) {
    return (
      <section className="mx-auto min-h-screen max-w-md bg-neutral-950 px-4 pb-36 pt-6 text-white">
        <p className="text-sm text-neutral-500">Loading workout…</p>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-md bg-neutral-950 px-4 pb-36 pt-6 font-sans text-white">
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
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
              ACTIVE WORKOUT
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AccountButton signedIn={isSignedIn} onClick={() => setIsAuthOpen(true)} />
          <button
            type="button"
            onClick={() => {
              void finishSession();
            }}
            className="rounded-xl bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-black transition active:scale-98"
          >
            Finish Session
          </button>
        </div>
      </header>

      {banner ? (
        <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2.5 text-sm font-medium text-emerald-300">
          {banner}
        </div>
      ) : null}
      {finishError ? <p className="mt-3 text-xs text-amber-400">{finishError}</p> : null}

      <div className="mt-6">
        {session.exercises.length === 0 ? (
          <div className="mb-4 rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4 text-center text-sm text-neutral-300">
            No exercises yet. Tap below to add a movement.
          </div>
        ) : (
          session.exercises.map((exercise) => (
            <article
              key={exercise.id}
              className="mb-4 rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold">{exercise.name}</h2>
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
              <div className="mt-4 grid grid-cols-[2rem_minmax(3rem,1fr)_1fr_1fr_2.25rem] gap-2 text-[11px] uppercase text-neutral-500">
                <span className="text-center">SET</span>
                <span className="text-center">PREV</span>
                <span className="text-center">KG</span>
                <span className="text-center">REPS</span>
                <span />
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {exercise.sets.map((set) => (
                  <div
                    key={set.id}
                    className="grid grid-cols-[2rem_minmax(3rem,1fr)_1fr_1fr_2.25rem] items-center gap-2"
                  >
                    <span className="text-center font-mono text-sm text-neutral-400">
                      {set.setNumber}
                    </span>
                    <span className="text-center font-mono text-xs text-neutral-500">—</span>
                    <input
                      inputMode="decimal"
                      value={set.weightKg}
                      readOnly={set.completed}
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
                      className="h-11 rounded-xl border border-neutral-800 bg-neutral-900 text-center font-mono text-sm outline-none focus:border-emerald-500"
                    />
                    <input
                      inputMode="numeric"
                      value={set.reps}
                      readOnly={set.completed}
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
                      className="h-11 rounded-xl border border-neutral-800 bg-neutral-900 text-center font-mono text-sm outline-none focus:border-emerald-500"
                    />
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
                                        sets: item.sets.map((row) =>
                                          row.id === set.id
                                            ? { ...row, completed: !row.completed }
                                            : row
                                        ),
                                      }
                                    : item
                                ),
                              }
                            : current
                        )
                      }
                      className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                        set.completed
                          ? "border-emerald-500 bg-emerald-500 text-black"
                          : "border-neutral-700 text-neutral-500"
                      }`}
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
                              ? { ...item, sets: [...item.sets, createSet(item.sets.length + 1)] }
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
          ))
        )}

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="mb-10 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-700 bg-neutral-900/40 py-3.5 font-semibold text-neutral-300 transition hover:border-emerald-500 active:scale-98"
        >
          <Plus className="h-4 w-4" />
          + Add Exercise
        </button>
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

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-3xl border border-neutral-800 bg-neutral-950 sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <h2 className="text-lg font-semibold">Add Exercise</h2>
              <button type="button" onClick={closeModal} aria-label="Close">
                <X className="h-5 w-5 text-neutral-400" />
              </button>
            </div>
            <div className="px-5">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search exercises..."
                  className="h-12 w-full rounded-xl border border-neutral-800 bg-neutral-900 pl-10 text-sm outline-none focus:border-emerald-500"
                />
              </label>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs ${
                      activeFilter === filter
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                        : "border-neutral-800 text-neutral-400"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            <ul className="mt-3 min-h-0 flex-1 overflow-y-auto px-5">
              {visibleExercises.map((exercise) => (
                <li key={exercise.name} className="border-b border-neutral-900">
                  <button
                    type="button"
                    onClick={() => addExercise(exercise.name)}
                    className="flex w-full items-center justify-between py-3.5 text-left text-sm"
                  >
                    {exercise.name}
                    <Plus className="h-4 w-4 text-neutral-500" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 border-t border-neutral-800 px-5 py-4">
              <input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="Custom movement"
                className="h-11 flex-1 rounded-xl border border-neutral-800 bg-neutral-900 px-3 text-sm outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => addExercise(customName)}
                className="rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthChange={setIsSignedIn}
      />
    </section>
  );
}
