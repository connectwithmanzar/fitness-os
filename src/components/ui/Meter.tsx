type MeterProps = {
  value: number;
  tone?: "ok" | "mid" | "low";
};

export function meterTone(percent: number): MeterProps["tone"] {
  if (percent >= 80) {
    return "ok";
  }
  if (percent >= 40) {
    return "mid";
  }
  return "low";
}

export function Meter({ value, tone = "ok" }: MeterProps) {
  const fill =
    tone === "low" ? "bg-danger" : tone === "mid" ? "bg-warn" : "bg-accent";
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
      <div
        className={`h-full rounded-full transition-all ${fill}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
