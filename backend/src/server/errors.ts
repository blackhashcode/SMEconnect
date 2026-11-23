import { ZodError } from "zod";

/** Base class for every expected application error. */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid input", details?: unknown) {
    super("VALIDATION_ERROR", message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super("FORBIDDEN", message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super("NOT_FOUND", message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "The resource is in a conflicting state", details?: unknown) {
    super("CONFLICT", message, 409, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests", details?: unknown) {
    super("RATE_LIMITED", message, 429, details);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message = "Business rule violation", details?: unknown) {
    super("BUSINESS_RULE_VIOLATION", message, 422, details);
  }
}

export class DatabaseUnavailableError extends AppError {
  constructor() {
    super("DATABASE_UNAVAILABLE", "Database connection failed", 503);
  }
}

export class EmailConfigurationError extends AppError {
  constructor(message = "Email is not configured") {
    super("EMAIL_CONFIGURATION_ERROR", message, 500);
  }
}

export class EmailDeliveryError extends AppError {
  constructor() {
    super("EMAIL_DELIVERY_FAILED", "Could not deliver email", 500);
  }
}

export interface ErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface MappedError {
  status: number;
  body: ErrorPayload;
}

/** Converts any thrown value into the public API error envelope. */
export function toErrorPayload(error: unknown): MappedError {
  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: error.flatten(),
        },
      },
    };
  }

  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
    };
  }

  // Never expose internal error messages or stacks to clients.
  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong",
      },
    },
  };
}
