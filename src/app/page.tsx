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
  deleteCustomSplit,
  exercisesForSplit,
  loadCustomSplits,
  renameCustomSplit,
  saveCustomSplit,
  WORKOUT_SPLITS,
  type WorkoutSplit,
} from "@/lib/workout-splits";
import { useReloadLocalFitnessData } from "@/hooks/useReloadLocalFitnessData";
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
import { notifyFitnessDataChanged, notifyWorkoutSessionChanged } from "@/lib/fitness-events";
import { InstallAppHint } from "@/components/InstallAppHint";
import { PageSkeleton } from "@/components/PageSkeleton";
import { AppBanner } from "@/components/ui/AppBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stepper } from "@/components/ui/Stepper";

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

type PendingPlan = {
  title: string;
  exerciseIds: string[];
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

function liftIdsFromExercises(exercises: WorkoutExercise[]): string[] {
  return exercises.map(
    (exercise) => findExerciseByName(exercise.name)?.id ?? exercise.name
  );
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

function overloadHint(
  exerciseName: string,
  history: CompletedWorkout[]
): string | null {
  const sessions = history
    .filter((workout) =>
      workout.exercises.some((exercise) => exercise.name === exerciseName)
    )
    .slice(0, 2);
  if (sessions.length < 2) {
    return null;
  }

  const older = sessions[1];
  const olderExercise = older.exercises.find((exercise) => exercise.name === exerciseName);
  const olderCompleted = olderExercise?.sets.filter((set) => set.completed) ?? [];
  const targets = olderCompleted
    .map((set) => Number(set.reps))
    .filter((reps) => Number.isFinite(reps) && reps > 0);
  if (targets.length === 0) {
    return null;
  }
  const targetReps = Math.min(...targets);

  const hitAll = sessions.every((workout) => {
    const exercise = workout.exercises.find((item) => item.name === exerciseName);
    const completed = exercise?.sets.filter((set) => set.completed) ?? [];
    return (
      completed.length >= olderCompleted.length &&
      completed.every((set) => {
        const reps = Number(set.reps);
        return Number.isFinite(reps) && reps >= targetReps;
      })
    );
  });

  return hitAll ? "+2.5 kg next time" : null;
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
  const [customSplits, setCustomSplits] = useState<WorkoutSplit[]>([]);
  const [splitName, setSplitName] = useState("");
  const [suggestedSplitId, setSuggestedSplitId] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null);
  const dataTick = useReloadLocalFitnessData();

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
    setCustomSplits(loadCustomSplits());
    const suggest = new URLSearchParams(window.location.search).get("suggest");
    if (suggest) {
      setSuggestedSplitId(suggest);
      const match = [...loadCustomSplits(), ...WORKOUT_SPLITS].find(
        (split) => split.id === suggest
      );
      if (match) {
        setBanner(`Today's plan: ${match.title}`);
      }
    }
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
    setCustomSplits(loadCustomSplits());
  }, [dataTick, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (!session) {
      window.localStorage.removeItem(STORAGE_KEY);
      notifyWorkoutSessionChanged();
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    notifyWorkoutSessionChanged();
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

  useEffect(() => {
    const app = document.getElementById("app");
    if (!app) {
      return;
    }
    app.classList.toggle("resting", restRemaining !== null);
    return () => {
      app.classList.remove("resting");
    };
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
    setPendingPlan(null);
    setSplitName("");
  };

  const savePlan = (title: string, exerciseIds: string[]) => {
    const trimmed = title.trim() || "My plan";
    if (exerciseIds.length === 0) {
      setBanner("Add at least one lift before saving a plan");
      return;
    }
    setCustomSplits(
      saveCustomSplit({
        id: createId(),
        title: trimmed,
        detail: `${exerciseIds.length} lifts`,
        exerciseIds,
        custom: true,
      })
    );
    setSplitName("");
    setPendingPlan(null);
    setBanner("Plan saved on this phone");
  };

  const renamePlan = (split: WorkoutSplit) => {
    const next = window.prompt("Rename plan", split.title);
    if (next === null) {
      return;
    }
    const trimmed = next.trim();
    if (trimmed.length === 0 || trimmed === split.title) {
      return;
    }
    setCustomSplits(renameCustomSplit(split.id, trimmed));
    setBanner("Plan renamed");
  };

  const removePlan = (split: WorkoutSplit) => {
    if (!window.confirm(`Delete "${split.title}"? This only removes it from this phone.`)) {
      return;
    }
    setCustomSplits(deleteCustomSplit(split.id));
    setBanner("Plan deleted");
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
      splitId: session.splitId,
    };
    setHistory(appendWorkoutHistory(completed));
    persistLastCompletedWorkout(completedAt);
    notifyFitnessDataChanged();
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
    setPendingPlan({
      title: completed.name,
      exerciseIds: liftIdsFromExercises(validExercises),
    });
    setSplitName(completed.name);
    setBanner(synced ? "Workout saved + synced" : "Workout saved locally");
  };

  if (!hydrated) {
    return <PageSkeleton />;
  }

  const canFinish = session ? validSetCount(session.exercises) > 0 : false;
  const setCount = session
    ? session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
    : 0;
  const doneCount = session
    ? session.exercises.reduce(
        (sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length,
        0
      )
    : 0;
  const progressPct = setCount > 0 ? (doneCount / setCount) * 100 : 0;

  const patchSet = (
    exerciseId: string,
    setId: string,
    patch: Partial<WorkoutSet>
  ) => {
    setSession((current) =>
      current
        ? {
            ...current,
            exercises: current.exercises.map((item) =>
              item.id === exerciseId
                ? {
                    ...item,
                    sets: item.sets.map((row) =>
                      row.id === setId ? { ...row, ...patch } : row
                    ),
                  }
                : item
            ),
          }
        : current
    );
  };

  return (
    <section>
      {session ? (
        <div className="whdr stick">
          <PageHeader
            title={sessionName(session)}
            subtitle={`${doneCount}/${setCount} sets`}
            action={
              <div className="flex items-center gap-2">
                <AccountButton signedIn={isSignedIn} onClick={() => setIsAuthOpen(true)} />
                <button
                  type="button"
                  disabled={!canFinish}
                  onClick={() => {
                    void finishSession();
                  }}
                  className="btn primary sm"
                >
                  Finish
                </button>
              </div>
            }
          />
          <div className="wprog">
            <i style={{ width: `${progressPct}%` }} />
          </div>
          <div className="chips" style={{ marginBottom: 12 }}>
            {REST_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`chip ${restSeconds === preset ? "acc" : ""}`}
                onClick={() => {
                  setRestSeconds(preset);
                  if (restRemaining !== null) {
                    setRestRemaining(preset);
                  }
                }}
              >
                {preset}s rest
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <PageHeader
            title="Train"
            subtitle={new Intl.DateTimeFormat("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            }).format(new Date())}
            action={<AccountButton signedIn={isSignedIn} onClick={() => setIsAuthOpen(true)} />}
          />
          <InstallAppHint />
        </>
      )}

      {banner ? <AppBanner>{banner}</AppBanner> : null}
      {finishError ? (
        <p className="t-foot" style={{ color: "var(--orange)", marginBottom: 12 }}>
          {finishError}
        </p>
      ) : null}

      {restRemaining !== null ? (
        <div id="timer" className="rest">
          <div className="head">
            <span className="t">
              {`${Math.floor(restRemaining / 60)}:${String(restRemaining % 60).padStart(2, "0")}`}
            </span>
            <div className="bar">
              <i
                style={{
                  width: `${Math.min(100, (restRemaining / Math.max(restSeconds, 1)) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="acts">
            <button
              type="button"
              className="btn sm"
              onClick={() => setRestRemaining((current) => Math.max(0, (current ?? 0) - 15))}
            >
              −15
            </button>
            <button
              type="button"
              className="btn sm"
              onClick={() => setRestRemaining((current) => (current ?? 0) + 15)}
            >
              +15
            </button>
            <button
              type="button"
              className="btn sm skip"
              onClick={() => setRestRemaining(null)}
            >
              Skip
            </button>
          </div>
        </div>
      ) : null}

      <div>
        {!session ? (
          <div className="mb-8">
            {pendingPlan ? (
              <form
                className="card"
                onSubmit={(event) => {
                  event.preventDefault();
                  savePlan(splitName || pendingPlan.title, pendingPlan.exerciseIds);
                }}
              >
                <h2>Save this as my plan</h2>
                <p className="t-foot">
                  Keep {pendingPlan.exerciseIds.length} lifts for next time. Stored on this phone.
                </p>
                <input
                  value={splitName}
                  onChange={(event) => setSplitName(event.target.value)}
                  placeholder={pendingPlan.title}
                  className="field"
                  style={{ marginTop: 12 }}
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="submit" className="btn primary">
                    Save plan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingPlan(null);
                      setSplitName("");
                    }}
                    className="btn"
                  >
                    Not now
                  </button>
                </div>
              </form>
            ) : null}

            {customSplits.length > 0 ? (
              <section>
                <h4 className="sec">My plans</h4>
                <div className="list">
                  {customSplits.map((split) => (
                    <div
                      key={split.id}
                      className="item"
                      style={
                        suggestedSplitId === split.id
                          ? { boxShadow: "inset 0 0 0 1.5px var(--acc)" }
                          : undefined
                      }
                    >
                      <div className="grow">
                        <p className="tt">{split.title}</p>
                        <p className="ss">{split.detail}</p>
                        <span className="chip acc" style={{ marginTop: 6 }}>
                          Custom
                        </span>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => startSplit(split)}
                            className="btn primary sm"
                          >
                            Start
                          </button>
                          <button
                            type="button"
                            onClick={() => renamePlan(split)}
                            className="btn sm"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => removePlan(split)}
                            className="btn sm danger"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <h4 className="sec">Start a session</h4>
            <div className="list">
              {WORKOUT_SPLITS.map((split) => (
                <button
                  key={split.id}
                  type="button"
                  onClick={() => startSplit(split)}
                  className="item"
                  style={
                    suggestedSplitId === split.id
                      ? { boxShadow: "inset 0 0 0 1.5px var(--acc)" }
                      : undefined
                  }
                >
                  <div className="grow">
                    <p className="tt">{split.title}</p>
                    <p className="ss">{split.detail}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : session.exercises.length === 0 ? (
          <EmptyState
            title="No lifts yet"
            body="Tap below to add a movement and start logging."
          />
        ) : (
          session.exercises.map((exercise) => {
            const muscle = resolveMuscle(exercise);
            const catalog = findExerciseByName(exercise.name);
            const hint = overloadHint(exercise.name, history);
            return (
            <article key={exercise.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ExerciseThumb
                    name={exercise.name}
                    muscle={muscle}
                    gifUrl={exercise.gifUrl ?? catalog?.gifUrl ?? ""}
                    stillUrl={exercise.stillUrl ?? catalog?.stillUrl}
                    className="h-[50px] w-[50px] shrink-0 rounded-[9px] object-cover"
                  />
                  <div className="min-w-0">
                    <h2 className="tt truncate" style={{ color: "var(--label)" }}>
                      {exercise.name}
                    </h2>
                    <div className="chips" style={{ marginTop: 6 }}>
                      <span className="chip acc">{muscle}</span>
                      {exercise.equipment || catalog?.equipment ? (
                        <span className="chip">
                          {exercise.equipment ?? catalog?.equipment}
                        </span>
                      ) : null}
                      {hint ? <span className="chip">{hint}</span> : null}
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
                  className="iconbtn"
                  aria-label={`Remove ${exercise.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="sethead" style={{ marginTop: 10 }}>
                <span className="n-sp">Set</span>
                <span className="w-sp">kg</span>
                <span className="r-sp">Reps</span>
                <span className="ck-sp" />
              </div>
              {exercise.sets.map((set, setIndex) => (
                <div
                  key={set.id}
                  className={`setrow ${set.completed ? "done" : ""}`}
                >
                  <span className="n" title={previousForSet(exercise.name, setIndex, history)}>
                    {set.setNumber}
                  </span>
                  <Stepper
                    variant="w"
                    value={set.weightKg}
                    step={2.5}
                    disabled={set.completed}
                    ariaLabel={`${exercise.name} set ${set.setNumber} weight`}
                    onChange={(next) => patchSet(exercise.id, set.id, { weightKg: next })}
                  />
                  <Stepper
                    variant="r"
                    value={set.reps}
                    step={1}
                    disabled={set.completed}
                    ariaLabel={`${exercise.name} set ${set.setNumber} reps`}
                    onChange={(next) => patchSet(exercise.id, set.id, { reps: next })}
                  />
                  <button
                    type="button"
                    className={`ck ${set.completed ? "on" : ""}`}
                    onClick={() => {
                      if (set.completed) {
                        patchSet(exercise.id, set.id, { completed: false });
                        return;
                      }
                      if (!isValidLoggedSet({ ...set, completed: true })) {
                        return;
                      }
                      patchSet(exercise.id, set.id, { completed: true });
                      setRestRemaining(restSeconds);
                    }}
                    aria-label={`Mark ${exercise.name} set ${set.setNumber} complete`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
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
                className="btn ghost"
                style={{ marginTop: 8 }}
              >
                <Plus className="h-4 w-4" />
                Add set
              </button>
            </article>
            );
          })
        )}

        {session ? (
          <>
            {session.exercises.length > 0 ? (
              <form
                className="card"
                onSubmit={(event) => {
                  event.preventDefault();
                  savePlan(
                    splitName.trim() || sessionName(session),
                    liftIdsFromExercises(session.exercises)
                  );
                }}
              >
                <h2>Save this as my plan</h2>
                <div className="mt-2 flex gap-2">
                  <input
                    value={splitName}
                    onChange={(event) => setSplitName(event.target.value)}
                    placeholder="e.g. Heavy Push"
                    className="field"
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn primary sm">
                    Save
                  </button>
                </div>
              </form>
            ) : null}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="btn"
              style={{ marginBottom: 8 }}
            >
              <Plus className="h-4 w-4" />
              Add exercise
            </button>
            <button type="button" onClick={cancelWorkout} className="btn danger">
              Cancel workout
            </button>
          </>
        ) : null}
      </div>

      <section className={session ? "hidden" : undefined}>
        <h4 className="sec">Past workouts</h4>
        {history.length === 0 ? (
          <EmptyState
            title="No sessions yet"
            body="Finish a workout above and it will land here."
          />
        ) : (
          <div className="list">
            {history.map((entry) => (
              <article key={entry.id} className="item" style={{ alignItems: "flex-start" }}>
                <div className="grow">
                  <p className="ss">{formatHistoryTimestamp(entry.completedAt)}</p>
                  <p className="tt">{entry.name}</p>
                  <div className="chips" style={{ marginTop: 8 }}>
                    <span className="chip acc">
                      {completedSetCount(entry)} sets
                      {totalVolumeKg(entry) > 0 ? ` • ${Math.round(totalVolumeKg(entry))}kg` : ""}
                    </span>
                    {entry.exercises.map((exercise) => (
                      <span key={exercise.id} className="chip">
                        {exercise.name}: {topSetLabel(exercise)}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHistory(removeWorkoutHistory(entry.id))}
                  className="iconbtn"
                  aria-label={`Delete ${entry.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
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
