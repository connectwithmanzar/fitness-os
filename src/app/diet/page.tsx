"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Trash2, Utensils } from "lucide-react";
import { AccountButton, AuthModal } from "@/components/AuthModal";
import { PageSkeleton } from "@/components/PageSkeleton";
import { parseMealScanResult } from "@/lib/diet-parse";
import {
  createMealId,
  isSameLocalDay,
  loadLocalMealLogs,
  localDayKey,
  removeLocalMealLog,
  upsertLocalMealLogs,
} from "@/lib/diet-storage";
import {
  deleteRemoteMealLog,
  fetchRemoteMealLogs,
  insertRemoteMealLog,
} from "@/lib/diet-sync";
import { DAILY_MACRO_TARGETS, fiberFromEntry } from "@/lib/diet-types";
import type { DailyMacroTargets, DietEntry, MealLog, MealScanResult } from "@/lib/diet-types";
import { loadDietTargets, persistDietTargets } from "@/lib/diet-targets";
import { getSupabase } from "@/lib/supabaseClient";
import { useReloadLocalFitnessData } from "@/hooks/useReloadLocalFitnessData";

const SHORTCUTS = [
  "+ 1 Katori Dal",
  "+ 2 Roti",
  "+ 100g Paneer",
  "+ 250ml Milk",
  "+ 200g Chicken",
] as const;

function appendShortcut(current: string, chip: string): string {
  const addition = chip.replace(/^\+\s*/, "");
  const trimmed = current.trim();
  if (trimmed.length === 0) {
    return addition;
  }
  if (trimmed.endsWith(",")) {
    return `${trimmed} ${addition}`;
  }
  return `${trimmed}, ${addition}`;
}

function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function todaysMealLogs(todayKey: string): MealLog[] {
  return loadLocalMealLogs()
    .filter((log) => isSameLocalDay(log.logged_at, todayKey))
    .sort((left, right) => right.logged_at.localeCompare(left.logged_at));
}

function startOfLocalDayIso(date: Date): string {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function DietPage() {
  const [query, setQuery] = useState("");
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [targets, setTargets] = useState<DailyMacroTargets>(DAILY_MACRO_TARGETS);
  const [draftTargets, setDraftTargets] = useState<DailyMacroTargets>(DAILY_MACRO_TARGETS);
  const [editingTargets, setEditingTargets] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const todayKey = localDayKey(new Date());
  const dataTick = useReloadLocalFitnessData();
  const editingTargetsRef = useRef(editingTargets);
  editingTargetsRef.current = editingTargets;

  useEffect(() => {
    const bootstrap = async () => {
      const local = todaysMealLogs(todayKey);
      const remote = await fetchRemoteMealLogs(startOfLocalDayIso(new Date()));
      const merged = new Map<string, MealLog>();
      for (const log of local) {
        merged.set(log.id, log);
      }
      if (remote) {
        for (const log of remote) {
          merged.set(log.id, log);
        }
      }
      const todayMerged = Array.from(merged.values()).sort((a, b) =>
        b.logged_at.localeCompare(a.logged_at)
      );
      if (todayMerged.length > 0) {
        upsertLocalMealLogs(todayMerged);
      }
      setLogs(todaysMealLogs(todayKey));
      if (!editingTargetsRef.current) {
        const savedTargets = loadDietTargets();
        setTargets(savedTargets);
        setDraftTargets(savedTargets);
      }
      setHydrated(true);
    };

    void bootstrap();
  }, [todayKey]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    setLogs(todaysMealLogs(todayKey));
    if (!editingTargetsRef.current) {
      const savedTargets = loadDietTargets();
      setTargets(savedTargets);
      setDraftTargets(savedTargets);
    }
  }, [dataTick, hydrated, todayKey]);

  useEffect(() => {
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
    if (!banner) {
      return;
    }
    const timeout = window.setTimeout(() => setBanner(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [banner]);

  const totals = useMemo(
    () =>
      logs.reduce(
        (acc, log) => ({
          calories: acc.calories + log.calories,
          protein_g: acc.protein_g + log.protein_g,
          carbs_g: acc.carbs_g + log.carbs_g,
          fats_g: acc.fats_g + log.fats_g,
          fiber_g: acc.fiber_g + fiberFromEntry(log),
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0, fiber_g: 0 }
      ),
    [logs]
  );

  const saveTargets = () => {
    const next = {
      calories: Math.max(1, Number(draftTargets.calories) || DAILY_MACRO_TARGETS.calories),
      protein_g: Math.max(1, Number(draftTargets.protein_g) || DAILY_MACRO_TARGETS.protein_g),
      carbs_g: Math.max(1, Number(draftTargets.carbs_g) || DAILY_MACRO_TARGETS.carbs_g),
      fats_g: Math.max(1, Number(draftTargets.fats_g) || DAILY_MACRO_TARGETS.fats_g),
      fiber_g: Math.max(1, Number(draftTargets.fiber_g) || DAILY_MACRO_TARGETS.fiber_g),
    };
    setTargets(next);
    persistDietTargets(next);
    setEditingTargets(false);
  };

  const logMeal = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/diet/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      const payload = await readJsonBody(response);
      let scanned: MealScanResult | null = null;
      try {
        scanned = parseMealScanResult(payload, trimmed);
      } catch {
        scanned = null;
      }

      if (!scanned) {
        setError("Could not read that meal. Try a shorter description.");
        return;
      }

      const nextLog: MealLog = {
        ...scanned,
        id: createMealId(),
        query: trimmed,
        logged_at: new Date().toISOString(),
      };

      upsertLocalMealLogs([nextLog]);
      setLogs(todaysMealLogs(todayKey));
      setQuery("");

      let synced = false;
      try {
        synced = await insertRemoteMealLog(nextLog);
      } catch {
        synced = false;
      }
      setBanner(synced ? "Meal saved · Synced" : "Meal saved · Saved on this phone");
    } catch {
      setError("Could not log that meal. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [loading, query, todayKey]);

  const removeLog = useCallback(async (id: string) => {
    removeLocalMealLog(id);
    setLogs(todaysMealLogs(todayKey));
    if (expandedId === id) {
      setExpandedId(null);
    }
    try {
      await deleteRemoteMealLog(id);
    } catch {
      // Keep the local delete even if remote delete is unavailable.
    }
  }, [expandedId, todayKey]);

  if (!hydrated) {
    return <PageSkeleton />;
  }

  return (
    <section className="mx-auto min-h-screen max-w-md bg-neutral-950 px-4 pb-36 text-neutral-50">
      <header className="sticky top-0 z-40 -mx-4 mb-1 flex items-start justify-between gap-3 border-b border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur-md">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
            Module 2
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Utensils className="h-5 w-5 text-emerald-400" />
            <h1 className="text-2xl font-semibold tracking-tight">Diet Engine</h1>
          </div>
          <p className="mt-2 text-sm text-neutral-400">
            Text-only Indian meal logger. Katori, roti, plates, grams, and ml all work.
          </p>
        </div>
        <AccountButton signedIn={isSignedIn} onClick={() => setIsAuthOpen(true)} />
      </header>

      {banner ? (
        <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2.5 text-sm font-medium text-emerald-300">
          {banner}
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
              Daily Blueprint
            </p>
            <p className="mt-1 text-sm text-neutral-300">
              {formatNumber(targets.calories)} kcal • {formatNumber(targets.protein_g, 0)}P •{" "}
              {formatNumber(targets.carbs_g, 0)}C • {formatNumber(targets.fats_g, 0)}F •{" "}
              {formatNumber(targets.fiber_g, 0)}g fiber
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDraftTargets(targets);
              setEditingTargets((open) => !open);
            }}
            className="tap-target min-h-12 rounded-xl border border-neutral-800 px-3 text-sm font-semibold text-neutral-300 transition active:scale-95"
          >
            {editingTargets ? "Close" : "Edit"}
          </button>
        </div>

        {editingTargets ? (
          <form
            className="mt-4 grid grid-cols-2 gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              saveTargets();
            }}
          >
            {(
              [
                ["calories", "kcal"],
                ["protein_g", "Protein"],
                ["carbs_g", "Carbs"],
                ["fats_g", "Fat"],
                ["fiber_g", "Fiber"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-[11px] text-neutral-500">
                {label}
                <input
                  inputMode="decimal"
                  value={draftTargets[key]}
                  onChange={(event) =>
                    setDraftTargets((current) => ({
                      ...current,
                      [key]: Number(event.target.value) || 0,
                    }))
                  }
                  className="mt-1 min-h-12 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-base text-white outline-none focus:border-emerald-500"
                />
              </label>
            ))}
            <button
              type="submit"
              className="tap-target col-span-2 mt-1 min-h-12 rounded-xl bg-emerald-500 py-3.5 text-sm font-semibold text-black transition active:scale-95"
            >
              Save targets
            </button>
          </form>
        ) : null}

        <div className="mt-4 flex flex-col gap-3">
          {(
            [
              { label: "Calories", consumed: totals.calories, target: targets.calories, unit: "kcal" },
              { label: "Protein", consumed: totals.protein_g, target: targets.protein_g, unit: "g" },
              { label: "Carbs", consumed: totals.carbs_g, target: targets.carbs_g, unit: "g" },
              { label: "Fat", consumed: totals.fats_g, target: targets.fats_g, unit: "g" },
              { label: "Fiber", consumed: totals.fiber_g, target: targets.fiber_g, unit: "g" },
            ] as const
          ).map((row) => {
            const percent = row.target > 0 ? Math.min(100, Math.round((row.consumed / row.target) * 100)) : 0;
            const barTone =
              percent >= 80 ? "bg-emerald-500" : percent >= 40 ? "bg-amber-400" : "bg-red-500";
            return (
              <div key={row.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-300">{row.label}</span>
                  <span className="font-mono text-neutral-400">
                    {formatNumber(row.consumed, row.unit === "kcal" ? 0 : 1)} /{" "}
                    {formatNumber(row.target)} {row.unit} • {percent}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className={`h-full rounded-full ${barTone}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
        <label htmlFor="meal-query" className="text-sm font-medium text-neutral-200">
          What did you eat?
        </label>
        <textarea
          id="meal-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={4}
          placeholder="e.g., 250g paneer bhurji, 2 roti, and 1 katori dal or 300ml whole milk..."
          className="mt-3 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-3 text-base text-neutral-50 outline-none transition placeholder:text-neutral-600 focus:border-emerald-500"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {SHORTCUTS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setQuery((current) => appendShortcut(current, chip))}
              className="tap-target min-h-12 rounded-full border border-neutral-700 bg-neutral-950 px-3 text-sm font-medium text-neutral-300 transition hover:border-emerald-500 hover:text-emerald-300 active:scale-95"
            >
              {chip}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            void logMeal();
          }}
          disabled={loading || query.trim().length === 0}
          className="tap-target mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-semibold text-neutral-950 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculating nutritional values...
            </>
          ) : (
            "Log Meal"
          )}
        </button>
        {error ? <p className="mt-3 text-xs text-amber-400">{error}</p> : null}
      </div>

      <section className="mt-7">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">Today&apos;s meals</h2>
          <p className="text-xs text-neutral-500">{logs.length} logged</p>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {logs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-800 px-4 py-10 text-center text-sm text-neutral-500">
              No meals yet. Log a roti, katori, or gram-based plate to start the day.
            </div>
          ) : (
            logs.map((log: DietEntry & MealLog) => {
              const expanded = expandedId === log.id;
              const fiberG = fiberFromEntry(log);
              return (
                <article
                  key={log.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-50">
                        {log.meal_name}
                      </h3>
                      <p className="mt-1 text-xs text-neutral-500">
                        {log.serving_inferred}
                      </p>
                      {log.source ? (
                        <span
                          className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            log.source === "gemini"
                              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border border-amber-400/30 bg-amber-400/10 text-amber-300"
                          }`}
                        >
                          {log.source === "gemini" ? "Gemini" : "Estimate"}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                        {formatNumber(log.calories)} kcal
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void removeLog(log.id);
                        }}
                        className="tap-target rounded-lg p-3 text-neutral-500 transition hover:bg-neutral-800 hover:text-red-400 active:scale-95"
                        aria-label={`Delete ${log.meal_name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-neutral-800 px-2.5 py-1 text-neutral-300">
                      P: {formatNumber(log.protein_g, 1)}g
                    </span>
                    <span className="rounded-full border border-neutral-800 px-2.5 py-1 text-neutral-300">
                      C: {formatNumber(log.carbs_g, 1)}g
                    </span>
                    <span className="rounded-full border border-neutral-800 px-2.5 py-1 text-neutral-300">
                      F: {formatNumber(log.fats_g, 1)}g
                    </span>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                      Fiber: {formatNumber(fiberG, 0)}g
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(expanded ? null : log.id)
                    }
                    className="mt-3 flex w-full items-center justify-between text-left text-xs font-medium text-neutral-400 transition hover:text-neutral-200 active:scale-95"
                    aria-expanded={expanded}
                  >
                    Micronutrients
                    <ChevronDown
                      className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`}
                    />
                  </button>

                  {expanded ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-neutral-800 bg-neutral-950/70 p-3 text-xs text-neutral-300">
                      <p>Iron: {formatNumber(log.micronutrients.iron_mg, 1)} mg</p>
                      <p>Zinc: {formatNumber(log.micronutrients.zinc_mg, 1)} mg</p>
                      <p>
                        Magnesium: {formatNumber(log.micronutrients.magnesium_mg, 1)} mg
                      </p>
                      <p>
                        Calcium: {formatNumber(log.micronutrients.calcium_mg, 1)} mg
                      </p>
                      <p>
                        Vitamin D: {formatNumber(log.micronutrients.vitamin_d_iu, 1)} IU
                      </p>
                      <p>
                        B12: {formatNumber(log.micronutrients.vitamin_b12_mcg, 2)} mcg
                      </p>
                      {log.breakdown_summary ? (
                        <p className="col-span-2 text-neutral-500">
                          {log.breakdown_summary}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthChange={setIsSignedIn}
      />
    </section>
  );
}
