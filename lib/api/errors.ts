import { NextResponse } from "next/server";

/**
 * Custom API Error Classes
 * Provides structured error handling for API endpoints
 */

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 400, code?: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code || "API_ERROR";
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApiError {
  public readonly errors: Record<string, string[]>;

  constructor(errors: Record<string, string[]> | string) {
    const message =
      typeof errors === "string"
        ? errors
        : "Validation failed: " + Object.keys(errors).join(", ");
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.errors = typeof errors === "string" ? { _error: [errors] } : errors;
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends ApiError {
  constructor(
    message: string = "You do not have permission to perform this action"
  ) {
    super(message, 403, "AUTHORIZATION_ERROR");
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApiError {
  constructor(message: string = "Resource already exists") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class RateLimitError extends ApiError {
  public readonly retryAfter: number;

  constructor(message: string = "Too many requests", retryAfter: number = 60) {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class ServiceUnavailableError extends ApiError {
  public readonly retryAfter?: number;

  constructor(
    message: string = "Service temporarily unavailable",
    retryAfter?: number,
    code: string = "SERVICE_UNAVAILABLE",
  ) {
    super(message, 503, code);
    this.name = "ServiceUnavailableError";
    this.retryAfter = retryAfter;
  }
}

/**
 * Error handler utility for API routes
 * Returns a proper NextResponse for API routes
 */
export function handleApiError(error: unknown): NextResponse {
  // Handle rate limit errors with Retry-After header
  if (error instanceof RateLimitError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
        code: error.code,
        retryAfter: error.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(error.retryAfter),
        },
      }
    );
  }

  // Handle validation errors with detailed field errors
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
        code: error.code,
        errors: error.errors,
      },
      { status: 400 }
    );
  }

  // Handle other API errors
  if (error instanceof ApiError) {
    const headers =
      error instanceof ServiceUnavailableError && error.retryAfter
        ? { "Retry-After": String(error.retryAfter) }
        : undefined;

    return NextResponse.json(
      {
        success: false,
        message: error.message,
        code: error.code,
      },
      { status: error.statusCode, headers }
    );
  }

  // Handle standard JavaScript errors — show clean message, log full detail
  if (error instanceof Error) {
    console.error("Unhandled error:", error);

    // Strip any JSON / stack traces from the message shown to the client.
    // Keep the human-readable prefix (e.g. "PayPal auth failed: …") but
    // replace embedded JSON blobs with the extracted description.
    let clientMessage = error.message || "Internal server error";

    // Remove embedded JSON objects like {"error":"…","error_description":"…"}
    clientMessage = clientMessage.replace(/\{[\s\S]*\}/g, "").trim();

    // Remove trailing colon/whitespace left behind after stripping JSON
    clientMessage = clientMessage.replace(/:\s*$/, "").trim();

    return NextResponse.json(
      {
        success: false,
        message: clientMessage || "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }

  // Handle unknown errors
  return NextResponse.json(
    {
      success: false,
      message: "An unexpected error occurred",
      code: "UNKNOWN_ERROR",
    },
    { status: 500 }
  );
}
