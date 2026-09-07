import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../middleware/asyncHandler";
import { ApiError } from "../../middleware/errorHandler";
import { calculateAge, calculateBMI, bmiCategory } from "../../utils/calories";
import { isValidUsername } from "../../utils/username";
import { canMessageUser, getFollowCounts, getRelationship } from "../social/social.service";

const router = Router();
router.use(authenticate);

const MESSAGING_PRIVACY_VALUES = ["EVERYONE", "FOLLOWING", "MUTUALS", "NO_ONE"] as const;

const MESSAGING_PRIVACY_LABELS: Record<(typeof MESSAGING_PRIVACY_VALUES)[number], string> = {
  EVERYONE: "This user only accepts messages from certain people.",
  FOLLOWING: "This user only accepts messages from people they follow.",
  MUTUALS: "This user only accepts messages from mutual followers.",
  NO_ONE: "This user isn't accepting messages right now.",
};

const updateSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    username: z
      .string()
      .refine(isValidUsername, "Username must be 3-20 characters: letters, numbers, underscore only.")
      .optional(),
    bio: z.string().max(280).optional(),
    avatarUrl: z.string().url().optional().or(z.literal("")),
    isPrivate: z.boolean().optional(),
    messagingPrivacy: z.enum(MESSAGING_PRIVACY_VALUES).optional(),
    dateOfBirth: z.string().datetime().optional(),
    sex: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    heightCm: z.number().positive().optional(),
    activityLevel: z
      .enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"])
      .optional(),
  }),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user!.id } });
    const latestMeasurement = await prisma.bodyMeasurement.findFirst({
      where: { userId: req.user!.id },
      orderBy: { recordedAt: "desc" },
    });
    const currentWeightKg = latestMeasurement?.weightKg ?? null;

    const age = profile?.dateOfBirth ? calculateAge(profile.dateOfBirth) : null;
    const bmi =
      currentWeightKg && profile?.heightCm ? calculateBMI(currentWeightKg, profile.heightCm) : null;
    const counts = await getFollowCounts(req.user!.id);

    res.json({
      ...profile,
      currentWeightKg,
      age,
      bmi,
      bmiCategory: bmi != null ? bmiCategory(bmi) : null,
      ...counts,
    });
  })
);

// Public-facing view of another user's profile. Fitness stats (weight, BMI,
// goals) stay private to the account owner — only what a social profile
// should show (name, username, bio, avatar, privacy flag, follower/following
// counts, the viewer's relationship, and whether the viewer is allowed to
// message them) is exposed here.
router.get(
  "/user/:userId",
  asyncHandler(async (req, res) => {
    const targetUserId = req.params.userId;
    const profile = await prisma.profile.findUnique({ where: { userId: targetUserId } });
    if (!profile) throw new ApiError(404, "User not found");

    const [counts, relationship, canMessage] = await Promise.all([
      getFollowCounts(targetUserId),
      getRelationship(req.user!.id, targetUserId),
      req.user!.id === targetUserId
        ? Promise.resolve(false)
        : canMessageUser(req.user!.id, targetUserId),
    ]);

    res.json({
      userId: targetUserId,
      name: profile.name,
      username: profile.username,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      isPrivate: profile.isPrivate,
      ...counts,
      relationship,
      canMessage,
      messagingUnavailableReason: canMessage
        ? null
        : MESSAGING_PRIVACY_LABELS[profile.messagingPrivacy as (typeof MESSAGING_PRIVACY_VALUES)[number]],
    });
  })
);

router.put(
  "/",
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const { dateOfBirth, avatarUrl, username, ...rest } = req.body;

    if (username) {
      const existing = await prisma.profile.findUnique({ where: { username } });
      if (existing && existing.userId !== req.user!.id) {
        throw new ApiError(409, "That username is already taken.");
      }
    }

    const profile = await prisma.profile.update({
      where: { userId: req.user!.id },
      data: {
        ...rest,
        username: username ?? undefined,
        avatarUrl: avatarUrl === "" ? null : avatarUrl,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      },
    });
    res.json(profile);
  })
);

// Body measurements are append-only history, not an update to a single row.
router.post(
  "/measurements",
  validate(
    z.object({
      body: z.object({
        weightKg: z.number().positive(),
        bodyFatPct: z.number().min(0).max(100).optional(),
        notes: z.string().optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const measurement = await prisma.bodyMeasurement.create({
      data: { userId: req.user!.id, ...req.body },
    });
    res.status(201).json(measurement);
  })
);

router.get(
  "/measurements",
  asyncHandler(async (req, res) => {
    const measurements = await prisma.bodyMeasurement.findMany({
      where: { userId: req.user!.id },
      orderBy: { recordedAt: "desc" },
      take: 90,
    });
    res.json(measurements);
  })
);

export default router;
