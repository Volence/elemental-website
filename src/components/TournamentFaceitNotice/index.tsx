import React from 'react'

/**
 * Notice component explaining that Tournament Templates are NOT used for FaceIt
 */
export const TournamentFaceitNotice: React.FC = () => {
  return (
    <div className="tournament-faceit-notice">
      <h3 className="tournament-faceit-notice__title">
        ℹ️ FaceIt Tournaments
      </h3>
      <p className="tournament-faceit-notice__content">
        <strong>Tournament Templates are NOT used for FaceIt leagues.</strong><br/>
        FaceIt matches are automatically synced from the FaceIt API using <strong>FaceIt Leagues</strong> (People → FaceIt Leagues).<br/>
        Only use Tournament Templates for manually-scheduled, non-FaceIt tournaments.
      </p>
    </div>
  )
}

export default TournamentFaceitNotice


