import { NextFunction, Request, Response } from "express";
import { ZodError, ZodTypeAny } from "zod";
import { ValidationError } from "../utils/errors";

type Target = "body" | "params" | "query";

export function validate(schema: ZodTypeAny, target: Target = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req[target] = schema.parse(req[target]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(new ValidationError("Payload validation failed", err.flatten()));
        return;
      }
      next(err);
    }
  };
}
