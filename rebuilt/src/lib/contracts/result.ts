export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "EMAIL_UNVERIFIED"
  | "PROFILE_INCOMPLETE"
  | "VALIDATION_ERROR"
  | "DUPLICATE"
  | "CONFLICT"
  | "NOT_FOUND"
  | "INSUFFICIENT_BALANCE"
  | "PERIOD_CLOSED"
  | "ALREADY_SUBMITTED"
  | "RATE_LIMITED"
  | "INTEGRATION_UNAVAILABLE";

export type Result<T> =
  | { ok: true; data: T; requestId: string }
  | {
      ok: false;
      error: {
        code: ErrorCode;
        message: string;
        fieldErrors?: Record<string, string[]>;
      };
      requestId: string;
    };
