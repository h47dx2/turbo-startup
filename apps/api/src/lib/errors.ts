export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown) {
  return new AppError(400, "bad_request", message, details);
}

export function unauthorized(message = "Unauthorized", code = "unauthorized") {
  return new AppError(401, code, message);
}

export function conflict(message: string, code = "conflict") {
  return new AppError(409, code, message);
}

export function notFound(message: string) {
  return new AppError(404, "not_found", message);
}
