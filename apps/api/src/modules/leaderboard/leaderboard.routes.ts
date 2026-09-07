import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/asyncHandler";
import { ApiError } from "../../middleware/errorHandler";
import {
  getLeaderboard,
  LeaderboardCategory,
  LeaderboardPeriod,
} from "./leaderboard.service";

const router = Router();
router.use(authenticate);

const CATEGORIES: LeaderboardCategory[] = ["volume", "distance", "pace", "goals"];
const PERIODS: LeaderboardPeriod[] = ["all", "month", "week"];

// Full ranked list for one category, capped at the top 20. Also returns the
// requesting user's own rank/value even when they're outside the top 20, so
// the page can always show "you" — this is a leaderboard, not just a top-list.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const category = (req.query.category as LeaderboardCategory) ?? "volume";
    const period = (req.query.period as LeaderboardPeriod) ?? "all";

    if (!CATEGORIES.includes(category)) throw new ApiError(400, "Invalid leaderboard category");
    if (!PERIODS.includes(period)) throw new ApiError(400, "Invalid leaderboard period");

    const entries = await getLeaderboard(category, period);
    const ranked = entries.map((e, i) => ({ ...e, rank: i + 1 }));
    const you = ranked.find((e) => e.userId === req.user!.id) ?? null;

    res.json({ category, period, entries: ranked.slice(0, 20), you, totalRanked: ranked.length });
  })
);

// Compact cross-category summary (all-time only) — powers the Dashboard's
// "Your Rankings" card without the page having to make 4 separate calls.
router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const results = await Promise.all(CATEGORIES.map((category) => getLeaderboard(category, "all")));

    const summary = Object.fromEntries(
      CATEGORIES.map((category, i) => {
        const ranked = results[i].map((e, idx) => ({ ...e, rank: idx + 1 }));
        const you = ranked.find((e) => e.userId === userId) ?? null;
        return [category, { you, totalRanked: ranked.length }];
      })
    );

    res.json(summary);
  })
);

export default router;
