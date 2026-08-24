import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export interface AccessTokenPayload {
  sub: string; // user id
  role: "USER" | "ADMIN";
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: env.accessTokenTtl as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.jwtAccessSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

export function signRefreshToken(userId: string): string {
  const options: SignOptions = { expiresIn: `${env.refreshTokenTtlDays}d` as SignOptions["expiresIn"] };
  return jwt.sign({ sub: userId }, env.jwtRefreshSecret, options);
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.jwtRefreshSecret) as { sub: string };
}
