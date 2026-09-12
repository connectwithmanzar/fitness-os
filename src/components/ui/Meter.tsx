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
  const color =
    tone === "low" ? "var(--red)" : tone === "mid" ? "var(--orange)" : "var(--acc)";
  return (
    <div className="meter">
      <i
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: color,
        }}
      />
    </div>
  );
}
