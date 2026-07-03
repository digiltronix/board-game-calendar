import type { Gathering } from './types'

// Game nights have no explicit end time stored, so calendar events default to a
// fixed-length block starting at the gathering's datetime.
export const GATHERING_DURATION_HOURS = 3

export type CalendarEventInput = {
  gatheringId: string
  datetime: string // ISO date (UTC)
  hostName?: string
  location?: string
  notes?: string
  games?: { name: string }[]
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// RFC 5545 UTC timestamp: YYYYMMDDTHHMMSSZ
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

function endDate(datetime: string): Date {
  return new Date(
    new Date(datetime).getTime() + GATHERING_DURATION_HOURS * 60 * 60 * 1000
  )
}

export function eventTitle(hostName?: string): string {
  return hostName ? `Board game night with ${hostName}` : 'Board game night'
}

export function eventDescription(
  input: CalendarEventInput,
  appUrl: string
): string {
  const games = (input.games ?? []).map((g) => g.name).filter(Boolean)
  const parts: string[] = []
  if (input.hostName) parts.push(`Hosted by ${input.hostName}.`)
  if (games.length) parts.push(`Games: ${games.join(', ')}.`)
  // Terminate free-text notes so they don't run into the details link
  if (input.notes)
    parts.push(/[.!?]$/.test(input.notes) ? input.notes : `${input.notes}.`)
  parts.push(`Details: ${appUrl}/calendar`)
  return parts.join(' ')
}

// Google Calendar event-template URL (opens a pre-filled "new event" page).
export function googleCalendarUrl(
  input: CalendarEventInput,
  appUrl: string
): string {
  const start = new Date(input.datetime)
  const dates = `${toIcsUtc(start)}/${toIcsUtc(endDate(input.datetime))}`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle(input.hostName),
    dates,
    details: eventDescription(input, appUrl),
    ...(input.location ? { location: input.location } : {}),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// Escape a value for an RFC 5545 text field.
function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// A single-event VCALENDAR (METHOD:PUBLISH) for download / email attachment.
// Imports into Apple Calendar, Outlook, Google Calendar, etc.
export function buildIcs(input: CalendarEventInput, appUrl: string): string {
  const start = new Date(input.datetime)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Board Game Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.gatheringId}@bgc.jasonsuttles.dev`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(endDate(input.datetime))}`,
    `SUMMARY:${escapeIcs(eventTitle(input.hostName))}`,
    `DESCRIPTION:${escapeIcs(eventDescription(input, appUrl))}`,
    ...(input.location ? [`LOCATION:${escapeIcs(input.location)}`] : []),
    `URL:${appUrl}/calendar`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

export function toCalendarEventInput(
  gathering: Gathering & { id: string },
  hostName?: string
): CalendarEventInput {
  return {
    gatheringId: gathering.id,
    datetime: gathering.datetime,
    hostName,
    ...(gathering.location ? { location: gathering.location } : {}),
    ...(gathering.notes ? { notes: gathering.notes } : {}),
    games: gathering.games,
  }
}

// Triggers a browser download of an .ics file (Apple Calendar / Outlook).
export function downloadIcs(input: CalendarEventInput, appUrl: string): void {
  const blob = new Blob([buildIcs(input, appUrl)], {
    type: 'text/calendar;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `board-game-night-${input.gatheringId}.ics`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
