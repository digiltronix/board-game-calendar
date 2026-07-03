import { setGlobalOptions } from 'firebase-functions'
import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https'
import {
  onValueCreated,
  onValueUpdated,
  onValueWritten,
} from 'firebase-functions/v2/database'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'
import { parseString } from 'xml2js'
import { promisify } from 'util'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

initializeApp()

const BGG_API_KEY = defineSecret('BGG_API_KEY')
const RESEND_API_KEY = defineSecret('RESEND_API_KEY')
const FACEBOOK_APP_SECRET = defineSecret('FACEBOOK_APP_SECRET')

const parseXml = promisify(parseString)

// BGG search only supports a fixed set of item types; allowlist to avoid
// forwarding arbitrary strings to the upstream API.
const ALLOWED_BGG_TYPES = new Set([
  'boardgame',
  'boardgameexpansion',
  'boardgameaccessory',
])

const BGG_BASE_URL = 'https://boardgamegeek.com/xmlapi2'

// The 2nd-gen RTDB→Eventarc triggers below run as this service account. We pin
// the scoped firebase-adminsdk SA for least privilege — the project's default
// compute SA carries the broad roles/editor, which we don't want functions
// running as. firebase-adminsdk-fbsvc already has the RTDB read + Firebase Auth
// access these functions need, and secret access (BGG_API_KEY, RESEND_API_KEY)
// is auto-granted at deploy time.
//
// ONE-TIME SETUP: this SA must hold roles/eventarc.eventReceiver or deploys fail
// trigger validation with "Permission 'eventarc.events.receiveEvent' denied".
// It's a persistent grant (CD never touches IAM), so run it once:
//   gcloud projects add-iam-policy-binding board-game-calendar-3ae94 \
//     --member="serviceAccount:firebase-adminsdk-fbsvc@board-game-calendar-3ae94.iam.gserviceaccount.com" \
//     --role="roles/eventarc.eventReceiver"
setGlobalOptions({
  maxInstances: 5,
  serviceAccount:
    'firebase-adminsdk-fbsvc@board-game-calendar-3ae94.iam.gserviceaccount.com',
})

// xml2js wraps repeated XML elements as arrays but single occurrences as plain
// objects, so any field may be either. Always normalise to the first element.
function first(node: unknown): unknown {
  return Array.isArray(node) ? node[0] : node
}

// Safely read a BGG AttrValue: { $: { value: string } }
// Handles both the plain-object and single-element-array forms xml2js may emit.
function attrValue(node: unknown): string | null {
  const n = first(node)
  if (n == null || typeof n !== 'object') return null
  const $ = (n as Record<string, unknown>).$
  if ($ == null || typeof $ !== 'object') return null
  const v = ($ as Record<string, unknown>).value
  return typeof v === 'string' ? v : null
}

// Safely read item.$.prop
function itemAttr(item: unknown, prop: string): string | null {
  const n = first(item)
  if (n == null || typeof n !== 'object') return null
  const $ = (n as Record<string, unknown>).$
  if ($ == null || typeof $ !== 'object') return null
  const v = ($ as Record<string, unknown>)[prop]
  return typeof v === 'string' ? v : null
}

// BGG `thing` items carry repeated <link type="..." value="..."> elements
// (categories, mechanics, families). Collect the values of a given link type.
// `boardgamecategory` is BGG's genre concept (Economic, Fantasy, Card Game…).
function linkValues(itemObj: Record<string, unknown>, type: string): string[] {
  const node = itemObj.link
  if (node == null) return []
  const arr: unknown[] = Array.isArray(node) ? node : [node]
  return arr
    .filter((l) => itemAttr(l, 'type') === type)
    .map((l) => itemAttr(l, 'value'))
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
}

export const bggSearch = onCall(
  { enforceAppCheck: true, secrets: [BGG_API_KEY] },
  async (request) => {
    const { query, type } = request.data as { query: string; type: string }
    if (!query || !type)
      throw new HttpsError('invalid-argument', 'Missing query or type')
    if (!ALLOWED_BGG_TYPES.has(type))
      throw new HttpsError('invalid-argument', 'Invalid type')

    const params = new URLSearchParams({ query, type }).toString()
    const url = `${BGG_BASE_URL}/search?${params}`
    console.log(`Proxying search to BGG: ${url}`)

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${BGG_API_KEY.value()}` },
    })
    if (!response.ok)
      throw new HttpsError('internal', `BGG error: ${response.statusText}`)

    const xml = await response.text()

    let parsed: unknown
    try {
      parsed = await parseXml(xml)
    } catch (err) {
      console.error(
        'Failed to parse BGG search XML:',
        err,
        '\nRaw XML:',
        xml.slice(0, 500)
      )
      throw new HttpsError('internal', 'Invalid response from BGG')
    }

    // Validate top-level shape before touching nested fields
    const rawItems = (parsed as Record<string, unknown>)?.items
    if (rawItems == null || typeof rawItems !== 'object') {
      console.error(
        'Unexpected BGG search response shape:',
        JSON.stringify(parsed)?.slice(0, 500)
      )
      throw new HttpsError('internal', 'Unexpected response format from BGG')
    }

    const itemField = (rawItems as Record<string, unknown>).item ?? []
    const itemArray: unknown[] = Array.isArray(itemField)
      ? itemField
      : [itemField]

    const mappedItems = []
    for (const item of itemArray) {
      const id = itemAttr(item, 'id')
      const itemType = itemAttr(item, 'type')
      const nameField = (item as Record<string, unknown>)?.name
      const name = attrValue(nameField)
      if (!id || !name) {
        console.warn(
          'Skipping BGG search item missing id or name:',
          JSON.stringify(item)
        )
        continue
      }
      mappedItems.push({
        id,
        type: itemType ?? '',
        name,
        yearpublished: attrValue(
          (item as Record<string, unknown>).yearpublished
        ),
      })
    }

    return { items: mappedItems }
  }
)

function parseBggThingItem(item: unknown) {
  const itemObj = item as Record<string, unknown>
  const itemId = itemAttr(item, 'id')
  if (!itemId) return null

  const nameField = itemObj.name
  const nameArray: unknown[] = Array.isArray(nameField)
    ? nameField
    : [nameField]
  const primaryNameNode =
    nameArray.find((n) => itemAttr(n, 'type') === 'primary') ?? nameArray[0]
  const name = attrValue(primaryNameNode) ?? ''

  const descriptionRaw = first(itemObj.description)
  const imageRaw = first(itemObj.image)
  const thumbnailRaw = first(itemObj.thumbnail)

  const imageUrl = typeof imageRaw === 'string' ? imageRaw : ''
  const thumbnailUrl =
    typeof thumbnailRaw === 'string' && thumbnailRaw ? thumbnailRaw : imageUrl

  return {
    id: itemId,
    name,
    description: typeof descriptionRaw === 'string' ? descriptionRaw : '',
    image: imageUrl,
    thumbnail: thumbnailUrl,
    yearpublished: attrValue(itemObj.yearpublished),
    minplayers: attrValue(itemObj.minplayers),
    maxplayers: attrValue(itemObj.maxplayers),
    minplaytime: attrValue(itemObj.minplaytime),
    maxplaytime: attrValue(itemObj.maxplaytime),
    minage: attrValue(itemObj.minage),
    categories: linkValues(itemObj, 'boardgamecategory'),
  }
}

export const bggThing = onCall(
  { enforceAppCheck: true, secrets: [BGG_API_KEY] },
  async (request) => {
    const { ids } = request.data as { ids: string[] }
    if (!Array.isArray(ids) || ids.length === 0)
      throw new HttpsError('invalid-argument', 'Missing ids')
    if (ids.length > 20)
      throw new HttpsError('invalid-argument', 'Too many ids (max 20)')
    if (ids.some((id) => !/^\d+$/.test(id)))
      throw new HttpsError('invalid-argument', 'Invalid id format')

    const params = new URLSearchParams({ id: ids.join(',') }).toString()
    const url = `${BGG_BASE_URL}/thing?${params}`
    console.log(`Proxying thing to BGG: ${url}`)

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${BGG_API_KEY.value()}` },
    })
    if (!response.ok)
      throw new HttpsError('internal', `BGG error: ${response.statusText}`)

    const xml = await response.text()

    let parsed: unknown
    try {
      parsed = await parseXml(xml)
    } catch (err) {
      console.error(
        'Failed to parse BGG thing XML:',
        err,
        '\nRaw XML:',
        xml.slice(0, 500)
      )
      throw new HttpsError('internal', 'Invalid response from BGG')
    }

    const rawItems = (parsed as Record<string, unknown>)?.items
    if (rawItems == null || typeof rawItems !== 'object') {
      console.error(
        'Unexpected BGG thing response shape:',
        JSON.stringify(parsed)?.slice(0, 500)
      )
      throw new HttpsError('internal', 'Unexpected response format from BGG')
    }

    const itemField = (rawItems as Record<string, unknown>).item ?? []
    const itemArray: unknown[] = Array.isArray(itemField)
      ? itemField
      : [itemField]

    const items = itemArray
      .map(parseBggThingItem)
      .filter(
        (item): item is NonNullable<ReturnType<typeof parseBggThingItem>> =>
          item !== null
      )

    return { items }
  }
)

const APP_URL = 'https://bgc.jasonsuttles.dev'
const FROM_EMAIL = 'Board Game Calendar <bgc-notifications@jasonsuttles.dev>'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

type EmailAttachment = { filename: string; content: string } // content: base64

// Sends a single email via Resend and classifies the outcome. Event-driven
// 2nd-gen functions do NOT retry on error by default — retry is opt-in via
// `retry: true` on the trigger, which the single-recipient triggers (friend
// requests, gathering invites, email invites) set. Those callers throw on
// 'retry' so Eventarc redelivers the event (with backoff, for up to ~24h);
// they must NOT throw on 'failed' (a non-transient rejection such as an
// unverified domain or an invalid recipient), where retrying would just
// hammer Resend with a request that can never succeed. The multi-recipient
// caller (gathering state changes) has no retry and ignores the result
// entirely: redelivery there would re-send to recipients who already got
// the email.
type SendResult = 'sent' | 'retry' | 'failed'

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: EmailAttachment[]
): Promise<SendResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY.value()}`,
      'Content-Type': 'application/json',
    },
    // A hung connection would otherwise burn the whole function timeout
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      ...(attachments?.length ? { attachments } : {}),
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`Resend error ${res.status} for ${to}: ${body}`)
    return res.status === 429 || res.status >= 500 ? 'retry' : 'failed'
  }
  return 'sent'
}

function formatDatetime(iso: string, timezone?: string): string {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return iso
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    ...(timezone ? { timeZone: timezone } : {}),
  })
}

// --- Calendar helpers (mirrors helpers/calendar.ts on the client; duplicated
// because the functions workspace builds from its own rootDir) ---

const GATHERING_DURATION_HOURS = 3

type CalendarEvent = {
  gatheringId: string
  datetime: string
  hostName?: string
  location?: string
  notes?: string
  games?: { name?: string }[]
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toIcsUtc(date: Date): string {
  return (
    String(date.getUTCFullYear()) +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  )
}

function eventEnd(datetime: string): Date {
  return new Date(
    new Date(datetime).getTime() + GATHERING_DURATION_HOURS * 60 * 60 * 1000
  )
}

function eventTitle(hostName?: string): string {
  return hostName ? `Board game night with ${hostName}` : 'Board game night'
}

function eventDescription(event: CalendarEvent): string {
  const games = (event.games ?? []).map((g) => g.name ?? '').filter(Boolean)
  const parts: string[] = []
  if (event.hostName) parts.push(`Hosted by ${event.hostName}.`)
  if (games.length) parts.push(`Games: ${games.join(', ')}.`)
  // Terminate free-text notes so they don't run into the details link
  if (event.notes)
    parts.push(/[.!?]$/.test(event.notes) ? event.notes : `${event.notes}.`)
  parts.push(`Details: ${APP_URL}/calendar`)
  return parts.join(' ')
}

function googleCalendarUrl(event: CalendarEvent): string {
  const dates = `${toIcsUtc(new Date(event.datetime))}/${toIcsUtc(eventEnd(event.datetime))}`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle(event.hostName),
    dates,
    details: eventDescription(event),
    ...(event.location ? { location: event.location } : {}),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function buildIcs(event: CalendarEvent): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Board Game Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.gatheringId}@bgc.jasonsuttles.dev`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(new Date(event.datetime))}`,
    `DTEND:${toIcsUtc(eventEnd(event.datetime))}`,
    `SUMMARY:${escapeIcs(eventTitle(event.hostName))}`,
    `DESCRIPTION:${escapeIcs(eventDescription(event))}`,
    ...(event.location ? [`LOCATION:${escapeIcs(event.location)}`] : []),
    `URL:${APP_URL}/calendar`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

function icsAttachment(event: CalendarEvent): EmailAttachment {
  return {
    filename: 'board-game-night.ics',
    content: Buffer.from(buildIcs(event), 'utf-8').toString('base64'),
  }
}

// "Add to Google Calendar" link shown beneath the email body.
function calendarLinkHtml(event: CalendarEvent): string {
  return `<p><a href="${googleCalendarUrl(event)}">Add to Google Calendar</a> &middot; an Apple/Outlook invite is attached.</p>`
}

// Accept / Decline buttons that deep-link into the app (the user signs in if
// needed, then the RSVP is applied on the calendar page).
function rsvpButtonsHtml(gatheringId: string): string {
  const accept = `${APP_URL}/calendar?id=${gatheringId}&respond=accepted`
  const decline = `${APP_URL}/calendar?id=${gatheringId}&respond=declined`
  return `<p>
  <a href="${accept}" style="display:inline-block;padding:10px 18px;margin-right:8px;background:#55B855;color:#100A04;text-decoration:none;border-radius:8px;font-weight:600;">Accept</a>
  <a href="${decline}" style="display:inline-block;padding:10px 18px;background:#E05252;color:#100A04;text-decoration:none;border-radius:8px;font-weight:600;">Decline</a>
</p>`
}

async function getProfileName(uid: string): Promise<string> {
  const snap = await getDatabase().ref(`profiles/${uid}/name`).get()
  const val = snap.val()
  return typeof val === 'string' ? val : 'Someone'
}

// Raw gathering node as read from RTDB; fields are validated by the security
// rules but read back untyped, so narrow each one before use.
type GatheringRecord = Record<string, unknown>

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

function toCalendarEvent(
  gatheringId: string,
  gathering: GatheringRecord,
  hostName: string
): CalendarEvent {
  return {
    gatheringId,
    datetime: gathering.datetime as string,
    hostName,
    location: optionalString(gathering.location),
    notes: optionalString(gathering.notes),
    games: gathering.games as { name?: string }[] | undefined,
  }
}

// "Where" + host-notes lines shared by the invite and confirmation emails.
function gatheringDetailsHtml(gathering: GatheringRecord): string {
  const location = optionalString(gathering.location)
  const notes = optionalString(gathering.notes)
  const parts: string[] = []
  if (location)
    parts.push(`<p><strong>Where:</strong> ${escapeHtml(location)}</p>`)
  if (notes) parts.push(`<p>${escapeHtml(notes)}</p>`)
  return parts.join('\n')
}

// Sends an invite email when a new email address is added to a gathering's
// emailInvites list. The recipient may not have an account yet; the email
// includes RSVP deep-links that go through the normal sign-in redirect flow.
//
// NOTE ON THE NAME: a v2 function create whose container build fails leaves a
// half-created record with no Eventarc trigger, which GCF then treats as an
// HTTPS function — and GCF refuses to change a function's trigger type in
// place, so every later deploy of that name fails with "Changing from an
// HTTPS function to a background triggered function is not allowed". Both
// `onEmailInviteCreated` (original name, broken first deploy) and
// `onEmailInviteAdded` (renamed, then its create died in a dependency-conflict
// build failure) are poisoned in production this way; the `--force` flag on
// the CD deploy deletes them once a deploy succeeds. Do not reuse either name.
export const onGatheringEmailInvite = onValueCreated(
  {
    ref: 'gatherings/{gatheringId}/emailInvites/{inviteId}',
    secrets: [RESEND_API_KEY],
    instance: 'board-game-calendar-3ae94-default-rtdb',
    retry: true,
  },
  async (event) => {
    const { gatheringId, inviteId } = event.params
    const email = event.data.val() as string | null
    if (
      !email ||
      typeof email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      console.warn(
        `Skipping email invite ${gatheringId}/${inviteId}: not a valid address`
      )
      return
    }
    const gatheringSnap = await getDatabase()
      .ref(`gatherings/${gatheringId}`)
      .get()
    const gathering = gatheringSnap.val() as Record<string, unknown> | null
    if (!gathering) {
      console.warn(
        `Skipping email invite ${gatheringId}/${inviteId}: gathering gone`
      )
      return
    }
    const hostName = await getProfileName(gathering.host as string)
    const datetime = formatDatetime(
      gathering.datetime as string,
      gathering.timezone as string | undefined
    )
    const calEvent = toCalendarEvent(gatheringId, gathering, hostName)
    const safeHost = escapeHtml(hostName)
    const safeDatetime = escapeHtml(datetime)
    const gamesList = ((gathering.games as { name?: string }[] | null) ?? [])
      .map((g) => escapeHtml(g.name ?? ''))
      .filter(Boolean)
    const gamesHtml = gamesList.length
      ? `<p><strong>Games planned:</strong> ${gamesList.join(', ')}</p>`
      : ''
    const result = await sendEmail(
      email,
      `You're invited to a board game night!`,
      `<p>Hi there,</p>
<p><strong>${safeHost}</strong> has invited you to a board game night on <strong>${safeDatetime}</strong>.</p>
${gatheringDetailsHtml(gathering)}
${gamesHtml}
<p>Accept or decline (you'll be asked to sign in or create a free account):</p>
${rsvpButtonsHtml(gatheringId)}
<p><a href="${APP_URL}/calendar">View on your calendar after signing in</a></p>
${calendarLinkHtml(calEvent)}`,
      [icsAttachment(calEvent)]
    )
    if (result === 'retry')
      throw new Error(`Transient failure sending invite email to ${email}`)
  }
)

// Converts an email invite into a proper guest entry. Called from the calendar
// page when a user follows an email invite link and isn't yet in the guest list.
// Runs as admin so it can bypass the mutual-friendship check in the DB rules.
export const acceptEmailInvite = onCall(
  { enforceAppCheck: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in')
    }
    const { gatheringId, response } = request.data as {
      gatheringId?: unknown
      response?: unknown
    }
    if (typeof gatheringId !== 'string' || !gatheringId) {
      throw new HttpsError('invalid-argument', 'Missing gatheringId')
    }
    if (response !== 'accepted' && response !== 'declined') {
      throw new HttpsError('invalid-argument', 'Invalid response')
    }
    const userEmail = request.auth.token.email?.toLowerCase()
    if (!userEmail) {
      throw new HttpsError('failed-precondition', 'Account has no email address')
    }
    if (!request.auth.token.email_verified) {
      throw new HttpsError('failed-precondition', 'Email address must be verified')
    }
    const uid = request.auth.uid
    const db = getDatabase()
    const gatheringSnap = await db.ref(`gatherings/${gatheringId}`).get()
    const gathering = gatheringSnap.val() as Record<string, unknown> | null
    if (!gathering) {
      throw new HttpsError('not-found', 'Gathering not found')
    }
    if (gathering.state === 'canceled') {
      throw new HttpsError('failed-precondition', 'Gathering has been canceled')
    }
    if (uid === gathering.host) {
      throw new HttpsError('failed-precondition', 'Host cannot accept their own email invite')
    }
    const emailInvites = (gathering.emailInvites ?? {}) as Record<string, string>
    const inviteEntry = Object.entries(emailInvites).find(
      ([, inviteEmail]) => inviteEmail.toLowerCase() === userEmail
    )
    if (!inviteEntry) {
      throw new HttpsError(
        'not-found',
        'No email invite found for your address'
      )
    }
    const [inviteId] = inviteEntry
    await db.ref().update({
      [`gatherings/${gatheringId}/guests/${uid}`]: response,
      [`userGatherings/${uid}/${gatheringId}`]: true,
      [`gatherings/${gatheringId}/emailInvites/${inviteId}`]: null,
    })
    return { success: true }
  }
)

export const onFriendRequest = onValueCreated(
  {
    ref: 'friendRequests/{toUid}/{fromUid}',
    secrets: [RESEND_API_KEY],
    instance: 'board-game-calendar-3ae94-default-rtdb',
    retry: true,
  },
  async (event) => {
    const { toUid, fromUid } = event.params
    // With retry enabled, a permanently-missing account (deleted between the
    // request write and this event) must not throw, or the event would be
    // redelivered until it expires.
    const [toUser, fromName] = await Promise.all([
      getAuth()
        .getUser(toUid)
        .catch(() => null),
      getProfileName(fromUid),
    ])
    if (!toUser?.email) return
    const safeName = escapeHtml(fromName)
    const result = await sendEmail(
      toUser.email,
      `${fromName} sent you a friend request`,
      `<p>Hi there,</p>
<p><strong>${safeName}</strong> has sent you a friend request on Board Game Calendar.</p>
<p><a href="${APP_URL}/friends">View your friend requests</a></p>`
    )
    if (result === 'retry')
      throw new Error(
        `Transient failure sending friend request email to ${toUser.email}`
      )
  }
)

export const onGatheringInvite = onValueWritten(
  {
    ref: 'gatherings/{gatheringId}/guests/{guestUid}',
    secrets: [RESEND_API_KEY],
    instance: 'board-game-calendar-3ae94-default-rtdb',
    retry: true,
  },
  async (event) => {
    const after = event.data.after.val() as string | null
    const before = event.data.before.val() as string | null
    // Notify on initial invite or re-invite after a decline; skip accept/decline updates
    if (after !== 'invited' || (before !== null && before !== 'declined'))
      return
    const { gatheringId, guestUid } = event.params
    // See onFriendRequest: a missing account must not trip the retry loop
    const [guestUser, gatheringSnap] = await Promise.all([
      getAuth()
        .getUser(guestUid)
        .catch(() => null),
      getDatabase().ref(`gatherings/${gatheringId}`).get(),
    ])
    if (!guestUser?.email) return
    const gathering = gatheringSnap.val() as Record<string, unknown> | null
    if (!gathering) return
    const hostName = await getProfileName(gathering.host as string)
    const datetime = formatDatetime(
      gathering.datetime as string,
      gathering.timezone as string
    )
    const calEvent = toCalendarEvent(gatheringId, gathering, hostName)
    const result = await sendEmail(
      guestUser.email,
      `You're invited to a board game night!`,
      `<p>Hi there,</p>
<p><strong>${escapeHtml(hostName)}</strong> has invited you to a board game night on <strong>${escapeHtml(datetime)}</strong>.</p>
${gatheringDetailsHtml(gathering)}
${rsvpButtonsHtml(gatheringId)}
<p><a href="${APP_URL}/calendar">View on your calendar</a></p>
${calendarLinkHtml(calEvent)}`,
      [icsAttachment(calEvent)]
    )
    if (result === 'retry')
      throw new Error(
        `Transient failure sending invite email to ${guestUser.email}`
      )
  }
)

// Notifies the host when a guest answers an invitation, so hosts don't have to
// poll the calendar page to know whether game night is happening. Fires on the
// same path as onGatheringInvite but on the opposite transitions: guest-authored
// 'accepted'/'declined' writes (including the acceptEmailInvite admin write),
// never the host-authored 'invited' seeds that onGatheringInvite handles.
export const onGuestResponse = onValueWritten(
  {
    ref: 'gatherings/{gatheringId}/guests/{guestUid}',
    secrets: [RESEND_API_KEY],
    instance: 'board-game-calendar-3ae94-default-rtdb',
    retry: true,
  },
  async (event) => {
    const after = event.data.after.val() as string | null
    const before = event.data.before.val() as string | null
    // Only actual answers: skip removals, invites, and no-op rewrites (the
    // host preserving an existing response while editing).
    if (after !== 'accepted' && after !== 'declined') return
    if (after === before) return
    const { gatheringId, guestUid } = event.params
    const gatheringSnap = await getDatabase()
      .ref(`gatherings/${gatheringId}`)
      .get()
    const gathering = gatheringSnap.val() as GatheringRecord | null
    if (!gathering) return
    // A decline against an already-canceled gathering isn't news to the host
    if (gathering.state === 'canceled') return
    // See onFriendRequest: with retry enabled, a permanently-missing account
    // must not throw, or the event would be redelivered until it expires.
    const [hostUser, guestName] = await Promise.all([
      getAuth()
        .getUser(gathering.host as string)
        .catch(() => null),
      getProfileName(guestUid),
    ])
    if (!hostUser?.email) return
    const datetime = formatDatetime(
      gathering.datetime as string,
      gathering.timezone as string | undefined
    )
    const safeGuest = escapeHtml(guestName)
    const safeDatetime = escapeHtml(datetime)
    const accepted = after === 'accepted'
    const result = await sendEmail(
      hostUser.email,
      accepted
        ? `${guestName} is in for game night`
        : `${guestName} can't make game night`,
      `<p>Hi there,</p>
<p><strong>${safeGuest}</strong> has ${accepted ? 'accepted' : 'declined'} your invitation to the board game night on <strong>${safeDatetime}</strong>.</p>
<p><a href="${APP_URL}/calendar">View your calendar</a></p>`
    )
    if (result === 'retry')
      throw new Error(
        `Transient failure sending RSVP email to ${hostUser.email}`
      )
  }
)

export const onGatheringStateChange = onValueUpdated(
  {
    ref: 'gatherings/{gatheringId}/state',
    secrets: [RESEND_API_KEY],
    instance: 'board-game-calendar-3ae94-default-rtdb',
  },
  async (event) => {
    const newState = event.data.after.val() as string
    const oldState = event.data.before.val() as string
    if (newState === oldState) return
    if (newState !== 'confirmed' && newState !== 'canceled') return
    const { gatheringId } = event.params
    const gatheringSnap = await getDatabase()
      .ref(`gatherings/${gatheringId}`)
      .get()
    const gathering = gatheringSnap.val() as Record<string, unknown> | null
    if (!gathering) return
    const guests = (gathering.guests as Record<string, string> | null) ?? {}
    // Notify accepted guests on confirm; notify accepted + invited guests on cancel
    const notifyUids = Object.entries(guests)
      .filter(
        ([, status]) =>
          status === 'accepted' ||
          (newState === 'canceled' && status === 'invited')
      )
      .map(([uid]) => uid)
    if (notifyUids.length === 0) return
    const [hostName, guestUsers] = await Promise.all([
      getProfileName(gathering.host as string),
      Promise.all(notifyUids.map((uid) => getAuth().getUser(uid))),
    ])
    const datetime = formatDatetime(
      gathering.datetime as string,
      gathering.timezone as string
    )
    const subject =
      newState === 'confirmed'
        ? `Game night confirmed: ${datetime}`
        : `Game night canceled: ${datetime}`
    const safeHost = escapeHtml(hostName)
    const safeDatetime = escapeHtml(datetime)
    const calEvent = toCalendarEvent(gatheringId, gathering, hostName)
    const html =
      newState === 'confirmed'
        ? `<p>Great news! <strong>${safeHost}</strong> has confirmed the board game night on <strong>${safeDatetime}</strong>.</p>
${gatheringDetailsHtml(gathering)}
<p><a href="${APP_URL}/calendar">View on your calendar</a></p>
${calendarLinkHtml(calEvent)}`
        : `<p><strong>${safeHost}</strong> has unfortunately canceled the board game night on <strong>${safeDatetime}</strong>.</p>
<p><a href="${APP_URL}/calendar">View your calendar</a></p>`
    // Attach the .ics only on confirm — there's nothing to add to a calendar
    // for a cancellation.
    const attachments =
      newState === 'confirmed' ? [icsAttachment(calEvent)] : undefined
    const emails = guestUsers
      .map((u) => u.email)
      .filter((e): e is string => !!e)
    await Promise.all(
      emails.map((email) => sendEmail(email, subject, html, attachments))
    )
  }
)

// --- Facebook data deletion ---------------------------------------------------
//
// Facebook requires a data-deletion callback for apps that use Facebook Login.
// When a user removes the app (or requests deletion) Facebook POSTs a
// `signed_request` here. We verify it with the app secret, map the Facebook
// app-scoped user id to the Firebase account that linked it, erase that
// account's data, and return the JSON Facebook expects: a status URL + a
// confirmation code.
//
// SETUP (one-time, before merging/deploying — the deploy needs the secret):
//   1. Set the secret to your Facebook App Secret (Facebook App Dashboard →
//      Settings → Basic → App Secret):
//        firebase functions:secrets:set FACEBOOK_APP_SECRET
//   2. After deploy, paste the function URL into the Facebook App Dashboard →
//      Settings → Basic → "Data Deletion Request URL":
//        https://us-central1-board-game-calendar-3ae94.cloudfunctions.net/facebookDataDeletion
//   (Prefer no automation? Use the "Data Deletion Instructions URL" field with
//    https://bgc.jasonsuttles.dev/data-deletion instead and skip the secret —
//    deletion then happens by email request rather than automatically.)

const FACEBOOK_PROVIDER_ID = 'facebook.com'

// Verify Facebook's signed_request (`<sig>.<payload>`, both base64url) and
// return the Facebook user id, or null if missing / forged / malformed.
function parseSignedRequest(
  signedRequest: string,
  appSecret: string
): string | null {
  const parts = signedRequest.split('.')
  if (parts.length !== 2) return null
  const [encodedSig, encodedPayload] = parts

  const sig = Buffer.from(encodedSig, 'base64url')
  const expected = createHmac('sha256', appSecret)
    .update(encodedPayload)
    .digest()
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    return null
  }

  try {
    const data = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as { user_id?: string; algorithm?: string }
    if (data.algorithm && data.algorithm.toUpperCase() !== 'HMAC-SHA256') {
      return null
    }
    return typeof data.user_id === 'string' ? data.user_id : null
  } catch {
    return null
  }
}

// Erase everything we hold for a user: their own subtrees plus the references
// other members hold to them (reverse friend links, guest entries, pending
// requests, blocks). Hosted gatherings are removed entirely. Applied as one
// multi-path update; the caller then deletes the auth account.
async function deleteUserData(uid: string): Promise<void> {
  const db = getDatabase()
  const updates: Record<string, null> = {}

  // Reverse friend references on each friend's own list.
  const friendsSnap = await db.ref(`users/${uid}/friends`).get()
  const friends = (friendsSnap.val() as Record<string, unknown> | null) ?? {}
  for (const friendId of Object.keys(friends)) {
    updates[`users/${friendId}/friends/${uid}`] = null
  }

  // Walk the user's gathering index (avoids scanning every gathering).
  const ugSnap = await db.ref(`userGatherings/${uid}`).get()
  const userGatherings = (ugSnap.val() as Record<string, unknown> | null) ?? {}
  for (const gid of Object.keys(userGatherings)) {
    const gSnap = await db.ref(`gatherings/${gid}`).get()
    const gathering = gSnap.val() as Record<string, unknown> | null
    if (!gathering) continue
    if (gathering.host === uid) {
      // Host is leaving: delete the gathering and each guest's index entry. The
      // user's own index entry is covered by the userGatherings/${uid} delete
      // below, so skip it here or the update paths would nest illegally.
      updates[`gatherings/${gid}`] = null
      const guests = (gathering.guests as Record<string, unknown> | null) ?? {}
      for (const guestUid of Object.keys(guests)) {
        if (guestUid !== uid) {
          updates[`userGatherings/${guestUid}/${gid}`] = null
        }
      }
    } else {
      // Guest is leaving: just drop them from the guest list.
      updates[`gatherings/${gid}/guests/${uid}`] = null
    }
  }

  // Friend requests: incoming (whole subtree) + any outgoing references.
  updates[`friendRequests/${uid}`] = null
  const frSnap = await db.ref('friendRequests').get()
  const allRequests =
    (frSnap.val() as Record<string, Record<string, unknown>> | null) ?? {}
  for (const [toUid, fromMap] of Object.entries(allRequests)) {
    if (toUid !== uid && fromMap && uid in fromMap) {
      updates[`friendRequests/${toUid}/${uid}`] = null
    }
  }

  // Blocks: owned by the user (whole subtree) + where others blocked them.
  updates[`blocked/${uid}`] = null
  const blockedSnap = await db.ref('blocked').get()
  const allBlocked =
    (blockedSnap.val() as Record<string, Record<string, unknown>> | null) ?? {}
  for (const [ownerUid, blockedMap] of Object.entries(allBlocked)) {
    if (ownerUid !== uid && blockedMap && uid in blockedMap) {
      updates[`blocked/${ownerUid}/${uid}`] = null
    }
  }

  // The user's own data.
  updates[`profiles/${uid}`] = null
  updates[`users/${uid}`] = null
  updates[`userGatherings/${uid}`] = null

  await db.ref().update(updates)
}

export const facebookDataDeletion = onRequest(
  { secrets: [FACEBOOK_APP_SECRET] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    const signedRequest = (
      req.body as { signed_request?: unknown } | undefined
    )?.signed_request
    if (typeof signedRequest !== 'string' || !signedRequest) {
      res.status(400).json({ error: 'Missing signed_request' })
      return
    }

    const facebookUserId = parseSignedRequest(
      signedRequest,
      FACEBOOK_APP_SECRET.value()
    )
    if (!facebookUserId) {
      res.status(400).json({ error: 'Invalid signed_request' })
      return
    }

    const code = randomBytes(8).toString('hex')

    try {
      const userRecord = await getAuth().getUserByProviderUid(
        FACEBOOK_PROVIDER_ID,
        facebookUserId
      )
      await deleteUserData(userRecord.uid)
      await getAuth().deleteUser(userRecord.uid)
      console.log(
        `Data deletion ${code}: erased user ${userRecord.uid} (fb ${facebookUserId})`
      )
    } catch (err) {
      // No linked account means nothing to delete — still a success from
      // Facebook's perspective. Other errors are logged, but we still return a
      // 200 with the code so Facebook records the request; the status page and
      // email contact cover any follow-up.
      if ((err as { code?: string })?.code === 'auth/user-not-found') {
        console.log(
          `Data deletion ${code}: no account linked to fb ${facebookUserId}`
        )
      } else {
        console.error(`Data deletion ${code} failed:`, err)
      }
    }

    // Record the request so the status URL has something to confirm against.
    await getDatabase()
      .ref(`dataDeletionRequests/${code}`)
      .set({ completedAt: Date.now() })

    res.status(200).json({
      url: `${APP_URL}/data-deletion?code=${code}`,
      confirmation_code: code,
    })
  }
)
