'use client'

import React, { useState, useMemo } from 'react'
import { CalendarOff, Plus, Trash2, X, Save, Loader2, Users } from 'lucide-react'
import { useSchedule } from './ScheduleContext'
import './AbsenceManager.css'

export function AbsenceManager() {
  const { data, refreshData } = useSchedule()
  const { absences, authState, team } = data
  const [showForm, setShowForm] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const myAbsences = useMemo(() => {
    if (!authState.discordUser) return []
    return absences.filter(a => a.discordId === authState.discordUser!.id && a.type === 'absence')
  }, [absences, authState.discordUser])

  const teamAbsences = useMemo(() => {
    return absences.filter(a => a.type === 'absence')
  }, [absences])

  const handleSave = async () => {
    if (!startDate || !endDate) {
      setError('Start and end dates are required')
      return
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError('End date must be after start date')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          type: 'absence',
          startDate,
          endDate,
          reason: reason.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }
      setShowForm(false)
      setStartDate('')
      setEndDate('')
      setReason('')
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Failed to save absence')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeleting(id)
    try {
      const res = await fetch(`/api/absences?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Failed to delete absence')
    } finally {
      setDeleting(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getPersonName = (absence: any) => {
    if (typeof absence.person === 'object' && absence.person?.name) return absence.person.name
    return 'Unknown'
  }

  return (
    <div className="absence-mgr">
      <div className="absence-mgr__header">
        <CalendarOff size={20} />
        <h3 className="absence-mgr__title">Absences</h3>
      </div>

      {authState.isAuthenticated && (
        <div className="absence-mgr__section">
          <div className="absence-mgr__section-header">
            <h4 className="absence-mgr__section-title">My Absences</h4>
            {!showForm && (
              <button className="absence-mgr__add-btn" onClick={() => setShowForm(true)}>
                <Plus size={14} />
                Add Absence
              </button>
            )}
          </div>

          {showForm && (
            <div className="absence-mgr__form">
              <div className="absence-mgr__form-row">
                <label className="absence-mgr__form-label">
                  Start
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="absence-mgr__form-input"
                  />
                </label>
                <label className="absence-mgr__form-label">
                  End
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="absence-mgr__form-input"
                  />
                </label>
              </div>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason (optional)"
                maxLength={200}
                className="absence-mgr__form-reason"
              />
              {error && <p className="absence-mgr__error">{error}</p>}
              <div className="absence-mgr__form-actions">
                <button className="absence-mgr__cancel-btn" onClick={() => { setShowForm(false); setError(null) }}>
                  <X size={14} /> Cancel
                </button>
                <button className="absence-mgr__save-btn" onClick={handleSave} disabled={saving}>
                  {saving ? <><Loader2 size={14} className="absence-mgr__spinner" /> Saving...</> : <><Save size={14} /> Save</>}
                </button>
              </div>
            </div>
          )}

          {myAbsences.length === 0 && !showForm && (
            <p className="absence-mgr__empty">No upcoming absences.</p>
          )}

          {myAbsences.map(absence => (
            <div key={absence.id} className="absence-mgr__item">
              <div className="absence-mgr__item-dates">
                {formatDate(absence.startDate)} - {formatDate(absence.endDate)}
              </div>
              {absence.reason && <div className="absence-mgr__item-reason">{absence.reason}</div>}
              <button
                className="absence-mgr__delete-btn"
                onClick={() => handleDelete(absence.id)}
                disabled={deleting === absence.id}
              >
                {deleting === absence.id ? <Loader2 size={14} className="absence-mgr__spinner" /> : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="absence-mgr__section">
        <h4 className="absence-mgr__section-title">
          <Users size={16} />
          Team Absences
        </h4>
        {teamAbsences.length === 0 ? (
          <p className="absence-mgr__empty">No upcoming team absences.</p>
        ) : (
          teamAbsences.map(absence => (
            <div key={absence.id} className="absence-mgr__item absence-mgr__item--team">
              <div className="absence-mgr__item-name">{getPersonName(absence)}</div>
              <div className="absence-mgr__item-dates">
                {formatDate(absence.startDate)} - {formatDate(absence.endDate)}
              </div>
              {absence.reason && <div className="absence-mgr__item-reason">{absence.reason}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
