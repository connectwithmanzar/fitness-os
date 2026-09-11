import type { MealScanResult, Micronutrients } from "@/lib/diet-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function parseMicros(value: unknown): Micronutrients {
  const record = isRecord(value) ? value : {};
  return {
    iron_mg: asNumber(record.iron_mg),
    zinc_mg: asNumber(record.zinc_mg),
    magnesium_mg: asNumber(record.magnesium_mg),
    vitamin_d_iu: asNumber(record.vitamin_d_iu),
    calcium_mg: asNumber(record.calcium_mg),
  };
}

export function parseMealScanResult(
  value: unknown,
  fallbackQuery: string
): MealScanResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const mealName = asString(value.meal_name, fallbackQuery);
  if (mealName.length === 0) {
    return null;
  }

  return {
    meal_name: mealName,
    serving_inferred: asString(value.serving_inferred, fallbackQuery),
    calories: asNumber(value.calories),
    protein_g: asNumber(value.protein_g),
    carbs_g: asNumber(value.carbs_g),
    fats_g: asNumber(value.fats_g),
    micronutrients: parseMicros(value.micronutrients),
    breakdown_summary: asString(
      value.breakdown_summary,
      "Estimated from the logged Indian meal description."
    ),
  };
}

export function parseMealScanText(
  text: string,
  fallbackQuery: string
): MealScanResult | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return parseMealScanResult(JSON.parse(cleaned) as unknown, fallbackQuery);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) {
      return null;
    }
    try {
      return parseMealScanResult(
        JSON.parse(cleaned.slice(start, end + 1)) as unknown,
        fallbackQuery
      );
    } catch {
      return null;
    }
  }
}
