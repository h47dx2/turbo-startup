import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

function isFastifyValidationError(error: unknown): error is { code: "FST_ERR_VALIDATION"; validation?: unknown } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "FST_ERR_VALIDATION"
  );
}

export async function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "validation_error",
          message: "Invalid request payload",
          details: error.flatten()
        }
      });
    }

    if (isFastifyValidationError(error)) {
      return reply.status(400).send({
        error: {
          code: "validation_error",
          message: "Invalid request payload",
          details: error.validation
        }
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      error: {
        code: "internal_error",
        message: "Internal Server Error"
      }
    });
  });
}
