import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import usersRoutes from "../modules/users/users.routes";
import profileRoutes from "../modules/profile/profile.routes";
import goalsRoutes from "../modules/goals/goals.routes";
import foodsRoutes from "../modules/foods/foods.routes";
import mealsRoutes from "../modules/meals/meals.routes";
import exercisesRoutes from "../modules/exercises/exercises.routes";
import workoutsRoutes from "../modules/workouts/workouts.routes";
import cardioRoutes from "../modules/cardio/cardio.routes";
import wearablesRoutes from "../modules/wearables/wearables.routes";
import progressRoutes from "../modules/progress/progress.routes";
import reportsRoutes from "../modules/reports/reports.routes";
import adminRoutes from "../modules/admin/admin.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/profile", profileRoutes);
router.use("/goals", goalsRoutes);
router.use("/foods", foodsRoutes);
router.use("/meals", mealsRoutes);
router.use("/exercises", exercisesRoutes);
router.use("/workouts", workoutsRoutes);
router.use("/cardio", cardioRoutes);
router.use("/wearables", wearablesRoutes);
router.use("/progress", progressRoutes);
router.use("/reports", reportsRoutes);
router.use("/admin", adminRoutes);

export default router;
