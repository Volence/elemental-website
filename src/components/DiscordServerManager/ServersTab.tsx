'use client'

import React, { useState, useEffect } from 'react'

interface BotGuild {
  guildId: string
  name: string
  memberCount: number
  registered: boolean
  registrationId: number | null
  label: string | null
  region: string | null
  isPrimary: boolean
  active: boolean | null
}

const ServersTab = ({ onChange }: { onChange?: () => void }) => {
  const [guilds, setGuilds] = useState<BotGuild[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { label: string; region: string }>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [cmdStatus, setCmdStatus] = useState<Record<string, { ok: boolean; error?: string }>>({})
  const [onboardStatus, setOnboardStatus] = useState<Record<string, { ok: boolean; error?: string }>>({})

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/discord/bot-guilds')
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setGuilds(data.guilds)
      setInviteUrl(data.inviteUrl ?? null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const register = async (g: BotGuild) => {
    const draft = drafts[g.guildId] || { label: g.label || g.name, region: g.region || '' }
    setSubmitting(g.guildId)
    try {
      const res = await fetch('/api/discord/servers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: g.guildId, label: draft.label, region: draft.region }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      if (data.commandStatus) {
        setCmdStatus((m) => ({ ...m, [g.guildId]: { ok: data.commandStatus.ok, error: data.commandStatus.error } }))
      }
      await load()
      onChange?.()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(null)
    }
  }

  const copyOnboarding = async (g: BotGuild) => {
    setSubmitting(g.guildId)
    try {
      const res = await fetch('/api/discord/server/copy-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetGuildId: g.guildId }),
      })
      const data = await res.json()
      setOnboardStatus((m) => ({ ...m, [g.guildId]: { ok: !!data.success, error: data.error } }))
    } catch (e: any) {
      setOnboardStatus((m) => ({ ...m, [g.guildId]: { ok: false, error: e.message } }))
    } finally {
      setSubmitting(null)
    }
  }

  const reRegister = async (g: BotGuild) => {
    setSubmitting(g.guildId)
    try {
      const res = await fetch('/api/discord/servers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: g.guildId, label: g.label || g.name, region: g.region || '' }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      if (data.commandStatus) {
        setCmdStatus((m) => ({ ...m, [g.guildId]: { ok: data.commandStatus.ok, error: data.commandStatus.error } }))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="servers-tab">
      <h3>Servers</h3>
      <p>Discord servers the bot is in. Register a server to manage it from the picker above.</p>
      {inviteUrl && (
        <p className="servers-tab__invite">
          To add another server, <a href={inviteUrl} target="_blank" rel="noreferrer">invite the bot</a> (grants the applications.commands scope), then it appears below to register.
        </p>
      )}
      {error && <p className="servers-tab__error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="servers-tab__list">
          {guilds.map((g) => (
            <div key={g.guildId} className="servers-tab__row">
              <div className="servers-tab__name">
                {g.name} <span className="servers-tab__meta">({g.memberCount} members)</span>
                {g.isPrimary && <span className="servers-tab__badge">primary</span>}
              </div>
              {g.registered ? (
                <div className="servers-tab__registered">
                  <span className="servers-tab__status">Registered{g.region ? ` - ${g.region}` : ''}</span>
                  {cmdStatus[g.guildId] && (
                    <span className={cmdStatus[g.guildId].ok ? 'servers-tab__cmd-ok' : 'servers-tab__cmd-fail'}>
                      {cmdStatus[g.guildId].ok ? 'commands: ok' : `commands: failed - ${cmdStatus[g.guildId].error || 're-invite with applications.commands'}`}
                    </span>
                  )}
                  {!g.isPrimary && (
                    <>
                      <button onClick={() => reRegister(g)} disabled={submitting === g.guildId}>
                        {submitting === g.guildId ? 'Registering...' : 'Re-register commands'}
                      </button>
                      <button onClick={() => copyOnboarding(g)} disabled={submitting === g.guildId}>
                        {submitting === g.guildId ? 'Working...' : 'Copy onboarding'}
                      </button>
                      {onboardStatus[g.guildId] && (
                        <span className={onboardStatus[g.guildId].ok ? 'servers-tab__cmd-ok' : 'servers-tab__cmd-fail'}>
                          {onboardStatus[g.guildId].ok ? 'onboarding: copied' : `onboarding: ${onboardStatus[g.guildId].error || 'failed'}`}
                        </span>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="servers-tab__register">
                  <input
                    placeholder="Label"
                    value={(drafts[g.guildId]?.label) ?? g.name}
                    onChange={(e) => setDrafts((d) => ({ ...d, [g.guildId]: { label: e.target.value, region: d[g.guildId]?.region ?? '' } }))}
                  />
                  <input
                    placeholder="Region (NA/EMEA/SA)"
                    value={(drafts[g.guildId]?.region) ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [g.guildId]: { label: d[g.guildId]?.label ?? g.name, region: e.target.value } }))}
                  />
                  <button onClick={() => register(g)} disabled={submitting === g.guildId}>
                    {submitting === g.guildId ? 'Registering…' : 'Register'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ServersTab
