import { describe, it, expect } from 'vitest'
import { nextEmailInviteRateLimitState } from '../functions/src/emailInviteRateLimit'

const WINDOW_MS = 60 * 60 * 1000
const MAX = 20
const T0 = 1_800_000_000_000

const next = (
  current: Parameters<typeof nextEmailInviteRateLimitState>[0],
  now = T0
) => nextEmailInviteRateLimitState(current, now, WINDOW_MS, MAX)

describe('nextEmailInviteRateLimitState', () => {
  it('starts a fresh window at count 1 when there is no prior state', () => {
    expect(next(null)).toEqual({ windowStart: T0, count: 1 })
  })

  it('starts a fresh window when the previous one has elapsed', () => {
    const expired = { windowStart: T0 - WINDOW_MS - 1, count: MAX }
    expect(next(expired, T0)).toEqual({ windowStart: T0, count: 1 })
  })

  it('increments within an active window, preserving windowStart', () => {
    const current = { windowStart: T0, count: 5 }
    expect(next(current, T0 + 1000)).toEqual({ windowStart: T0, count: 6 })
  })

  it('allows the request that brings count up to the max', () => {
    const current = { windowStart: T0, count: MAX - 1 }
    expect(next(current, T0)).toEqual({ windowStart: T0, count: MAX })
  })

  it('denies (returns undefined) once count has reached the max', () => {
    const current = { windowStart: T0, count: MAX }
    expect(next(current, T0)).toBeUndefined()
  })

  it('denies further requests anywhere inside an exhausted window', () => {
    const current = { windowStart: T0, count: MAX }
    expect(next(current, T0 + WINDOW_MS - 1)).toBeUndefined()
  })

  it('is a fixed window with lazy reset, not a true sliding window', () => {
    // Documents the known, accepted tradeoff (see the comment on this
    // function) rather than a bug — exhaust a window right at its start,
    // then confirm a fresh window opens the instant windowMs has elapsed,
    // regardless of how the calls are spaced within either window.
    let state = next(null, T0)
    for (let i = 1; i < MAX; i++) state = next(state, T0 + i)
    expect(state?.count).toBe(MAX)
    expect(next(state, T0 + WINDOW_MS)).toBeUndefined()
    expect(next(state, T0 + WINDOW_MS + 1)).toEqual({
      windowStart: T0 + WINDOW_MS + 1,
      count: 1,
    })
  })
})
