'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { toast } from '@payloadcms/ui'
import { Copy, Send, X, RefreshCw, AlertCircle, Pencil } from 'lucide-react'
import { localDateKey } from '@/utilities/taskDueDate'

interface DigestModalProps {
  isOpen: boolean
  onClose: () => void
  start: Date
  end: Date
}

interface DigestResponse {
  text: string
  channelConfigured: boolean
  roleConfigured: boolean
  taskCount: number
  existingMessage: { messageId: string; sentAt: string; updatedAt: string | null } | null
}

const DEFAULT_FOOTER = 'If anyone wants to take over a post, say so in the thread. Thanks!'

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/**
 * Preview + send the weekly post schedule to Discord in the format the team
 * already writes by hand. If this week was already posted, the default action
 * edits that message in place instead of sending a duplicate.
 */
export const DigestModal: React.FC<DigestModalProps> = ({ isOpen, onClose, start, end }) => {
  const [text, setText] = useState('')
  const [footer, setFooter] = useState(DEFAULT_FOOTER)
  const [info, setInfo] = useState<DigestResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState<'update' | 'new' | null>(null)

  const startKey = localDateKey(start)
  const endKey = localDateKey(end)

  const loadPreview = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/social-media/weekly-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ start: startKey, end: endKey, footer }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to build digest')
      }
      const data: DigestResponse = await res.json()
      setInfo(data)
      setText(data.text)
    } catch (err: any) {
      toast.error(err.message || 'Failed to build digest')
    } finally {
      setLoading(false)
    }
  }, [startKey, endKey, footer])

  useEffect(() => {
    if (isOpen) loadPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, startKey, endKey])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy - select the text and copy manually')
    }
  }

  const handleSend = async (mode: 'update' | 'new') => {
    if (!text.trim()) return
    setSending(mode)
    try {
      const res = await fetch('/api/social-media/weekly-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ start: startKey, end: endKey, send: true, text, footer, mode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to send')
      toast.success(data.updated ? 'Discord message updated' : 'Posted to Discord')
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Failed to send')
    } finally {
      setSending(null)
    }
  }

  if (!isOpen) return null

  const existing = info?.existingMessage ?? null
  const canSend = !loading && !sending && !!text && !!info?.channelConfigured

  return (
    <div className="workboard-modal-overlay" onClick={onClose}>
      <div className="workboard-modal workboard-modal--digest" onClick={(e) => e.stopPropagation()}>
        <div className="workboard-modal__header">
          <div className="workboard-modal__header-title">
            <h2>Post Week to Discord</h2>
            <span className="workboard-modal__request-badge">
              {start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <button className="workboard-modal__close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="workboard-modal__form">
          {existing && (
            <div className="digest-modal__note digest-modal__note--info">
              <Pencil size={14} />
              <span>
                This week is already in Discord (posted {fmt(existing.sentAt)}
                {existing.updatedAt ? `, last updated ${fmt(existing.updatedAt)}` : ''}). <strong>Update</strong> edits that message in place; reassignments and completed check marks also sync automatically when tasks change.
              </span>
            </div>
          )}

          <div className="workboard-modal__field">
            <label>Closing line</label>
            <input
              type="text"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              onBlur={loadPreview}
              placeholder="Optional closing line"
            />
          </div>

          <div className="workboard-modal__field">
            <label>
              Message preview{' '}
              <span className="digest-modal__hint">(Discord markdown - edit freely before sending)</span>
            </label>
            <textarea
              className="digest-modal__text"
              value={loading ? 'Building preview...' : text}
              onChange={(e) => setText(e.target.value)}
              rows={16}
              disabled={loading}
            />
            <div className="digest-modal__meta">
              <span>{text.length} / 2000 characters{text.length > 2000 ? ' (will be split into several messages)' : ''}</span>
              {info && <span>{info.taskCount} post{info.taskCount === 1 ? '' : 's'} this week</span>}
            </div>
          </div>

          {info && !info.channelConfigured && (
            <div className="digest-modal__warning">
              <AlertCircle size={14} /> No Discord channel is configured for the weekly digest. Use Copy and paste it yourself, or ask an admin to set the channel in Settings.
            </div>
          )}
          {info && info.channelConfigured && !info.roleConfigured && (
            <div className="digest-modal__note">
              No role is configured to ping. Set one in Settings if you want the header to mention the Social Manager role.
            </div>
          )}

          <div className="workboard-modal__actions">
            <div className="workboard-modal__danger-actions">
              <button
                type="button"
                className="workboard-modal__btn workboard-modal__btn--archive"
                onClick={loadPreview}
                disabled={loading}
              >
                <RefreshCw size={12} /> Regenerate
              </button>
            </div>
            <div className="workboard-modal__primary-actions">
              <button type="button" className="workboard-modal__btn workboard-modal__btn--secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="workboard-modal__btn workboard-modal__btn--secondary"
                onClick={handleCopy}
                disabled={loading || !text}
              >
                <Copy size={14} /> Copy
              </button>
              {existing ? (
                <>
                  <button
                    type="button"
                    className="workboard-modal__btn workboard-modal__btn--secondary"
                    onClick={() => handleSend('new')}
                    disabled={!canSend}
                    title="Post a fresh message (re-pings the role); the new one becomes the tracked message"
                  >
                    <Send size={14} /> {sending === 'new' ? 'Sending...' : 'Send as new'}
                  </button>
                  <button
                    type="button"
                    className="workboard-modal__btn workboard-modal__btn--primary"
                    onClick={() => handleSend('update')}
                    disabled={!canSend}
                    title="Edit the existing Discord message in place"
                  >
                    <Pencil size={14} /> {sending === 'update' ? 'Updating...' : 'Update Discord message'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="workboard-modal__btn workboard-modal__btn--primary"
                  onClick={() => handleSend('new')}
                  disabled={!canSend}
                  title={info && !info.channelConfigured ? 'Configure a channel in Settings first' : 'Send to the configured Discord channel'}
                >
                  <Send size={14} /> {sending ? 'Sending...' : 'Send to Discord'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DigestModal
