import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    name: z.string().min(1),
    dateOfBirth: z.string().datetime({ message: "Date of birth is required" }),
    sex: z.enum(["MALE", "FEMALE", "OTHER"]),
    heightCm: z.number().positive("Height must be greater than 0"),
    activityLevel: z.enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"]),
    currentWeightKg: z.number().positive("Current weight must be greater than 0"),
    targetWeightKg: z.number().positive("Target weight must be greater than 0"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});
