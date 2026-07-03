import { ref } from 'vue'
import { ref as dbRef, get } from 'firebase/database'
import type { GatheringWithId } from '~/helpers/gatherings'
import type { Gathering, GuestResponse } from '~/helpers/types'

// Display-name resolution for gatherings: guests of hosted gatherings and
// hosts of invitations. Names are cached for the lifetime of the composable.
export function useGatheringDisplay() {
  const db = useNuxtApp().$db
  const names = ref<Record<string, string>>({})

  async function resolveNames(sections: {
    hosting: GatheringWithId[]
    invited: GatheringWithId[]
    past?: GatheringWithId[]
  }) {
    const wanted = new Set<string>()
    for (const gathering of sections.hosting)
      Object.keys(gathering.guests ?? {}).forEach((guestUid) => wanted.add(guestUid))
    for (const gathering of sections.invited) wanted.add(gathering.host)
    for (const gathering of sections.past ?? []) wanted.add(gathering.host)
    const missing = [...wanted].filter((personUid) => !(personUid in names.value))
    await Promise.all(
      missing.map(async (personUid) => {
        try {
          const snap = await get(dbRef(db, `profiles/${personUid}/name`))
          names.value[personUid] = snap.val() ?? 'Unknown player'
        } catch {
          names.value[personUid] = 'Unknown player'
        }
      })
    )
  }

  function guestEntries(
    gathering: Gathering
  ): { uid: string; response: GuestResponse }[] {
    return Object.entries(gathering.guests ?? {}).map(([guestUid, response]) => ({
      uid: guestUid,
      response,
    }))
  }

  return { names, resolveNames, guestEntries }
}
