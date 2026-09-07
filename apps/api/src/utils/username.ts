import { prisma } from "../lib/prisma";

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username);
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
  return base.length >= 3 ? base : `${base}user`.slice(0, 20);
}

// Generates a unique, valid username from a seed string (name or email
// local-part), appending a numeric suffix on collision. Used at
// registration so every account gets a searchable handle without asking
// for one up front.
export async function generateUniqueUsername(seed: string): Promise<string> {
  const base = slugify(seed);
  let candidate = base;
  let suffix = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.profile.findUnique({ where: { username: candidate } });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`.slice(0, 20);
  }
}
