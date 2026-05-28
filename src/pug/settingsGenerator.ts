/**
 * OW Custom Game Settings & Code Generator for PUG matches.
 *
 * Two output modes:
 * - generateSettings(): Settings-only block for human-hosted lobbies.
 *   The host loads ScrimTime by share code separately and only needs
 *   map/hero ban config to paste into Custom Game > Settings > Import.
 *
 * - generateFullCode(): Complete importable blob for bot-hosted lobbies.
 *   Combines dynamic settings (maps, hero bans, mode config, workshop
 *   settings) with the full Workshop code (ScrimTime logging rules,
 *   ELMT position tracking, admin controls). The bot pastes this as a
 *   single import — no separate share code needed.
 *
 * Samoa, Colosseo, and Esperanca have duplicate entries in OW's internal
 * Map enum (confirmed OW bug). They can't be referenced in enabled maps,
 * so we use disabled maps to exclude everything else instead.
 */

export type SettingsInput = {
  mapSettingsEntry: string | null
  mapType: string
  bannedHeroes: string[]
  /** Other map names in the same mode, used for disabled-maps workaround */
  otherMapsInMode?: string[]
  /** Host instruction when disabled maps can't fully isolate the target */
  hostNote?: string
}

const MODE_BY_MAP_TYPE: Record<string, string> = {
  clash: 'Clash',
  control: 'Control',
  escort: 'Escort',
  flashpoint: 'Flashpoint',
  hybrid: 'Hybrid',
  push: 'Push',
}

const HUMAN_MODE_SETTINGS: Record<string, string[]> = {
  Clash: ['\t\t\tCapture Speed Modifier: 45%'],
  Control: ['\t\t\tCompetitive Rules: On'],
  Escort: ['\t\t\tCompetitive Rules: On'],
  Flashpoint: ['\t\t\tCompetitive Rules: On'],
  Hybrid: ['\t\t\tCompetitive Rules: On'],
  Push: ['\t\t\tCompetitive Rules: On'],
}

const BOT_MODE_SETTINGS: Record<string, string[]> = {
  Clash: ['\t\t\tCapture Speed Modifier: 45%'],
}

const ALL_MODES = ['Clash', 'Control', 'Escort', 'Flashpoint', 'Hybrid', 'Push']

// OW map variants not in our DB that need to be disabled
const VARIANT_MAPS: Record<string, string[]> = {
  Control: ['Lijiang Tower Lunar New Year'],
}

// Maps with duplicate OW enum entries that can't be used in enabled/disabled maps
const BROKEN_MAP_NAMES = ['Samoa', 'Colosseo', 'Esperança']

function buildMapBlock(
  mode: string,
  targetMode: string,
  mapSettingsEntry: string | null,
  otherMapsInMode: string[] | undefined,
  useDisabledApproach: boolean,
): string[] {
  const lines: string[] = []
  if (mode === targetMode && useDisabledApproach) {
    const variants = VARIANT_MAPS[mode] ?? []
    const mapsToDisable = [...(otherMapsInMode ?? []), ...variants].filter(
      (name) => !BROKEN_MAP_NAMES.includes(name),
    )
    if (mapsToDisable.length > 0) {
      lines.push('\t\t\tdisabled maps')
      lines.push('\t\t\t{')
      for (const name of mapsToDisable) {
        lines.push(`\t\t\t\t${name}`)
      }
      lines.push('\t\t\t}')
    }
  } else {
    lines.push('\t\t\tenabled maps')
    lines.push('\t\t\t{')
    if (mode === targetMode && mapSettingsEntry) {
      lines.push(`\t\t\t\t${mapSettingsEntry}`)
    }
    lines.push('\t\t\t}')
  }
  return lines
}

function buildHeroesBlock(bannedHeroes: string[]): string[] {
  if (bannedHeroes.length === 0) return []
  const lines: string[] = []
  lines.push('')
  lines.push('\theroes')
  lines.push('\t{')
  lines.push('\t\tGeneral')
  lines.push('\t\t{')
  lines.push('\t\t\tdisabled heroes')
  lines.push('\t\t\t{')
  for (const hero of bannedHeroes) {
    lines.push(`\t\t\t\t${hero}`)
  }
  lines.push('\t\t\t}')
  lines.push('\t\t}')
  lines.push('\t}')
  return lines
}

/** Settings-only output for human-hosted lobbies */
export function generateSettings(input: SettingsInput): string {
  const { mapSettingsEntry, mapType, bannedHeroes, otherMapsInMode, hostNote } = input
  const targetMode = MODE_BY_MAP_TYPE[mapType]
  const useDisabledApproach = otherMapsInMode && otherMapsInMode.length > 0

  const lines: string[] = []
  lines.push('settings')
  lines.push('{')

  lines.push('\tmain')
  lines.push('\t{')
  lines.push('\t\tMode Name: "Competitive Rules"')
  lines.push('\t}')
  lines.push('')

  lines.push('\tlobby')
  lines.push('\t{')
  lines.push('\t\tData Center Preference: USA - Central')
  lines.push('\t\tPause Game On Player Disconnect: Yes')
  lines.push('\t}')
  lines.push('')

  lines.push('\tmodes')
  lines.push('\t{')

  for (const mode of ALL_MODES) {
    const settings = HUMAN_MODE_SETTINGS[mode]
    lines.push(`\t\t${mode}`)
    lines.push('\t\t{')
    if (settings) {
      lines.push(...settings)
      lines.push('')
    }
    lines.push(
      ...buildMapBlock(mode, targetMode!, mapSettingsEntry, otherMapsInMode, !!useDisabledApproach),
    )
    lines.push('\t\t}')
    lines.push('')
  }

  lines.push('\t\tGeneral')
  lines.push('\t\t{')
  lines.push('\t\t\tLimit Roles: 1 Tank 2 Offense 2 Support')
  lines.push('\t\t\tRandom Hero Role Limit Per Team: 5')
  lines.push('\t\t}')

  lines.push('\t}')
  lines.push(...buildHeroesBlock(bannedHeroes))
  lines.push('}')

  let result = lines.join('\n')
  if (hostNote) {
    result = `// HOST: ${hostNote}\n${result}`
  }
  return result
}

/** Complete importable blob for bot-hosted lobbies (settings + Workshop code) */
export function generateFullCode(input: SettingsInput): string {
  // Dynamic import to avoid loading fs in client bundles
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getWorkshopTemplate } = require('./workshopTemplate') as {
    getWorkshopTemplate: () => string
  }

  const settingsBlock = generateBotSettings(input)
  const workshopCode = getWorkshopTemplate()

  return settingsBlock + '\n\n' + workshopCode
}

function generateBotSettings(input: SettingsInput): string {
  const { mapSettingsEntry, mapType, bannedHeroes, otherMapsInMode } = input
  const targetMode = MODE_BY_MAP_TYPE[mapType]
  const useDisabledApproach = otherMapsInMode && otherMapsInMode.length > 0

  const lines: string[] = []
  lines.push('settings')
  lines.push('{')

  lines.push('\tmain')
  lines.push('\t{')
  lines.push(
    '\t\tDescription: "ELMT PUG — ScrimTime + Admin Controls\\nPowered by elmt.gg"',
  )
  lines.push('\t\tMode Name: "ELMT PUG"')
  lines.push('\t}')
  lines.push('')

  lines.push('\tlobby')
  lines.push('\t{')
  lines.push('\t\tData Center Preference: USA - Central')
  lines.push('\t\tMap Rotation: After A Game')
  lines.push('\t\tMax Spectators: 12')
  lines.push('\t\tPause Game On Player Disconnect: No')
  lines.push('\t\tReturn To Lobby: After A Game')
  lines.push('\t}')
  lines.push('')

  lines.push('\tmodes')
  lines.push('\t{')

  for (const mode of ALL_MODES) {
    const settings = BOT_MODE_SETTINGS[mode]
    lines.push(`\t\t${mode}`)
    lines.push('\t\t{')
    if (settings) {
      lines.push(...settings)
      lines.push('')
    }
    lines.push(
      ...buildMapBlock(mode, targetMode!, mapSettingsEntry, otherMapsInMode, !!useDisabledApproach),
    )
    lines.push('\t\t}')
    lines.push('')
  }

  lines.push('\t\tGeneral')
  lines.push('\t\t{')
  lines.push('\t\t\tCompetitive Rules: On')
  lines.push('\t\t\tGame Mode Start: Immediately')
  lines.push('\t\t\tLimit Roles: 1 Tank 2 Offense 2 Support')
  lines.push('\t\t\tRandom Hero Role Limit Per Team: 5')
  lines.push('\t\t\tTank Role Passive Health Bonus: Always Enabled')
  lines.push('\t\t}')

  lines.push('\t}')
  lines.push(...buildHeroesBlock(bannedHeroes))

  // Workshop settings block — hardcoded values for bot-hosted PUGs.
  // ScrimTime defaults are tuned for scrims (full map play, etc).
  // We override to match competitive rules for PUGs.
  lines.push('')
  lines.push('\tworkshop')
  lines.push('\t{')
  lines.push('\t\tControl Point Progress Increment: 33.300')
  lines.push('\t\tEnable Debug Mode: Off')
  lines.push('\t\tEnable Ready Up System: [2]')
  lines.push('\t\tAutomatically End Match Time: 2700')
  lines.push(
    '\t\tEnd Assault, Escort and Hybrid Maps After Two Rounds: [2]',
  )
  lines.push('\t\tEnd Control Maps After Three Rounds: Off')
  lines.push('\t\tEnd Flashpoint Maps After Five Captures: Off')
  lines.push(
    '\t\tEnsure Full Map is Attacked on Round 2 for Assault, Escort and Hybrid Maps: Off',
  )
  lines.push('\t\tPayload Progress Increment: 10.000')
  lines.push('\t}')

  lines.push('}')

  return lines.join('\n')
}
