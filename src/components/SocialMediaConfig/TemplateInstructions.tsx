'use client'

import React from 'react'
import { FileEdit, Lightbulb } from 'lucide-react'

export default function TemplateInstructions() {
  return (
    <div className="template-instructions">
      <h3 className="template-instructions__title">
        <FileEdit size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> How to Create Templates
      </h3>
      <ol className="template-instructions__list">
        <li>
          <strong>Click &quot;Add Post Template&quot;</strong> below to create a new template
        </li>
        <li>
          <strong>Give it a descriptive name</strong> (e.g., &quot;Match Day Announcement&quot;, &quot;Weekly
          Stream Promo&quot;)
        </li>
        <li>
          <strong>Select the post type</strong> to categorize it (helps with goal tracking)
        </li>
        <li>
          <strong>Write the template text</strong> using placeholders:
          <ul>
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
      <p className="template-instructions__tip">
        <Lightbulb size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> <strong>Tip:</strong> Templates help maintain consistent messaging and save time for
        your social media team.
      </p>
    </div>
  )
}
