/**
 * OW2 Custom Game Settings Generator for PUG matches.
 *
 * Takes the base competitive settings template and dynamically injects:
 * - The voted map (only that map enabled, all others empty)
 * - Hero bans (via the `disabled heroes` block)
 *
 * Output is the full OW2 settings text block that the host pastes into
 * Custom Game > Settings > Import.
 */

export type SettingsInput = {
  /** The exact OW2 settings map entry, including internal IDs.
   *  e.g., "Samoa 972777519512068154" */
  mapSettingsEntry: string | null
  /** Map type from the Maps collection (control, escort, hybrid, push, flashpoint, clash) */
  mapType: string
  /** Hero names to ban, e.g., ["Widowmaker", "Tracer", "Ana", "Reinhardt"] */
  bannedHeroes: string[]
}

const MODE_BY_MAP_TYPE: Record<string, string> = {
  clash: 'Clash',
  control: 'Control',
  escort: 'Escort',
  flashpoint: 'Flashpoint',
  hybrid: 'Hybrid',
  push: 'Push',
}

const MODE_SETTINGS: Record<string, string[]> = {
  Clash: ['\t\t\tCapture Speed Modifier: 45%'],
  Control: ['\t\t\tCompetitive Rules: On'],
  Escort: ['\t\t\tCompetitive Rules: On'],
  Flashpoint: ['\t\t\tCompetitive Rules: On'],
  Hybrid: ['\t\t\tCompetitive Rules: On'],
  Push: ['\t\t\tCompetitive Rules: On'],
}

const ALL_MODES = ['Clash', 'Control', 'Escort', 'Flashpoint', 'Hybrid', 'Push']

export function generateSettings(input: SettingsInput): string {
  const { mapSettingsEntry, mapType, bannedHeroes } = input
  const targetMode = MODE_BY_MAP_TYPE[mapType]

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
    const settings = MODE_SETTINGS[mode]
    lines.push(`\t\t${mode}`)
    lines.push('\t\t{')
    if (settings) {
      lines.push(...settings)
      lines.push('')
    }
    lines.push('\t\t\tenabled maps')
    lines.push('\t\t\t{')
    if (mode === targetMode && mapSettingsEntry) {
      lines.push(`\t\t\t\t${mapSettingsEntry}`)
    }
    lines.push('\t\t\t}')
    lines.push('\t\t}')
    lines.push('')
  }

  lines.push('\t\tGeneral')
  lines.push('\t\t{')
  lines.push('\t\t\tLimit Roles: 1 Tank 2 Offense 2 Support')
  lines.push('\t\t\tRandom Hero Role Limit Per Team: 5')
  lines.push('\t\t}')

  lines.push('\t}')

  if (bannedHeroes.length > 0) {
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
  }

  lines.push('}')

  return lines.join('\n')
}
