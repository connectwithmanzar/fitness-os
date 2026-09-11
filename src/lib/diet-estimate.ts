import type { MealScanResult, Micronutrients } from "@/lib/diet-types";

type MacroEstimate = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  iron_mg: number;
  zinc_mg: number;
  magnesium_mg: number;
  vitamin_d_iu: number;
  calcium_mg: number;
};

const EMPTY_MACROS: MacroEstimate = {
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fats_g: 0,
  iron_mg: 0,
  zinc_mg: 0,
  magnesium_mg: 0,
  vitamin_d_iu: 0,
  calcium_mg: 0,
};

function scale(base: MacroEstimate, factor: number): MacroEstimate {
  return {
    calories: base.calories * factor,
    protein_g: base.protein_g * factor,
    carbs_g: base.carbs_g * factor,
    fats_g: base.fats_g * factor,
    iron_mg: base.iron_mg * factor,
    zinc_mg: base.zinc_mg * factor,
    magnesium_mg: base.magnesium_mg * factor,
    vitamin_d_iu: base.vitamin_d_iu * factor,
    calcium_mg: base.calcium_mg * factor,
  };
}

function add(left: MacroEstimate, right: MacroEstimate): MacroEstimate {
  return {
    calories: left.calories + right.calories,
    protein_g: left.protein_g + right.protein_g,
    carbs_g: left.carbs_g + right.carbs_g,
    fats_g: left.fats_g + right.fats_g,
    iron_mg: left.iron_mg + right.iron_mg,
    zinc_mg: left.zinc_mg + right.zinc_mg,
    magnesium_mg: left.magnesium_mg + right.magnesium_mg,
    vitamin_d_iu: left.vitamin_d_iu + right.vitamin_d_iu,
    calcium_mg: left.calcium_mg + right.calcium_mg,
  };
}

function matchCount(source: string, pattern: RegExp): number {
  const match = source.match(pattern);
  if (!match?.[1]) {
    return 0;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function gramsFromQuery(source: string, food: string): number {
  const pattern = new RegExp(
    `(\\d+(?:\\.\\d+)?)\\s*(kg|g|gram|grams|mg)?\\s*${food}`,
    "i"
  );
  const match = source.match(pattern);
  if (!match?.[1]) {
    return 0;
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) {
    return 0;
  }
  const unit = (match[2] ?? "g").toLowerCase();
  if (unit === "kg") {
    return amount * 1000;
  }
  if (unit === "mg") {
    return amount / 1000;
  }
  return amount;
}

function mlFromQuery(source: string, food: string): number {
  const pattern = new RegExp(
    `(\\d+(?:\\.\\d+)?)\\s*(l|ltr|liter|litre|liters|ml)?\\s*${food}`,
    "i"
  );
  const match = source.match(pattern);
  if (!match?.[1]) {
    return 0;
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) {
    return 0;
  }
  const unit = (match[2] ?? "ml").toLowerCase();
  if (unit.startsWith("l")) {
    return amount * 1000;
  }
  return amount;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function titleFromQuery(query: string): string {
  const cleaned = query.trim().replace(/\s+/g, " ");
  if (cleaned.length === 0) {
    return "Logged meal";
  }
  return cleaned.length > 48 ? `${cleaned.slice(0, 45)}...` : cleaned;
}

export function estimateIndianMeal(query: string): MealScanResult {
  const source = query.toLowerCase();
  let totals = { ...EMPTY_MACROS };
  const parts: string[] = [];

  const rotiCount = matchCount(
    source,
    /(\d+(?:\.\d+)?)\s*(?:butter|ghee)?\s*(?:roti|rotis|chapati|chapatis|phulka|phulkas)\b/
  );
  if (rotiCount > 0) {
    const isButter = /butter|ghee/.test(source);
    const roti = isButter
      ? {
          calories: 105,
          protein_g: 3,
          carbs_g: 15,
          fats_g: 3.5,
          iron_mg: 0.9,
          zinc_mg: 0.5,
          magnesium_mg: 20,
          vitamin_d_iu: 0,
          calcium_mg: 18,
        }
      : {
          calories: 75,
          protein_g: 3,
          carbs_g: 15,
          fats_g: 0.5,
          iron_mg: 0.8,
          zinc_mg: 0.4,
          magnesium_mg: 18,
          vitamin_d_iu: 0,
          calcium_mg: 15,
        };
    totals = add(totals, scale(roti, rotiCount));
    parts.push(`${rotiCount} ${isButter ? "ghee roti" : "roti"}`);
  }

  const katoriCount = matchCount(
    source,
    /(\d+(?:\.\d+)?)\s*(?:katori|katoris|bowl|bowls)\b/
  );
  if (katoriCount > 0) {
    const dal = {
      calories: 160,
      protein_g: 9,
      carbs_g: 22,
      fats_g: 4,
      iron_mg: 2.4,
      zinc_mg: 1.1,
      magnesium_mg: 48,
      vitamin_d_iu: 0,
      calcium_mg: 40,
    };
    totals = add(totals, scale(dal, katoriCount));
    parts.push(`${katoriCount} katori dal (~150g)`);
  }

  const paneerG = gramsFromQuery(source, "paneer");
  if (paneerG > 0) {
    totals = add(totals, scale({
      calories: 2.65,
      protein_g: 0.18,
      carbs_g: 0.03,
      fats_g: 0.21,
      iron_mg: 0.002,
      zinc_mg: 0.025,
      magnesium_mg: 0.2,
      vitamin_d_iu: 0,
      calcium_mg: 4.8,
    }, paneerG));
    parts.push(`${Math.round(paneerG)}g paneer`);
  }

  const chickenG = gramsFromQuery(source, "chicken");
  if (chickenG > 0) {
    totals = add(totals, scale({
      calories: 1.65,
      protein_g: 0.31,
      carbs_g: 0,
      fats_g: 0.036,
      iron_mg: 0.009,
      zinc_mg: 0.01,
      magnesium_mg: 0.28,
      vitamin_d_iu: 0.02,
      calcium_mg: 0.11,
    }, chickenG));
    parts.push(`${Math.round(chickenG)}g chicken`);
  }

  const milkMl = mlFromQuery(source, "milk");
  if (milkMl > 0) {
    totals = add(totals, scale({
      calories: 0.64,
      protein_g: 0.033,
      carbs_g: 0.048,
      fats_g: 0.035,
      iron_mg: 0.0003,
      zinc_mg: 0.004,
      magnesium_mg: 0.11,
      vitamin_d_iu: 0.4,
      calcium_mg: 1.13,
    }, milkMl));
    parts.push(`${Math.round(milkMl)}ml milk`);
  }

  const riceG = gramsFromQuery(source, "(?:rice|biryani|pulao)");
  const plateRice = matchCount(source, /(\d+(?:\.\d+)?)\s*(?:plate|plates)\s*(?:of\s+)?(?:rice|biryani|pulao)/);
  const riceTotal = riceG + plateRice * 350;
  if (riceTotal > 0) {
    totals = add(totals, scale({
      calories: 1.3,
      protein_g: 0.027,
      carbs_g: 0.28,
      fats_g: 0.003,
      iron_mg: 0.002,
      zinc_mg: 0.005,
      magnesium_mg: 0.12,
      vitamin_d_iu: 0,
      calcium_mg: 0.1,
    }, riceTotal));
    parts.push(`${Math.round(riceTotal)}g rice`);
  }

  if (totals.calories === 0) {
    totals = {
      calories: 380,
      protein_g: 18,
      carbs_g: 42,
      fats_g: 12,
      iron_mg: 2.4,
      zinc_mg: 1.8,
      magnesium_mg: 52,
      vitamin_d_iu: 8,
      calcium_mg: 120,
    };
    parts.push("estimated mixed Indian plate");
  }

  const micros: Micronutrients = {
    iron_mg: round(totals.iron_mg),
    zinc_mg: round(totals.zinc_mg),
    magnesium_mg: round(totals.magnesium_mg),
    vitamin_d_iu: round(totals.vitamin_d_iu),
    calcium_mg: round(totals.calcium_mg),
  };

  return {
    meal_name: titleFromQuery(query),
    serving_inferred: parts.join(" + "),
    calories: Math.round(totals.calories),
    protein_g: round(totals.protein_g),
    carbs_g: round(totals.carbs_g),
    fats_g: round(totals.fats_g),
    micronutrients: micros,
    breakdown_summary:
      "Fallback Indian-diet estimate using katori, roti, and metric portion heuristics. Recheck once Gemini is available.",
  };
}
