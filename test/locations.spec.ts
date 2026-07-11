import { describe, it, expect } from 'vitest'
import {
  addressToLocation,
  savedLocationPlan,
  MAX_SAVED_LOCATIONS,
} from '~/helpers/locations'

describe('addressToLocation', () => {
  it('collapses a multi-line address to a single comma-separated line', () => {
    expect(addressToLocation('123 Game Night Lane\nBoard City, BC 12345')).toBe(
      '123 Game Night Lane, Board City, BC 12345'
    )
  })

  it('trims lines and drops blank ones', () => {
    expect(addressToLocation('  1 Main St  \n\n  Springfield ')).toBe(
      '1 Main St, Springfield'
    )
  })

  it('passes a single-line address through unchanged', () => {
    expect(addressToLocation('1 Main St')).toBe('1 Main St')
  })

  it('returns an empty string for an empty address', () => {
    expect(addressToLocation('')).toBe('')
  })
})

describe('savedLocationPlan', () => {
  it('saves a new location with no evictions while under the cap', () => {
    expect(savedLocationPlan({ '-a': '1 Main St' }, '2 Elm St', '')).toEqual({
      save: true,
      removeKeys: [],
    })
  })

  it('skips an empty or whitespace-only location', () => {
    expect(savedLocationPlan({}, '', '1 Main St').save).toBe(false)
    expect(savedLocationPlan({}, '   ', '1 Main St').save).toBe(false)
  })

  it('skips the host own address, ignoring case, spacing and line breaks', () => {
    expect(
      savedLocationPlan({}, '1 main st,  springfield', '1 Main St\nSpringfield')
        .save
    ).toBe(false)
  })

  it('skips a location already in the list, ignoring case and spacing', () => {
    expect(savedLocationPlan({ '-a': '2 Elm  St' }, '2 elm st', '').save).toBe(
      false
    )
  })

  it('evicts the oldest entries to stay within the cap', () => {
    // Push IDs sort lexicographically by creation time: -a oldest.
    const existing = Object.fromEntries(
      Array.from({ length: MAX_SAVED_LOCATIONS + 1 }, (_, i) => [
        `-${String.fromCharCode(97 + i)}`,
        `${i} Oak St`,
      ])
    )
    expect(savedLocationPlan(existing, '99 New St', '')).toEqual({
      save: true,
      removeKeys: ['-a', '-b'],
    })
  })
})
