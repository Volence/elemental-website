'use client'

import React, { useState, useEffect } from 'react'
import { toast } from '@payloadcms/ui'
import { BarChart3 } from 'lucide-react'
import type { TimeBlockOutcome } from './types'

interface ScrimOutcomeButtonProps {
  opponentName: string
  outcome?: TimeBlockOutcome
  onSaveOutcome: (outcome: TimeBlockOutcome) => void
  availableMaps: Array<{ id: number; name: string }>
}

export const ScrimOutcomeButton: React.FC<ScrimOutcomeButtonProps> = ({
  opponentName,
  outcome,
  onSaveOutcome,
}) => {
  const [showModal, setShowModal] = useState(false)
  const [localOutcome, setLocalOutcome] = useState<NonNullable<TimeBlockOutcome>>(outcome || {})

  useEffect(() => {
    if (showModal) {
      setLocalOutcome(outcome || {})
    }
  }, [showModal, outcome])

  const handleSave = () => {
    onSaveOutcome(localOutcome)
    setShowModal(false)
    toast.success('Scrim outcome saved!')
  }

  const hasOutcome = Boolean(outcome?.ourRating || outcome?.opponentRating || outcome?.worthScrimAgain)

  return (
    <>
      <button
        type="button"
        className={`schedule-editor__outcome-btn ${hasOutcome ? 'schedule-editor__outcome-btn--filled' : ''}`}
        onClick={() => setShowModal(true)}
      >
        {hasOutcome ? <><BarChart3 size={12} /> View Outcome</> : <><BarChart3 size={12} /> Set Outcome</>}
      </button>

      {showModal && (
        <div className="schedule-editor__modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="schedule-editor__modal schedule-editor__modal--outcome"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="schedule-editor__modal-header">
              <span className="schedule-editor__modal-icon"><BarChart3 size={16} /></span>
              <h3>Scrim Outcome{opponentName ? ` vs ${opponentName}` : ''}</h3>
            </div>
            <div className="schedule-editor__modal-body schedule-editor__outcome-form">
              <div className="schedule-editor__outcome-row">
                <div className="schedule-editor__outcome-field">
                  <label>Our Performance</label>
                  <select
                    value={localOutcome.ourRating || ''}
                    onChange={(e) =>
                      setLocalOutcome({
                        ...localOutcome,
                        ourRating: (e.target.value as TimeBlockOutcome['ourRating']) || undefined,
                      })
                    }
                  >
                    <option value="">- Select -</option>
                    <option value="easywin">Easy Win</option>
                    <option value="closewin">Close Win</option>
                    <option value="neutral">Neutral</option>
                    <option value="closeloss">Close Loss</option>
                    <option value="gotrolled">Got Rolled</option>
                  </select>
                </div>
                <div className="schedule-editor__outcome-field">
                  <label>Opponent Strength</label>
                  <select
                    value={localOutcome.opponentRating || ''}
                    onChange={(e) =>
                      setLocalOutcome({
                        ...localOutcome,
                        opponentRating: (e.target.value as TimeBlockOutcome['opponentRating']) || undefined,
                      })
                    }
                  >
                    <option value="">- Select -</option>
                    <option value="weak">Weak</option>
                    <option value="average">Average</option>
                    <option value="strong">Strong</option>
                    <option value="verystrong">Very Strong</option>
                  </select>
                </div>
                <div className="schedule-editor__outcome-field">
                  <label>Scrim Again?</label>
                  <select
                    value={localOutcome.worthScrimAgain || ''}
                    onChange={(e) =>
                      setLocalOutcome({
                        ...localOutcome,
                        worthScrimAgain: (e.target.value as TimeBlockOutcome['worthScrimAgain']) || undefined,
                      })
                    }
                  >
                    <option value="">- Select -</option>
                    <option value="yes">Yes</option>
                    <option value="maybe">Maybe</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>

              <div className="schedule-editor__outcome-field schedule-editor__outcome-field--full">
                <label>Notes</label>
                <textarea
                  placeholder="Areas to improve, observations..."
                  rows={3}
                  value={localOutcome.scrimNotes || ''}
                  onChange={(e) => setLocalOutcome({ ...localOutcome, scrimNotes: e.target.value })}
                />
              </div>
            </div>
            <div className="schedule-editor__modal-actions">
              <button
                type="button"
                className="schedule-editor__modal-cancel"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="schedule-editor__modal-confirm schedule-editor__modal-confirm--outcome"
                onClick={handleSave}
              >
                Save Outcome
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
