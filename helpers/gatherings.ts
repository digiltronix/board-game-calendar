import { GATHERING_DURATION_HOURS } from './calendar'
import type { Game, Gathering, GatheringState, GuestResponse } from './types'

export type GatheringWithId = Gathering & { id: string }

const byDatetime = (a: GatheringWithId, b: GatheringWithId) =>
  a.datetime.localeCompare(b.datetime)

// A gathering counts as past once its full play window has elapsed, so
// tonight's game night stays in the upcoming sections while it's happening.
export function isPast(gathering: Gathering, now: Date): boolean {
  const start = new Date(gathering.datetime).getTime()
  if (Number.isNaN(start)) return false
  return start + GATHERING_DURATION_HOURS * 60 * 60 * 1000 < now.getTime()
}

// Splits the user's gatherings (loaded via their userGatherings/{uid} index,
// so all are ones they host or are invited to) into the calendar sections.
// Upcoming ones are split into hosting/invited (soonest first); past ones land
// in a single section, most recent first.
export function splitGatherings(
  gatherings: GatheringWithId[],
  uid: string,
  now: Date = new Date()
) {
  const relevant = gatherings.filter(
    (g) => g.host === uid || g.guests?.[uid] !== undefined
  )
  const upcoming = relevant.filter((g) => !isPast(g, now))
  return {
    hosting: upcoming.filter((g) => g.host === uid).sort(byDatetime),
    invited: upcoming.filter((g) => g.host !== uid).sort(byDatetime),
    past: relevant
      .filter((g) => isPast(g, now))
      .sort((a, b) => byDatetime(b, a)),
  }
}

export function acceptedCount(gathering: Gathering): number {
  return Object.values(gathering.guests ?? {}).filter(
    (response) => response === 'accepted'
  ).length
}

export function isFull(gathering: Gathering): boolean {
  return gathering.maxGuests > 0 && acceptedCount(gathering) >= gathering.maxGuests
}

export function stateColor(state: GatheringState): string {
  return (
    { pending: 'warning', confirmed: 'success', canceled: 'error' }[state] ??
    'info'
  )
}

export function responseColor(response: GuestResponse): string {
  return (
    { invited: 'warning', accepted: 'success', declined: 'error' }[response] ??
    'info'
  )
}

export function responseIcon(response: GuestResponse): string {
  return (
    {
      invited: '$helpCircleOutline',
      accepted: '$checkCircleOutline',
      declined: '$closeCircleOutline',
    }[response] ?? '$helpCircleOutline'
  )
}

export type FriendCollection = { name: string; games: Game[] }

// Builds the "Games to play" select items for the gathering form: the host's
// own collection, plus friends' collections so a game night can pull from
// whoever owns it. A game already in the host's own collection is listed
// once with no subtitle (the host can bring it regardless of who else owns
// it); a game only friends own gets their name(s) as the item subtitle so
// the host knows whose copy they're picking.
export function buildGameItems(
  ownGames: Game[],
  friendCollections: FriendCollection[]
): {
  items: { title: string; subtitle?: string; value: string }[]
  gamesById: Record<string, Game>
} {
  const gamesById: Record<string, Game> = {}
  const ownerNames: Record<string, string[]> = {}

  for (const game of ownGames) {
    gamesById[game.id] = game
  }

  for (const { name, games } of friendCollections) {
    for (const game of games) {
      if (ownGames.some((owned) => owned.id === game.id)) continue
      if (!gamesById[game.id]) {
        gamesById[game.id] = game
        ownerNames[game.id] = [name]
      } else if (!ownerNames[game.id].includes(name)) {
        ownerNames[game.id].push(name)
      }
    }
  }

  const items = Object.values(gamesById)
    .map((game) => {
      const owners = ownerNames[game.id]
      return {
        title: game.name,
        subtitle: owners?.length ? owners.join(', ') : undefined,
        value: game.id,
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))

  return { items, gamesById }
}

export function formatDatetime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
