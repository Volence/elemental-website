'use client'

import React, { useState, useEffect } from 'react'
import { CheckCircle, Loader, Rocket, Palette, Hash, Volume2, MessageSquare, AlertTriangle, Copy } from 'lucide-react'
import { Modal } from './Modal'

interface TeamInfo {
  id: number
  name: string
  brandingPrimary?: string | null
  brandingSecondary?: string | null
  discordProvisioned?: boolean
  discordTeamRoleId?: string | null
  discordAccessRoleId?: string | null
  discordCategoryId?: string | null
  discordEmoji?: string | null
}

interface ProvisionResult {
  success: boolean
  team: { id: number; name: string }
  roles: {
    team: { id: string; name: string; color: string }
    access: { id: string; name: string; color: string }
  }
  category: { id: string; name: string }
  channels: Array<{ id: string; name: string; type: number }>
  forumThreadIds: Record<string, string>
  colorInfo: {
    primary: string
    accessColor: string
    note: string
  }
  error?: string
}

interface ProvisionTeamTabProps {
  onAlert: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void
}

export default function ProvisionTeamTab({ onAlert }: ProvisionTeamTabProps) {
  const [teams, setTeams] = useState<TeamInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [emoji, setEmoji] = useState('⚡')
  const [provisioning, setProvisioning] = useState(false)
  const [result, setResult] = useState<ProvisionResult | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/teams?limit=100&depth=0&sort=name', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setTeams(
          data.docs.map((t: any) => ({
            id: t.id,
            name: t.name,
            brandingPrimary: t.brandingPrimary,
            brandingSecondary: t.brandingSecondary,
            discordProvisioned: t.discordProvisioned || false,
            discordTeamRoleId: t.discordTeamRoleId,
            discordAccessRoleId: t.discordAccessRoleId,
            discordCategoryId: t.discordCategoryId,
            discordEmoji: t.discordEmoji,
          })),
        )
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)
  const unprovisionedTeams = teams.filter((t) => !t.discordProvisioned)
  const provisionedTeams = teams.filter((t) => t.discordProvisioned)

  /**
   * Lighten a hex color by a percentage (matching the server-side logic)
   */
  const lightenColor = (hex: string, amount: number): string => {
    const h = hex.replace('#', '')
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    const lr = Math.min(255, Math.round(r + (255 - r) * amount))
    const lg = Math.min(255, Math.round(g + (255 - g) * amount))
    const lb = Math.min(255, Math.round(b + (255 - b) * amount))
    return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
  }

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleProvision = async () => {
    if (!selectedTeamId || !selectedTeam) return

    if (!selectedTeam.brandingPrimary) {
      onAlert('Missing Branding', `Team "${selectedTeam.name}" has no branding colors set. Please set brandingPrimary first.`, 'warning')
      return
    }

    setShowConfirm(true)
  }

  const executeProvision = async () => {
    if (!selectedTeamId || !selectedTeam) return
    setShowConfirm(false)

    setProvisioning(true)
    setResult(null)

    try {
      const response = await fetch('/api/discord/provision-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamId: selectedTeamId, emoji }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Provisioning failed')
      }

      setResult(data)
      onAlert('Success', `Discord provisioned for "${selectedTeam.name}"!`, 'success')
      // Refresh team list to update provisioned status
      await fetchTeams()
    } catch (error: any) {
      onAlert('Error', error.message || 'Provisioning failed', 'error')
      setResult({ success: false, error: error.message } as any)
    } finally {
      setProvisioning(false)
    }
  }

  if (loading) {
    return <div className="loading-state">Loading teams...</div>
  }

  return (
    <div className="provision-team-tab">
      <div className="provision-header">
        <h3>
          <Rocket size={14} /> Provision Team
        </h3>
        <p className="description">
          One-click Discord setup for new teams. Creates roles, channels, permissions, and forum
          posts automatically.
        </p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{teams.length}</div>
          <div className="stat-label">Total Teams</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-value--success">{provisionedTeams.length}</div>
          <div className="stat-label">Provisioned</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-value--warning">{unprovisionedTeams.length}</div>
          <div className="stat-label">Not Provisioned</div>
        </div>
      </div>

      {/* Provision Form */}
      <div className="provision-form">
        <div className="provision-form__row">
          <div className="provision-form__field provision-form__field--team">
            <label>Select Team</label>
            <select
              value={selectedTeamId || ''}
              onChange={(e) => {
                setSelectedTeamId(e.target.value ? Number(e.target.value) : null)
                setResult(null)
              }}
            >
              <option value="">Choose a team...</option>
              <optgroup label="Not Provisioned">
                {unprovisionedTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.brandingPrimary ? '' : '⚠️ No colors'}
                  </option>
                ))}
              </optgroup>
              {provisionedTeams.length > 0 && (
                <optgroup label="Already Provisioned">
                  {provisionedTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      ✅ {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="provision-form__field provision-form__field--emoji">
            <label>Category Emoji</label>
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="⚡"
              maxLength={4}
            />
          </div>
        </div>

        {/* Preview */}
        {selectedTeam && (
          <div className="provision-preview">
            <div className="provision-preview__category">
              <Hash size={12} />
              <span>{emoji}|====== T. {selectedTeam.name} ======|{emoji}</span>
            </div>

            <div className="provision-preview__channels">
              <div className="provision-preview__channel">
                <Hash size={10} /> {selectedTeam.name.toLowerCase()}-chat
              </div>
              <div className="provision-preview__channel">
                <Hash size={10} /> {selectedTeam.name.toLowerCase()}-announcements
              </div>
              <div className="provision-preview__channel">
                <MessageSquare size={10} /> {selectedTeam.name.toLowerCase()}-team-info
              </div>
              <div className="provision-preview__channel">
                <MessageSquare size={10} /> {selectedTeam.name.toLowerCase()}-coaching
              </div>
              <div className="provision-preview__channel">
                <Hash size={10} /> {selectedTeam.name.toLowerCase()}-private-chat
              </div>
              <div className="provision-preview__channel">
                <Volume2 size={10} /> {selectedTeam.name} VC
              </div>
              <div className="provision-preview__channel">
                <Volume2 size={10} /> {selectedTeam.name} Private
              </div>
            </div>

            {/* Color Preview */}
            {selectedTeam.brandingPrimary && (
              <div className="provision-preview__colors">
                <Palette size={12} />
                <div className="provision-preview__color-row">
                  <div className="provision-preview__color-item">
                    <div
                      className="provision-preview__color-swatch"
                      style={{ backgroundColor: selectedTeam.brandingPrimary }}
                    />
                    <span>Team {selectedTeam.name}</span>
                    <code
                      className="provision-preview__color-code"
                      onClick={() => handleCopy(selectedTeam.brandingPrimary!, 'primary')}
                      title="Click to copy"
                    >
                      {selectedTeam.brandingPrimary}
                      {copiedField === 'primary' && <span className="copied-badge">✓</span>}
                    </code>
                  </div>
                  <div className="provision-preview__color-item">
                    <div
                      className="provision-preview__color-swatch"
                      style={{
                        backgroundColor: lightenColor(selectedTeam.brandingPrimary, 0.2),
                      }}
                    />
                    <span>{selectedTeam.name} Access (20% lighter)</span>
                    <code
                      className="provision-preview__color-code"
                      onClick={() =>
                        handleCopy(
                          lightenColor(selectedTeam.brandingPrimary!, 0.2),
                          'access',
                        )
                      }
                      title="Click to copy"
                    >
                      {lightenColor(selectedTeam.brandingPrimary, 0.2)}
                      {copiedField === 'access' && <span className="copied-badge">✓</span>}
                    </code>
                  </div>
                </div>
                {selectedTeam.brandingSecondary && (
                  <div className="provision-preview__gradient-hint">
                    <span>Team gradient: use</span>
                    <code
                      onClick={() => handleCopy(selectedTeam.brandingPrimary!, 'gradPrimary')}
                      title="Click to copy"
                    >
                      {selectedTeam.brandingPrimary}
                      {copiedField === 'gradPrimary' && <span className="copied-badge">✓</span>}
                    </code>
                    <span>→</span>
                    <code
                      onClick={() => handleCopy(selectedTeam.brandingSecondary!, 'gradSecondary')}
                      title="Click to copy"
                    >
                      {selectedTeam.brandingSecondary}
                      {copiedField === 'gradSecondary' && <span className="copied-badge">✓</span>}
                    </code>
                  </div>
                )}
                {selectedTeam.brandingSecondary && (
                  <div className="provision-preview__gradient-hint">
                    <span>Access gradient: use</span>
                    <code
                      onClick={() => handleCopy(lightenColor(selectedTeam.brandingPrimary!, 0.2), 'gradAccessPrimary')}
                      title="Click to copy"
                    >
                      {lightenColor(selectedTeam.brandingPrimary!, 0.2)}
                      {copiedField === 'gradAccessPrimary' && <span className="copied-badge">✓</span>}
                    </code>
                    <span>→</span>
                    <code
                      onClick={() => handleCopy(lightenColor(selectedTeam.brandingSecondary!, 0.2), 'gradAccessSecondary')}
                      title="Click to copy"
                    >
                      {lightenColor(selectedTeam.brandingSecondary!, 0.2)}
                      {copiedField === 'gradAccessSecondary' && <span className="copied-badge">✓</span>}
                    </code>
                  </div>
                )}
              </div>
            )}

            {/* Already provisioned warning */}
            {selectedTeam.discordProvisioned && (
              <div className="provision-preview__warning">
                <AlertTriangle size={14} />
                <span>
                  This team is already provisioned. Running again will create duplicate roles and
                  channels.
                </span>
              </div>
            )}

            <button
              className="provision-button"
              onClick={handleProvision}
              disabled={provisioning || !selectedTeam.brandingPrimary}
            >
              {provisioning ? (
                <>
                  <Loader size={14} className="spinning" /> Provisioning...
                </>
              ) : (
                <>
                  <Rocket size={14} /> Provision Discord for {selectedTeam.name}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Success Result */}
      {result?.success && (
        <div className="provision-result">
          <div className="provision-result__header">
            <CheckCircle size={16} />
            <h4>Provisioning Complete!</h4>
          </div>

          <div className="provision-result__section">
            <h5>Roles Created</h5>
            <div className="provision-result__item">
              <div
                className="provision-result__color-dot"
                style={{ backgroundColor: result.roles.team.color }}
              />
              <strong>{result.roles.team.name}</strong>
              <code className="provision-result__id">{result.roles.team.id}</code>
            </div>
            <div className="provision-result__item">
              <div
                className="provision-result__color-dot"
                style={{ backgroundColor: result.roles.access.color }}
              />
              <strong>{result.roles.access.name}</strong>
              <code className="provision-result__id">{result.roles.access.id}</code>
            </div>
          </div>

          <div className="provision-result__section">
            <h5>Category</h5>
            <div className="provision-result__item">
              <strong>{result.category.name}</strong>
            </div>
          </div>

          <div className="provision-result__section">
            <h5>Channels ({result.channels.length})</h5>
            {result.channels.map((ch) => (
              <div key={ch.id} className="provision-result__item">
                {ch.type === 2 ? <Volume2 size={10} /> : ch.type === 15 ? <MessageSquare size={10} /> : <Hash size={10} />}
                <span>{ch.name}</span>
              </div>
            ))}
          </div>

          {Object.keys(result.forumThreadIds).length > 0 && (
            <div className="provision-result__section">
              <h5>Forum Threads (auto-saved to team record)</h5>
              {Object.entries(result.forumThreadIds).map(([key, id]) => (
                <div key={key} className="provision-result__item">
                  <span>{key}</span>
                  <code className="provision-result__id">{id}</code>
                </div>
              ))}
            </div>
          )}

          <div className="provision-result__section provision-result__section--colors">
            <h5>
              <Palette size={12} /> Role Colors for Gradient Setup
            </h5>
            <p className="provision-result__hint">
              To set gradients: Discord → Server Settings → Roles → select role → Role Styles → Gradient
            </p>
            <div className="provision-result__color-info">
              <div className="provision-result__color-row">
                <div
                  className="provision-result__color-swatch"
                  style={{ backgroundColor: result.colorInfo.primary }}
                />
                <span>Team Role Primary:</span>
                <code
                  onClick={() => handleCopy(result.colorInfo.primary, 'resultPrimary')}
                  title="Click to copy"
                >
                  {result.colorInfo.primary}
                  {copiedField === 'resultPrimary' && <span className="copied-badge">✓</span>}
                </code>
              </div>
              <div className="provision-result__color-row">
                <div
                  className="provision-result__color-swatch"
                  style={{ backgroundColor: result.colorInfo.accessColor }}
                />
                <span>Access Role (20% lighter):</span>
                <code
                  onClick={() => handleCopy(result.colorInfo.accessColor, 'resultAccess')}
                  title="Click to copy"
                >
                  {result.colorInfo.accessColor}
                  {copiedField === 'resultAccess' && <span className="copied-badge">✓</span>}
                </code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Result */}
      {result && !result.success && result.error && (
        <div className="provision-result provision-result--error">
          <AlertTriangle size={14} />
          <span>{result.error}</span>
        </div>
      )}

      {/* Provisioned Teams Table */}
      {provisionedTeams.length > 0 && (
        <div className="provisioned-teams">
          <h4>Provisioned Teams ({provisionedTeams.length})</h4>
          <div className="teams-table-container">
            <table className="teams-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Emoji</th>
                  <th>Team Role ID</th>
                  <th>Access Role ID</th>
                  <th>Category ID</th>
                </tr>
              </thead>
              <tbody>
                {provisionedTeams.map((team) => (
                  <tr key={team.id}>
                    <td>
                      <strong>{team.name}</strong>
                    </td>
                    <td>{team.discordEmoji || '—'}</td>
                    <td>
                      {team.discordTeamRoleId ? (
                        <code
                          className="copyable-id"
                          onClick={() => handleCopy(team.discordTeamRoleId!, `team-${team.id}`)}
                          title="Click to copy"
                        >
                          {team.discordTeamRoleId.slice(0, 10)}...
                          {copiedField === `team-${team.id}` && <span className="copied-badge">✓</span>}
                        </code>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {team.discordAccessRoleId ? (
                        <code
                          className="copyable-id"
                          onClick={() => handleCopy(team.discordAccessRoleId!, `access-${team.id}`)}
                          title="Click to copy"
                        >
                          {team.discordAccessRoleId.slice(0, 10)}...
                          {copiedField === `access-${team.id}` && <span className="copied-badge">✓</span>}
                        </code>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {team.discordCategoryId ? (
                        <code
                          className="copyable-id"
                          onClick={() => handleCopy(team.discordCategoryId!, `cat-${team.id}`)}
                          title="Click to copy"
                        >
                          {team.discordCategoryId.slice(0, 10)}...
                          {copiedField === `cat-${team.id}` && <span className="copied-badge">✓</span>}
                        </code>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {selectedTeam && (
        <Modal
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          title={`Provision Discord for "${selectedTeam.name}"`}
          size="small"
          footer={
            <>
              <button className="modal-button modal-button-secondary" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button className="modal-button modal-button-success" onClick={executeProvision}>
                <Rocket size={14} /> Provision
              </button>
            </>
          }
        >
          <div className="provision-confirm-content">
            <p>This will create the following on Discord:</p>
            <ul>
              <li><strong>Role:</strong> Team {selectedTeam.name}</li>
              <li><strong>Role:</strong> {selectedTeam.name} Access</li>
              <li><strong>Category:</strong> {emoji}|====== T. {selectedTeam.name} ======|{emoji}</li>
              <li><strong>7 channels</strong> with permissions</li>
              <li><strong>6 forum posts</strong> auto-saved to team record</li>
            </ul>
          </div>
        </Modal>
      )}
    </div>
  )
}
