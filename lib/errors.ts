/**
 * Uniform error contract — docs/07 §4.
 * Server Actions throw typed classes mapping to the same codes;
 * Route Handlers return { error: { code, message, meta } }.
 */

export type ErrorCode =
  | "PLAN_LIMIT"
  | "QUOTA_EXCEEDED"
  | "AI_BUSY"
  | "DUPLICATE_TOUCH"
  | "NEEDS_REAUTH"
  | "VALIDATION"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "INTERNAL";

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  DUPLICATE_TOUCH: 409,
  PLAN_LIMIT: 402,
  QUOTA_EXCEEDED: 402,
  RATE_LIMITED: 429,
  AI_BUSY: 503,
  INTERNAL: 500,
  NEEDS_REAUTH: 401,
};

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public meta: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "AppError";
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, meta: this.meta } };
  }
}

export class PlanLimitError extends AppError {
  constructor(meter: string, message?: string) {
    super("PLAN_LIMIT", message ?? `You've reached your plan's ${meter} limit. Upgrade to keep going — monitoring continues either way.`, { meter });
  }
}

export class QuotaExceededError extends AppError {
  constructor(message = "Monthly AI draft quota reached. Upgrade for more — no overage charges, ever.") {
    super("QUOTA_EXCEEDED", message);
  }
}

export class AIBusyError extends AppError {
  constructor(message = "AI is busy — retry in 60s.") {
    super("AI_BUSY", message);
  }
}

export class DuplicateTouchError extends AppError {
  constructor(bySubject: string, byDate: string, byName: string) {
    super(
      "DUPLICATE_TOUCH",
      `${byName} contacted this person on ${byDate} ("${bySubject}").`,
      { bySubject, byDate, byName },
    );
  }
}

export function errorResponse(err: unknown): Response {
  const appErr =
    err instanceof AppError
      ? err
      : new AppError("INTERNAL", "Something went wrong on our side. It's been reported.");
  const status = ERROR_HTTP_STATUS[appErr.code];
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (appErr.code === "AI_BUSY") headers["Retry-After"] = "60";
  return new Response(JSON.stringify(appErr.toJSON()), { status, headers });
}
