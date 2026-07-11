# Board Game Calendar — CLAUDE.md

A Nuxt 4 / Vue 3 SPA that helps groups schedule board game nights around specific games. Deployed as a static site to GitHub Pages, backed by Firebase Realtime Database.

## Keeping this file up to date

When you change a convention documented here — a colour token, a component pattern, a CSS class, an accessibility rule, a Firebase path, a command — update the relevant section of this file in the same commit. If you add a new reusable pattern (composable, layout class, data model field), document it here.

## Commands

```bash
yarn dev          # dev server on :3005
yarn lint         # ESLint (must pass before commit)
yarn test         # Vitest (must pass before commit)
yarn test:rules   # security-rules tests against the RTDB emulator (needs Java)
yarn generate     # production static build → dist/
yarn postinstall  # nuxi prepare — regenerates .nuxt/ types (run after yarn install)
```

To manage packages in the `functions` workspace, use `yarn workspace functions add <package>` (note: singular `workspace`, not `workspaces`).

Pre-commit hooks run `yarn lint` via husky + lint-staged. Commits must follow Conventional Commits (`feat:`, `fix:`, `chore:`, etc.).

### Screenshots

`yarn screenshot /<route> --mobile` (or `--desktop`, `--full-page`). Saves to `screenshots/` (git-ignored). No Firebase credentials needed — dev server starts with all Firebase mocked, fake user `screenshot-uid-1` "Alex Johnson". Fixture data: `scripts/fixtures/default.json` (mirrors RTDB path structure); pass `--fixture path/to/custom.json` for overrides. After any `.vue` change, take a mobile screenshot before committing — most layout bugs hide on desktop.

## Stack

Nuxt 4.4 + Vue 3.5 + Vuetify 4.1 (MD3, dark theme) + Pinia 3 + Firebase RTDB (not Firestore) + TypeScript strict. ESLint 10 flat config via `@nuxt/eslint` + Prettier. Vitest 4 + `@nuxt/test-utils` (jsdom). Icons are tree-shaken MDI SVGs — see the **Icons** section under Design Conventions before touching any `v-icon`.

## Architecture

### Pages → Firebase paths

| Page                 | Route             | Firebase reads/writes                                                                                                                                             |
| -------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signin.vue`         | `/signin`         | auth; writes initial `profiles/{uid}` (+ `users/{uid}/phoneNumber` if present)                                                                                    |
| `profile.vue`        | `/profile`        | `users/{uid}` (private fields), `profiles/{uid}` (public fields); email shown from auth                                                                           |
| `gamecollection.vue` | `/gamecollection` | `users/{uid}/collection/{pushId}`                                                                                                                                 |
| `friends.vue`        | `/friends`        | `profiles/` (search + display), `users/{uid}/friends`, `friendRequests/{uid}`, `blocked/{uid}` (decline writes)                                                   |
| `calendar.vue`       | `/calendar`       | `userGatherings/{uid}` (own index), `gatherings/{id}` (one listener per entry; splits hosting/invited/past client-side), `profiles/{uid}/name`                         |
| `gatherings/new.vue` | `/gatherings/new` | `gatherings/{pushId}` (create; `?id=` edits in place) then `userGatherings/*` index sync, `users/{uid}` (own prefill incl. address + `savedLocations` read/write), `profiles/{uid}/name` (friend/guest names) |
| `index.vue`          | `/`               | none                                                                                                                                                              |
| `privacy.vue`        | `/privacy`        | none — static privacy policy (public, no auth)                                                                                                                    |
| `terms.vue`          | `/terms`          | none — static terms of service (public, no auth)                                                                                                                  |
| `data-deletion.vue`  | `/data-deletion`  | none — data-deletion info + status page (public, no auth); echoes a `?code` hex confirmation                                                                      |

`/privacy`, `/terms` and `/data-deletion` are public: they're whitelisted alongside `index`/`signin` in `middleware/auth.global.ts`, and linked from the footer (`/privacy`, `/terms`) / the privacy policy (`/data-deletion`).

### Privacy / cookie consent

Analytics is **opt-in** — `plugins/01-firebase.client.ts` does not load `firebase/analytics` until consent is `'granted'` (stored in `localStorage` under `bgc-cookie-consent` via `useCookieConsent.ts`). App Check/reCAPTCHA and Auth are strictly-necessary and always on. Update `pages/privacy.vue` when changing what data is collected.

### Data deletion (Facebook + manual)

`facebookDataDeletion` Cloud Function (HTTP) verifies the Facebook `signed_request` HMAC, then calls `deleteUserData(uid)` — a multi-path RTDB update removing all user subtrees (friend links, guest entries, requests, blocks, hosted gatherings) — then deletes the auth account. Returns `{ url, confirmation_code }` pointing at `/data-deletion?code=…`. `deleteUserData` is also the right place for a future in-app "delete my account" button. One-time setup: `firebase functions:secrets:set FACEBOOK_APP_SECRET`, then set the function URL in the Facebook app dashboard.

### Key files

- `plugins/firebase.ts` — exports `db`, `auth`, `logEvent`, `log` (Firebase 12 modular SDK)
- `plugins/fireauth.client.ts` — one-shot `onAuthStateChanged` to hydrate Pinia before navigation
- `stores/user.ts` — Pinia store; `{ user: User | null }`; actions: `setUser`, `signInWithGoogle`, `signOut`
- `middleware/auth.global.ts` — redirects unauthenticated → `/signin?redirect={fullPath}`; `useAuthSignIn` reads `?redirect` post-login (internal paths only, open-redirect-guarded)
- `helpers/types.ts` — shared TS types incl. `FormInstance` for Vuetify 4 form refs
- `helpers/gatherings.ts` — `splitGatherings` (upcoming hosting/invited + a `past` section; a gathering turns past once `datetime` + the 3-hour play window elapses, see `isPast`), state/response color+icon maps, `formatDatetime`
- `helpers/collection.ts` — `filterAndSortCollection` + `collectionGenres`; pure + unit-tested; returns ordered `CollectionEntry[]`
- `helpers/locations.ts` — saved gathering addresses: `addressToLocation` (multi-line profile address → single-line location), `savedLocationPlan` (save/dedupe/evict decision for `users/{uid}/savedLocations`), `MAX_SAVED_LOCATIONS`; pure + unit-tested
- `helpers/calendar.ts` — `googleCalendarUrl()`, `buildIcs()` (3-hour VEVENT; `LOCATION` from the gathering's `location`, `notes` folded into the description), `downloadIcs()`, `toCalendarEventInput()`. Cloud Functions duplicate this — keep both in sync.
- `database.rules.json` — Firebase Realtime DB security rules (deployed by `cd.yml`)

### Components

- `BGCLogo.vue` — animated brass **meeple** SVG logo (bob + glow), used in the navigation drawer header. The meeple is also the favicon (`public/favicon.svg` + `.png`: brass meeple on a felt-green tile).
- `BGCLogoIcon.vue` — static inline meeple icon; accepts `size` (height in px, default 24) and `color` (fill hex, default `#C8860A`). Width is auto at 0.8× height (4:5 aspect ratio). Use anywhere a small static meeple is needed (app bar, signin header). The meeple SVG path is shared with `BGCLogo.vue` — keep them in sync.
- `GameSearch.vue` — BGG API search + add-to-collection; hits `https://boardgamegeek.com/xmlapi2/`
- `Snackbar.vue` — toast notification wrapper; uses `defineExpose` for parent `ref` access

### Composables

Pages own routing/layout, composables own data/logic (`composables/`, auto-imported):

- `useBoardGameSearch.ts` — BGG API search logic for `GameSearch.vue`
- `useFriendSearch.ts` — debounced friend search over the queryable\* indexes, annotates friendship status
- `useFriendActions.ts` — send/accept/decline friend requests, unfriend (multi-path updates)
- `useAuthSignIn.ts` — OAuth/email sign-in, signup, password reset; writes the initial profile
- `useGatheringDisplay.ts` — guest/host display-name resolution for the calendar

### Layout

`layouts/default.vue` — sidebar nav (`v-navigation-drawer`) + app bar. Nav items are conditionally shown based on `userStore.user` auth state. Uses `<slot />` for page content.

### Auth flow

`fireauth.client.ts` does a one-shot `onAuthStateChanged` on boot to hydrate the store, then unsubscribes. Sign-in handlers call `userStore.setUser(user)` manually before `router.push()` since the listener is already gone. `signOut` calls `firebaseSignOut(auth)` then sets `userStore.user = null`.

## Data Model

### Implemented and in use

```ts
// profiles/{uid} — public, search-visible; readable by any authenticated user
{
  name: string
  queryableName: string // lowercase(name), rule-enforced, indexed for friend search
  queryableEmail: string // lowercase auth email; rules only accept it from a *verified* token (written at sign-in), indexed for friend search
  queryablePhone: string // digits-only phone number, indexed for friend search
}

// users/{uid} — private; owner-only read/write
{
  phoneNumber: string
  address: string
  maxPeople: number
}
// the account email is not stored; the UI reads it from Firebase Auth

// users/{uid}/savedLocations/{pushId}: string — owner-only history of
// addresses previously used on gatherings (≤200 chars each; capped at
// MAX_SAVED_LOCATIONS=5 client-side, oldest evicted). Written best-effort
// after a gathering save; skips the host's own address and duplicates.
// Surfaced as quick-fill chips ("My address" + past addresses) under the
// Location field on the gathering form — logic in helpers/locations.ts

// users/{uid}/collection/{pushId} — owner-writable; readable by the owner and
// their *mutual* friends (rule-enforced), which backs the friend-collection
// view at /gamecollection?uid={friendId}
type Game = {
  id: string // BoardGameGeek game ID
  name: string
  thumbnail: string
  minplayers?: string // …maxplayers, minplaytime, maxplaytime, yearpublished — BGG strings
  categories?: string[] // BGG `boardgamecategory` values (genres); drives the collection genre-filter chips. RTDB array (numeric-keyed); each entry validated as string ≤60 chars. Absent when BGG lists none.
  publicNote?: string
}

// users/{uid}/gameOpinions/{gameId} — owner-only (ratings and private notes are
// NOT visible to friends); keyed by BGG game id so opinions survive collection
// removal ("Also rated" section)
type GameOpinion = {
  name: string // denormalized for display
  rating?: number // 0–5
  privateNote?: string
}

// users/{uid}/friends/{friendId}: true — mutual; written to both sides on accept

// friendRequests/{toUid}/{fromUid}: 'pending' — top-level so the rules can enforce authorship; removed on accept/decline

// blocked/{ownerUid}/{blockedUid}: true — top-level, owner-only read/write; written on decline; directional (blocks blockedUid → ownerUid requests only)

// gatherings/{pushId} — readable only by the host and invited guests
type Gathering = {
  state: GatheringState // 'pending' | 'confirmed' | 'canceled'
  datetime: string // ISO date
  timezone: string // IANA zone of the host at creation; used by email formatting
  initiator: string // uid; pinned to auth.uid at creation, immutable after
  host: string // uid; immutable after creation
  maxGuests: number
  location?: string | null // ≤200 chars; shown to guests, included in emails + calendar exports. Written as null (not omitted) when cleared so edit-in-place update() deletes it
  notes?: string | null // ≤500 chars; host notes for guests, same null-when-cleared convention
  guests?: Record<string, GuestResponse> // keyed by uid; 'invited' | 'accepted' | 'declined'; new invites require the guest to have friended the host
  games?: GatheringGame[] // { id, name } — denormalized from the host's collection
  emailInvites?: Record<string, string> // pushId → email address; non-user invitees
}

// userGatherings/{uid}/{gatheringId}: true — per-user calendar index, owner-only read;
// maintained by the host (written after the gathering, since rules validate entries
// against the existing gathering); a user can always delete their own entry
```

## Firebase Security Rules

`database.rules.json` covers `profiles/`, `users/`, `friendRequests/`, `blocked/`, `gatherings/`, and `userGatherings/` (deployed automatically by `cd.yml` on push to `main`; manual deploy: `firebase deploy --only database`). All nodes reject unknown keys via `"$other": { ".validate": false }` and bound types/lengths with field-level `.validate` rules.

- `profiles/{uid}` — the public/private profile split: only this node is readable by any authenticated user (required for friend search queries on `queryableName`/`queryableEmail`/`queryablePhone`, all indexed via `.indexOn`); owner-only write. A _new_ `queryableEmail` must match `auth.token.email` **with `email_verified === true`** (so an unverified signup can't squat someone else's address; sign-in writes it once verified, and profile saves preserve the stored value); `name` and `queryableName` must agree (`queryableName === lowercase(name)`, enforced symmetrically so neither can drift); `queryablePhone` must be digits-only.
- `users/{uid}` — owner-only read **and** write for phone, address, maxPeople, `savedLocations` (past gathering addresses), `gameOpinions` (ratings + `privateNote`), and the friends list — with one carve-out: `users/{uid}/collection` is additionally readable by *mutual* friends (both sides present in each other's friends lists), which backs the friend-collection view.
- `friendRequests/{toUid}/{fromUid}` — top-level so authorship is rule-enforced (a request nested under the recipient's own subtree was owner-forgeable). Only the sender can create (not overwrite) a `'pending'` entry, blocked senders can't; only the recipient can delete. Recipient reads their whole node; a sender can read only their own outgoing entry.
- `blocked/{ownerUid}/{blockedUid}` — owner-only read and write; value must be `true`.
- `users/{uid}/friends/{friendId}` — the owner can write their own list; additionally `friendId` may add themselves only while a pending request from `uid` exists at `friendRequests/{friendId}/{uid}` (the accept flow's mutual multi-path update), and may always delete themselves (mutual unfriend).
- `gatherings/{id}` — readable only by the host and invited guests (no list read at `gatherings/`; the calendar walks the user's `userGatherings` index instead); only the host can create/modify/delete a gathering; `host` must be the creator and is immutable, `initiator` is pinned to `auth.uid` at creation and immutable; an invited guest can write only their own `guests/{uid}` response (`'invited' | 'accepted' | 'declined'`); the host can only seed `'invited'` — and only for users whose own friends list contains the host (mutual friendship, which the host cannot forge) — or preserve an existing response, never answer on a guest's behalf.
- `userGatherings/{uid}/{gatheringId}: true` — owner-only read. The host of the referenced gathering may write entries for themselves and actual participants (validated against the existing gathering, hence written _after_ the gathering itself — creation is the one non-atomic two-step flow; deletion is atomic because rules see the pre-delete state). Any user may delete their own entry (dangling-pointer cleanup; the calendar does this when an entry turns unreadable).

Accepted limitations (conscious product trade-offs, not open findings):

- **Search exposes what it searches**: name, verified lowercase email, and phone digits in `profiles/` are necessarily readable (and bulk-enumerable via range queries) by any signed-in user — client-side search on a static site cannot hide the indexed values. Mitigating this requires moving search behind a Cloud Function or dropping email/phone search.
- **Phone impersonation**: `queryablePhone` is format-validated but ownership can't be verified without phone auth.
- **`maxGuests` is not rule-enforced** against the number of guest entries (RTDB rules can't count children); the client enforces it informally.
- **Gathering creation is two writes** (gathering, then index): if the second fails, the gathering is invisible until the host re-saves it. RTDB multi-path rules validate against pre-write `root`, so the index can't reference a gathering created in the same batch.

## External API

BoardGameGeek XML API v2 — proxied via Firebase Cloud Functions (`bggSearch`, `bggThing`):

- Search: `https://boardgamegeek.com/xmlapi2/search?query=<term>&type=boardgame`
- Detail: `https://boardgamegeek.com/xmlapi2/thing?id=<id>`
- XML is parsed server-side in the functions using `xml2js`; the client receives JSON. `bggThing` also extracts `boardgamecategory` `<link>` values as `categories: string[]` (BGG's genre concept) via the `linkValues()` helper — these feed the collection genre-filter chips
- **Authorization is required.** Every request must include an `Authorization: Bearer <token>` header. Tokens are created at https://boardgamegeek.com/applications after registering an application (non-commercial license is free). The token is stored in Secret Manager as `BGG_API_KEY` and accessed via `defineSecret('BGG_API_KEY')` in the Cloud Functions. Requests must go to `boardgamegeek.com` (no `www.` prefix) or the token will not work.
- Subject to rate limits and occasional 202 "try again" responses
- Client calls via `httpsCallable` from `firebase/functions`; App Check enforced

## Email notifications & calendar export

Transactional emails are sent server-side from `functions/src/index.ts` via Resend (`RESEND_API_KEY` secret; `FROM_EMAIL`; `APP_URL = https://bgc.jasonsuttles.dev` — keep this current with the deployed domain, it backs every email link). Triggers: `onFriendRequest`, `onGatheringInvite`, `onGuestResponse` (guest accepts/declines → host is emailed; skips `invited` seeds, no-op rewrites, and canceled gatherings), `onGatheringStateChange`, `onGatheringEmailInvite`. Invite and confirmation emails include the gathering's `location`/`notes` when set (`gatheringDetailsHtml`).

**Retry semantics** (2nd-gen event functions do **not** retry on error unless the trigger sets `retry: true`): the four single-recipient triggers (`onFriendRequest`, `onGatheringInvite`, `onGuestResponse`, `onGatheringEmailInvite`) set `retry: true` and throw only on *transient* Resend failures (429/5xx/network — `sendEmail` returns `'sent' | 'retry' | 'failed'`), so Eventarc redelivers with backoff; permanent rejections (unverified domain, invalid recipient) are logged and dropped. The multi-recipient `onGatheringStateChange` never retries or throws per-recipient — redelivery would re-send to guests who already got the email. With retry enabled, keep those handlers idempotent and never let a permanently-failing lookup (e.g. `getUser` on a deleted account) throw.

- **Calendar export in-app**: the calendar page renders an "Add to calendar" menu (Google Calendar / Apple·Outlook `.ics`) on every non-canceled hosting and invited card, via `helpers/calendar.ts`.
- **Calendar in emails**: invite + confirmation emails include an "Add to Google Calendar" link and attach a `.ics` invite (`sendEmail`'s optional `attachments: [{ filename, content }]`, content base64). Cancellation emails get neither.
- **RSVP from email**: the invite email has Accept/Decline buttons that deep-link to `/calendar?id={gatheringId}&respond=accepted|declined`. The calendar page applies the RSVP on mount once the gathering loads and confirms the user is an invited guest (writes `gatherings/{id}/guests/{uid}` under the existing rules — login required, no new security surface), then strips the query. This relies on the `?redirect` sign-in flow above.
- **Email invite for non-users**: the gathering form has an "Email invites" section where the host can enter any email address (friend not required). Each address is stored in `gatherings/{id}/emailInvites/{pushId}`. `onGatheringEmailInvite` fires and sends an invite email with RSVP deep-links. When the recipient signs in and follows the link, `calendar.vue` detects they aren't yet a guest and calls the `acceptEmailInvite` Cloud Function, which verifies their email against `emailInvites`, writes `guests/{uid}` + `userGatherings/{uid}` as an atomic admin update (bypassing the mutual-friendship rule), and removes the consumed email invite entry. The existing RSVP watcher then finishes applying the response.

## Test Setup

Unit tests live in `test/` (`Logo.spec.ts`, `authErrors.spec.ts`, `gatherings.spec.ts`, `calendar.spec.ts`, `collection.spec.ts`); security-rules tests in `test/rules/` run via `yarn test:rules` against the RTDB emulator (`vitest.rules.config.ts`). Vitest requires `environment: 'jsdom'` (set in `vitest.config.ts`). Vuetify must be inlined via `server.deps.inline: ['vuetify']` to avoid CSS import errors. Import `createVuetify` and pass it as a global plugin to `mount`.

## Design Conventions

The app uses a consistent **"Evening Game Table"** design system: a deep green felt play surface lit by a warm overhead lamp, framed in walnut wood, with brass-gold accents and wooden-token chips. The aesthetic is modern post-morphism — soft realistic shadows and honest warm light, restrained texture, no HUD/skeuomorphic chrome. All new UI must follow these conventions.

### Color palette (defined in `nuxt.config.ts` → `vuetifyOptions.theme.themes.dark.colors`)

| Token | Hex | Use |
|-------|-----|-----|
| `background` | `#0E1A12` | App background (deep felt green — the table surface). Also the `theme-color` meta + the initial paint colour (the "default load colour"). |
| `surface` | `#20140A` | Cards (walnut cardstock), drawers. Distinct from the green felt by hue, not just luminance. |
| `surface-variant` | `#2A1A0B` | Nested surfaces, avatars |
| `primary` | `#C8860A` | Amber gold — CTAs, active states, icons. ~5.9:1 on card. |
| `on-primary` | `#100A04` | Text/icons on primary-coloured backgrounds. |
| `secondary` | `#4A7A44` | Muted green — secondary actions. |
| `accent` | `#C0A870` | Sand/tan — external links, edit/navigation actions on dark surfaces (~7.8:1). |
| `success` | `#55B855` | Confirm, accept, save actions. ~7.2:1 on card. |
| `error` | `#E05252` | Destructive actions (delete, cancel, decline). ~4.7:1 on card. |
| `warning` | `#D4A820` | Pending / invited states (chips). |
| `info` | `#5B8FAB` | Informational states. |
| `on-surface` / `on-background` | `#E8D4A8` | Body text on dark backgrounds (warm parchment). ~12.4:1 on card. |

**Semantic color rules:**
- Destructive action → `color="error"`
- Confirm / accept / save → `color="success"`
- Primary CTA → `color="primary"` on buttons with filled/elevated variant
- External links, secondary navigation → `color="accent"` on text/icon buttons
- Pending / invited state chips → `color="warning"`
- **Never** substitute a darker custom colour for `success` or `error` — contrast will fail

### Typography

- Headings / display: **Fraunces** (serif, variable font, `opsz` axis) via `$heading-font-family` in `variables.scss`.
- Body: **Lora** (serif) via `$body-font-family`. Also used on **chips/status tokens** so small tokens stay readable.
- Body text color: `#E8D4A8` (Vuetify `on-surface`)
- Page title: `.page-title` → `1.4rem / 700`, Fraunces, `letter-spacing: 0.01em`, rendered as `<h1>` (not `<span>`)
- Section label: `.section-label` → `0.82rem / 600`, Fraunces, uppercase, `letter-spacing: 0.1em`, `#c8860a` (full opacity); auto-prefixed with a small amber diamond "scoring marker" via `::before` (flex row)
- Empty state title: `.empty-title` → `1.25rem / 600`, Fraunces
- Empty state description: `.empty-desc` → `0.95rem`, Lora, `rgba(240,223,196,0.80)`
- All buttons: `text-transform: none`, `font-family: Fraunces`, `letter-spacing: 0.01em` (global override in `global.scss`)
- Chips: `font-family: Lora`, `0.78rem / 600`, `letter-spacing: 0.01em` (global override in `global.scss`) — deliberately the body serif. **Keep tracking minimal.**

### UI copy (capitalization)

All UI labels use **sentence case** — capitalize only the first word: buttons ("Add game", "Create gathering", "Sign in"), nav items, menu items, page titles (`.page-title` h1 and `useHead({ title })`), section labels, field labels/placeholders, and status text. This is the Material Design / Vuetify default.

- **Exceptions — keep their own casing:** proper nouns ("Board Game Calendar", "BGC", "Google Calendar", "Apple / Outlook", "BoardGameGeek"/"BGG"), game names, people's names.

### Spacing & shape

- **Border radius root**: `10px` (set in `variables.scss`); buttons & fields `10px` (global override in `global.scss`); cards `xl` (Vuetify default `24px`)
- **Card padding**: `pa-6` (24 px) for `v-card-text` content; `16px 20px` for `page-card-title` headers
- **List item gap**: `mb-2` between items
- **Section gap**: `mb-3` after section labels, `my-4` for dividers between sections

### Cardstock card style (automatic via `global.scss`)

`v-card` elements are walnut cardstock (`#241808`) with a hairline brass border, soft shadow, and linen-weave texture — all via `global.scss`. The app bar, nav drawer, and footer are opaque walnut. Do not override card backgrounds inline and do not add `backdrop-filter` or corner-bracket ornaments.

### Collection browse (genre filter)

`gamecollection.vue` is the reference pattern: text filter + sort `v-select` toolbar, `v-chip-group multiple` for genre facets (`color="info"`; use the group — not hand-rolled `aria-pressed` — for correct keyboard nav), "Showing N of M" count, then a **virtualized list** (`v-virtual-scroll`, `max-height="72vh"` — never a plain `v-list`). Genres beyond `GENRE_CHIP_LIMIT` (12) collapse behind a "+N more" toggle. Do not add per-row entry animations on virtualized rows — they replay on every scroll recycle. Filter/sort lives in `helpers/collection.ts`; returns an **ordered array**, not a keyed object.

### Vuetify component defaults (set in `nuxt.config.ts`)

| Component | Default |
|-----------|---------|
| `VBtn` | `rounded="lg"`, `variant="elevated"` |
| `VCard` | `rounded="xl"` |
| `VTextField` | `variant="outlined"`, `density="comfortable"` |
| `VTextarea` | `variant="outlined"`, `density="comfortable"` |
| `VAutocomplete` | `variant="outlined"`, `density="comfortable"` |

Override these per-instance only when there's a clear reason (e.g., `variant="text"` for icon action buttons in list items).

### Reusable CSS classes (`assets/global.scss`)

| Class | Apply to | Purpose |
|-------|----------|---------|
| `page-card-title` | `v-card-title` | Responsive flex header: title + actions in one row at desktop, actions wrap below on narrow viewports |
| `page-header-actions` | `div` inside `page-card-title` | Right-aligns actions via `margin-left: auto`; wraps naturally on `xs` |
| `event-actions` | `div` at bottom of event card | `flex-wrap` row for action buttons, separated from metadata |
| `page-title` | `span` inside card header | Page-level heading size |
| `section-label` | `div` before a list section | Uppercase subdued section heading with a leading amber diamond marker |
| `empty-state` / `empty-title` / `empty-desc` | Empty state container | Centered empty state layout |

### Page structure pattern

Every authenticated page: `v-row justify="center"` → `v-col cols="12" sm="11" md="9" lg="6"` (lg="7" for wider) → `v-card` → `v-card-title class="page-card-title"` (icon + `h1.page-title` + `.page-header-actions`) → `v-divider` → `v-card-text` with loading/content split → `<Snackbar ref="snackbar" />` after the card. See any existing page for the exact structure.

### Event / gathering card pattern

`.event-item pa-4 mb-3`: first row is chip + datetime only (never mix actions into the metadata row); action buttons go in a separate `.event-actions` div at the bottom. See `calendar.vue` for the canonical example.

### Icons

Icons are **tree-shaken MDI SVGs** (`@mdi/js` + Vuetify's `mdi-svg` icon set) — the app does **not** ship the MDI icon font, so `mdi-*` font-class names render nothing.

- Reference icons as **`$aliasName`** (e.g. `<v-icon>$clockOutline</v-icon>`, `prepend-inner-icon="$magnify"`), including in TS maps that return icon names (see `responseIcon` in `helpers/gatherings.ts`).
- **Adding a new icon**: register it in `vuetify.icons.ts` first — one line, camelCase alias key → the `@mdi/js` export name as a string (e.g. `mapMarkerOutline: 'mdiMapMarkerOutline'`). vuetify-nuxt-module generates the import at build time, so only registered icons ship in the bundle (~0.4 KB each vs ~460 KB for the full font).
- An unregistered or typo'd alias renders **blank with no build error** — after adding icons, check the page with `yarn screenshot`.
- Vuetify's internal defaults ($menu, chip close, select arrows, rating stars…) come from `vuetify/iconsets/mdi-svg` automatically; don't register those.
- Don't add `@mdi/font` back (it's the whole 7,400-icon font) and don't hotlink icon CDNs.

### Icon-only action buttons

Any button without visible text **must** have `aria-label` and `title` attributes.

### Empty states

Use `.empty-state` / `.empty-title` / `.empty-desc` classes with a large `color="primary"` icon at `opacity: 0.3`, a title, a one-sentence description, and a primary CTA button.

### Notifications

Use `<Snackbar ref="snackbar" />` (placed after the `v-card`, inside `v-col`). Call `snackbar.value?.showSnackbarWithMessage(message, isError)`.

### Responsive / mobile

All pages target mobile-first (xs < 600px, sm 600–960px, md 960–1280px, lg/xl 1280px+). **`v-list-item-title` clipping**: Vuetify 4 clips titles to one line — when a list item has a prepend avatar and multiple append buttons the title truncates on mobile. Fix with scoped `:deep(.v-list-item-title) { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.35; }`.

### Accessibility

Targets WCAG 2.1 AA. Rules for all new UI:
- Page titles: `<h1 class="page-title">` — not `<span>`. CSS resets browser h1 defaults.
- Skip link: `layouts/default.vue` has a `.skip-link` targeting `#main-content`. Do not remove.
- Loading: every `<v-progress-linear indeterminate>` needs `aria-label` describing what loads.
- Notifications: `<Snackbar>` has `role="alert"` on its `<v-snackbar>`. Do not remove.
- Avatars: initials are decorative — add `aria-hidden="true"` to `v-avatar`.
- Links: must have `text-decoration: underline` in default state (not colour alone).
- Motion: `global.scss` has `prefers-reduced-motion: reduce` collapsing all durations. Don't bypass with inline styles.

#### Contrast quick-reference

Ratios below are measured against the walnut card surface `#20140A` (where body text sits), verified with a WCAG script.

| Use case | Colour | CR on card |
|---|---|---|
| Primary buttons, icons | `#C8860A` | ~5.9:1 ✓ |
| Success text/tonal | `#55B855` | ~7.2:1 ✓ |
| Error text/tonal | `#E05252` | ~4.7:1 ✓ |
| Accent text/tonal | `#C0A870` | ~7.8:1 ✓ |
| Warning text/tonal | `#D4A820` | ~8.1:1 ✓ |
| Info text/tonal | `#5B8FAB` | ~5.1:1 ✓ |
| Body text | `#E8D4A8` | ~12.4:1 ✓ |
| Button label on primary | `#100A04` on `#C8860A` | ~6.4:1 ✓ |
| Section labels | `#c8860a` at `0.8rem` | ~5.9:1 ✓ |

Inactive rating stars use `rgba(200,134,10,0.7)` (~3.5:1) — clears the 3:1 WCAG 1.4.11 threshold for UI components against the card. **Do not drop below 0.7**; `0.55` fails on the lighter walnut surface.

Friend/request avatar initials are dark (`#231708`) on the brass/sand (`primary`/`accent`) token avatars (~5.8:1); on a `surface-variant` avatar use the `.avatar-initial--on-dark` modifier (parchment text) instead.

## Pull Requests

When writing PR descriptions (e.g. via `mcp__github__create_pull_request`), pass the `body` string as a plain JSON string — **never** wrap it in a shell heredoc like `$(cat <<'EOF' ... EOF)`. The GitHub MCP tool receives the value directly as a JSON parameter; heredoc syntax will be passed literally as the PR body text rather than being interpolated. Similarly, do **not** use `\n` escape sequences in the body string — use actual line breaks in the JSON string value instead.

## Deployment

GitHub Actions (`.github/workflows/cd.yml`) runs `yarn generate` and deploys `dist/` to GitHub Pages on push to `main`, then deploys the database rules and Cloud Functions (`firebase deploy --only database` / `--only functions`) authenticated with the `FIREBASE_SERVICE_ACCOUNT_3AE94` key (the `github-action-…` SA). Firebase credentials are injected as GitHub secrets. The `ci.yml` workflow runs `yarn lint`, `yarn test`, and `yarn workspace functions run build` on push to `main` and on PRs. It also has a `rules` job that runs `yarn test:rules` (RTDB emulator + `actions/setup-java`, Temurin 21) — these tests need Java and an emulator, so the job is gated behind a `changes` job (`dorny/paths-filter`, pinned to a commit SHA) and only runs when `database.rules.json`, `test/rules/**`, `vitest.rules.config.ts`, or `firebase.json` changed. The path filter lives in a job rather than a workflow-level `paths:` trigger because GitHub's native `paths:` filter can't gate an individual job; keep the SHA pin when bumping the action.

### Cloud Functions service accounts (important)

The functions pin a scoped runtime SA in `setGlobalOptions`: `serviceAccount: 'firebase-adminsdk-fbsvc@…'`. This is deliberate, for **least privilege** — if `serviceAccount` is unset, functions run as the project's default compute SA (`<projectNumber>-compute@…`), which carries the broad `roles/editor`. The scoped SA already has the RTDB read + Firebase Auth access the functions need.

The 2nd-gen RTDB→Eventarc triggers (`onFriendRequest`, `onGatheringInvite`, `onGatheringStateChange`) run as that SA, which **must hold `roles/eventarc.eventReceiver`** or deploys fail trigger validation with `Permission 'eventarc.events.receiveEvent' denied`. This is a one-time, persistent grant (CD never touches IAM):

```bash
gcloud projects add-iam-policy-binding board-game-calendar-3ae94 \
  --member="serviceAccount:firebase-adminsdk-fbsvc@board-game-calendar-3ae94.iam.gserviceaccount.com" \
  --role="roles/eventarc.eventReceiver"
```

Secret access (`BGG_API_KEY`, `RESEND_API_KEY`, `FACEBOOK_APP_SECRET`) is auto-granted to the runtime SA at deploy time; this works in CD because the `github-action-…` deployer SA has `secretmanager.admin` and project-level `iam.serviceAccountUser` (so it can grant secrets and `actAs` the runtime SA). **Each secret must exist in Secret Manager before a deploy that references it** — a function declaring `secrets: [FACEBOOK_APP_SECRET]` fails to deploy if `FACEBOOK_APP_SECRET` is unset, so run `firebase functions:secrets:set FACEBOOK_APP_SECRET` before merging the data-deletion function. Each trigger also pins `instance: 'board-game-calendar-3ae94-default-rtdb'` so the RTDB instance is unambiguous.

### Cloud Functions dependencies — no lockfile, pin exact (important)

`functions/` is a Yarn Berry workspace member, so `yarn.lock` at the repo root manages it for local/CI installs (Berry doesn't emit a standalone per-workspace lockfile). On deploy, Firebase uploads **only** the `functions/` dir, and Google's buildpack installs runtime deps from `functions/package.json`. The buildpack chooses the package manager by lockfile: a `package-lock.json` triggers strict `npm ci` (fails if it drifts from `package.json`), while **no lockfile** falls back to a forgiving `npm install`. A committed npm `package-lock.json` inside this yarn repo was the source of recurring deploy failures — **do not add one back** (nor a `functions/yarn.lock`). Instead, **pin runtime deps to exact versions** (no `^`/`~`) in `functions/package.json` for reproducible cloud installs; Dependabot bumps them. Don't add a `yarn` field under `functions.engines` — the cloud build uses npm there, not yarn.

The buildpack's `npm install` enforces **peer deps strictly** (unlike Yarn Berry, which only warns): `firebase-admin` must stay within `firebase-functions`' peer range (`^11.10 || ^12 || ^13` as of firebase-functions 7.2.5) or every function's cloud build fails with `ERESOLVE` — CI won't catch it. `dependabot.yml` ignores firebase-admin major bumps for this reason; drop that ignore when firebase-functions accepts admin 14.

### Cloud Functions deploy health — merged ≠ deployed (important)

CI (`ci.yml`) builds the functions but never deploys them; only the **last** step of `cd.yml` does. So a merged PR's functions can silently lag `main` for days while the site and DB rules (deployed earlier in the same job) stay current — at one point every functions deploy failed for 4 days and three stacked causes had to be peeled off one at a time. Lessons:

- **When a server-side feature misbehaves in production, check the latest `cd.yml` run on `main` first** — before debugging code. If the functions step is red, the code you're reading may have never shipped. Deploy-blocking failures also mask each other: fixing one surfaces the next, so after any deploy fix, watch the next run all the way to green.
- **A failed v2 function _create_ poisons its name.** If the first deploy of a new function dies mid-create (e.g. a container build failure), GCP keeps a half-created record with no Eventarc trigger and classifies it as an *HTTPS* function; every later deploy of that name then fails with "Changing from an HTTPS function to a background triggered function is not allowed", and GCF never converts trigger types in place. Remedy: deploy under a **new export name** (the deploy `--force` flag then deletes the orphan once a deploy succeeds) or manually `firebase functions:delete <name> --force` and keep the name. Retired poisoned names — do **not** reuse: `onEmailInviteCreated`, `onEmailInviteAdded` (the email-invite trigger is now `onGatheringEmailInvite`).
- `cd.yml` deploys functions with `--force`: functions removed from (or renamed in) the source are **deleted from production** on the next green deploy. That's intended gitops behavior — but it means removing an export is a production deletion, not a no-op.
