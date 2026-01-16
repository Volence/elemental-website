'use client'

import React, { useState } from 'react'
import { useField, useFormFields, Button, toast } from '@payloadcms/ui'

interface RosterMember {
  person?: number | { id: number }
  position?: string
  playerNotes?: string
}

interface OpponentTeam {
  id: number
  name: string
  currentRoster?: RosterMember[]
}

// Note: value is passed by Payload but not needed, destructure to ignore
export default function PopulateRosterButton({ value, ...props }: any) {
  const [loading, setLoading] = useState(false)
  
  // Get the opponentTeam field value
  const opponentTeamField = useFormFields(([fields]) => fields.opponentTeam)
  const opponentTeamValue = opponentTeamField?.value
  
  // Get the rosterSnapshot field to set its value - THIS APPROACH WORKED BEFORE
  const { setValue: setRosterSnapshot, value: currentRoster } = useField<RosterMember[]>({
    path: 'rosterSnapshot',
  })

  const handlePopulate = async () => {
    if (!opponentTeamValue) {
      toast.error('Please select an opponent team first')
      return
    }

    // Extract team ID from value (could be number or object)
    const teamId = typeof opponentTeamValue === 'number' 
      ? opponentTeamValue 
      : (opponentTeamValue as any)?.id || opponentTeamValue

    if (!teamId) {
      toast.error('Could not determine opponent team ID')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/opponent-teams/${teamId}?depth=1`)
      if (!res.ok) {
        throw new Error('Failed to fetch opponent team')
      }
      
      const team: OpponentTeam = await res.json()
      
      if (!team.currentRoster || team.currentRoster.length === 0) {
        toast.info(`${team.name} has no roster members to import`)
        setLoading(false)
        return
      }

      // Transform roster to snapshot format
      const snapshot = team.currentRoster.map(member => ({
        person: typeof member.person === 'object' ? member.person?.id : member.person,
        position: member.position || '',
        nickname: '',
      }))

      // Use setValue from useField - this worked before!
      setRosterSnapshot(snapshot)
      toast.success(`Populated ${snapshot.length} roster members from ${team.name}`)
    } catch (error) {
      console.error('Error populating roster:', error)
      toast.error('Failed to fetch opponent team roster')
    } finally {
      setLoading(false)
    }
  }

  // Use Boolean() to ensure we don't render 0 or other falsy values
  const hasExistingRoster = Boolean(currentRoster && Array.isArray(currentRoster) && currentRoster.length > 0)

  return (
    <div className="populate-roster-button" style={{ marginBottom: '1rem' }}>
      <Button
        onClick={handlePopulate}
        disabled={loading || !opponentTeamValue}
        buttonStyle="secondary"
        size="small"
      >
        {loading ? 'Populating...' : '📋 Populate from Current Roster'}
      </Button>
      {/* Use ternary to avoid rendering falsy values */}
      {hasExistingRoster ? (
        <span style={{ 
          marginLeft: '0.75rem', 
          fontSize: '0.8rem', 
          color: 'rgba(255,255,255,0.5)' 
        }}>
          ⚠️ This will replace existing snapshot
        </span>
      ) : null}
      {!opponentTeamValue ? (
        <span style={{ 
          marginLeft: '0.75rem', 
          fontSize: '0.8rem', 
          color: 'rgba(255,255,255,0.5)' 
        }}>
          Select opponent team first
        </span>
      ) : null}
    </div>
  )
}
