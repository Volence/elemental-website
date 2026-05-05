/**
 * OW2 Custom Game Settings Generator for PUG matches.
 *
 * Takes the base competitive settings template and dynamically injects:
 * - The voted map (only that map enabled, all others empty)
 * - Hero bans (via the `disabled heroes` block)
 *
 * Output is the full OW2 settings text block that the host pastes into
 * Custom Game → Settings → Import.
 */

export type SettingsInput = {
  /** The exact OW2 settings map entry, including internal IDs.
   *  e.g., "Lijiang Tower 972777519512068197 972777519512068153 972777519512068154" */
  mapSettingsEntry: string | null
  /** Map type from the Maps collection (control, escort, hybrid, push, flashpoint, clash) */
  mapType: string
  /** Hero names to ban, e.g., ["Widowmaker", "Tracer", "Ana", "Reinhardt"] */
  bannedHeroes: string[]
}

/**
 * Mode names in the OW2 settings format, keyed by our Maps collection type values.
 * The order here matches the order in the base template.
 */
const MODE_BY_MAP_TYPE: Record<string, string> = {
  clash: 'Clash',
  control: 'Control',
  escort: 'Escort',
  flashpoint: 'Flashpoint',
  hybrid: 'Hybrid',
  push: 'Push',
}

/**
 * Modes that are always disabled (6v6 variants and Assault).
 * These are preserved as-is in the output.
 */
const ALWAYS_DISABLED_MODES = [
  'Assault',
  'Clash 6v6',
  'Control 6v6',
  'Escort 6v6',
  'Flashpoint 6v6',
  'Hybrid 6v6',
  'Push 6v6',
]

/**
 * Settings config for each non-disabled mode.
 * Uses string arrays instead of single strings to avoid clipboard formatting issues.
 */
const MODE_SETTINGS: Record<string, string[]> = {
  Clash: ['\t\t\tCapture Speed Modifier: 45%', '\t\t\tCompetitive Rules: On'],
  Control: ['\t\t\tCompetitive Rules: On'],
  Escort: ['\t\t\tCompetitive Rules: On'],
  Flashpoint: ['\t\t\tCompetitive Rules: On'],
  Hybrid: ['\t\t\tCompetitive Rules: On'],
  Push: ['\t\t\tCompetitive Rules: On'],
}

/**
 * Generates OW2 custom game settings text with the correct map and hero bans.
 */
export function generateSettings(input: SettingsInput): string {
  const { mapSettingsEntry, mapType, bannedHeroes } = input
  const targetMode = MODE_BY_MAP_TYPE[mapType]

  const lines: string[] = []
  lines.push('settings')
  lines.push('{')

  // Main section
  lines.push('\tmain')
  lines.push('\t{')
  lines.push('\t\tMode Name: "Competitive Rules"')
  lines.push('\t}')
  lines.push('')

  // Lobby section
  lines.push('\tlobby')
  lines.push('\t{')
  lines.push('\t\tData Center Preference: USA - Central')
  lines.push('\t\tPause Game On Player Disconnect: Yes')
  lines.push('\t}')
  lines.push('')

  // Modes section
  lines.push('\tmodes')
  lines.push('\t{')

  // Always-disabled modes
  for (const mode of ALWAYS_DISABLED_MODES) {
    lines.push(`\t\tdisabled ${mode}`)
    lines.push('\t\t{')
    const settings = MODE_SETTINGS[mode] || MODE_SETTINGS[mode.replace(' 6v6', '')]
    if (settings) lines.push(...settings)
    lines.push('\t\t}')
    lines.push('')
  }

  // Active modes — only the target mode gets the map, others get empty enabled maps
  const activeModes = ['Clash', 'Control', 'Escort', 'Flashpoint', 'Hybrid', 'Push']
  for (const mode of activeModes) {
    const settings = MODE_SETTINGS[mode]
    lines.push(`\t\t${mode}`)
    lines.push('\t\t{')
    if (settings) lines.push(...settings)
    lines.push('')
    lines.push('\t\t\tenabled maps')
    lines.push('\t\t\t{')
    if (mode === targetMode && mapSettingsEntry) {
      lines.push(`\t\t\t\t${mapSettingsEntry}`)
    }
    // Empty block = no maps for this mode
    lines.push('\t\t\t}')
    lines.push('\t\t}')
    lines.push('')
  }

  lines.push('\t}')

  // Heroes section — only added if there are bans
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
