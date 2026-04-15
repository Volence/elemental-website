'use client'

import React, { useCallback } from 'react'
import { useAllFormFields } from '@payloadcms/ui'
import { ArrowUp, ArrowDown } from 'lucide-react'

/**
 * Roster reorder controls — fixes Payload 3's array reorder bug.
 *
 * Payload 3.73 has a bug where native array moveUp/moveDown only swaps
 * select field values but NOT relationship field values. This component
 * provides correct reorder by reading ALL form field paths for the two
 * rows being swapped and dispatching SET_ALL to swap every sub-field.
 *
 * Usage: Place as a UI field above the `roster` array field in the
 * Teams collection. CSS hides the native broken move buttons.
 */
const RosterReorder: React.FC = () => {
  const [fields, dispatchFields] = useAllFormFields()

  // Collect roster rows from form state
  const getRowCount = useCallback(() => {
    let count = 0
    while (fields[`roster.${count}.role`] !== undefined || fields[`roster.${count}.person`] !== undefined) {
      count++
    }
    return count
  }, [fields])

  const getRowDisplay = useCallback((index: number) => {
    const personField = fields[`roster.${index}.person`]
    const roleField = fields[`roster.${index}.role`]

    // Person value can be a number (ID) or populated object
    let name = 'Empty'
    if (personField?.value) {
      const val = personField.value as any
      if (typeof val === 'object' && val !== null) {
        // Try to find a display string from the field's populated value
        name = val.name || val.discordHandle || val.value?.toString() || `#${val.id || val}`
      } else {
        name = `#${val}`
      }
    }

    // Check the initialValue too — relationship field value might be just the ID
    // but we can check if it was populated initially
    if (name.startsWith('#') && personField?.initialValue) {
      const init = personField.initialValue as any
      if (typeof init === 'object' && init !== null) {
        name = init.name || init.discordHandle || name
      }
    }

    const role = (roleField?.value as string) || ''
    const roleLabel = role === 'tank' ? 'Tank' : role === 'dps' ? 'DPS' : role === 'support' ? 'Support' : '—'

    return { name, role, roleLabel }
  }, [fields])

  const swapRows = useCallback((indexA: number, indexB: number) => {
    const rowCount = getRowCount()
    if (indexA < 0 || indexA >= rowCount || indexB < 0 || indexB >= rowCount) return

    // Collect all field paths for both rows
    const fieldPaths: string[] = []
    for (const key of Object.keys(fields)) {
      if (key.startsWith(`roster.${indexA}.`) || key.startsWith(`roster.${indexB}.`)) {
        // Extract the sub-field name (e.g., "person", "role", "id")
        const parts = key.split('.')
        if (parts.length >= 3) {
          const subField = parts.slice(2).join('.')
          if (!fieldPaths.includes(subField)) {
            fieldPaths.push(subField)
          }
        }
      }
    }

    // For each sub-field, swap values between the two rows
    const updates: { path: string; value: unknown }[] = []
    for (const subField of fieldPaths) {
      const pathA = `roster.${indexA}.${subField}`
      const pathB = `roster.${indexB}.${subField}`
      const valueA = fields[pathA]?.value
      const valueB = fields[pathB]?.value

      updates.push({ path: pathA, value: valueB })
      updates.push({ path: pathB, value: valueA })
    }

    // Dispatch all updates at once
    for (const update of updates) {
      dispatchFields({
        type: 'UPDATE',
        path: update.path,
        value: update.value,
      })
    }
  }, [fields, dispatchFields, getRowCount])

  const rowCount = getRowCount()
  if (rowCount === 0) return null

  const rowData = Array.from({ length: rowCount }, (_, i) => getRowDisplay(i))

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{
        fontSize: '0.6875rem',
        color: 'rgba(255,255,255,0.35)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontWeight: 600,
        marginBottom: '0.5rem',
      }}>
        Reorder Roster
      </div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        {rowData.map((row, index) => (
          <div key={index} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.375rem 0.625rem',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            fontSize: '0.8125rem',
          }}>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => swapRows(index, index - 1)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '4px',
                  padding: '3px',
                  cursor: index === 0 ? 'not-allowed' : 'pointer',
                  opacity: index === 0 ? 0.25 : 0.7,
                  color: 'white',
                  display: 'flex',
                  transition: 'opacity 0.15s',
                }}
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                disabled={index === rowCount - 1}
                onClick={() => swapRows(index, index + 1)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '4px',
                  padding: '3px',
                  cursor: index === rowCount - 1 ? 'not-allowed' : 'pointer',
                  opacity: index === rowCount - 1 ? 0.25 : 0.7,
                  color: 'white',
                  display: 'flex',
                  transition: 'opacity 0.15s',
                }}
              >
                <ArrowDown size={12} />
              </button>
            </div>
            <span style={{
              flex: 1,
              color: 'rgba(255,255,255,0.8)',
              fontWeight: 500,
            }}>
              {row.name}
            </span>
            <span style={{
              padding: '0.125rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.03em',
              background: row.role === 'tank' ? 'rgba(59,130,246,0.2)' :
                          row.role === 'dps' ? 'rgba(239,68,68,0.2)' :
                          row.role === 'support' ? 'rgba(34,197,94,0.2)' :
                          'rgba(255,255,255,0.1)',
              color: row.role === 'tank' ? '#93c5fd' :
                     row.role === 'dps' ? '#fca5a5' :
                     row.role === 'support' ? '#86efac' :
                     'rgba(255,255,255,0.5)',
              border: `1px solid ${
                row.role === 'tank' ? 'rgba(59,130,246,0.3)' :
                row.role === 'dps' ? 'rgba(239,68,68,0.3)' :
                row.role === 'support' ? 'rgba(34,197,94,0.3)' :
                'rgba(255,255,255,0.15)'
              }`,
            }}>
              {row.roleLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default RosterReorder
