import { describe, it, expect } from 'vitest'
import {
  eventTitle,
  eventDescription,
  googleCalendarUrl,
  buildIcs,
  toCalendarEventInput,
  type CalendarEventInput,
} from '~/helpers/calendar'

const APP_URL = 'https://bgc.jasonsuttles.dev'

// 2026-07-01 19:00 UTC; +3h default duration => 22:00 UTC
const event: CalendarEventInput = {
  gatheringId: 'abc123',
  datetime: '2026-07-01T19:00:00.000Z',
  hostName: 'Alex Johnson',
  games: [{ name: 'Catan' }, { name: 'Wingspan' }],
}

describe('eventTitle', () => {
  it('includes the host name when present', () => {
    expect(eventTitle('Alex Johnson')).toBe(
      'Board game night with Alex Johnson'
    )
  })

  it('falls back to a generic title without a host', () => {
    expect(eventTitle()).toBe('Board game night')
  })
})

describe('eventDescription', () => {
  it('lists host, games, and a details link', () => {
    const desc = eventDescription(event, APP_URL)
    expect(desc).toContain('Hosted by Alex Johnson.')
    expect(desc).toContain('Games: Catan, Wingspan.')
    expect(desc).toContain(`${APP_URL}/calendar`)
  })
})

describe('googleCalendarUrl', () => {
  it('builds a TEMPLATE url with a UTC start/end range', () => {
    const url = googleCalendarUrl(event, APP_URL)
    expect(url).toContain('https://calendar.google.com/calendar/render?')
    expect(url).toContain('action=TEMPLATE')
    // dates=20260701T190000Z/20260701T220000Z (url-encoded slash)
    expect(decodeURIComponent(url)).toContain(
      'dates=20260701T190000Z/20260701T220000Z'
    )
  })
})

describe('buildIcs', () => {
  it('produces a single VEVENT with correct UTC times and CRLF lines', () => {
    const ics = buildIcs(event, APP_URL)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('UID:abc123@bgc.jasonsuttles.dev')
    expect(ics).toContain('DTSTART:20260701T190000Z')
    expect(ics).toContain('DTEND:20260701T220000Z')
    expect(ics).toContain('SUMMARY:Board game night with Alex Johnson')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('\r\n')
  })

  it('escapes commas in the description per RFC 5545', () => {
    const ics = buildIcs(event, APP_URL)
    expect(ics).toContain('Catan\\, Wingspan')
  })
})

describe('location and notes', () => {
  it('adds a Google Calendar location param only when a location is set', () => {
    const withLocation = new URL(
      googleCalendarUrl({ ...event, location: '1 Main St' }, APP_URL)
    )
    expect(withLocation.searchParams.get('location')).toBe('1 Main St')
    const bare = new URL(googleCalendarUrl(event, APP_URL))
    expect(bare.searchParams.has('location')).toBe(false)
  })

  it('emits an escaped LOCATION line only when a location is set', () => {
    const ics = buildIcs(
      { ...event, location: '1 Main St, Apt 2; ring twice' },
      APP_URL
    )
    expect(ics).toContain('LOCATION:1 Main St\\, Apt 2\\; ring twice')
    expect(buildIcs(event, APP_URL)).not.toContain('LOCATION:')
  })

  it('includes notes in the description', () => {
    const desc = eventDescription({ ...event, notes: 'Bring snacks' }, APP_URL)
    expect(desc).toContain('Bring snacks')
  })

  it('carries location and notes from the gathering, dropping cleared nulls', () => {
    const base = {
      id: 'abc123',
      state: 'pending' as const,
      datetime: event.datetime,
      timezone: 'America/Chicago',
      initiator: 'h',
      host: 'h',
      maxGuests: 4,
    }
    const withValues = toCalendarEventInput(
      { ...base, location: '1 Main St', notes: 'Bring snacks' },
      'Alex Johnson'
    )
    expect(withValues.location).toBe('1 Main St')
    expect(withValues.notes).toBe('Bring snacks')
    const cleared = toCalendarEventInput(
      { ...base, location: null, notes: null },
      'Alex Johnson'
    )
    expect('location' in cleared).toBe(false)
    expect('notes' in cleared).toBe(false)
  })
})
