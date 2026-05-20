'use client'

import React, { useEffect, useState } from 'react'
import './styles.scss'

type MapData = { id: number; name: string; type: string; settingsEntry?: string }
type HeroData = { id: number; name: string; role: string }

/** Mode names in the OW settings format, keyed by Maps collection type */
const MODE_BY_MAP_TYPE: Record<string, string> = {
  clash: 'Clash', control: 'Control', escort: 'Escort',
  flashpoint: 'Flashpoint', hybrid: 'Hybrid', push: 'Push',
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

const VARIANT_MAPS: Record<string, string[]> = {
  Control: ['Lijiang Tower Lunar New Year'],
}

const BROKEN_MAP_NAMES = ['Samoa', 'Colosseo', 'Esperança']

function generateSettingsText(
  mapSettingsEntry: string | null,
  mapType: string,
  bannedHeroes: string[],
  otherMapsInMode?: string[],
  hostNote?: string,
): string {
  const targetMode = MODE_BY_MAP_TYPE[mapType]
  const useDisabled = otherMapsInMode && otherMapsInMode.length > 0
  const lines: string[] = []
  if (hostNote) lines.push(`// HOST: ${hostNote}`)
  lines.push('settings', '{')
  lines.push('\tmain', '\t{', '\t\tMode Name: "Competitive Rules"', '\t}', '')
  lines.push('\tlobby', '\t{', '\t\tData Center Preference: USA - Central', '\t\tPause Game On Player Disconnect: Yes', '\t}', '')
  lines.push('\tmodes', '\t{')

  for (const mode of ALL_MODES) {
    const settings = MODE_SETTINGS[mode]
    lines.push(`\t\t${mode}`, '\t\t{')
    if (settings) lines.push(...settings, '')

    if (mode === targetMode && useDisabled) {
      const variants = VARIANT_MAPS[mode] ?? []
      const toDisable = [...otherMapsInMode, ...variants].filter((n) => !BROKEN_MAP_NAMES.includes(n))
      if (toDisable.length > 0) {
        lines.push('\t\t\tdisabled maps', '\t\t\t{')
        for (const n of toDisable) lines.push(`\t\t\t\t${n}`)
        lines.push('\t\t\t}')
      }
    } else {
      lines.push('\t\t\tenabled maps', '\t\t\t{')
      if (mode === targetMode && mapSettingsEntry) lines.push(`\t\t\t\t${mapSettingsEntry}`)
      lines.push('\t\t\t}')
    }

    lines.push('\t\t}', '')
  }

  lines.push('\t\tGeneral', '\t\t{')
  lines.push('\t\t\tLimit Roles: 1 Tank 2 Offense 2 Support')
  lines.push('\t\t\tRandom Hero Role Limit Per Team: 5')
  lines.push('\t\t}')

  lines.push('\t}')

  if (bannedHeroes.length > 0) {
    lines.push('', '\theroes', '\t{', '\t\tGeneral', '\t\t{', '\t\t\tdisabled heroes', '\t\t\t{')
    for (const hero of bannedHeroes) {
      lines.push(`\t\t\t\t${hero}`)
    }
    lines.push('\t\t\t}', '\t\t}', '\t}')
  }

  lines.push('}')
  return lines.join('\n')
}

export const SettingsGeneratorPanel: React.FC = () => {
  const [maps, setMaps] = useState<MapData[]>([])
  const [heroes, setHeroes] = useState<HeroData[]>([])
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null)
  const [bannedHeroIds, setBannedHeroIds] = useState<number[]>([])
  const [settingsText, setSettingsText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/maps?limit=100&sort=name&depth=0').then((r) => r.json()),
      fetch('/api/heroes?limit=100&sort=name&depth=0&where[active][equals]=true').then((r) => r.json()),
    ])
      .then(([mapData, heroData]) => {
        setMaps(
          (mapData.docs || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            type: m.type,
            settingsEntry: m.settingsEntry ?? undefined,
          })),
        )
        setHeroes(
          (heroData.docs || []).map((h: any) => ({
            id: h.id,
            name: h.name,
            role: h.role,
          })),
        )
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  function toggleBan(heroId: number) {
    setBannedHeroIds((prev) =>
      prev.includes(heroId) ? prev.filter((id) => id !== heroId) : [...prev, heroId],
    )
    setSettingsText(null)
  }

  function generate() {
    const selectedMap = maps.find((m) => m.id === selectedMapId)
    const mapType = selectedMap?.type || 'control'
    const mapEntry = selectedMap?.settingsEntry || selectedMap?.name || null
    const mapName = selectedMap?.name ?? ''
    const bannedNames = heroes.filter((h) => bannedHeroIds.includes(h.id)).map((h) => h.name)

    let otherMapsInMode: string[] | undefined
    let hostNote: string | undefined

    if (BROKEN_MAP_NAMES.includes(mapName)) {
      otherMapsInMode = maps.filter((m) => m.type === mapType && m.name !== mapName).map((m) => m.name)
      const brokenPush = ['Colosseo', 'Esperança']
      if (brokenPush.includes(mapName)) {
        const other = brokenPush.find((n) => n !== mapName)
        if (other) hostNote = `Manually disable ${other} in Push > Maps`
      }
    }

    setSettingsText(generateSettingsText(mapEntry, mapType, bannedNames, otherMapsInMode, hostNote))
  }

  async function copySettings() {
    if (!settingsText) return
    try {
      await navigator.clipboard.writeText(settingsText)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = settingsText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return <div className="settings-gen">Loading maps and heroes...</div>
  }

  const selectedMap = maps.find((m) => m.id === selectedMapId)
  const groupedHeroes = {
    tank: heroes.filter((h) => h.role === 'tank'),
    dps: heroes.filter((h) => h.role === 'damage' || h.role === 'dps'),
    support: heroes.filter((h) => h.role === 'support'),
  }

  const bannedNames = heroes.filter((h) => bannedHeroIds.includes(h.id)).map((h) => h.name)

  return (
    <div className="settings-gen">
      <h2 className="settings-gen__title">OW Settings Generator</h2>
      <p className="settings-gen__desc">
        Select a map and heroes to ban, generate settings, and paste into OW Custom Game → Import to verify.
      </p>

      {error && <p className="settings-gen__error">{error}</p>}

      {/* Map selection */}
      <section className="settings-gen__section">
        <h3 className="settings-gen__label">Map</h3>
        <div className="settings-gen__chips">
          {maps.map((m) => (
            <button
              key={m.id}
              onClick={() => { setSelectedMapId(m.id === selectedMapId ? null : m.id); setSettingsText(null) }}
              className={`settings-gen__chip ${m.id === selectedMapId ? 'settings-gen__chip--active' : ''}`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </section>

      {/* Hero bans */}
      <section className="settings-gen__section">
        <h3 className="settings-gen__label">
          Hero Bans <span className="settings-gen__count">({bannedHeroIds.length} selected)</span>
        </h3>
        {(['tank', 'dps', 'support'] as const).map((role) => (
          <div key={role} className="settings-gen__role-group">
            <p className="settings-gen__role-label">{role.toUpperCase()}</p>
            <div className="settings-gen__chips">
              {groupedHeroes[role].map((h) => {
                const banned = bannedHeroIds.includes(h.id)
                return (
                  <button
                    key={h.id}
                    onClick={() => toggleBan(h.id)}
                    className={`settings-gen__chip settings-gen__chip--${role} ${banned ? 'settings-gen__chip--banned' : ''}`}
                  >
                    {banned && '✕ '}{h.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Generate */}
      <button onClick={generate} className="settings-gen__generate">
        ⚙️ Generate Settings
      </button>

      {/* Output */}
      {settingsText && (
        <section className="settings-gen__output">
          <div className="settings-gen__output-header">
            <div className="settings-gen__output-meta">
              <span className="settings-gen__output-title">Generated Settings</span>
              <span className="settings-gen__output-info">
                Mode: {selectedMap?.type || 'none'} | Bans: {bannedNames.length > 0 ? bannedNames.join(', ') : 'none'}
              </span>
            </div>
            <button onClick={copySettings} className={`settings-gen__copy ${copied ? 'settings-gen__copy--done' : ''}`}>
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
          <pre className="settings-gen__code">{settingsText}</pre>
        </section>
      )}

      {/* Instructions */}
      <div className="settings-gen__instructions">
        <h4>How to Test</h4>
        <ol>
          <li>Select a map and optionally some hero bans above</li>
          <li>Click &quot;Generate Settings&quot;</li>
          <li>Click &quot;Copy&quot;</li>
          <li>In OW: <strong>Play → Custom Game → Create → Settings → Import</strong></li>
          <li>Paste and confirm the settings imported correctly</li>
        </ol>
      </div>
    </div>
  )
}
