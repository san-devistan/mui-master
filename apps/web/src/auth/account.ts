// Better Auth's error codes, said the game's way.
const MESSAGES: Partial<Record<string, string>> = {
  INVALID_OTP: "That code isn't right. Check it and try again.",
  OTP_EXPIRED: "That code has expired. Send a new one.",
  TOO_MANY_ATTEMPTS: "Too many tries. Send a new code.",
  TOO_MANY_CODES: "Too many codes sent to this email. Try again later.",
  USERNAME_IS_ALREADY_TAKEN: "That username is taken. Try another.",
  USERNAME_TOO_SHORT: "Use at least 3 characters.",
  USERNAME_TOO_LONG: "Use 30 characters or fewer.",
  INVALID_USERNAME: "Use letters, numbers, dots and underscores only.",
}

export const explainAuthError = (error: { code?: string; message?: string }) =>
  (error.code ? MESSAGES[error.code] : undefined) ??
  error.message ??
  "That didn't work, try again."

// The username plugin's rules (convex/auth.ts), checked by the browser first. Names are unique
// whatever their case: the server compares them lowercased.
export const USERNAME_INPUT = {
  autoComplete: "username",
  placeholder: "your_name",
  minLength: 3,
  maxLength: 30,
  pattern: "[A-Za-z0-9_.]+",
  title: "Letters, numbers, dots and underscores",
} as const
