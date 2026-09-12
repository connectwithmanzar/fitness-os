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
            className={`tap-target min-h-12 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition active:scale-95 ${
              active
                ? "border-accent bg-accent/12 text-accent"
                : "border-line bg-raised text-mute"
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
      className="fixed inset-0 z-[70] flex items-end justify-center overflow-x-hidden bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={resetAndClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-library-title"
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-[1.75rem] border border-line bg-raised pb-[env(safe-area-inset-bottom)] sm:rounded-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 id="exercise-library-title" className="font-display text-lg font-semibold text-ink">
            Exercise Library
          </h2>
          <button
            type="button"
            onClick={resetAndClose}
            className="tap-target flex h-12 w-12 items-center justify-center rounded-full text-mute"
            aria-label="Close exercise library"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search exercises..."
              className="input-field pl-10"
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
            <li className="py-10 text-center text-sm text-mute">No matches. Try another filter.</li>
          ) : (
            results.map((exercise) => (
              <li key={exercise.id} className="border-b border-line">
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
                    <p className="truncate text-sm font-semibold text-ink">{exercise.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="chip">
                        {exercise.muscle}
                      </span>
                      <span className="chip">
                        {exercise.equipment}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="flex gap-2 border-t border-line px-5 py-4">
          <input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            placeholder="Custom movement"
            className="input-field min-w-0 flex-1"
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
            className="btn-primary w-auto shrink-0 px-4"
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
            className="w-full max-w-md overflow-hidden rounded-t-[1.75rem] border border-line bg-raised p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="exercise-detail-title" className="font-display text-lg font-semibold text-ink">
                {detail.name}
              </h3>
              <button type="button" onClick={() => setDetail(null)} aria-label="Close detail">
                <X className="h-5 w-5 text-mute" />
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
              <span className="chip-accent">
                {detail.muscle}
              </span>
              <span className="chip">
                {detail.equipment}
              </span>
            </div>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-mute">
              {detail.instructions.slice(0, 3).map((cue) => (
                <li key={cue}>{cue}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => addExercise(detail)}
              className="btn-primary mt-5"
            >
              Add to Routine
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
