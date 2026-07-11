// Saved gathering locations — users/{uid}/savedLocations/{pushId}: string.
// A small owner-only history of addresses previously used on gatherings,
// surfaced as quick-fill chips on the gathering form.

export const MAX_SAVED_LOCATIONS = 5

// Case- and whitespace-insensitive comparison key
const normalize = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase()

// The profile address is a multi-line textarea; a gathering location is a
// single-line field, so newlines collapse to comma separators
export function addressToLocation(address: string): string {
  return address
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(', ')
}

export type SavedLocationPlan = {
  save: boolean // append the location to the saved list
  removeKeys: string[] // oldest entries to evict so the list stays capped
}

// Decides what to do with a gathering's location after a save: remember it
// unless it's empty, the host's own address (always offered anyway), or
// already in the list. Push keys sort chronologically, so the oldest entries
// are the lexicographically smallest keys.
export function savedLocationPlan(
  existing: Record<string, string>,
  location: string,
  ownAddress: string
): SavedLocationPlan {
  const skip: SavedLocationPlan = { save: false, removeKeys: [] }
  const key = normalize(location)
  if (!key) return skip
  if (key === normalize(addressToLocation(ownAddress))) return skip
  if (Object.values(existing).some((value) => normalize(value) === key))
    return skip
  const keys = Object.keys(existing).sort()
  return {
    save: true,
    removeKeys: keys.slice(0, Math.max(0, keys.length + 1 - MAX_SAVED_LOCATIONS)),
  }
}
