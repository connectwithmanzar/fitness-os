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
            className={`chip lg ${active ? "acc" : ""}`}
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
    <div className="sheet-back" onClick={resetAndClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-library-title"
        className="sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grab" />
        <div className="mb-3 flex items-center justify-between">
          <h3 id="exercise-library-title">Exercise library</h3>
          <button
            type="button"
            onClick={resetAndClose}
            className="iconbtn"
            aria-label="Close exercise library"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--label-3)" }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search exercises..."
              className="field"
              style={{ paddingLeft: 40 }}
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

        <div className="sect-b mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {results.length === 0 ? (
            <p className="empty">No matches. Try another filter.</p>
          ) : (
            results.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => setDetail(exercise)}
                className="lrow tap"
              >
                <ExerciseThumb
                  name={exercise.name}
                  muscle={exercise.muscle}
                  gifUrl={exercise.gifUrl}
                  stillUrl={exercise.stillUrl}
                  className="h-[44px] w-[44px] shrink-0 rounded-[9px] object-cover"
                />
                <span className="lrow-m">
                  <span className="lrow-t truncate">{exercise.name}</span>
                  <span className="lrow-s">
                    {exercise.muscle} · {exercise.equipment}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            placeholder="Custom movement"
            className="field"
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
            className="btn primary sm"
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
            className="sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="exercise-detail-title">{detail.name}</h3>
              <button type="button" className="iconbtn" onClick={() => setDetail(null)} aria-label="Close detail">
                <X className="h-4 w-4" />
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
              <span className="chip acc">
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
              className="btn primary"
              style={{ marginTop: 16 }}
            >
              Add to Routine
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
