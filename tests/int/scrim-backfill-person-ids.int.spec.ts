/**
 * Matching rules for the personId backfill.
 *
 * A curated gameAlias is deliberate operator intent and may stamp any row.
 * A bare Person.name match is weak evidence - an OPPONENT whose in-game name
 * happens to collide with someone in our People table must not be stamped,
 * so name-only matches additionally require the row's scrim to be linked to
 * a team the person is rostered on (enforced by the caller via SQL).
 */

import { describe, it, expect } from 'vitest'
import {
  buildAliasMaps,
  resolveBackfillTarget,
} from '@/lib/scrim-analytics/backfill-person-ids'

const people = [
  { id: 1, name: 'Alex', gameAliases: [{ alias: 'AlexTheGreat' }, { alias: 'xX-Alex-Xx' }] },
  { id: 2, name: 'Cajan', gameAliases: [] },
  { id: 3, name: 'Mirky', gameAliases: [{ alias: 'Cajan' }] }, // alias colliding with a name
]

describe('resolveBackfillTarget', () => {
  const maps = buildAliasMaps(people)

  it('matches a curated alias globally (no roster check needed)', () => {
    expect(resolveBackfillTarget('alexthegreat', maps)).toEqual({
      personId: 1,
      requiresRosterCheck: false,
    })
  })

  it('matches a bare person name only with a roster check', () => {
    expect(resolveBackfillTarget('Alex', maps)).toEqual({
      personId: 1,
      requiresRosterCheck: true,
    })
  })

  it('prefers a curated alias over a colliding person name', () => {
    // 'Cajan' is person 2's name but person 3's curated alias - the alias wins
    expect(resolveBackfillTarget('Cajan', maps)).toEqual({
      personId: 3,
      requiresRosterCheck: false,
    })
  })

  it('returns null for unknown names', () => {
    expect(resolveBackfillTarget('NoSuchPlayer', maps)).toBeNull()
  })
})
