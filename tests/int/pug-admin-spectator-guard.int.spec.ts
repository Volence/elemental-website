import { describe, it, expect } from 'vitest'
import { getWorkshopTemplate } from '@/pug/workshopTemplate'

/** Extract a single workshop rule block by its exact title. */
function ruleBlock(template: string, title: string): string {
  const start = template.indexOf(`rule("${title}")`)
  if (start === -1) throw new Error(`rule not found: ${title}`)
  const next = template.indexOf('rule("', start + 1)
  return template.slice(start, next === -1 ? undefined : next)
}

describe('ELMT admin rules: spectator (bot) guard', () => {
  const template = getWorkshopTemplate()

  // These rules act on Host Player button input. The bot is always a spectator
  // (off-team), but Host Player migrates to an in-game player if the bot dies.
  // Each must additionally require the host to be a spectator, so a migrated
  // in-game host can't end/pause the match just by pressing normal buttons.
  const guardedRules = [
    'ELMT Admin: Pause or Unpause',
    'ELMT Admin: End Game Draw',
    'ELMT Admin: Team 1 Wins',
    'ELMT Admin: Team 2 Wins',
  ]

  for (const title of guardedRules) {
    it(`"${title}" only fires when the host is a spectator`, () => {
      expect(ruleBlock(template, title)).toContain('Team Of(Host Player) == All Teams')
    })
  }
})
