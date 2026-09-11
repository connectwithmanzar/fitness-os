"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Trash2, Utensils } from "lucide-react";
import { parseMealScanResult } from "@/lib/diet-parse";
import {
  createMealId,
  isSameLocalDay,
  loadLocalMealLogs,
  localDayKey,
  persistLocalMealLogs,
} from "@/lib/diet-storage";
import {
  deleteRemoteMealLog,
  fetchRemoteMealLogs,
  insertRemoteMealLog,
} from "@/lib/diet-sync";
import { DAILY_MACRO_TARGETS } from "@/lib/diet-types";
import type { MealLog, MealScanResult } from "@/lib/diet-types";

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

function startOfLocalDayIso(date: Date): string {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export default function DietPage() {
  const [query, setQuery] = useState("");
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const todayKey = localDayKey(new Date());

  useEffect(() => {
    const bootstrap = async () => {
      const remote = await fetchRemoteMealLogs(startOfLocalDayIso(new Date()));
      if (remote) {
        setLogs(remote);
      } else {
        setLogs(
          loadLocalMealLogs().filter((log) => isSameLocalDay(log.logged_at, todayKey))
        );
      }
      setHydrated(true);
    };

    void bootstrap();
  }, [todayKey]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    persistLocalMealLogs(logs);
  }, [hydrated, logs]);

  const totals = useMemo(
    () =>
      logs.reduce(
        (acc, log) => ({
          calories: acc.calories + log.calories,
          protein_g: acc.protein_g + log.protein_g,
          carbs_g: acc.carbs_g + log.carbs_g,
          fats_g: acc.fats_g + log.fats_g,
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 }
      ),
    [logs]
  );

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

      const payload: unknown = await response.json();
      const scanned: MealScanResult | null = parseMealScanResult(payload, trimmed);

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

      setLogs((current) => [nextLog, ...current]);
      setQuery("");

      try {
        await insertRemoteMealLog(nextLog);
      } catch {
        // Local persistence already covers unauthenticated testing.
      }
    } catch {
      setError("Meal saved locally after a network hiccup. Try again if totals look off.");
    } finally {
      setLoading(false);
    }
  }, [loading, query]);

  const removeLog = useCallback(async (id: string) => {
    setLogs((current) => current.filter((log) => log.id !== id));
    if (expandedId === id) {
      setExpandedId(null);
    }
    try {
      await deleteRemoteMealLog(id);
    } catch {
      // Keep the local delete even if remote delete is unavailable.
    }
  }, [expandedId]);

  return (
    <section className="mx-auto min-h-screen max-w-md bg-neutral-950 px-4 pb-32 pt-6 text-neutral-50">
      <header>
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
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <SummaryCard
          label="Calories"
          value={`${formatNumber(totals.calories)}`}
          unit="kcal"
          target={DAILY_MACRO_TARGETS.calories}
        />
        <SummaryCard
          label="Protein"
          value={formatNumber(totals.protein_g, 1)}
          unit="g"
          target={DAILY_MACRO_TARGETS.protein_g}
        />
        <SummaryCard
          label="Carbs"
          value={formatNumber(totals.carbs_g, 1)}
          unit="g"
          target={DAILY_MACRO_TARGETS.carbs_g}
        />
        <SummaryCard
          label="Fats"
          value={formatNumber(totals.fats_g, 1)}
          unit="g"
          target={DAILY_MACRO_TARGETS.fats_g}
        />
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
          className="mt-3 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-3 text-sm text-neutral-50 outline-none transition placeholder:text-neutral-600 focus:border-emerald-500"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {SHORTCUTS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setQuery((current) => appendShortcut(current, chip))}
              className="rounded-full border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-emerald-500 hover:text-emerald-300 active:scale-95"
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
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-neutral-950 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
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
            logs.map((log) => {
              const expanded = expandedId === log.id;
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
                        className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-red-400 active:scale-95"
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
                      <p className="col-span-2 text-neutral-500">
                        Vitamin D: {formatNumber(log.micronutrients.vitamin_d_iu, 1)} IU
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
    </section>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  target,
}: {
  label: string;
  value: string;
  unit: string;
  target: number;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight">
        {value}
        <span className="ml-1 text-xs font-medium text-neutral-500">{unit}</span>
      </p>
      <p className="mt-1 text-[11px] text-neutral-500">/ {formatNumber(target)}</p>
    </div>
  );
}
