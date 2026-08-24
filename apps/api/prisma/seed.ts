import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const FOODS = [
  { name: "Chicken Breast (cooked)", servingSize: "100 g", calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0 },
  { name: "Brown Rice (cooked)", servingSize: "1 cup", calories: 216, proteinG: 5, carbsG: 45, fatG: 1.8, fiberG: 3.5 },
  { name: "Broccoli (steamed)", servingSize: "1 cup", calories: 55, proteinG: 3.7, carbsG: 11, fatG: 0.6, fiberG: 5.1 },
  { name: "Banana", servingSize: "1 medium", calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, fiberG: 3.1 },
  { name: "Rolled Oats (dry)", servingSize: "1/2 cup", calories: 150, proteinG: 5, carbsG: 27, fatG: 3, fiberG: 4 },
  { name: "Whole Eggs", servingSize: "1 large", calories: 72, proteinG: 6.3, carbsG: 0.4, fatG: 4.8, fiberG: 0 },
  { name: "Greek Yogurt (plain, nonfat)", servingSize: "170 g", calories: 100, proteinG: 17, carbsG: 6, fatG: 0.7, fiberG: 0 },
  { name: "Salmon (cooked)", servingSize: "100 g", calories: 208, proteinG: 20, carbsG: 0, fatG: 13, fiberG: 0 },
  { name: "Almonds", servingSize: "28 g (1 oz)", calories: 164, proteinG: 6, carbsG: 6, fatG: 14, fiberG: 3.5 },
  { name: "Sweet Potato (baked)", servingSize: "1 medium", calories: 103, proteinG: 2.3, carbsG: 24, fatG: 0.2, fiberG: 3.8 },
  { name: "Whole Wheat Bread", servingSize: "1 slice", calories: 81, proteinG: 4, carbsG: 14, fatG: 1.1, fiberG: 2 },
  { name: "Peanut Butter", servingSize: "2 tbsp", calories: 190, proteinG: 8, carbsG: 7, fatG: 16, fiberG: 2 },
  { name: "Avocado", servingSize: "1/2 medium", calories: 120, proteinG: 1.5, carbsG: 6, fatG: 11, fiberG: 5 },
  { name: "Black Beans (cooked)", servingSize: "1 cup", calories: 227, proteinG: 15, carbsG: 41, fatG: 0.9, fiberG: 15 },
  { name: "Ground Beef 90% lean (cooked)", servingSize: "100 g", calories: 176, proteinG: 20, carbsG: 0, fatG: 10, fiberG: 0 },
  { name: "Apple", servingSize: "1 medium", calories: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, fiberG: 4.4 },
  { name: "Skim Milk", servingSize: "1 cup", calories: 83, proteinG: 8.3, carbsG: 12, fatG: 0.2, fiberG: 0 },
  { name: "Quinoa (cooked)", servingSize: "1 cup", calories: 222, proteinG: 8, carbsG: 39, fatG: 3.6, fiberG: 5.2 },
  { name: "Olive Oil", servingSize: "1 tbsp", calories: 119, proteinG: 0, carbsG: 0, fatG: 13.5, fiberG: 0 },
  { name: "Protein Shake (whey, 1 scoop)", servingSize: "1 scoop", calories: 120, proteinG: 24, carbsG: 3, fatG: 1.5, fiberG: 0 },
];

const EXERCISES: Array<{ name: string; category: string; description?: string }> = [
  { name: "Bench Press", category: "CHEST" },
  { name: "Incline Bench Press", category: "CHEST" },
  { name: "Chest Fly", category: "CHEST" },
  { name: "Push-up", category: "CHEST" },
  { name: "Lat Pulldown", category: "BACK" },
  { name: "Seated Row", category: "BACK" },
  { name: "Pull-up", category: "BACK" },
  { name: "Deadlift", category: "BACK" },
  { name: "Squat", category: "LEGS" },
  { name: "Leg Press", category: "LEGS" },
  { name: "Leg Extension", category: "LEGS" },
  { name: "Lunges", category: "LEGS" },
  { name: "Overhead Press", category: "SHOULDERS" },
  { name: "Lateral Raise", category: "SHOULDERS" },
  { name: "Bicep Curl", category: "ARMS" },
  { name: "Tricep Pushdown", category: "ARMS" },
  { name: "Plank", category: "CORE" },
  { name: "Hanging Leg Raise", category: "CORE" },
  { name: "Burpees", category: "FULL_BODY" },
  { name: "Jump Rope", category: "CARDIO" },
];

async function main() {
  console.log("Seeding foods...");
  for (const food of FOODS) {
    await prisma.food.upsert({
      where: { id: food.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
      update: {},
      create: { id: food.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), ...food },
    });
  }

  console.log("Seeding exercises...");
  for (const ex of EXERCISES) {
    const id = ex.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await prisma.exercise.upsert({
      where: { id },
      update: {},
      create: { id, ...ex, category: ex.category as any },
    });
  }

  console.log("Seeding demo accounts...");
  const adminPasswordHash = await bcrypt.hash("Admin1234!", 12);
  await prisma.user.upsert({
    where: { email: "admin@fittrack.dev" },
    update: {},
    create: {
      email: "admin@fittrack.dev",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      profile: { create: { name: "System Admin" } },
    },
  });

  const userPasswordHash = await bcrypt.hash("Demo1234!", 12);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@fittrack.dev" },
    update: {},
    create: {
      email: "demo@fittrack.dev",
      passwordHash: userPasswordHash,
      role: "USER",
      profile: {
        create: {
          name: "Demo User",
          dateOfBirth: new Date("1998-03-14T00:00:00.000Z"),
          sex: "MALE",
          heightCm: 178,
          activityLevel: "MODERATE",
        },
      },
    },
  });

  await prisma.bodyMeasurement.createMany({
    data: [
      { userId: demoUser.id, weightKg: 84, recordedAt: new Date(Date.now() - 30 * 86400000) },
      { userId: demoUser.id, weightKg: 82.5, recordedAt: new Date(Date.now() - 15 * 86400000) },
      { userId: demoUser.id, weightKg: 81, recordedAt: new Date() },
    ],
  });

  await prisma.goal.upsert({
    where: { id: "demo-goal-weight-loss" },
    update: {},
    create: {
      id: "demo-goal-weight-loss",
      userId: demoUser.id,
      type: "WEIGHT_LOSS",
      startingValue: 84,
      targetValue: 75,
      currentValue: 81,
      status: "ACTIVE",
    },
  });

  console.log("Seed complete.");
  console.log("Demo login:  demo@fittrack.dev / Demo1234!");
  console.log("Admin login: admin@fittrack.dev / Admin1234!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
