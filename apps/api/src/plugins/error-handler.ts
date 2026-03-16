import type { Hono } from "hono";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

export function registerErrorHandler(app: Hono) {
  app.onError((error, c) => {
    if (error instanceof AppError) {
      return c.body(
        JSON.stringify({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
        }),
        error.statusCode as 400 | 401 | 404 | 409,
        {
          "content-type": "application/json"
        }
      );
    }

    if (error instanceof ZodError) {
      return c.json({
        error: {
          code: "validation_error",
          message: "Invalid request payload",
          details: error.flatten()
        }
      }, { status: 400 });
    }

    console.error(error);
    return c.json({
      error: {
        code: "internal_error",
        message: "Internal Server Error"
      }
    }, { status: 500 });
  });
}
