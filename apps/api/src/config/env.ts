import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  // Comma-separated list supported, e.g.
  // "http://localhost:5173,https://username.github.io"
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  // "lax" works when frontend and API share a site (e.g. both on localhost,
  // or same registrable domain). A split deployment — frontend on GitHub
  // Pages, API on Render/Railway/etc — is cross-site, so the auth cookie
  // needs SameSite=None (which browsers require to be paired with Secure).
  // Set COOKIE_SAME_SITE=none in the API's production environment when
  // deploying that way.
  cookieSameSite: (process.env.COOKIE_SAME_SITE ?? "lax") as "lax" | "none" | "strict",
};
