// Pure decision logic for the email-invite rate limiter, split out from
// index.ts so it can be unit-tested directly without pulling in
// firebase-admin's side-effecting initializeApp()/setGlobalOptions() calls
// that run at module load there.
export type EmailInviteRateLimitState = { windowStart: number; count: number }

// Fixed window, lazily reset on the first request after it elapses — not a
// true sliding window. A burst can land close to 2x the nominal rate right at
// the reset boundary (e.g. send `max` near the end of one window, then `max`
// again right after it resets ~windowMs later). Accepted: this is a
// blunt-force abuse throttle, not a precision fairness guarantee, and even 2x
// is still bounded — see EMAIL_INVITE_RATE_LIMIT_* in index.ts.
//
// Returns the next state to write, or undefined to signal "deny, write
// nothing" — passed straight into an RTDB transaction's update callback,
// where returning undefined aborts the transaction.
export function nextEmailInviteRateLimitState(
  current: EmailInviteRateLimitState | null,
  now: number,
  windowMs: number,
  max: number
): EmailInviteRateLimitState | undefined {
  if (!current || now - current.windowStart > windowMs) {
    return { windowStart: now, count: 1 }
  }
  if (current.count >= max) {
    return undefined
  }
  return { windowStart: current.windowStart, count: current.count + 1 }
}
