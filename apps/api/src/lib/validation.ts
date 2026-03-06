import { ZodError, type ZodType } from "zod";
import { badRequest } from "./errors.js";

export function parseWithSchema<T>(schema: ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw badRequest("Invalid request payload", error.flatten());
    }

    throw error;
  }
}
