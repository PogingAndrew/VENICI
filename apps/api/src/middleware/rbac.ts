import { NextFunction, Request, Response } from "express";
import { ApiError } from "./errorHandler";

// Restricts a route to one or more roles. Must run after `authenticate`.
export function requireRole(...roles: Array<"USER" | "ADMIN">) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError(401, "Not authenticated"));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "Insufficient permissions"));
    }
    next();
  };
}
