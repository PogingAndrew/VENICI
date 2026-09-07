// Mirrors the backend's WEIGHT_GOAL_TYPES (apps/api/src/modules/progress/progress.service.ts).
// Goals of these types have a targetValue that's an actual body weight in kg;
// FITNESS_IMPROVEMENT goals can have any arbitrary numeric target.
export const WEIGHT_GOAL_TYPES = ["WEIGHT_LOSS", "WEIGHT_GAIN", "WEIGHT_MAINTENANCE"];
