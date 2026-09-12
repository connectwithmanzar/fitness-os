"use client";

import { Minus, Plus } from "lucide-react";

type StepperProps = {
  value: string;
  onChange: (next: string) => void;
  step: number;
  disabled?: boolean;
  ariaLabel: string;
  variant?: "w" | "r";
};

export function Stepper({
  value,
  onChange,
  step,
  disabled,
  ariaLabel,
  variant = "w",
}: StepperProps) {
  const bump = (direction: 1 | -1) => {
    if (disabled) {
      return;
    }
    const current = Number(value);
    const base = Number.isFinite(current) ? current : 0;
    const next = Math.max(0, Math.round((base + direction * step) * 10) / 10);
    onChange(String(next));
  };

  return (
    <div className={`stp ${variant}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={`Decrease ${ariaLabel}`}
        onClick={() => bump(-1)}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        className="num"
        inputMode="decimal"
        value={value}
        readOnly={disabled}
        aria-label={ariaLabel}
        onChange={(event) => {
          if (!disabled) {
            onChange(event.target.value);
          }
        }}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={`Increase ${ariaLabel}`}
        onClick={() => bump(1)}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
