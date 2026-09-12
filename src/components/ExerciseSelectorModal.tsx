"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { ExerciseThumb } from "@/components/ExerciseThumb";
import {
  EQUIPMENT_TYPES,
  MUSCLE_GROUPS,
  filterExerciseDatabase,
  type EquipmentType,
  type LibraryExercise,
  type MuscleGroup,
} from "@/lib/exerciseDatabase";

type MuscleFilter = "All" | MuscleGroup;
type EquipmentFilter = "All" | EquipmentType;

type ExerciseSelectorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exercise: LibraryExercise) => void;
};

function PillRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                : "border-neutral-800 bg-neutral-900 text-neutral-400"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function ExerciseSelectorModal({
  isOpen,
  onClose,
  onSelect,
}: ExerciseSelectorModalProps) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<MuscleFilter>("All");
  const [equipment, setEquipment] = useState<EquipmentFilter>("All");
  const [detail, setDetail] = useState<LibraryExercise | null>(null);
  const [customName, setCustomName] = useState("");

  const results = useMemo(
    () => filterExerciseDatabase(query, muscle, equipment),
    [equipment, muscle, query]
  );

  if (!isOpen) {
    return null;
  }

  const resetAndClose = () => {
    setQuery("");
    setMuscle("All");
    setEquipment("All");
    setDetail(null);
    setCustomName("");
    onClose();
  };

  const addExercise = (exercise: LibraryExercise) => {
    onSelect(exercise);
    resetAndClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center overflow-x-hidden bg-black/80 backdrop-blur-sm sm:items-center"
      onClick={resetAndClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-library-title"
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-neutral-800 bg-neutral-950 pb-[env(safe-area-inset-bottom)] sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 id="exercise-library-title" className="text-lg font-semibold text-white">
            Exercise Library
          </h2>
          <button type="button" onClick={resetAndClose} aria-label="Close exercise library">
            <X className="h-5 w-5 text-neutral-400" />
          </button>
        </div>

        <div className="space-y-3 px-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search exercises..."
              className="h-12 w-full rounded-xl border border-neutral-800 bg-neutral-900 pl-10 pr-3 text-sm text-white outline-none focus:border-emerald-500"
            />
          </label>
          <PillRow
            options={["All", ...MUSCLE_GROUPS] as const}
            value={muscle}
            onChange={setMuscle}
          />
          <PillRow
            options={["All", ...EQUIPMENT_TYPES] as const}
            value={equipment}
            onChange={setEquipment}
          />
        </div>

        <ul className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
          {results.length === 0 ? (
            <li className="py-10 text-center text-sm text-neutral-500">No matches. Try another filter.</li>
          ) : (
            results.map((exercise) => (
              <li key={exercise.id} className="border-b border-neutral-900">
                <button
                  type="button"
                  onClick={() => setDetail(exercise)}
                  className="flex w-full items-center gap-3 py-3 text-left active:scale-[0.99]"
                >
                  <ExerciseThumb
                    name={exercise.name}
                    muscle={exercise.muscle}
                    gifUrl={exercise.gifUrl}
                    stillUrl={exercise.stillUrl}
                    className="h-[52px] w-[52px] shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{exercise.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                        {exercise.muscle}
                      </span>
                      <span className="rounded-full border border-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                        {exercise.equipment}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="flex gap-2 border-t border-neutral-800 px-5 py-4">
          <input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            placeholder="Custom movement"
            className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-800 bg-neutral-900 px-3 text-sm text-white outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => {
              const trimmed = customName.trim();
              if (!trimmed) {
                return;
              }
              addExercise({
                id: `custom-${trimmed.toLowerCase()}`,
                name: trimmed,
                muscle: "Core",
                equipment: "Bodyweight",
                gifUrl: "",
                stillUrl: "",
                instructions: ["Log load and reps honestly", "Keep form tight"],
                defaultSets: 3,
              });
            }}
            className="shrink-0 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black"
          >
            Add
          </button>
        </div>
      </div>

      {detail ? (
        <div
          className="absolute inset-0 z-[80] flex items-end justify-center bg-black/70 sm:items-center"
          onClick={(event) => {
            event.stopPropagation();
            setDetail(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exercise-detail-title"
            className="w-full max-w-md overflow-hidden rounded-t-3xl border border-neutral-800 bg-neutral-950 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="exercise-detail-title" className="text-lg font-semibold text-white">
                {detail.name}
              </h3>
              <button type="button" onClick={() => setDetail(null)} aria-label="Close detail">
                <X className="h-5 w-5 text-neutral-400" />
              </button>
            </div>
            <ExerciseThumb
              key={detail.id}
              name={detail.name}
              muscle={detail.muscle}
              gifUrl={detail.gifUrl}
              stillUrl={detail.stillUrl}
              eager
              className="mt-4 h-52 w-full rounded-2xl object-contain"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                {detail.muscle}
              </span>
              <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-300">
                {detail.equipment}
              </span>
            </div>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-neutral-300">
              {detail.instructions.slice(0, 3).map((cue) => (
                <li key={cue}>{cue}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => addExercise(detail)}
              className="mt-5 w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-semibold text-black transition active:scale-98"
            >
              Add to Routine
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
