import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/apiClient";
import { Card } from "../ui/Card";
import { ProgressBar } from "../ui/ProgressBar";
import { LoadingBlock } from "../ui/EmptyState";

interface WeeklyBalance {
  daysElapsed: number;
  daysRemaining: number;
  trackedDaysElapsed: number;
  totalConsumed: number;
  totalBurned: number;
  netKcalSoFar: number; // + = deficit run so far, - = surplus run so far
  usedTdee: boolean;
  phase: "bulking" | "cutting" | "maintaining";
  direction: "deficit" | "surplus" | "maintenance";
  weeklyTargetKcal: number; // magnitude
  targetWeeklyKgChange: number; // magnitude
  achievedTowardGoalKcal: number; // + = progress toward goal, - = moving away
  remainingKcalNeeded: number;
  avgDailyKcalNeeded: number | null;
  onTrack: boolean;
  goalMet: boolean;
  hasActiveGoal: boolean;
  hasWeight: boolean;
}

const PHASE_LABEL: Record<WeeklyBalance["phase"], string> = {
  bulking: "Bulking",
  cutting: "Cutting",
  maintaining: "Maintaining",
};

const PHASE_BADGE_CLASS: Record<WeeklyBalance["phase"], string> = {
  bulking: "bg-sky-50 text-sky-700",
  cutting: "bg-brand-50 text-brand-700",
  maintaining: "bg-slate-100 text-ink-500",
};

export function WeeklyCalorieBalance() {
  const [data, setData] = useState<WeeklyBalance | null>(null);

  useEffect(() => {
    api.get<WeeklyBalance>("/progress/weekly-balance").then(setData);
  }, []);

  if (!data) {
    return (
      <Card>
        <h2 className="mb-4 font-semibold text-ink-900">Weekly Calorie Balance</h2>
        <LoadingBlock />
      </Card>
    );
  }

  if (!data.hasWeight) {
    return (
      <Card>
        <h2 className="mb-2 font-semibold text-ink-900">Weekly Calorie Balance</h2>
        <p className="text-sm text-ink-500">
          Log a current weight on your{" "}
          <Link to="/profile" className="font-semibold text-brand-700">
            profile
          </Link>{" "}
          to unlock this — it needs your weight, height, and activity level to estimate maintenance
          calories.
        </p>
      </Card>
    );
  }

  const ranDeficit = data.netKcalSoFar >= 0;
  const nothingLoggedYet = data.trackedDaysElapsed === 0;
  // Whether the actual deficit/surplus so far is the kind this goal wants —
  // only meaningful when there's an active weight goal to judge it against.
  // With no goal, the number is purely informational, so it stays neutral
  // rather than implying "good" or "bad" progress toward nothing.
  const soFarIsGoodDirection =
    !data.hasActiveGoal ||
    data.direction === "maintenance" ||
    (data.direction === "deficit" && ranDeficit) ||
    (data.direction === "surplus" && !ranDeficit);
  const soFarColorClass = !data.hasActiveGoal
    ? "text-ink-900"
    : soFarIsGoodDirection
      ? "text-brand-700"
      : "text-red-600";

  const progressPct =
    data.weeklyTargetKcal > 0
      ? Math.max(0, Math.min(100, Math.round((data.achievedTowardGoalKcal / data.weeklyTargetKcal) * 100)))
      : null;

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-ink-900">Weekly Calorie Balance</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PHASE_BADGE_CLASS[data.phase]}`}
          >
            {PHASE_LABEL[data.phase]}
          </span>
        </div>
        <span className="text-xs text-ink-500">Day {data.daysElapsed} of 7</span>
      </div>
      <p className="mb-4 text-xs text-ink-500">
        {data.usedTdee
          ? "Estimated maintenance calories + activity burned, minus food consumed, on days you've logged something."
          : "Calories burned minus calories consumed, on days you've logged something (complete your profile for a maintenance-adjusted figure)."}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-ink-500">So far this week</p>
          {nothingLoggedYet ? (
            <>
              <p className="text-2xl font-bold text-ink-900">0 kcal</p>
              <p className="text-xs text-ink-500">nothing logged yet this week</p>
            </>
          ) : (
            <>
              <p className={`text-2xl font-bold ${soFarColorClass}`}>
                {Math.abs(data.netKcalSoFar).toLocaleString()} kcal
              </p>
              <p className="text-xs text-ink-500">
                {ranDeficit ? "deficit" : "surplus"} so far · {data.trackedDaysElapsed} day
                {data.trackedDaysElapsed === 1 ? "" : "s"} logged
                {data.hasActiveGoal && !soFarIsGoodDirection && data.weeklyTargetKcal > 0 && (
                  <span className="text-red-600"> · wrong direction for {data.phase}</span>
                )}
              </p>
            </>
          )}
        </div>
        <div>
          <p className="text-xs text-ink-500">Weekly goal</p>
          {data.hasActiveGoal && data.weeklyTargetKcal > 0 ? (
            <>
              <p className="text-2xl font-bold text-ink-900">
                {data.weeklyTargetKcal.toLocaleString()} kcal
              </p>
              <p className="text-xs text-ink-500">
                {data.direction} target (~{data.targetWeeklyKgChange} kg/week)
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-ink-900">Maintenance</p>
              <p className="text-xs text-ink-500">
                {data.hasActiveGoal ? "goal weight already reached" : "no active goal set"}
              </p>
            </>
          )}
        </div>
      </div>

      {progressPct != null && !nothingLoggedYet && (
        <>
          <ProgressBar value={progressPct} max={100} color={data.onTrack ? "bg-brand-500" : "bg-red-500"} />
          <p className="mt-3 text-sm text-ink-700">
            {data.goalMet ? (
              <>
                You've already hit this week's {data.direction} goal for {data.phase} — nice work. Any
                further {data.direction} beyond this is a bonus toward next week.
              </>
            ) : (
              <>
                <span className="font-semibold text-ink-900">
                  {data.remainingKcalNeeded.toLocaleString()} kcal
                </span>{" "}
                more {data.direction} still needed this week to stay on pace for {data.phase}
                {data.daysRemaining > 0 && data.avgDailyKcalNeeded != null && (
                  <>
                    {" "}
                    — about{" "}
                    <span className="font-semibold text-ink-900">
                      {data.avgDailyKcalNeeded.toLocaleString()} kcal/day
                    </span>{" "}
                    over the next {data.daysRemaining} day{data.daysRemaining === 1 ? "" : "s"}
                    {data.phase === "bulking" ? " (on top of maintenance)" : " (below maintenance)"}.
                  </>
                )}
                {!data.onTrack && (
                  <span className="mt-1 block text-red-600">
                    You're currently trending the opposite way — {ranDeficit ? "a deficit" : "a surplus"}{" "}
                    won't get you to your {data.phase} goal.
                  </span>
                )}
              </>
            )}
          </p>
        </>
      )}

      {progressPct != null && nothingLoggedYet && (
        <p className="text-sm text-ink-500">
          Log a meal, workout, or cardio session to start tracking this week's {data.direction} toward
          your {data.phase} goal.
        </p>
      )}

      {data.weeklyTargetKcal === 0 && (
        <p className="text-sm text-ink-500">
          {data.hasActiveGoal
            ? "You're already at your goal weight — this tracks toward staying there."
            : "Set a weight goal to get a weekly calorie target."}{" "}
          <Link to="/goals" className="font-semibold text-brand-700">
            Manage goals →
          </Link>
        </p>
      )}
    </Card>
  );
}
