import React from 'react'

export function AboutSection() {
  return (
    <div className="data-consistency-about">
      <p className="data-consistency-about__title">
        <strong>About Data Consistency Checks:</strong>
      </p>
      <ul className="data-consistency-about__list">
        <li>Checks for broken relationships (deleted persons still referenced in teams)</li>
        <li>Identifies people without team assignments</li>
        <li>Detects incomplete rosters (teams with missing positions)</li>
        <li>Finds duplicate names across collections</li>
      </ul>
    </div>
  )
}
