import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { ApiError } from "../../middleware/errorHandler";
import { generateUniqueUsername } from "../../utils/username";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt";

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  dateOfBirth: string;
  sex: "MALE" | "FEMALE" | "OTHER";
  heightCm: number;
  activityLevel: "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "VERY_ACTIVE";
  currentWeightKg: number;
  targetWeightKg: number;
}

// Derives a sensible goal type from where the target sits relative to the
// starting weight, so the person doesn't have to pick this explicitly
// during onboarding.
function inferGoalType(current: number, target: number): "WEIGHT_LOSS" | "WEIGHT_GAIN" | "WEIGHT_MAINTENANCE" {
  const diff = target - current;
  if (Math.abs(diff) < 0.5) return "WEIGHT_MAINTENANCE";
  return diff < 0 ? "WEIGHT_LOSS" : "WEIGHT_GAIN";
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ApiError(409, "An account with this email already exists");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const username = await generateUniqueUsername(input.name || input.email.split("@")[0]);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        profile: {
          create: {
            name: input.name,
            username,
            dateOfBirth: new Date(input.dateOfBirth),
            sex: input.sex,
            heightCm: input.heightCm,
            activityLevel: input.activityLevel,
          },
        },
      },
    });

    // First body-weight reading, so the dashboard has "current weight" from day one.
    await tx.bodyMeasurement.create({
      data: { userId: created.id, weightKg: input.currentWeightKg },
    });

    // Starting goal, pre-populated from the values captured at signup.
    await tx.goal.create({
      data: {
        userId: created.id,
        type: inferGoalType(input.currentWeightKg, input.targetWeightKg),
        startingValue: input.currentWeightKg,
        targetValue: input.targetWeightKg,
        currentValue: input.currentWeightKg,
        status: "ACTIVE",
      },
    });

    return created;
  });

  return issueSession(user.id, user.role);
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError(401, "Invalid email or password");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new ApiError(401, "Invalid email or password");

  return issueSession(user.id, user.role);
}

export async function issueSession(userId: string, role: "USER" | "ADMIN") {
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = signRefreshToken(userId);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.refreshTokenTtlDays);

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId, expiresAt },
  });

  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(oldToken: string) {
  const stored = await prisma.refreshToken.findUnique({ where: { token: oldToken } });
  if (!stored || stored.expiresAt < new Date()) {
    throw new ApiError(401, "Refresh token is invalid or expired");
  }

  const payload = verifyRefreshToken(oldToken);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new ApiError(401, "User not found");

  await prisma.refreshToken.delete({ where: { token: oldToken } });
  return issueSession(user.id, user.role);
}

export async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}
