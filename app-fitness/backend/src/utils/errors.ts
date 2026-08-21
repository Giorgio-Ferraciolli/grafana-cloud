export class AppError extends Error {
  readonly statusCode: number;
  readonly expose: boolean;

  constructor(message: string, statusCode = 500, expose = true) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.expose = expose;
  }
}

export class ValidationError extends AppError {
  readonly details: unknown;

  constructor(message: string, details?: unknown) {
    super(message, 400);
    this.name = "ValidationError";
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
    this.name = "NotFoundError";
  }
}
