# Ideas / parked work

Backlog of features discussed but deliberately deferred. Promote an item into
a real issue/PR when it's picked up.

## BGG collection import

Let a user import their existing BoardGameGeek collection instead of adding
games one at a time through search. The target audience often has hundreds of
games already catalogued on BGG, so this removes the most tedious onboarding
step.

- BGG XML API v2 has a collection endpoint: `GET /xmlapi2/collection?username=<name>&own=1`.
- Proxy it through a new Cloud Function alongside `bggSearch`/`bggThing`
  (same `BGG_API_KEY` bearer auth, same `xml2js` parsing). The endpoint is
  asynchronous on BGG's side: it can return **202 "try again"** while BGG
  builds the export, so the function (or client) needs a short retry loop.
- The collection export lacks per-game detail (categories, playtimes) — fetch
  those via `bggThing` in batches of ≤20 ids after the import, or lazily.
- UI: an "Import from BGG" action on the game collection page prompting for a
  BGG username, with a preview + confirm step and duplicate skipping (match on
  BGG game id).

## Email-invite RSVP fails on address mismatch

`acceptEmailInvite` requires the signed-in account's verified email to match
the invited address exactly. Someone invited at one address who signs in with
a different Google/Facebook account gets "No email invite found for your
address" with no recovery path. Possible fixes: let the host re-send to a
different address from the gathering page, or a signed one-time token in the
invite link that doesn't depend on the email matching. Parked for now.

## Sign-in fails inside in-app browsers (webviews)

Sign-in is OAuth-popup-only (`signInWithPopup`, Google/Facebook). Invite
emails opened in the Gmail/Outlook mobile apps or links opened from
Facebook/Messenger launch an embedded webview, where Google blocks OAuth
(`disallowed_useragent`) and popups are unreliable — so a new invitee's very
first touch can dead-end at the sign-in wall. Options: detect webviews and
show "open in your browser" guidance, add `signInWithRedirect` fallback, or
add email-link (passwordless) auth. Parked for now.
