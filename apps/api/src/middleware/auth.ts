import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { ApiError } from "./errorHandler";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: "USER" | "ADMIN" };
    }
  }
}

// Reads the access token from the httpOnly cookie (preferred) or the
// Authorization header (useful for non-browser clients/testing).
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined;
  const token = req.cookies?.accessToken ?? bearer;

  if (!token) return next(new ApiError(401, "Not authenticated"));

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new ApiError(401, "Invalid or expired token"));
  }
}
