import React from 'react'

/**
 * Notice component explaining that Tournament Templates are NOT used for FaceIt
 */
export const TournamentFaceitNotice: React.FC = () => {
  return (
    <div style={{
      padding: '16px',
      marginBottom: '24px',
      backgroundColor: '#1a1a2e',
      border: '2px solid #3b82f6',
      borderRadius: '8px',
      color: '#e5e7eb'
    }}>
      <h3 style={{ margin: '0 0 8px 0', color: '#60a5fa', fontSize: '16px', fontWeight: '600' }}>
        ℹ️ FaceIt Tournaments
      </h3>
      <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
        <strong>Tournament Templates are NOT used for FaceIt leagues.</strong><br/>
        FaceIt matches are automatically synced from the FaceIt API using <strong>FaceIt Leagues</strong> (People → FaceIt Leagues).<br/>
        Only use Tournament Templates for manually-scheduled, non-FaceIt tournaments.
      </p>
    </div>
  )
}

export default TournamentFaceitNotice


