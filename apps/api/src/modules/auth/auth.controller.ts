import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import {
  loginUser,
  registerUser,
  revokeRefreshToken,
  rotateRefreshToken,
} from "./auth.service";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: env.cookieSameSite,
  secure: env.cookieSameSite === "none" || process.env.NODE_ENV === "production",
};

function setSessionCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie("accessToken", accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 });
  res.cookie("refreshToken", refreshToken, {
    ...COOKIE_OPTS,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { accessToken, refreshToken } = await registerUser(req.body);
  setSessionCookies(res, accessToken, refreshToken);
  res.status(201).json({ message: "Account created" });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { accessToken, refreshToken } = await loginUser(email, password);
  setSessionCookies(res, accessToken, refreshToken);
  res.json({ message: "Logged in" });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: "No refresh token" });
  const { accessToken, refreshToken } = await rotateRefreshToken(token);
  setSessionCookies(res, accessToken, refreshToken);
  res.json({ message: "Refreshed" });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (token) await revokeRefreshToken(token);
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out" });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, role: true, profile: true },
  });
  res.json(user);
});
