import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";

// Validates and coerces req.body/query/params against a zod schema.
// Rejections flow to errorHandler as ZodError -> 400 with field details.
export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    req.body = parsed.body ?? req.body;
    next();
  };
}
