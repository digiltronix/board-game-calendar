export type FormInstance = {
  validate(): Promise<{ valid: boolean }>
  reset(): void
  resetValidation(): void
}

// friendRequests/{toUid}/{fromUid}; only ever 'pending' — accepting or
// declining removes the entry
export type FriendRequestStatus = 'pending'

// profiles/{uid} — the public, search-visible profile node; private fields
// (phone, address, collection, friends) live under owner-only users/{uid}
export type Person = {
  name: string
  queryableName?: string
  queryableEmail?: string
  queryablePhone?: string
  isFriend?: boolean
  requestSent?: boolean
}

export type Friend = Person & {
  userId: string
}

export type Game = {
  id: string
  name: string
  thumbnail: string // always present in BGG
  minplayers?: string // nullable in BGG
  maxplayers?: string // nullable in BGG
  minplaytime?: string // nullable in BGG
  maxplaytime?: string // nullable in BGG
  yearpublished?: string // nullable in BGG
  categories?: string[] // BGG boardgamecategory values (genres); absent if none
  publicNote?: string
}

// users/{uid}/gameOpinions/{gameId} — owner-only; keyed by BGG game ID so
// opinions exist independently of the collection
export type GameOpinion = {
  name: string // denormalized so opinions on unowned games can be displayed
  rating?: number
  privateNote?: string
}

export type GatheringState = 'pending' | 'confirmed' | 'canceled'

// Keyed into Gathering.guests by uid; security rules let a guest write only
// their own entry
export type GuestResponse = 'invited' | 'accepted' | 'declined'

// Denormalized so guests can render game names without reading the host's
// collection
export type GatheringGame = Pick<Game, 'id' | 'name'>

// gatherings/{pushId}
export type Gathering = {
  state: GatheringState
  datetime: string // ISO date (UTC)
  timezone: string // IANA timezone of the host at creation time; used by
  // server-side code (email notifications) to display local time
  initiator: string // uid
  host: string // uid
  maxGuests: number
  // Optional free-text fields; written as null (RTDB delete) when cleared so
  // an edit-in-place update() actually removes the old value
  location?: string | null // where the gathering happens, shared with guests
  notes?: string | null // host notes ("bring snacks", parking info…)
  guests?: Record<string, GuestResponse> // keyed by guest uid
  games?: GatheringGame[]
  emailInvites?: Record<string, string> // pushId → email address (non-user invitees)
}

export type DisplayableItemType = {
  id: string
  name: string
  description: string
  image: string
  thumbnail: string
  url: string
  maxplayers: string
  maxplaytime: string
  minage: string
  minplayers: string
  minplaytime: string
  yearpublished: string
  categories: string[]
  incollection: boolean
}

export type BoardGameGeekThingItemType = {
  items: {
    item?: {
      $: {
        type: string
        id: string
      }
      description: string
      image: string
      maxplayers: { $: { value: string } }
      maxplaytime: { $: { value: string } }
      minage: { $: { value: string } }
      minplayers: { $: { value: string } }
      minplaytime: { $: { value: string } }
      yearpublished: { $: { value: string } }
      name:
        | { $: { type: string; value: string } }[]
        | { $: { type: string; value: string } }
    }
  }
}

export type BoardGameGeekSearchItemType = {
  $: { id: string; type: string }
  name: { $: { type: string; value: string } }
  yearpublished?: { $: { value: string } }
}

export type BoardGameGeekItemsType = {
  items: { item?: BoardGameGeekSearchItemType[] }
}

export type BoardGameSearchResult = {
  id: string
  name: string
  displayname: string
  yearpublished: string
}
