'use client'

import React, { useState, useEffect } from 'react'
import { toast } from '@payloadcms/ui'
import type { TimeBlockOutcome } from './types'

interface ScrimOutcomeButtonProps {
  opponentName: string
  outcome?: TimeBlockOutcome
  onSaveOutcome: (outcome: TimeBlockOutcome) => void
  availableMaps: Array<{ id: number; name: string }>
}

/**
 * Button component for recording scrim outcomes
 * Extracted from ScheduleEditor for better code organization
 */
export const ScrimOutcomeButton: React.FC<ScrimOutcomeButtonProps> = ({
  opponentName,
  outcome,
  onSaveOutcome,
  availableMaps,
}) => {
  const [showModal, setShowModal] = useState(false)
  const [localOutcome, setLocalOutcome] = useState<NonNullable<TimeBlockOutcome>>(outcome || {})
  const [newMap, setNewMap] = useState({ mapName: '', result: '' as 'win' | 'loss' | 'draw' | '', score: '' })
  const [showMapDropdown, setShowMapDropdown] = useState(false)

  useEffect(() => {
    if (showModal) {
      setLocalOutcome(outcome || {})
    }
  }, [showModal, outcome])

  const handleSave = () => {
    // Validate all maps in the list are valid
    const invalidMaps = (localOutcome.mapsPlayed || []).filter(
      (m) => !availableMaps.some((am) => am.name.toLowerCase() === m.mapName.toLowerCase())
    )
    if (invalidMaps.length > 0) {
      toast.error(`Invalid map(s): ${invalidMaps.map((m) => m.mapName).join(', ')}. Please select from the dropdown.`)
      return
    }
    onSaveOutcome(localOutcome)
    setShowModal(false)
    toast.success('Scrim outcome saved!')
  }

  const addMap = () => {
    // Only add if there's at least a map name
    if (!newMap.mapName.trim()) return
    // Find exact map name if it exists (for proper casing)
    const exactMap = availableMaps.find((m) => m.name.toLowerCase() === newMap.mapName.toLowerCase())
    const mapsPlayed = localOutcome.mapsPlayed || []
    setLocalOutcome({
      ...localOutcome,
      mapsPlayed: [
        ...mapsPlayed,
        {
          mapName: exactMap?.name || newMap.mapName,
          result: (newMap.result || 'win') as 'win' | 'loss' | 'draw',
          score: newMap.score,
        },
      ],
    })
    setNewMap({ mapName: '', result: '', score: '' })
  }

  const removeMap = (index: number) => {
    const mapsPlayed = [...(localOutcome.mapsPlayed || [])]
    mapsPlayed.splice(index, 1)
    setLocalOutcome({ ...localOutcome, mapsPlayed })
  }

  // Check if any maps in the list are invalid
  const hasInvalidMaps = (localOutcome.mapsPlayed || []).some(
    (m) => !availableMaps.some((am) => am.name.toLowerCase() === m.mapName.toLowerCase())
  )

  // Check if there's a pending map entry that's invalid (typed but not added)
  const hasPendingInvalidMap =
    newMap.mapName.trim() !== '' &&
    !availableMaps.some((am) => am.name.toLowerCase() === newMap.mapName.toLowerCase())

  // Block save if any invalid maps or pending invalid input
  const cannotSave = hasInvalidMaps || hasPendingInvalidMap

  const hasOutcome = Boolean(outcome?.ourRating || outcome?.mapsPlayed?.length)

  return (
    <>
      <button
        type="button"
        className={`schedule-editor__outcome-btn ${hasOutcome ? 'schedule-editor__outcome-btn--filled' : ''}`}
        onClick={() => setShowModal(true)}
      >
        {hasOutcome ? '📊 View Outcome' : '📊 Set Outcome'}
      </button>

      {showModal && (
        <div className="schedule-editor__modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="schedule-editor__modal schedule-editor__modal--outcome"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="schedule-editor__modal-header">
              <span className="schedule-editor__modal-icon">📊</span>
              <h3>Scrim Outcome{opponentName ? ` vs ${opponentName}` : ''}</h3>
            </div>
            <div className="schedule-editor__modal-body schedule-editor__outcome-form">
              {/* Ratings Row */}
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
                    <option value="">— Select —</option>
                    <option value="easywin">✅ Easy Win</option>
                    <option value="closewin">🔥 Close Win</option>
                    <option value="neutral">😐 Neutral</option>
                    <option value="closeloss">😓 Close Loss</option>
                    <option value="gotrolled">💀 Got Rolled</option>
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
                    <option value="">— Select —</option>
                    <option value="weak">🟢 Weak</option>
                    <option value="average">🟡 Average</option>
                    <option value="strong">🔴 Strong</option>
                    <option value="verystrong">💀 Very Strong</option>
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
                    <option value="">— Select —</option>
                    <option value="yes">👍 Yes</option>
                    <option value="maybe">🤔 Maybe</option>
                    <option value="no">👎 No</option>
                  </select>
                </div>
              </div>

              {/* Maps Played */}
              <div className="schedule-editor__outcome-maps">
                <label>Maps Played</label>
                {localOutcome.mapsPlayed && localOutcome.mapsPlayed.length > 0 && (
                  <div className="schedule-editor__outcome-map-list">
                    {localOutcome.mapsPlayed.map((m, i) => {
                      const isInvalidMap = !availableMaps.some(
                        (am) => am.name.toLowerCase() === m.mapName.toLowerCase()
                      )
                      return (
                        <div
                          key={i}
                          className={`schedule-editor__outcome-map-item schedule-editor__outcome-map-item--${m.result} ${isInvalidMap ? 'schedule-editor__outcome-map-item--invalid' : ''}`}
                        >
                          <span>
                            {isInvalidMap ? '⚠️ ' : ''}
                            {m.mapName}
                          </span>
                          <span className="schedule-editor__outcome-map-result">
                            {m.result === 'win' ? '✅ W' : m.result === 'loss' ? '❌ L' : '🔄 D'}
                            {m.score && ` (${m.score})`}
                          </span>
                          <button type="button" onClick={() => removeMap(i)}>
                            ×
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="schedule-editor__outcome-add-map">
                  <div className="schedule-editor__map-autocomplete">
                    <input
                      type="text"
                      placeholder="Search map..."
                      value={newMap.mapName}
                      onChange={(e) => {
                        setNewMap({ ...newMap, mapName: e.target.value })
                        setShowMapDropdown(true)
                      }}
                      onFocus={() => setShowMapDropdown(true)}
                      onBlur={() => setTimeout(() => setShowMapDropdown(false), 200)}
                    />
                    {showMapDropdown &&
                      newMap.mapName &&
                      availableMaps.filter((m) => m.name.toLowerCase().includes(newMap.mapName.toLowerCase()))
                        .length > 0 && (
                        <div className="schedule-editor__map-dropdown">
                          {availableMaps
                            .filter((m) => m.name.toLowerCase().includes(newMap.mapName.toLowerCase()))
                            .slice(0, 8)
                            .map((map) => (
                              <button
                                key={map.id}
                                type="button"
                                onClick={() => {
                                  setNewMap({ ...newMap, mapName: map.name })
                                  setShowMapDropdown(false)
                                }}
                              >
                                {map.name}
                              </button>
                            ))}
                        </div>
                      )}
                  </div>
                  <select
                    value={newMap.result}
                    onChange={(e) => setNewMap({ ...newMap, result: e.target.value as 'win' | 'loss' | 'draw' | '' })}
                  >
                    <option value="">Result</option>
                    <option value="win">Win</option>
                    <option value="loss">Loss</option>
                    <option value="draw">Draw</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Score"
                    value={newMap.score}
                    onChange={(e) => setNewMap({ ...newMap, score: e.target.value })}
                  />
                  <button type="button" onClick={addMap}>
                    +
                  </button>
                </div>
              </div>

              {/* Notes */}
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
                className={`schedule-editor__modal-confirm schedule-editor__modal-confirm--outcome ${cannotSave ? 'schedule-editor__modal-confirm--disabled' : ''}`}
                onClick={handleSave}
                disabled={cannotSave}
                title={cannotSave ? 'Fix invalid map names first' : 'Save outcome'}
              >
                {cannotSave ? '⚠️ Fix Invalid Maps' : 'Save Outcome'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
