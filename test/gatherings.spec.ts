import { describe, it, expect } from 'vitest'
import {
  splitGatherings,
  isPast,
  acceptedCount,
  isFull,
  stateColor,
  buildGameItems,
  type GatheringWithId,
} from '~/helpers/gatherings'
import type { Gathering, Game } from '~/helpers/types'

const NOW = new Date('2026-07-03T12:00:00.000Z')
const FUTURE = '2026-07-10T19:00:00.000Z'
const PAST = '2026-06-20T19:00:00.000Z'

function gathering(overrides: Partial<GatheringWithId>): GatheringWithId {
  return {
    id: 'g',
    state: 'pending',
    datetime: FUTURE,
    timezone: 'America/Chicago',
    initiator: 'host1',
    host: 'host1',
    maxGuests: 4,
    ...overrides,
  }
}

describe('isPast', () => {
  it('keeps a gathering upcoming through its full play window', () => {
    // started 2h before NOW: still inside the 3h window
    expect(isPast(gathering({ datetime: '2026-07-03T10:00:00.000Z' }), NOW)).toBe(
      false
    )
    // started 4h before NOW: window elapsed
    expect(isPast(gathering({ datetime: '2026-07-03T08:00:00.000Z' }), NOW)).toBe(
      true
    )
  })

  it('never classifies an unparseable datetime as past', () => {
    expect(isPast(gathering({ datetime: 'not-a-date' }), NOW)).toBe(false)
  })
})

describe('splitGatherings', () => {
  it('splits upcoming gatherings into hosting and invited sections', () => {
    const all = [
      gathering({ id: 'mine', host: 'me' }),
      gathering({ id: 'inv', guests: { me: 'invited' } }),
      gathering({ id: 'other' }),
    ]
    const { hosting, invited, past } = splitGatherings(all, 'me', NOW)
    expect(hosting.map((g) => g.id)).toEqual(['mine'])
    expect(invited.map((g) => g.id)).toEqual(['inv'])
    expect(past).toEqual([])
  })

  it('sorts upcoming sections by datetime ascending', () => {
    const all = [
      gathering({ id: 'later', host: 'me', datetime: '2026-08-01T19:00:00.000Z' }),
      gathering({ id: 'sooner', host: 'me', datetime: FUTURE }),
    ]
    expect(splitGatherings(all, 'me', NOW).hosting.map((g) => g.id)).toEqual([
      'sooner',
      'later',
    ])
  })

  it('moves elapsed gatherings into a single past section, most recent first', () => {
    const all = [
      gathering({ id: 'up', host: 'me' }),
      gathering({ id: 'old-hosted', host: 'me', datetime: PAST }),
      gathering({
        id: 'old-invited',
        guests: { me: 'accepted' },
        datetime: '2026-06-25T19:00:00.000Z',
      }),
    ]
    const { hosting, invited, past } = splitGatherings(all, 'me', NOW)
    expect(hosting.map((g) => g.id)).toEqual(['up'])
    expect(invited).toEqual([])
    expect(past.map((g) => g.id)).toEqual(['old-invited', 'old-hosted'])
  })

  it('excludes past gatherings the user was never part of', () => {
    const all = [gathering({ id: 'other', datetime: PAST })]
    expect(splitGatherings(all, 'me', NOW).past).toEqual([])
  })
})

describe('capacity helpers', () => {
  const guests: Gathering['guests'] = {
    a: 'accepted',
    b: 'accepted',
    c: 'declined',
    d: 'invited',
  }

  it('counts only accepted guests', () => {
    expect(acceptedCount(gathering({ guests }))).toBe(2)
    expect(acceptedCount(gathering({}))).toBe(0)
  })

  it('reports fullness against maxGuests', () => {
    expect(isFull(gathering({ guests, maxGuests: 2 }))).toBe(true)
    expect(isFull(gathering({ guests, maxGuests: 3 }))).toBe(false)
    // maxGuests 0 means "no limit set"
    expect(isFull(gathering({ guests, maxGuests: 0 }))).toBe(false)
  })
})

describe('stateColor', () => {
  it('maps states to theme colors', () => {
    expect(stateColor('pending')).toBe('warning')
    expect(stateColor('confirmed')).toBe('success')
    expect(stateColor('canceled')).toBe('error')
  })
})

function game(overrides: Partial<Game>): Game {
  return { id: 'g1', name: 'Catan', thumbnail: '', ...overrides }
}

describe('buildGameItems', () => {
  it('lists the host own games unsuffixed', () => {
    const { items } = buildGameItems([game({ id: '1', name: 'Catan' })], [])
    expect(items).toEqual([{ title: 'Catan', value: '1' }])
  })

  it('suffixes a friend-only game with the friend name', () => {
    const { items } = buildGameItems(
      [],
      [{ name: 'Alex', games: [game({ id: '2', name: 'Wingspan' })] }]
    )
    expect(items).toEqual([{ title: 'Wingspan (Alex)', value: '2' }])
  })

  it('joins multiple friend owners of the same game', () => {
    const { items } = buildGameItems(
      [],
      [
        { name: 'Alex', games: [game({ id: '2', name: 'Wingspan' })] },
        { name: 'Sam', games: [game({ id: '2', name: 'Wingspan' })] },
      ]
    )
    expect(items).toEqual([{ title: 'Wingspan (Alex, Sam)', value: '2' }])
  })

  it('leaves a game the host already owns unsuffixed even if a friend also owns it', () => {
    const { items, gamesById } = buildGameItems(
      [game({ id: '1', name: 'Catan' })],
      [{ name: 'Alex', games: [game({ id: '1', name: 'Catan' })] }]
    )
    expect(items).toEqual([{ title: 'Catan', value: '1' }])
    expect(gamesById['1'].name).toBe('Catan')
  })

  it('sorts items by title', () => {
    const { items } = buildGameItems(
      [game({ id: '2', name: 'Wingspan' })],
      [{ name: 'Alex', games: [game({ id: '1', name: 'Azul' })] }]
    )
    expect(items.map((i) => i.title)).toEqual(['Azul (Alex)', 'Wingspan'])
  })
})
