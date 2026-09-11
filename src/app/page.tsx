'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Dumbbell, 
  UtensilsCrossed, 
  Activity, 
  CheckCircle2, 
  Circle, 
  Flame, 
  Calendar,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface WorkoutSession {
  id: string;
  name: string;
  completedAt: string;
  exercises?: any[];
}

interface DietEntry {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timestamp: string;
}

export default function PulsePage() {
  const [hasTrainedToday, setHasTrainedToday] = useState(false);
  const [latestWorkout, setLatestWorkout] = useState<WorkoutSession | null>(null);
  const [totalCalories, setTotalCalories] = useState(0);
  const [totalProtein, setTotalProtein] = useState(0);
  const [totalCarbs, setTotalCarbs] = useState(0);
  const [totalFat, setTotalFat] = useState(0);

  // 7-day trend arrays
  const [weekDays, setWeekDays] = useState<{ day: string; dateStr: string; trained: boolean; volume: number; proteinHit: boolean }[]>([]);

  // Bedtime Supplement Checklist state
  const [supplements, setSupplements] = useState({
    magnesium: false,
    ashwagandha: false,
    hydration: false,
    sleepTarget: false
  });

  useEffect(() => {
    // 1. Check today's workout
    const savedWorkouts = localStorage.getItem('workout_history');
    const todayIso = new Date().toISOString().split('T')[0];
    
    if (savedWorkouts) {
      try {
        const parsed: WorkoutSession[] = JSON.parse(savedWorkouts);
        const todaySession = parsed.find(w => w.completedAt && w.completedAt.startsWith(todayIso));
        if (todaySession) {
          setHasTrainedToday(true);
          setLatestWorkout(todaySession);
        } else if (parsed.length > 0) {
          setLatestWorkout(parsed[0]);
        }
      } catch (e) {
        console.error('Failed to parse workout_history', e);
      }
    }

    // 2. Check today's diet
    const savedDiet = localStorage.getItem('diet_logs');
    if (savedDiet) {
      try {
        const parsedDiet: DietEntry[] = JSON.parse(savedDiet);
        const todayLogs = parsedDiet.filter(entry => entry.timestamp && entry.timestamp.startsWith(todayIso));
        
        let cals = 0, p = 0, c = 0, f = 0;
        todayLogs.forEach(item => {
          cals += item.calories || 0;
          p += item.protein || 0;
          c += item.carbs || 0;
          f += item.fat || 0;
        });

        setTotalCalories(cals);
        setTotalProtein(p);
        setTotalCarbs(c);
        setTotalFat(f);
      } catch (e) {
        console.error('Failed to parse diet_logs', e);
      }
    }

    // 3. Build 7-day trend data
    const daysArr = [];
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const label = dayLabels[d.getDay()];

      let didTrain = false;
      if (savedWorkouts) {
        try {
          const parsedW: WorkoutSession[] = JSON.parse(savedWorkouts);
          didTrain = parsedW.some(w => w.completedAt && w.completedAt.startsWith(dStr));
        } catch {}
      }

      let pAmount = 0;
      if (savedDiet) {
        try {
          const parsedD: DietEntry[] = JSON.parse(savedDiet);
          const matched = parsedD.filter(entry => entry.timestamp && entry.timestamp.startsWith(dStr));
          pAmount = matched.reduce((acc, curr) => acc + (curr.protein || 0), 0);
        } catch {}
      }

      daysArr.push({
        day: label,
        dateStr: dStr,
        trained: didTrain,
        volume: didTrain ? 100 : 0,
        proteinHit: pAmount >= 120
      });
    }
    setWeekDays(daysArr);

    // 4. Load supplement checks
    const savedChecks = localStorage.getItem('pulse_bedtime_checks');
    if (savedChecks) {
      try {
        setSupplements(JSON.parse(savedChecks));
      } catch {}
    }
  }, []);

  const toggleSupplement = (key: keyof typeof supplements) => {
    const updated = { ...supplements, [key]: !supplements[key] };
    setSupplements(updated);
    localStorage.setItem('pulse_bedtime_checks', JSON.stringify(updated));
  };

  const calorieTarget = 2200;
  const proteinTarget = 140;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-36 pt-6 px-4 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-500 font-semibold">Module 03</span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">The Pulse</h1>
        </div>
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      {/* 1. Today's Training Status Card */}
      <div className="bg-neutral-900/90 border border-neutral-800/80 rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${hasTrainedToday ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-800 text-neutral-400'}`}>
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-neutral-400 font-medium uppercase tracking-wider">Today&apos;s Training</div>
              <div className="text-base font-semibold text-white mt-0.5">
                {hasTrainedToday ? 'Session Completed' : 'Rest or Training Pending'}
              </div>
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${hasTrainedToday ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-neutral-800 text-neutral-400'}`}>
            {hasTrainedToday ? 'Done' : 'Pending'}
          </span>
        </div>

        {latestWorkout && (
          <div className="mt-3.5 pt-3 border-t border-neutral-800/60 flex items-center justify-between text-xs text-neutral-400">
            <span>Last: <strong className="text-neutral-200">{latestWorkout.name}</strong></span>
            <span>{new Date(latestWorkout.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </div>

      {/* 2. Today's Nutrition Overview */}
      <div className="bg-neutral-900/90 border border-neutral-800/80 rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Nutrition Consistency</h2>
          </div>
          <span className="text-xs font-mono text-neutral-400">{totalCalories} / {calorieTarget} kcal</span>
        </div>

        {/* Calorie Bar */}
        <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden mb-4">
          <div 
            className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
            style={{ width: `${Math.min(100, Math.round((totalCalories / calorieTarget) * 100))}%` }}
          />
        </div>

        {/* Macro Breakdown */}
        <div className="grid grid-cols-3 gap-2 text-center pt-2">
          <div className="bg-neutral-950/60 border border-neutral-800/50 rounded-xl p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-neutral-400">Protein</div>
            <div className="text-sm font-bold text-white mt-0.5">{totalProtein}g</div>
            <div className="text-[10px] text-neutral-500">Target: {proteinTarget}g</div>
          </div>
          <div className="bg-neutral-950/60 border border-neutral-800/50 rounded-xl p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-neutral-400">Carbs</div>
            <div className="text-sm font-bold text-white mt-0.5">{totalCarbs}g</div>
            <div className="text-[10px] text-neutral-500">Logged</div>
          </div>
          <div className="bg-neutral-950/60 border border-neutral-800/50 rounded-xl p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-neutral-400">Fats</div>
            <div className="text-sm font-bold text-white mt-0.5">{totalFat}g</div>
            <div className="text-[10px] text-neutral-500">Logged</div>
          </div>
        </div>
      </div>

      {/* 3. 7-Day Consistency Sparkline */}
      <div className="bg-neutral-900/90 border border-neutral-800/80 rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">7-Day Consistency</h2>
          </div>
          <span className="text-[11px] text-neutral-400">Training & Protein</span>
        </div>

        {/* 7 Columns */}
        <div className="grid grid-cols-7 gap-2 items-end h-24 pt-2 pb-1 border-b border-neutral-800/60">
          {weekDays.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center h-full justify-end gap-1.5">
              <div 
                className={`w-full rounded-t-sm transition-all duration-300 ${
                  item.trained ? 'bg-emerald-500 h-16 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-neutral-800/60 h-2 rounded-sm'
                }`} 
              />
              <span className="text-[10px] font-mono text-neutral-400 uppercase">{item.day.charAt(0)}</span>
            </div>
          ))}
        </div>

        {/* Protein dot indicator line */}
        <div className="flex items-center justify-between pt-3 text-[11px] text-neutral-400">
          <span>Protein target met:</span>
          <div className="flex items-center gap-2">
            {weekDays.map((item, idx) => (
              <div 
                key={idx} 
                className={`w-2 h-2 rounded-full ${item.proteinHit ? 'bg-emerald-400' : 'bg-neutral-800'}`} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* 4. Bedtime Supplement & Recovery Checklist */}
      <div className="bg-neutral-900/90 border border-neutral-800/80 rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Bedtime Recovery Stack</h2>
        </div>

        <div className="space-y-2.5">
          <button 
            onClick={() => toggleSupplement('magnesium')}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/60 text-left transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              {supplements.magnesium ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-neutral-500 shrink-0" />
              )}
              <span className={`text-xs ${supplements.magnesium ? 'text-neutral-400 line-through' : 'text-neutral-200'}`}>
                Magnesium Glycinate (400mg)
              </span>
            </div>
          </button>

          <button 
            onClick={() => toggleSupplement('ashwagandha')}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/60 text-left transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              {supplements.ashwagandha ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-neutral-500 shrink-0" />
              )}
              <span className={`text-xs ${supplements.ashwagandha ? 'text-neutral-400 line-through' : 'text-neutral-200'}`}>
                KSM-66 Ashwagandha
              </span>
            </div>
          </button>

          <button 
            onClick={() => toggleSupplement('hydration')}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/60 text-left transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              {supplements.hydration ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-neutral-500 shrink-0" />
              )}
              <span className={`text-xs ${supplements.hydration ? 'text-neutral-400 line-through' : 'text-neutral-200'}`}>
                500ml Water + Electrolytes
              </span>
            </div>
          </button>

          <button 
            onClick={() => toggleSupplement('sleepTarget')}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/60 text-left transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              {supplements.sleepTarget ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-neutral-500 shrink-0" />
              )}
              <span className={`text-xs ${supplements.sleepTarget ? 'text-neutral-400 line-through' : 'text-neutral-200'}`}>
                8-Hour Deep Sleep Target
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Bottom Sticky Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-950/95 backdrop-blur-md border-t border-neutral-800/80 px-6 py-3">
        <div className="max-w-md mx-auto flex justify-around items-center">
          <Link href="/" className="flex flex-col items-center gap-1 text-neutral-400 hover:text-neutral-200 transition">
            <Dumbbell className="w-5 h-5" />
            <span className="text-[10px] font-medium">Workout</span>
          </Link>
          <Link href="/diet" className="flex flex-col items-center gap-1 text-neutral-400 hover:text-neutral-200 transition">
            <UtensilsCrossed className="w-5 h-5" />
            <span className="text-[10px] font-medium">Diet Engine</span>
          </Link>
          <Link href="/pulse" className="flex flex-col items-center gap-1 text-emerald-400 font-medium">
            <Activity className="w-5 h-5" />
            <span className="text-[10px]">Pulse</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}