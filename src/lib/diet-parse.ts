import {
  EMPTY_MICRONUTRIENTS,
  toMicrosRecord,
  type MealScanResult,
  type Micronutrients,
} from "@/lib/diet-types";

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

function pickNumber(
  record: Record<string, unknown>,
  keys: string[],
  fallback = 0
): number {
  for (const key of keys) {
    if (key in record) {
      return asNumber(record[key], fallback);
    }
  }
  return fallback;
}

export function parseMicros(value: unknown, extra?: Record<string, unknown>): Micronutrients {
  const nested = isRecord(value) ? value : {};
  const source = extra ?? {};
  return {
    iron_mg: pickNumber(nested, ["iron_mg"]) || asNumber(source.iron_mg),
    calcium_mg: pickNumber(nested, ["calcium_mg"]) || asNumber(source.calcium_mg),
    magnesium_mg:
      pickNumber(nested, ["magnesium_mg"]) || asNumber(source.magnesium_mg),
    zinc_mg: pickNumber(nested, ["zinc_mg"]) || asNumber(source.zinc_mg),
    vitamin_d_iu:
      pickNumber(nested, ["vitamin_d_iu"]) || asNumber(source.vitamin_d_iu),
    vitamin_b12_mcg:
      pickNumber(nested, ["vitamin_b12_mcg"]) || asNumber(source.vitamin_b12_mcg),
  };
}

export function parseMealScanResult(
  value: unknown,
  fallbackQuery: string
): MealScanResult | null {
  try {
    if (!isRecord(value)) {
      return null;
    }

    const mealName = asString(value.meal_name, fallbackQuery);
    if (mealName.length === 0) {
      return null;
    }

    const fiber = pickNumber(value, ["fiber", "fiber_g"]);
    const micros = parseMicros(
      isRecord(value.micros) ? value.micros : value.micronutrients,
      value
    );
    const safeMicros: Micronutrients = {
      ...EMPTY_MICRONUTRIENTS,
      ...micros,
    };

    const source =
      value.source === "gemini" || value.source === "estimate"
        ? value.source
        : undefined;

    return {
      meal_name: mealName,
      serving_inferred: asString(value.serving_inferred, fallbackQuery),
      calories: asNumber(value.calories),
      protein_g: pickNumber(value, ["protein_g", "protein"]),
      carbs_g: pickNumber(value, ["carbs_g", "carbs"]),
      fats_g: pickNumber(value, ["fats_g", "fat", "fats"]),
      fiber,
      fiber_g: Number.isFinite(fiber) ? fiber : 0,
      micros: toMicrosRecord(safeMicros),
      micronutrients: safeMicros,
      breakdown_summary: asString(
        value.breakdown_summary,
        "Estimated from the logged Indian meal description."
      ),
      source,
    };
  } catch {
    return null;
  }
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
