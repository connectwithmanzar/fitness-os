"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, Trash2, X } from "lucide-react";
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

type CatalogExercise = {
  name: string;
  group: MuscleGroup;
};

const FILTERS: ExerciseFilter[] = [
  "All",
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
];

const CATALOG: CatalogExercise[] = [
  { name: "Barbell Bench Press", group: "Chest" },
  { name: "Incline Dumbbell Press", group: "Chest" },
  { name: "Cable Flyes", group: "Chest" },
  { name: "Dips", group: "Chest" },
  { name: "Push-ups", group: "Chest" },
  { name: "Lat Pulldown", group: "Back" },
  { name: "Barbell Row", group: "Back" },
  { name: "Pull-ups", group: "Back" },
  { name: "Seated Cable Row", group: "Back" },
  { name: "Barbell Deadlift", group: "Back" },
  { name: "Squat", group: "Legs" },
  { name: "Leg Press", group: "Legs" },
  { name: "Romanian Deadlift", group: "Legs" },
  { name: "Leg Extension", group: "Legs" },
  { name: "Hamstring Curl", group: "Legs" },
  { name: "Overhead Press", group: "Shoulders" },
  { name: "Dumbbell Lateral Raise", group: "Shoulders" },
  { name: "Face Pulls", group: "Shoulders" },
  { name: "Arnold Press", group: "Shoulders" },
  { name: "Bicep Curls", group: "Arms" },
  { name: "Hammer Curl", group: "Arms" },
  { name: "Tricep Rope Pushdown", group: "Arms" },
  { name: "Skull Crushers", group: "Arms" },
];

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSet(setNumber: number): WorkoutSet {
  return {
    id: createId(),
    setNumber,
    weightKg: "",
    reps: "",
    completed: false,
  };
}

function createExercise(name: string): WorkoutExercise {
  return {
    id: createId(),
    name,
    sets: [createSet(1)],
  };
}

function createSession(): ActiveWorkoutSession {
  return {
    id: createId(),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exercises: [],
  };
}

function isSession(value: unknown): value is ActiveWorkoutSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as ActiveWorkoutSession;
  return typeof record.id === "string" && Array.isArray(record.exercises);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
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
  const [session, setSession] = useState<ActiveWorkoutSession>(createSession);
  const [hydrated, setHydrated] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ExerciseFilter>("All");
  const [customName, setCustomName] = useState("");
  const [history, setHistory] = useState<CompletedWorkout[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isSession(parsed) && !parsed.finishedAt) {
          setSession(parsed);
        }
      }
    } catch {
      // Keep a fresh session if storage is corrupt.
    }
    setHistory(loadWorkoutHistory());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [hydrated, session]);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isModalOpen]);

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
      const matchesQuery =
        query.length === 0 || exercise.name.toLowerCase().includes(query);
      return matchesGroup && matchesQuery;
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
    setSession((current) => ({
      ...current,
      exercises: [...current.exercises, createExercise(trimmed)],
    }));
    closeModal();
  };

  const removeExercise = (exerciseId: string) => {
    setSession((current) => ({
      ...current,
      exercises: current.exercises.filter((exercise) => exercise.id !== exerciseId),
    }));
  };

  const addSet = (exerciseId: string) => {
    setSession((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: [...exercise.sets, createSet(exercise.sets.length + 1)],
            }
          : exercise
      ),
    }));
  };

  const updateSet = (
    exerciseId: string,
    setId: string,
    field: "weightKg" | "reps",
    value: string
  ) => {
    setSession((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.id === setId && !set.completed ? { ...set, [field]: value } : set
              ),
            }
          : exercise
      ),
    }));
  };

  const toggleSet = (exerciseId: string, setId: string) => {
    setSession((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.id === setId ? { ...set, completed: !set.completed } : set
              ),
            }
          : exercise
      ),
    }));
  };

  const finishSession = async () => {
    const hasExercise = session.exercises.length > 0;
    const hasSet = session.exercises.some((exercise) => exercise.sets.length > 0);
    if (!hasExercise && !hasSet) {
      setFinishError("Add at least one exercise or set before finishing.");
      return;
    }

    const completedAt = new Date().toISOString();
    const completed: CompletedWorkout = {
      id: createId(),
      name: sessionName(session.exercises),
      completedAt,
      exercises: session.exercises,
    };

    const nextHistory = appendWorkoutHistory(completed);
    setHistory(nextHistory);
    window.localStorage.setItem("last_completed_workout", completedAt);

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
      // Local history is already saved if cloud sync is unavailable.
    }

    window.localStorage.removeItem(STORAGE_KEY);
    setSession(createSession());
    setFinishError(null);
    setBanner("Workout Saved to History!");
    closeModal();
  };

  return (
    <section className="mx-auto min-h-screen max-w-md bg-neutral-950 px-4 pb-36 pt-6 font-sans text-neutral-50">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
            {formatDate(new Date())}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Workout</h1>
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
              ACTIVE WORKOUT
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void finishSession();
          }}
          className="rounded-xl bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-black transition active:scale-98"
        >
          Finish Session
        </button>
      </header>

      {banner ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2.5 text-sm font-medium text-emerald-300"
        >
          {banner}
        </div>
      ) : null}
      {finishError ? (
        <p className="mt-3 text-xs text-amber-400">{finishError}</p>
      ) : null}

      <div className="mt-6">
        {session.exercises.length === 0 ? (
          <div className="mb-4 rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4 text-center">
            <p className="text-sm font-medium text-neutral-200">
              No exercises yet. Tap below to add a movement.
            </p>
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
                  onClick={() => removeExercise(exercise.id)}
                  className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-red-400 active:scale-98"
                  aria-label={`Remove ${exercise.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-[2rem_minmax(3rem,1fr)_1fr_1fr_2.25rem] gap-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
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
                    <span className="text-center font-mono text-xs text-neutral-500">
                      —
                    </span>
                    <input
                      inputMode="decimal"
                      value={set.weightKg}
                      readOnly={set.completed}
                      onChange={(event) =>
                        updateSet(exercise.id, set.id, "weightKg", event.target.value)
                      }
                      placeholder="0"
                      className="h-11 rounded-xl border border-neutral-800 bg-neutral-900 text-center font-mono text-sm text-neutral-50 outline-none transition focus:border-emerald-500"
                      aria-label={`${exercise.name} set ${set.setNumber} kg`}
                    />
                    <input
                      inputMode="numeric"
                      value={set.reps}
                      readOnly={set.completed}
                      onChange={(event) =>
                        updateSet(exercise.id, set.id, "reps", event.target.value)
                      }
                      placeholder="0"
                      className="h-11 rounded-xl border border-neutral-800 bg-neutral-900 text-center font-mono text-sm text-neutral-50 outline-none transition focus:border-emerald-500"
                      aria-label={`${exercise.name} set ${set.setNumber} reps`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleSet(exercise.id, set.id)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-98 ${
                        set.completed
                          ? "border-emerald-500 bg-emerald-500 text-black"
                          : "border-neutral-700 bg-neutral-950 text-neutral-500"
                      }`}
                      aria-pressed={set.completed}
                      aria-label={`Complete set ${set.setNumber}`}
                    >
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => addSet(exercise.id)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-800 py-2.5 text-sm font-medium text-neutral-300 transition hover:text-neutral-100 active:scale-98"
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

      <section className="mt-2 pb-6">
        <h2 className="text-lg font-semibold">Past Workouts</h2>
        {history.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/40 px-4 py-8 text-center text-sm text-neutral-500">
            No completed workouts yet. Finish a session above to see your history
            here.
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {history.map((entry) => {
              const setsDone = completedSetCount(entry);
              const volume = Math.round(totalVolumeKg(entry));
              return (
                <article
                  key={entry.id}
                  className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-neutral-500">
                        {formatHistoryTimestamp(entry.completedAt)}
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-neutral-50">
                        {entry.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                        {setsDone} sets
                        {volume > 0 ? ` • ${volume}kg` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => setHistory(removeWorkoutHistory(entry.id))}
                        className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-red-400 active:scale-98"
                        aria-label={`Delete ${entry.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.exercises.map((exercise) => (
                      <span
                        key={exercise.id}
                        className="rounded-full border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-[11px] text-neutral-300"
                      >
                        {exercise.name}: {topSetLabel(exercise)}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exercise-modal-title"
            className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-3xl border border-neutral-800 bg-neutral-950 shadow-2xl sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <h2 id="exercise-modal-title" className="text-lg font-semibold">
                Add Exercise
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-2 text-neutral-400 transition hover:text-neutral-100 active:scale-98"
                aria-label="Close exercise selector"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search exercises..."
                  className="h-12 w-full rounded-xl border border-neutral-800 bg-neutral-900 pl-10 pr-3 text-sm text-neutral-50 outline-none transition focus:border-emerald-500"
                  autoFocus
                />
              </label>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-98 ${
                      activeFilter === filter
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                        : "border-neutral-800 bg-neutral-900 text-neutral-400"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <ul className="mt-3 min-h-0 flex-1 overflow-y-auto px-5">
              {visibleExercises.map((exercise) => (
                <li
                  key={`${exercise.group}-${exercise.name}`}
                  className="border-b border-neutral-900 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => addExercise(exercise.name)}
                    className="flex w-full items-center justify-between py-3.5 text-left text-sm font-medium text-neutral-200 transition hover:text-emerald-400 active:scale-98"
                  >
                    <span>
                      {exercise.name}
                      <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-neutral-500">
                        {exercise.group}
                      </span>
                    </span>
                    <Plus className="h-4 w-4 text-neutral-500" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="border-t border-neutral-800 px-5 pb-6 pt-3">
              <div className="flex gap-2">
                <input
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      addExercise(customName);
                    }
                  }}
                  placeholder="Custom movement"
                  className="h-11 flex-1 rounded-xl border border-neutral-800 bg-neutral-900 px-3 text-sm text-neutral-50 outline-none transition focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => addExercise(customName)}
                  className="rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black transition active:scale-98"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
