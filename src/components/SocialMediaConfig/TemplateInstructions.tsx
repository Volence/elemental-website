'use client'

import React from 'react'

export default function TemplateInstructions() {
  return (
    <div
      style={{
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '2rem',
      }}
    >
      <h3
        style={{
          margin: '0 0 1rem 0',
          color: 'var(--theme-text)',
          fontSize: '1.1rem',
          fontWeight: 600,
        }}
      >
        📝 How to Create Templates
      </h3>
      <ol
        style={{
          margin: 0,
          paddingLeft: '1.5rem',
          color: 'var(--theme-elevation-600)',
          lineHeight: '1.8',
        }}
      >
        <li>
          <strong>Click "Add Post Template"</strong> below to create a new template
        </li>
        <li>
          <strong>Give it a descriptive name</strong> (e.g., "Match Day Announcement", "Weekly
          Stream Promo")
        </li>
        <li>
          <strong>Select the post type</strong> to categorize it (helps with goal tracking)
        </li>
        <li>
          <strong>Write the template text</strong> using placeholders:
          <ul style={{ marginTop: '0.5rem' }}>
            <li>
              Use <code>{'{{placeholderName}}'}</code> format for <strong>any</strong> dynamic value
            </li>
            <li>
              Examples: <code>{'{{team_1}}'}</code>, <code>{'{{team_2}}'}</code>, <code>{'{{matchTime}}'}</code>, <code>{'{{url}}'}</code>
            </li>
            <li>
              The modal will automatically detect all placeholders and create input fields for them!
            </li>
          </ul>
        </li>
        <li>
          <strong>Add media suggestions</strong> (optional) to remind staff what graphics to
          include
        </li>
        <li>
          <strong>Save</strong> - Your team can now use this template from the Social Media
          Dashboard!
        </li>
      </ol>
      <p
        style={{
          marginTop: '1rem',
          marginBottom: 0,
          color: 'var(--theme-elevation-500)',
          fontSize: '0.9rem',
        }}
      >
        💡 <strong>Tip:</strong> Templates help maintain consistent messaging and save time for
        your social media team.
      </p>
    </div>
  )
}

