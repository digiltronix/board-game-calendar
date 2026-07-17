import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  ref,
  get,
  set,
  update,
  remove,
  query,
  orderByChild,
  startAt,
  endAt,
  limitToFirst,
} from 'firebase/database'

let testEnv: RulesTestEnvironment

const db = (
  uid?: string,
  claims?: { email?: string; email_verified?: boolean }
) =>
  uid
    ? testEnv.authenticatedContext(uid, claims).database()
    : testEnv.unauthenticatedContext().database()

// queryableEmail is bound to the verified auth token, so public-profile
// writes need a matching, verified token email
const alice = () =>
  db('alice', { email: 'alice@example.com', email_verified: true })

const seed = (path: string, value: unknown) =>
  testEnv.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), path), value)
  })

// profiles/{uid} — the search-visible public node
const alicePublicProfile = {
  name: 'Alice',
  queryableName: 'alice',
  queryableEmail: 'alice@example.com',
  queryablePhone: '5551234567',
}

// users/{uid} — the private, owner-only node
const alicePrivateProfile = {
  phoneNumber: '(555) 123-4567',
  address: '1 Main St',
  maxPeople: 6,
}

const baseGathering = {
  state: 'pending',
  datetime: '2026-07-01T19:00:00.000Z',
  initiator: 'host1',
  host: 'host1',
  maxGuests: 4,
  guests: { guest1: 'invited' },
  games: [{ id: '13', name: 'Catan' }],
}

beforeAll(async () => {
  const [host, port] = (
    process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9000'
  ).split(':')
  testEnv = await initializeTestEnvironment({
    projectId: 'board-game-calendar-3ae94',
    database: {
      rules: readFileSync('database.rules.json', 'utf8'),
      host,
      port: Number(port),
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearDatabase()
})

describe('public profile (profiles/) rules', () => {
  it('denies unauthenticated reads', async () => {
    await seed('profiles/alice', alicePublicProfile)
    await assertFails(get(ref(db(), 'profiles/alice')))
  })

  it('allows any authenticated user to read a public profile', async () => {
    await seed('profiles/alice', alicePublicProfile)
    await assertSucceeds(get(ref(db('bob'), 'profiles/alice')))
  })

  it('only lets a user write their own public profile', async () => {
    await assertSucceeds(
      set(ref(alice(), 'profiles/alice'), alicePublicProfile)
    )
    await assertFails(set(ref(db('bob'), 'profiles/alice'), alicePublicProfile))
  })

  it('permits the friend-search queries for signed-in users only', async () => {
    await seed('profiles/alice', alicePublicProfile)
    for (const [field, term] of [
      ['queryableName', 'ali'],
      ['queryableEmail', 'alice@'],
      ['queryablePhone', '5551234'],
    ] as const) {
      await assertSucceeds(
        get(
          query(
            ref(db('bob'), 'profiles'),
            orderByChild(field),
            startAt(term),
            endAt(term + '\uf8ff'),
            limitToFirst(10)
          )
        )
      )
    }
    await assertFails(
      get(
        query(
          ref(db(), 'profiles'),
          orderByChild('queryableName'),
          startAt('ali'),
          endAt('ali'),
          limitToFirst(10)
        )
      )
    )
  })

  it('binds queryableEmail to the verified auth token email', async () => {
    await assertSucceeds(
      set(ref(alice(), 'profiles/alice'), alicePublicProfile)
    )
    // bob claiming alice's email to show up in her search results
    await assertFails(
      set(
        ref(
          db('bob', { email: 'bob@example.com', email_verified: true }),
          'profiles/bob'
        ),
        {
          ...alicePublicProfile,
          name: 'Bob',
          queryableName: 'bob',
        }
      )
    )
  })

  it('rejects queryableEmail from an unverified email (signup squatting)', async () => {
    // mallory signed up with alice's address but never verified it
    const mallory = db('mallory', {
      email: 'alice@example.com',
      email_verified: false,
    })
    await assertFails(
      set(ref(mallory, 'profiles/mallory'), {
        name: 'Mallory',
        queryableName: 'mallory',
        queryableEmail: 'alice@example.com',
      })
    )
    // omitting the field entirely is fine
    await assertSucceeds(
      set(ref(mallory, 'profiles/mallory'), {
        name: 'Mallory',
        queryableName: 'mallory',
      })
    )
  })

  it('lets a now-stale token preserve an already-verified queryableEmail', async () => {
    await seed('profiles/alice', alicePublicProfile)
    const staleAlice = db('alice', {
      email: 'alice@example.com',
      email_verified: false,
    })
    // rewriting the unchanged value succeeds (profile saves replace the node)
    await assertSucceeds(
      set(ref(staleAlice, 'profiles/alice'), alicePublicProfile)
    )
    // but it cannot be used to introduce a new value
    await assertFails(
      set(ref(staleAlice, 'profiles/alice'), {
        ...alicePublicProfile,
        queryableEmail: 'other@example.com',
      })
    )
  })

  it('requires queryableName to match the lowercased name', async () => {
    await assertFails(
      set(ref(alice(), 'profiles/alice'), {
        ...alicePublicProfile,
        queryableName: 'totally different',
      })
    )
    // a partial update still sees the merged node, and the constraint is
    // symmetric: updating name alone can't drift away from queryableName
    await seed('profiles/alice', alicePublicProfile)
    await assertSucceeds(
      update(ref(alice(), 'profiles/alice'), {
        name: 'Alice B',
        queryableName: 'alice b',
      })
    )
    await assertFails(
      update(ref(alice(), 'profiles/alice'), { name: 'Alice C' })
    )
    await assertFails(
      update(ref(alice(), 'profiles/alice'), { queryableName: 'alice c' })
    )
  })

  it('requires queryablePhone to be digits only', async () => {
    await assertFails(
      set(ref(alice(), 'profiles/alice'), {
        ...alicePublicProfile,
        queryablePhone: '(555) 123-4567',
      })
    )
  })

  it('rejects unknown keys on a public profile', async () => {
    await assertFails(
      set(ref(alice(), 'profiles/alice'), {
        ...alicePublicProfile,
        address: '1 Main St',
      })
    )
  })
})

describe('private profile (users/) rules', () => {
  it('lets only the owner read their private profile', async () => {
    await seed('users/alice', alicePrivateProfile)
    await assertSucceeds(get(ref(db('alice'), 'users/alice')))
    await assertFails(get(ref(db('bob'), 'users/alice')))
    await assertFails(get(ref(db(), 'users/alice')))
  })

  it('only lets a user write their own private profile', async () => {
    await assertSucceeds(
      set(ref(db('alice'), 'users/alice'), alicePrivateProfile)
    )
    await assertFails(set(ref(db('bob'), 'users/alice'), alicePrivateProfile))
  })

  it('validates field types and lengths', async () => {
    await assertFails(
      set(ref(db('alice'), 'users/alice'), {
        ...alicePrivateProfile,
        maxPeople: '6',
      })
    )
    await assertFails(
      set(ref(db('alice'), 'users/alice'), {
        ...alicePrivateProfile,
        address: 'x'.repeat(501),
      })
    )
    await assertSucceeds(
      set(ref(db('alice'), 'users/alice/collection/g1'), {
        id: '13',
        name: 'Catan',
      })
    )
    await assertFails(
      set(ref(db('alice'), 'users/alice/collection/g1'), {
        id: '1'.repeat(21), // exceeds the 20-char id limit
        name: 'Catan',
      })
    )
  })

  it('keeps the game collection (incl. privateNote) owner-only', async () => {
    await seed('users/alice/collection/g1', {
      id: '13',
      name: 'Catan',
      privateNote: 'only for alice',
    })
    await assertSucceeds(get(ref(db('alice'), 'users/alice/collection')))
    await assertFails(get(ref(db('bob'), 'users/alice/collection')))
  })

  it('rejects unknown keys under a private profile', async () => {
    await assertFails(
      set(ref(db('alice'), 'users/alice'), {
        ...alicePrivateProfile,
        junk: 'x',
      })
    )
    await assertFails(set(ref(db('alice'), 'users/alice/email'), 'a@b.co'))
    await assertFails(
      set(ref(db('alice'), 'users/alice/collection/g1'), {
        id: '13',
        name: 'Catan',
        junk: 'x',
      })
    )
  })

  it('accepts a categories array of short strings, rejects oversized/non-string', async () => {
    await assertSucceeds(
      set(ref(db('alice'), 'users/alice/collection/g1'), {
        id: '13',
        name: 'Catan',
        categories: ['Economic', 'Negotiation'],
      })
    )
    await assertFails(
      set(ref(db('alice'), 'users/alice/collection/g2'), {
        id: '14',
        name: 'Brass',
        categories: ['x'.repeat(61)],
      })
    )
    await assertFails(
      set(ref(db('alice'), 'users/alice/collection/g3'), {
        id: '15',
        name: 'Azul',
        categories: [42],
      })
    )
  })

  it('validates savedLocations entries and keeps them owner-only', async () => {
    await assertSucceeds(
      set(ref(db('alice'), 'users/alice/savedLocations/loc1'), '99 Elm St')
    )
    await assertFails(
      set(ref(db('alice'), 'users/alice/savedLocations/loc2'), 'x'.repeat(201))
    )
    await assertFails(
      set(ref(db('alice'), 'users/alice/savedLocations/loc3'), '')
    )
    await assertFails(
      set(ref(db('alice'), 'users/alice/savedLocations/loc4'), 42)
    )
    await assertFails(
      set(ref(db('bob'), 'users/alice/savedLocations/loc5'), '99 Elm St')
    )
    await assertFails(get(ref(db('bob'), 'users/alice/savedLocations')))
  })

  it('validates fcmTokens entries and keeps them owner-only', async () => {
    await assertSucceeds(
      set(ref(db('alice'), 'users/alice/fcmTokens/token123'), Date.now())
    )
    await assertFails(
      set(ref(db('alice'), 'users/alice/fcmTokens/token123'), 'not-a-number')
    )
    await assertFails(
      set(ref(db('alice'), 'users/alice/fcmTokens/token123'), -1)
    )
    await assertFails(
      set(ref(db('bob'), 'users/alice/fcmTokens/token999'), Date.now())
    )
    await assertFails(get(ref(db('bob'), 'users/alice/fcmTokens')))
    await assertFails(
      set(ref(db('alice'), `users/alice/fcmTokens/${'x'.repeat(4097)}`), Date.now())
    )
  })

  it('allows the atomic profile save across users/ and profiles/', async () => {
    await assertSucceeds(
      update(ref(alice()), {
        'profiles/alice': alicePublicProfile,
        'users/alice/phoneNumber': '(555) 123-4567',
        'users/alice/address': '1 Main St',
        'users/alice/maxPeople': 6,
      })
    )
  })
})

describe('friend request rules', () => {
  it('lets a user send a pending request under their own uid', async () => {
    await assertSucceeds(
      set(ref(db('bob'), 'friendRequests/alice/bob'), 'pending')
    )
  })

  it('rejects values other than pending', async () => {
    await assertFails(
      set(ref(db('bob'), 'friendRequests/alice/bob'), 'accepted')
    )
  })

  it('blocks sending a request under someone else uid', async () => {
    await assertFails(
      set(ref(db('mallory'), 'friendRequests/alice/bob'), 'pending')
    )
  })

  it('blocks overwriting an existing request', async () => {
    await seed('friendRequests/alice/bob', 'pending')
    await assertFails(
      set(ref(db('bob'), 'friendRequests/alice/bob'), 'pending')
    )
  })

  it('blocks requests from a sender the recipient has blocked', async () => {
    await seed('blocked/alice/bob', true)
    await assertFails(
      set(ref(db('bob'), 'friendRequests/alice/bob'), 'pending')
    )
    // the block is directional: alice can still request bob
    await assertSucceeds(
      set(ref(db('alice'), 'friendRequests/bob/alice'), 'pending')
    )
  })

  it('lets only the recipient delete a request', async () => {
    await seed('friendRequests/alice/bob', 'pending')
    await assertFails(remove(ref(db('bob'), 'friendRequests/alice/bob')))
    await assertFails(remove(ref(db('mallory'), 'friendRequests/alice/bob')))
    await assertSucceeds(remove(ref(db('alice'), 'friendRequests/alice/bob')))
  })

  it('lets the recipient read incoming requests and the sender their own entry', async () => {
    await seed('friendRequests/alice/bob', 'pending')
    await assertSucceeds(get(ref(db('alice'), 'friendRequests/alice')))
    await assertSucceeds(get(ref(db('bob'), 'friendRequests/alice/bob')))
    await assertFails(get(ref(db('mallory'), 'friendRequests/alice')))
    await assertFails(get(ref(db('mallory'), 'friendRequests/alice/bob')))
  })

  it('lets the recipient accept via the mutual multi-path update', async () => {
    await seed('friendRequests/alice/bob', 'pending')
    await assertSucceeds(
      update(ref(db('alice')), {
        'users/alice/friends/bob': true,
        'users/bob/friends/alice': true,
        'friendRequests/alice/bob': null,
      })
    )
  })

  it('blocks writing into another users friends list without a pending request', async () => {
    await assertFails(set(ref(db('alice'), 'users/bob/friends/alice'), true))
    await assertFails(set(ref(db('mallory'), 'users/bob/friends/alice'), true))
  })

  it('blocks the forged-request self-insert (request authored by the recipient)', async () => {
    // mallory cannot forge a "request from bob": requests live top-level and
    // only the sender can create them
    await assertFails(
      set(ref(db('mallory'), 'friendRequests/mallory/bob'), 'pending')
    )
    // and without a real request from bob, she cannot add herself to his list
    await assertFails(
      set(ref(db('mallory'), 'users/bob/friends/mallory'), true)
    )
  })

  it('keeps friends lists private to their owner', async () => {
    await seed('users/alice/friends/bob', true)
    await assertSucceeds(get(ref(db('alice'), 'users/alice/friends')))
    await assertFails(get(ref(db('bob'), 'users/alice/friends')))
  })

  it('lets the decline flow remove the request and block the sender', async () => {
    await seed('friendRequests/alice/bob', 'pending')
    await assertSucceeds(
      update(ref(db('alice')), {
        'blocked/alice/bob': true,
        'friendRequests/alice/bob': null,
      })
    )
  })

  it('lets a user remove themselves from a friends list (mutual unfriend)', async () => {
    await seed('users/alice/friends/bob', true)
    await seed('users/bob/friends/alice', true)
    await assertSucceeds(
      update(ref(db('alice')), {
        'users/alice/friends/bob': null,
        'users/bob/friends/alice': null,
      })
    )
  })
})

describe('blocked list rules', () => {
  it('lets only the owner write their blocked list', async () => {
    await assertSucceeds(set(ref(db('alice'), 'blocked/alice/bob'), true))
    await assertFails(set(ref(db('bob'), 'blocked/alice/bob'), true))
  })

  it('only allows true as a blocked value', async () => {
    await assertFails(set(ref(db('alice'), 'blocked/alice/bob'), false))
    await assertFails(set(ref(db('alice'), 'blocked/alice/bob'), 'blocked'))
  })

  it('lets only the owner read their blocked list', async () => {
    await seed('blocked/alice/bob', true)
    await assertSucceeds(get(ref(db('alice'), 'blocked/alice')))
    await assertFails(get(ref(db('bob'), 'blocked/alice')))
    await assertFails(get(ref(db('bob'), 'blocked/alice/bob')))
  })
})

// the invite gate: a host may only invite users whose own friends list
// contains the host (i.e. mutual friendship, which the host cannot forge)
const seedFriendship = (guestUid: string, hostUid: string) =>
  seed(`users/${guestUid}/friends/${hostUid}`, true)

describe('gatherings rules', () => {
  it('lets only the host and invited guests read a gathering', async () => {
    await seed('gatherings/g1', baseGathering)
    await assertSucceeds(get(ref(db('host1'), 'gatherings/g1')))
    await assertSucceeds(get(ref(db('guest1'), 'gatherings/g1')))
    await assertFails(get(ref(db('stranger'), 'gatherings/g1')))
    await assertFails(get(ref(db(), 'gatherings/g1')))
  })

  it('blocks listing all gatherings, even for signed-in users', async () => {
    await seed('gatherings/g1', baseGathering)
    await assertFails(get(ref(db('host1'), 'gatherings')))
    await assertFails(get(ref(db('stranger'), 'gatherings')))
  })

  it('lets a user create a gathering only with themselves as host', async () => {
    await seedFriendship('guest1', 'host1')
    await assertSucceeds(set(ref(db('host1'), 'gatherings/g1'), baseGathering))
    await assertFails(
      set(ref(db('mallory'), 'gatherings/g2'), {
        ...baseGathering,
        host: 'host1',
      })
    )
  })

  it('only lets a host invite users who have friended them back', async () => {
    // stranger1 has not friended host1
    await assertFails(
      set(ref(db('host1'), 'gatherings/g1'), {
        ...baseGathering,
        guests: { stranger1: 'invited' },
      })
    )
    // a one-sided "friendship" the host wrote into their own list doesn't count
    await seed('users/host1/friends/stranger1', true)
    await assertFails(
      set(ref(db('host1'), 'gatherings/g1'), {
        ...baseGathering,
        guests: { stranger1: 'invited' },
      })
    )
    await seedFriendship('stranger1', 'host1')
    await assertSucceeds(
      set(ref(db('host1'), 'gatherings/g1'), {
        ...baseGathering,
        guests: { stranger1: 'invited' },
      })
    )
  })

  it('lets only the host modify or delete a gathering', async () => {
    await seed('gatherings/g1', baseGathering)
    await assertSucceeds(
      update(ref(db('host1'), 'gatherings/g1'), { state: 'confirmed' })
    )
    await assertFails(
      update(ref(db('guest1'), 'gatherings/g1'), { state: 'confirmed' })
    )
    await assertFails(remove(ref(db('guest1'), 'gatherings/g1')))
    await assertSucceeds(remove(ref(db('host1'), 'gatherings/g1')))
  })

  it('keeps host immutable after creation', async () => {
    await seed('gatherings/g1', baseGathering)
    await assertFails(
      update(ref(db('host1'), 'gatherings/g1'), { host: 'alice' })
    )
  })

  it('pins initiator to the creator and keeps it immutable', async () => {
    await seedFriendship('guest1', 'host1')
    await assertFails(
      set(ref(db('host1'), 'gatherings/g1'), {
        ...baseGathering,
        initiator: 'alice',
      })
    )
    await seed('gatherings/g1', baseGathering)
    await assertFails(
      update(ref(db('host1'), 'gatherings/g1'), { initiator: 'alice' })
    )
  })

  it('validates gathering state values', async () => {
    await seedFriendship('guest1', 'host1')
    await assertFails(
      set(ref(db('host1'), 'gatherings/g1'), {
        ...baseGathering,
        state: 'partying',
      })
    )
  })

  it('accepts optional location and notes within their length limits', async () => {
    await seedFriendship('guest1', 'host1')
    await assertSucceeds(
      set(ref(db('host1'), 'gatherings/g1'), {
        ...baseGathering,
        location: '1 Main St, Apt 2',
        notes: 'Bring snacks',
      })
    )
    // clearing them (null) is a delete, not a validate failure
    await assertSucceeds(
      update(ref(db('host1'), 'gatherings/g1'), {
        location: null,
        notes: null,
      })
    )
  })

  it('rejects oversized or non-string location and notes', async () => {
    await seed('gatherings/g1', baseGathering)
    await assertFails(
      update(ref(db('host1'), 'gatherings/g1'), { location: 'x'.repeat(201) })
    )
    await assertFails(
      update(ref(db('host1'), 'gatherings/g1'), { notes: 'x'.repeat(501) })
    )
    await assertFails(
      update(ref(db('host1'), 'gatherings/g1'), { location: 42 })
    )
  })

  it('rejects unknown keys on a gathering', async () => {
    await seedFriendship('guest1', 'host1')
    await assertFails(
      set(ref(db('host1'), 'gatherings/g1'), { ...baseGathering, junk: 'x' })
    )
    await assertFails(
      set(ref(db('host1'), 'gatherings/g1'), {
        ...baseGathering,
        games: [{ id: '13', name: 'Catan', junk: 'x' }],
      })
    )
  })

  it('lets an invited guest update only their own response', async () => {
    await seed('gatherings/g1', baseGathering)
    await assertSucceeds(
      set(ref(db('guest1'), 'gatherings/g1/guests/guest1'), 'accepted')
    )
    await assertFails(
      set(ref(db('mallory'), 'gatherings/g1/guests/guest1'), 'declined')
    )
    await assertFails(
      set(ref(db('guest1'), 'gatherings/g1/guests/guest1'), 'maybe')
    )
  })

  it('blocks the host from answering on a guest behalf', async () => {
    await seedFriendship('guest1', 'host1')
    await seedFriendship('guest2', 'host1')
    // seeding 'invited' and preserving an existing response are fine...
    await assertSucceeds(set(ref(db('host1'), 'gatherings/g1'), baseGathering))
    await seed('gatherings/g1/guests/guest1', 'accepted')
    await assertSucceeds(
      update(ref(db('host1'), 'gatherings/g1'), {
        guests: { guest1: 'accepted', guest2: 'invited' },
      })
    )
    // ...but the host cannot flip a guest to accepted/declined themselves
    await assertFails(
      update(ref(db('host1'), 'gatherings/g1'), {
        guests: { guest1: 'accepted', guest2: 'accepted' },
      })
    )
    await assertFails(
      set(ref(db('host1'), 'gatherings/g2'), {
        ...baseGathering,
        guests: { guest1: 'accepted' },
      })
    )
  })

  it('keeps a preserved response valid even after the friendship ends', async () => {
    await seed('gatherings/g1', baseGathering)
    await seed('gatherings/g1/guests/guest1', 'accepted')
    // no users/guest1/friends/host1 seeded — friendship is gone, but the
    // host's edit rewrites the existing response unchanged
    await assertSucceeds(
      update(ref(db('host1'), 'gatherings/g1'), {
        guests: { guest1: 'accepted' },
      })
    )
  })

  it('blocks uninvited users from writing a guest response', async () => {
    await seed('gatherings/g1', baseGathering)
    await assertFails(
      set(ref(db('walkin'), 'gatherings/g1/guests/walkin'), 'accepted')
    )
  })
})

describe('userGatherings index rules', () => {
  it('lets only the owner read their index', async () => {
    await seed('userGatherings/guest1/g1', true)
    await assertSucceeds(get(ref(db('guest1'), 'userGatherings/guest1')))
    await assertFails(get(ref(db('host1'), 'userGatherings/guest1')))
    await assertFails(get(ref(db(), 'userGatherings/guest1')))
  })

  it('lets the host index themselves and actual guests after creating', async () => {
    await seed('gatherings/g1', baseGathering)
    await assertSucceeds(
      update(ref(db('host1')), {
        'userGatherings/host1/g1': true,
        'userGatherings/guest1/g1': true,
      })
    )
  })

  it('blocks indexing users who are not participants of the gathering', async () => {
    await seed('gatherings/g1', baseGathering)
    await assertFails(
      set(ref(db('host1'), 'userGatherings/stranger1/g1'), true)
    )
  })

  it('blocks non-hosts from writing index entries', async () => {
    await seed('gatherings/g1', baseGathering)
    await assertFails(
      set(ref(db('mallory'), 'userGatherings/mallory/g1'), true)
    )
    await assertFails(set(ref(db('guest1'), 'userGatherings/guest1/g1'), true))
  })

  it('rejects entries pointing at nonexistent gatherings', async () => {
    await assertFails(set(ref(db('host1'), 'userGatherings/host1/ghost'), true))
  })

  it('only allows true as an index value', async () => {
    await seed('gatherings/g1', baseGathering)
    await assertFails(set(ref(db('host1'), 'userGatherings/host1/g1'), 'yes'))
  })

  it('lets a user always remove their own entry (dangling-pointer cleanup)', async () => {
    await seed('userGatherings/guest1/ghost', true)
    await assertFails(remove(ref(db('mallory'), 'userGatherings/guest1/ghost')))
    await assertSucceeds(
      remove(ref(db('guest1'), 'userGatherings/guest1/ghost'))
    )
  })

  it('lets the host remove a guest entry while uninviting', async () => {
    await seed('gatherings/g1', baseGathering)
    await seed('userGatherings/guest1/g1', true)
    await assertSucceeds(remove(ref(db('host1'), 'userGatherings/guest1/g1')))
  })

  it('supports the atomic delete of a gathering and all its index entries', async () => {
    await seed('gatherings/g1', baseGathering)
    await seed('userGatherings/host1/g1', true)
    await seed('userGatherings/guest1/g1', true)
    await assertSucceeds(
      update(ref(db('host1')), {
        'gatherings/g1': null,
        'userGatherings/host1/g1': null,
        'userGatherings/guest1/g1': null,
      })
    )
  })
})

// emailInviteIndex/{emailHash}/{gatheringId} lets a guest discover an email
// invite without the exact Accept/Decline link (see listMyEmailInvites in
// functions). It carries no rule of its own on purpose — reads and writes
// must stay Cloud-Functions-only (admin SDK bypasses rules entirely), since
// the index exists specifically so no client query can enumerate it.
describe('emailInviteIndex rules', () => {
  it('is unreadable and unwritable by every client, host or otherwise', async () => {
    await seed('emailInviteIndex/deadbeef/g1', true)
    await assertFails(get(ref(db('host1'), 'emailInviteIndex/deadbeef')))
    await assertFails(get(ref(db('host1'), 'emailInviteIndex/deadbeef/g1')))
    await assertFails(get(ref(db(), 'emailInviteIndex/deadbeef')))
    await assertFails(
      set(ref(db('host1'), 'emailInviteIndex/deadbeef/g1'), true)
    )
    await assertFails(
      set(ref(db('mallory'), 'emailInviteIndex/anything/g1'), true)
    )
  })
})

// emailInviteRateLimit/{uid} throttles how many email invites one account can
// send per rolling window (see tryConsumeEmailInviteQuota in functions). Like
// emailInviteIndex, it carries no rule of its own on purpose — a client that
// could read or write its own counter could reset or inflate it, defeating
// the whole point.
describe('emailInviteRateLimit rules', () => {
  it('is unreadable and unwritable by every client, including the owning account', async () => {
    await seed('emailInviteRateLimit/host1', { windowStart: 0, count: 20 })
    await assertFails(get(ref(db('host1'), 'emailInviteRateLimit/host1')))
    await assertFails(get(ref(db(), 'emailInviteRateLimit/host1')))
    await assertFails(
      set(ref(db('host1'), 'emailInviteRateLimit/host1'), {
        windowStart: 0,
        count: 0,
      })
    )
    await assertFails(
      set(ref(db('mallory'), 'emailInviteRateLimit/host1/count'), 0)
    )
  })
})
