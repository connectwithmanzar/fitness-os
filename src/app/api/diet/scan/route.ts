import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";
import { estimateIndianMeal } from "@/lib/diet-estimate";
import { parseMealScanText } from "@/lib/diet-parse";
import type { MealScanRequest, MealScanResult } from "@/lib/diet-types";

const SYSTEM_INSTRUCTION = `You are a clinical nutrition estimator specialized in Indian home cooking and restaurant staples.

Parse colloquial Indian and metric units:
- 1 standard katori ≈ 150ml / 150g
- 1 plain whole wheat roti/chapati (no oil) ≈ 70-80 kcal, 3g protein, 15g carbs, 0.5g fat
- 1 butter/ghee roti ≈ 100-110 kcal
- 1 plate biryani or rice ≈ 350g
- Also accept g, gram, kg, ml, l, liter, mg, pieces, plate, katori, bowl, cup, roti, chapati.

Calculate calories, macros (protein_g, carbs_g, fats_g), and micros (iron_mg, zinc_mg, magnesium_mg, vitamin_d_iu, calcium_mg) as numbers.

Respond STRICTLY with a single valid JSON object and no markdown:
{
  "meal_name": string,
  "serving_inferred": string,
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fats_g": number,
  "micronutrients": {
    "iron_mg": number,
    "zinc_mg": number,
    "magnesium_mg": number,
    "vitamin_d_iu": number,
    "calcium_mg": number
  },
  "breakdown_summary": string
}`;

const MEAL_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    meal_name: { type: Type.STRING },
    serving_inferred: { type: Type.STRING },
    calories: { type: Type.NUMBER },
    protein_g: { type: Type.NUMBER },
    carbs_g: { type: Type.NUMBER },
    fats_g: { type: Type.NUMBER },
    micronutrients: {
      type: Type.OBJECT,
      properties: {
        iron_mg: { type: Type.NUMBER },
        zinc_mg: { type: Type.NUMBER },
        magnesium_mg: { type: Type.NUMBER },
        vitamin_d_iu: { type: Type.NUMBER },
        calcium_mg: { type: Type.NUMBER },
      },
      required: [
        "iron_mg",
        "zinc_mg",
        "magnesium_mg",
        "vitamin_d_iu",
        "calcium_mg",
      ],
    },
    breakdown_summary: { type: Type.STRING },
  },
  required: [
    "meal_name",
    "serving_inferred",
    "calories",
    "protein_g",
    "carbs_g",
    "fats_g",
    "micronutrients",
    "breakdown_summary",
  ],
};

const GEMINI_MODELS = ["gemini-1.5-flash", "gemini-2.5-flash"] as const;
const GEMINI_TIMEOUT_MS = 12000;

function isMealScanRequest(value: unknown): value is MealScanRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "query" in value &&
    typeof (value as MealScanRequest).query === "string"
  );
}

function fallbackResult(query: string): MealScanResult {
  return estimateIndianMeal(query);
}

async function generateWithTimeout(
  ai: GoogleGenAI,
  model: string,
  query: string
): Promise<string> {
  const timed = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("Gemini request timed out"));
    }, GEMINI_TIMEOUT_MS);
  });

  const generation = ai.models.generateContent({
    model,
    contents: `Estimate nutrition for this Indian meal log: ${query}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: MEAL_RESPONSE_SCHEMA,
    },
  });

  const response = await Promise.race([generation, timed]);
  return response.text ?? "";
}

export async function POST(request: Request) {
  let query = "";

  try {
    const body: unknown = await request.json();
    if (!isMealScanRequest(body) || body.query.trim().length === 0) {
      return NextResponse.json(fallbackResult("Logged meal"), { status: 200 });
    }

    query = body.query.trim();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(fallbackResult(query), { status: 200 });
    }

    const ai = new GoogleGenAI({ apiKey });

    for (const model of GEMINI_MODELS) {
      try {
        const text = await generateWithTimeout(ai, model, query);
        const parsed = parseMealScanText(text, query);
        if (parsed) {
          return NextResponse.json(parsed, { status: 200 });
        }
      } catch {
        continue;
      }
    }

    return NextResponse.json(fallbackResult(query), { status: 200 });
  } catch {
    return NextResponse.json(fallbackResult(query || "Logged meal"), {
      status: 200,
    });
  }
}
